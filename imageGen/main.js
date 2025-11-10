// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const https = require('https');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const app = express();
const PORT = process.env.PORT || 8080;

// AWS S3 Configuration
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || 'real-estate-brochures-tenori';

// Initialize S3 client
let s3Client = null;
if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) {
  s3Client = new S3Client({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY
    }
  });
  console.log('✅ AWS S3 client initialized');
} else {
  console.log('⚠️  WARNING: AWS credentials not found. S3 upload will be disabled.');
}

// Helper function to upload image to S3
async function uploadToS3(imageBuffer, folder = 'pet-images') {
  if (!s3Client) {
    throw new Error('S3 client not initialized. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env');
  }

  // Generate timestamp-based filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
  const filename = `${folder}/${timestamp}.png`;

  try {
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: filename,
      Body: imageBuffer,
      ContentType: 'image/png'
    });

    await s3Client.send(command);
    
    // Generate public URL
    const s3Url = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${filename}`;
    console.log(`✅ Image uploaded to S3: ${s3Url}`);
    
    return s3Url;
  } catch (error) {
    console.error('❌ S3 upload failed:', error.message);
    throw new Error(`S3 upload failed: ${error.message}`);
  }
}

// Middleware - Increased limit for large base64 images
app.use(express.json({ limit: '50mb' }));
app.use(express.text({ type: 'text/plain', limit: '50mb' }));

// Routes
app.post('/generate-image', async (req, res) => {
  try {
    // Get prompt from request body
    let prompt;
    
    // Handle different content types
    if (typeof req.body === 'string') {
      // Raw text input
      prompt = req.body;
    } else if (req.body && typeof req.body === 'object' && req.body.prompt) {
      // JSON input with prompt field
      prompt = req.body.prompt;
    } else {
      return res.status(400).json({
        error: 'Invalid input. Provide prompt as raw text or JSON with prompt field'
      });
    }

    // Validate prompt
    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({
        error: 'Prompt is required and cannot be empty'
      });
    }

    // Make API call to Segmind using native https module
    const apiKey = process.env.SEGMIND_API_KEY?.trim();
    
    // Validate API key
    if (!apiKey || apiKey === 'YOUR_API_KEY' || apiKey.length < 10) {
      console.error('❌ SEGMIND_API_KEY not found or invalid in environment variables');
      console.error('   Current value:', apiKey ? `${apiKey.substring(0, 5)}...` : 'undefined');
      return res.status(500).json({
        success: false,
        error: 'API key not configured',
        message: 'Please set SEGMIND_API_KEY in your .env file'
      });
    }
    
    console.log('✅ API Key loaded (length:', apiKey.length + ')');
    const requestData = JSON.stringify({
      "prompt": prompt.trim(),
      "steps": 8,
      "seed": -1,
      "guidance": 1,
      "aspect_ratio": "3:4",
      "image_format": "png",
      "quality": 90,
      "base64": false
    });

    const response = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.segmind.com',
        path: '/v1/qwen-image-fast',
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestData)
        }
      };

      const req = https.request(options, (res) => {
        const chunks = [];
        const contentType = res.headers['content-type'] || '';
        
        console.log('📥 Response Status:', res.statusCode);
        console.log('📋 Content-Type:', contentType);
        console.log('📏 Content-Length:', res.headers['content-length'] || 'unknown');
        
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        res.on('end', () => {
          const data = Buffer.concat(chunks);
          
          // Log first few bytes to see what we're getting
          console.log('🔍 First 50 bytes (hex):', data.slice(0, 50).toString('hex'));
          console.log('🔍 First 50 bytes (ascii):', data.slice(0, 50).toString('ascii').replace(/[^\x20-\x7E]/g, '.'));
          
          resolve({
            status: res.statusCode,
            ok: res.statusCode >= 200 && res.statusCode < 300,
            contentType: contentType,
            data: data,
            json: async () => {
              try {
                return JSON.parse(data.toString());
              } catch (e) {
                console.error('❌ JSON parse error:', e.message);
                console.error('   Data preview:', data.slice(0, 200).toString());
                throw new Error('Response is not valid JSON');
              }
            },
            text: async () => data.toString(),
            buffer: async () => data
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(requestData);
      req.end();
    });

    if (response.ok) {
      // Check if response is an image (PNG, JPEG, etc.)
      if (response.contentType && response.contentType.startsWith('image/')) {
        const imageBuffer = await response.buffer();
        const imageSizeKB = (imageBuffer.length / 1024).toFixed(2);
        
        console.log('✅ Received image data');
        console.log(`📊 Image size: ${imageSizeKB} KB (binary)`);
        
        // Upload to S3
        let s3Url = null;
        try {
          s3Url = await uploadToS3(imageBuffer);
        } catch (s3Error) {
          console.error('⚠️  S3 upload failed, but continuing with base64 response:', s3Error.message);
          // Continue with base64 fallback
        }
        
        // Prepare response
        const responseData = {
          success: true,
          contentType: response.contentType,
          size: imageBuffer.length,
          sizeKB: parseFloat(imageSizeKB)
        };
        
        // Add S3 URL if upload was successful
        if (s3Url) {
          responseData.imageUrl = s3Url;
          responseData.image = s3Url; // Also include for backward compatibility
        } else {
          // Fallback to base64 if S3 upload failed
          const base64Image = imageBuffer.toString('base64');
          const dataUri = `data:${response.contentType};base64,${base64Image}`;
          responseData.image = dataUri;
        }
        
        res.json(responseData);
      } else {
        // Try to parse as JSON
        try {
          const result = await response.json();
          res.json({
            success: true,
            data: result
          });
        } catch (jsonError) {
          // If not JSON, return as text
          const textData = await response.text();
          console.log('⚠️  Response is not JSON, returning as text');
          res.json({
            success: true,
            data: textData,
            contentType: response.contentType
          });
        }
      }
    } else {
      const errorText = await response.text();
      console.error('Segmind API Error:', response.status, errorText);
      res.status(response.status).json({
        success: false,
        error: `API Error: ${response.status}`,
        details: errorText
      });
    }
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Send POST requests to http://localhost:${PORT}/generate-image`);
  console.log('Provide prompt as raw text in the request body');
  
  // Check if API key is loaded
  if (process.env.SEGMIND_API_KEY) {
    console.log(`✅ API Key loaded: ${process.env.SEGMIND_API_KEY.substring(0, 10)}...`);
  } else {
    console.log('⚠️  WARNING: SEGMIND_API_KEY not found in .env file');
    console.log('   Please create a .env file with: SEGMIND_API_KEY=your_key_here');
  }
  
  // Check if AWS credentials are loaded
  if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) {
    console.log(`✅ AWS S3 configured: ${S3_BUCKET_NAME} (${AWS_REGION})`);
  } else {
    console.log('⚠️  WARNING: AWS credentials not found in .env file');
    console.log('   Please set: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME');
    console.log('   Images will be returned as base64 data URIs instead of S3 URLs');
  }
});
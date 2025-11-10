from fastapi import FastAPI, HTTPException, BackgroundTasks, File, UploadFile
from pydantic import BaseModel
import requests
import asyncio
from typing import Dict
import json
from datetime import datetime
from dotenv import load_dotenv
import os
import base64
from pathlib import Path
import boto3
from botocore.exceptions import ClientError

# Load environment variables
load_dotenv()

app = FastAPI(title="Image to Video API", description="Generate emotional videos from images")

# Configuration
SEGMIND_API_URL = "https://api.segmind.com/v1/wan-2.2-i2v-fast"
SEGMIND_API_KEY = os.getenv("SEGMIND_API_KEY")

# AWS S3 Configuration
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
S3_BUCKET_NAME = "real-estate-brochures-tenori"

# Validate API keys
if not SEGMIND_API_KEY:
    raise ValueError("SEGMIND_API_KEY not found in environment variables. Please check your .env file.")

if not all([AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY]):
    raise ValueError("AWS credentials not found in environment variables. Please check your .env file.")

# Initialize S3 client
s3_client = boto3.client(
    's3',
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION
)

# Create directories if they don't exist
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
VIDEO_DIR = Path("videos")
VIDEO_DIR.mkdir(exist_ok=True)

# Emotion prompts
EMOTION_PROMPTS = {
    "happy": "The subject is happy and jumping JOYFULLY",
    "sad": "The subject is CRYING VERY MUCH and is in AGONY, TEARS rolling out",
    "angry": "The subject is EXTREMELY angry and is looking for a fight"
}

# Default video configuration
DEFAULT_CONFIG = {
    "resolution": "480p",
    "aspect_ratio": "1:1",  # Square video
    "num_frames": 81,
    "frames_per_second": 16
}

# Response model
class VideoGenerationResponse(BaseModel):
    job_id: str
    status: str
    message: str
    videos: Dict[str, str] = {}

# In-memory storage for job status (use Redis/DB in production)
jobs_storage: Dict[str, Dict] = {}

async def upload_to_s3(file: UploadFile, folder: str = "video-generation") -> str:
    """Upload file to S3 and return public URL"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    file_extension = Path(file.filename).suffix or '.jpg'
    filename = f"{folder}/{timestamp}{file_extension}"
    
    try:
        contents = await file.read()
        
        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=filename,
            Body=contents,
            ContentType=file.content_type or 'image/jpeg'
        )
        
        s3_url = f"https://{S3_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{filename}"
        return s3_url
        
    except ClientError as e:
        raise Exception(f"S3 upload failed: {str(e)}")
    except Exception as e:
        raise Exception(f"Failed to process file: {str(e)}")

def upload_video_to_s3(video_data: bytes, emotion: str, job_id: str) -> str:
    """Upload generated video to S3"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    filename = f"generated-videos/{job_id}/{emotion}_{timestamp}.mp4"
    
    try:
        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=filename,
            Body=video_data,
            ContentType='video/mp4'
        )
        
        s3_url = f"https://{S3_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{filename}"
        return s3_url
        
    except ClientError as e:
        raise Exception(f"S3 video upload failed: {str(e)}")

def generate_video(image_url: str, emotion: str, config: dict, job_id: str) -> dict:
    """Generate a single video for an emotion using image URL"""
    headers = {
        "x-api-key": SEGMIND_API_KEY,
        "Content-Type": "application/json"
    }
    
    # Prepare request payload
    payload = {
        "image": image_url,
        "prompt": EMOTION_PROMPTS[emotion],
        "num_frames": config.get("num_frames", 81),
        "resolution": config.get("resolution", "480p"),
        "aspect_ratio": config.get("aspect_ratio", "1:1"),
        "frames_per_second": config.get("frames_per_second", 16),
        "sample_shift": 12,
        "high_noise_lora_scale": 1,
        "low_noise_lora_scale": 1,
        "go_fast": True
    }
    
    try:
        print(f"Sending request to Segmind for {emotion} emotion...")
        
        response = requests.post(
            SEGMIND_API_URL, 
            headers=headers, 
            json=payload,
            timeout=120
        )
        
        print(f"Response status code: {response.status_code}")
        print(f"Response content type: {response.headers.get('content-type')}")
        
        if response.status_code == 200:
            # Check if response is video/mp4
            if response.headers.get('content-type') == 'video/mp4':
                # Save video locally first
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
                local_filename = f"{emotion}_{timestamp}.mp4"
                local_path = VIDEO_DIR / local_filename
                
                with open(local_path, 'wb') as f:
                    f.write(response.content)
                
                print(f"Video saved locally: {local_path}")
                
                # Upload to S3
                try:
                    s3_video_url = upload_video_to_s3(response.content, emotion, job_id)
                    print(f"Video uploaded to S3: {s3_video_url}")
                    
                    # Extract metadata from headers
                    metadata = {}
                    if 'x-output-metadata' in response.headers:
                        try:
                            metadata = json.loads(response.headers['x-output-metadata'])
                        except:
                            metadata = {"raw_metadata": response.headers['x-output-metadata']}
                    
                    return {
                        "success": True,
                        "emotion": emotion,
                        "video_url": s3_video_url,
                        "local_path": str(local_path),
                        "metadata": metadata,
                        "generation_time": response.headers.get('x-generation-time'),
                        "credits_remaining": response.headers.get('x-remaining-credits')
                    }
                    
                except Exception as e:
                    return {
                        "success": False,
                        "emotion": emotion,
                        "error": f"Failed to upload video to S3: {str(e)}",
                        "local_path": str(local_path)  # Still return local path as fallback
                    }
            else:
                # Handle unexpected content type
                return {
                    "success": False,
                    "emotion": emotion,
                    "error": f"Unexpected content type: {response.headers.get('content-type')}",
                    "response_preview": response.text[:200] if response.text else "No response content"
                }
        else:
            # Handle HTTP error
            return {
                "success": False,
                "emotion": emotion,
                "error": f"HTTP {response.status_code}: {response.text[:200]}",
                "status_code": response.status_code
            }
            
    except Exception as e:
        return {
            "success": False,
            "emotion": emotion,
            "error": f"Request failed: {str(e)}"
        }

async def process_videos_background(job_id: str, image_url: str, config: dict):
    """Background task to process all three emotions sequentially with 2-second delays"""
    jobs_storage[job_id]["status"] = "processing"
    jobs_storage[job_id]["videos"] = {}
    jobs_storage[job_id]["errors"] = {}
    
    emotions = ["happy", "sad", "angry"]
    
    for i, emotion in enumerate(emotions):
        # Add 2-second delay before each request (except the first one)
        if i > 0:
            await asyncio.sleep(2)
        
        jobs_storage[job_id]["current_emotion"] = emotion
        jobs_storage[job_id]["progress"] = f"Processing {emotion} ({i+1}/3)"
        
        # Generate video (this is a blocking call, wrapped in executor)
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, 
            generate_video, 
            image_url, 
            emotion, 
            config,
            job_id
        )
        
        if result["success"]:
            jobs_storage[job_id]["videos"][emotion] = {
                "video_url": result["video_url"],
                "local_path": result.get("local_path"),
                "metadata": result.get("metadata", {}),
                "generation_time": result.get("generation_time"),
                "credits_remaining": result.get("credits_remaining")
            }
            print(f"Successfully generated {emotion} video: {result['video_url']}")
        else:
            jobs_storage[job_id]["errors"][emotion] = result["error"]
            print(f"Failed to generate {emotion} video: {result['error']}")
    
    # Update final status
    if jobs_storage[job_id]["videos"]:
        jobs_storage[job_id]["status"] = "completed"
        jobs_storage[job_id]["progress"] = f"Generated {len(jobs_storage[job_id]['videos'])}/3 videos"
    else:
        jobs_storage[job_id]["status"] = "failed"
        jobs_storage[job_id]["progress"] = "All video generations failed"
    
    jobs_storage[job_id]["completed_at"] = datetime.now().isoformat()

@app.post("/generate-videos", response_model=VideoGenerationResponse)
async def generate_videos(
    background_tasks: BackgroundTasks,
    image: UploadFile = File(..., description="Image file to animate")
):
    """
    Generate 3 emotional videos from an uploaded image file
    
    Simply upload an image file and get back 3 videos with different emotions:
    - Happy: The subject is happy and jumping joyfully
    - Sad: The subject is crying in agony
    - Angry: The subject is extremely angry
    
    Default settings: 480p, 16:9, 81 frames, 16 FPS
    """
    # Validate file type
    if not image.content_type or not image.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Generate unique job ID
    job_id = f"job_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
    
    # Upload image to S3
    try:
        image_url = await upload_to_s3(image)
        print(f"Image uploaded to S3: {image_url}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to upload image to S3: {str(e)}")
    
    # Initialize job storage
    jobs_storage[job_id] = {
        "status": "queued",
        "image_filename": image.filename,
        "image_url": image_url,
        "created_at": datetime.now().isoformat(),
        "progress": "Job queued",
        "current_emotion": None
    }
    
    # Add background task with default config
    background_tasks.add_task(
        process_videos_background,
        job_id,
        image_url,
        DEFAULT_CONFIG
    )
    
    return VideoGenerationResponse(
        job_id=job_id,
        status="queued",
        message="Video generation started. Use /status/{job_id} to check progress."
    )

@app.get("/status/{job_id}")
async def get_job_status(job_id: str):
    """Get the status of a video generation job"""
    if job_id not in jobs_storage:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = jobs_storage[job_id]
    
    response_data = {
        "job_id": job_id,
        "status": job["status"],
        "progress": job.get("progress", ""),
        "current_emotion": job.get("current_emotion"),
        "created_at": job["created_at"],
        "completed_at": job.get("completed_at"),
        "image_url": job.get("image_url"),
        "videos": {},
        "errors": job.get("errors", {})
    }
    
    # Format videos for response
    for emotion, video_data in job.get("videos", {}).items():
        response_data["videos"][emotion] = {
            "video_url": video_data.get("video_url"),
            "generation_time": video_data.get("generation_time"),
            "credits_remaining": video_data.get("credits_remaining")
        }
    
    return response_data

@app.get("/jobs")
async def list_jobs():
    """List all jobs"""
    return {
        "total_jobs": len(jobs_storage),
        "jobs": [
            {
                "job_id": job_id,
                "status": job["status"],
                "progress": job.get("progress", ""),
                "created_at": job["created_at"],
                "image_url": job.get("image_url")
            }
            for job_id, job in jobs_storage.items()
        ]
    }

@app.get("/")
async def root():
    """API Health check"""
    return {
        "status": "online",
        "service": "Image to Video API",
        "endpoints": {
            "POST /generate-videos": "Generate 3 emotional videos from uploaded image",
            "GET /status/{job_id}": "Check generation status",
            "GET /jobs": "List all jobs",
            "GET /docs": "API documentation"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080, log_level="info")
// Image Generation Service
// Generates pet avatar images using the imagegen API

// Use proxy in development, direct URL in production
const IMAGEGEN_BASE_URL = 'https://imagegen-739298578243.us-central1.run.app'  // Direct URL in production

const IMAGEGEN_API_URL = `${IMAGEGEN_BASE_URL}/generate-image`

export type CreatureType = 'dragon' | 'unicorn' | 'dino'

const STAGE_DESCRIPTIONS: Record<CreatureType, Record<number, { name: string; prompt: string }>> = {
  dragon: {
    0: {
      name: 'Egg',
      prompt: 'a mysterious glowing egg, magical aura, fantasy art style, cosmic energy',
    },
    1: {
      name: 'Baby',
      prompt: 'a cute baby dragon creature, adorable, big eyes, chibi style, kawaii, soft pastel colors',
    },
    2: {
      name: 'Teen',
      prompt: 'a teenage dragon, energetic, playful, vibrant colors, dynamic pose, detailed scales',
    },
    3: {
      name: 'Adult',
      prompt: 'a majestic adult dragon, powerful, elegant, intricate details, epic fantasy art, wings spread',
    },
  },
  unicorn: {
    0: {
      name: 'Egg',
      prompt: 'a mysterious glowing egg, magical aura, fantasy art style, cosmic energy, rainbow sparkles',
    },
    1: {
      name: 'Baby',
      prompt: 'a cute baby unicorn creature, adorable, big eyes, chibi style, kawaii, soft pastel colors, tiny horn',
    },
    2: {
      name: 'Teen',
      prompt: 'a teenage unicorn, energetic, playful, vibrant colors, dynamic pose, flowing mane, magical horn',
    },
    3: {
      name: 'Adult',
      prompt: 'a majestic adult unicorn, powerful, elegant, intricate details, epic fantasy art, flowing rainbow mane, spiraled horn',
    },
  },
  dino: {
    0: {
      name: 'Egg',
      prompt: 'a mysterious glowing egg, magical aura, fantasy art style, cosmic energy, prehistoric patterns',
    },
    1: {
      name: 'Baby',
      prompt: 'a cute baby dinosaur creature, adorable, big eyes, chibi style, kawaii, soft pastel colors, tiny claws',
    },
    2: {
      name: 'Teen',
      prompt: 'a teenage dinosaur, energetic, playful, vibrant colors, dynamic pose, detailed scales, growing spikes',
    },
    3: {
      name: 'Adult',
      prompt: 'a majestic adult dinosaur, powerful, elegant, intricate details, epic fantasy art, impressive size, detailed scales and features',
    },
  },
}

const QUALITY_MODIFIERS = {
  loved: 'bright vibrant colors, healthy appearance, glowing aura, happy expression, surrounded by sparkles',
  neutral: 'balanced colors, normal appearance, peaceful mood',
  neglected: 'muted dark colors, tired appearance, sad expression, dim lighting, shadows',
}

export interface ImageGenerationParams {
  petName: string
  creatureType: CreatureType
  evolutionStage: number
  happiness: number
  hunger: number
  health: number
}

function getLifeQuality(happiness: number, hunger: number, health: number): 'loved' | 'neutral' | 'neglected' {
  const avgScore = (happiness + (100 - hunger) + health) / 3
  if (avgScore >= 70) return 'loved'
  if (avgScore >= 40) return 'neutral'
  return 'neglected'
}

function buildImagePrompt(params: ImageGenerationParams): string {
  const { petName, creatureType, evolutionStage, happiness, hunger, health } = params
  
  const stageDesc = STAGE_DESCRIPTIONS[creatureType][evolutionStage]
  const lifeQuality = getLifeQuality(happiness, hunger, health)
  const qualityMod = QUALITY_MODIFIERS[lifeQuality]

  const fullPrompt = `Professional digital art, ${stageDesc.prompt}, ${qualityMod}, named "${petName}", highly detailed, 8k quality, trending on artstation, concept art`

  return fullPrompt
}

/**
 * Generate pet avatar image
 */
export async function generatePetAvatar(params: ImageGenerationParams): Promise<string> {
  try {
    const prompt = buildImagePrompt(params)
    
    const requestBody = {
      prompt,
    }
    
    console.log('🎨 Generating pet avatar image...')
    console.log('   Prompt:', prompt)
    console.log('   Request Body:', JSON.stringify(requestBody, null, 2))
    console.log('   API URL:', IMAGEGEN_API_URL)
    
    const response = await fetch(IMAGEGEN_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `HTTP ${response.status}: Failed to generate image`)
    }

    const data = await response.json()
    
    if (!data.imageUrl || typeof data.imageUrl !== 'string') {
      throw new Error('Invalid response: imageUrl not found or invalid')
    }

    console.log('✅ Image generated successfully:', data.imageUrl)
    return data.imageUrl
  } catch (error) {
    console.error('❌ Error generating pet avatar:', error)
    throw error
  }
}


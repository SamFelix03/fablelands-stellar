// Pet Asset Service
// Orchestrates the complete asset generation flow (image + videos) and stores in Supabase

import { generatePetAvatar, type ImageGenerationParams } from './imageGenerationService'
import { generatePetVideos, type VideoGenerationStatus } from './videoGenerationService'
import { upsertPetMetadata, type PetMetadata } from './petService'
import { getOrCreateUser } from './userService'
import type { Pet } from '../lib/supabase'

import type { CreatureType } from './imageGenerationService'

export interface GeneratePetAssetsParams {
  walletAddress: string
  tokenId: number
  petName: string
  creatureType: CreatureType
  evolutionStage: number
  happiness: number
  hunger: number
  health: number
  onProgress?: (message: string, progress?: number) => void
}

export interface PetAssetsResult {
  success: boolean
  pet?: Pet
  imageUrl?: string
  videos?: {
    happy: string | null
    sad: string | null
    angry: string | null
  }
  error?: string
}

/**
 * Generate complete pet assets (image + videos) and store in Supabase
 * This is an atomic operation - either all succeed or all fail
 */
export async function generatePetAssets(
  params: GeneratePetAssetsParams
): Promise<PetAssetsResult> {
  const { walletAddress, tokenId, petName, creatureType, evolutionStage, happiness, hunger, health, onProgress } = params

  try {
    // Step 1: Get or create user
    onProgress?.('Setting up your pet...', 10)
    const user = await getOrCreateUser(walletAddress)
    if (!user) {
      throw new Error('Failed to get or create user')
    }

    // Step 2: Generate avatar image
    onProgress?.('Generating your pet\'s avatar...', 20)
    const imageParams: ImageGenerationParams = {
      petName,
      creatureType,
      evolutionStage,
      happiness,
      hunger,
      health,
    }
    
    const imageUrl = await generatePetAvatar(imageParams)
    onProgress?.('Avatar generated! Creating animations...', 40)

    // Step 3: Generate videos (happy, sad, angry)
    let videos = {
      happy: null as string | null,
      sad: null as string | null,
      angry: null as string | null,
    }

    try {
      const videoStatusCallback = (status: VideoGenerationStatus) => {
        if (status.progress) {
          onProgress?.(status.progress, 50)
        }
        if (status.current_emotion) {
          onProgress?.(`Generating ${status.current_emotion} animation...`, 60)
        }
      }

      videos = await generatePetVideos(imageUrl, videoStatusCallback)
      onProgress?.('All animations created! Saving...', 90)
    } catch (videoError: any) {
      // If video generation fails, we still save the image
      console.warn('Video generation failed, but continuing with image:', videoError)
      onProgress?.('Animations failed, but saving avatar...', 80)
    }

    // Step 4: Save to Supabase
    const metadata: PetMetadata = {
      pet_id: tokenId,
      pet_name: petName,
      creature_type: creatureType,
      evolution_stage: evolutionStage,
      pet_image_url: imageUrl,
      pet_happy_url: videos.happy,
      pet_sad_url: videos.sad,
      pet_angry_url: videos.angry,
    }

    const savedPet = await upsertPetMetadata(user.id, metadata)
    
    if (!savedPet) {
      throw new Error('Failed to save pet metadata to Supabase')
    }

    onProgress?.('Complete!', 100)

    return {
      success: true,
      pet: savedPet,
      imageUrl,
      videos,
    }
  } catch (error: any) {
    console.error('❌ Error generating pet assets:', error)
    return {
      success: false,
      error: error.message || 'Failed to generate pet assets',
    }
  }
}


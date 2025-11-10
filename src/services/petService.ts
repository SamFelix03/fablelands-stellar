// Pet Service
// Handles pet metadata operations with Supabase

import { supabase, type Pet } from '../lib/supabase'

export interface PetMetadata {
  pet_id: number
  pet_name: string
  creature_type?: 'dragon' | 'unicorn' | 'dino' | null
  evolution_stage?: number | null // 0=Egg, 1=Baby, 2=Teen, 3=Adult
  pet_image_url?: string | null
  pet_sad_url?: string | null
  pet_happy_url?: string | null
  pet_angry_url?: string | null
}

/**
 * Create or update a pet's metadata
 */
export async function upsertPetMetadata(
  userId: string,
  metadata: PetMetadata
): Promise<Pet | null> {
  try {
    const { data, error } = await supabase
      .from('pets')
      .upsert({
        user_id: userId,
        pet_id: metadata.pet_id,
        pet_name: metadata.pet_name,
        creature_type: metadata.creature_type || null,
        evolution_stage: metadata.evolution_stage !== undefined ? metadata.evolution_stage : null,
        pet_image_url: metadata.pet_image_url || null,
        pet_sad_url: metadata.pet_sad_url || null,
        pet_happy_url: metadata.pet_happy_url || null,
        pet_angry_url: metadata.pet_angry_url || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,pet_id',
      })
      .select()
      .single()

    if (error) {
      console.error('Error upserting pet metadata:', error)
      return null
    }

    return data as Pet | null
  } catch (error) {
    console.error('Error in upsertPetMetadata:', error)
    return null
  }
}

/**
 * Get all pets for a user
 */
export async function getUserPets(userId: string): Promise<Pet[]> {
  try {
    const { data, error } = await supabase
      .from('pets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching user pets:', error)
      return []
    }

    return (data || []) as Pet[]
  } catch (error) {
    console.error('Error in getUserPets:', error)
    return []
  }
}

/**
 * Get pet metadata by user ID and pet ID
 */
export async function getPetMetadata(
  userId: string,
  petId: number
): Promise<Pet | null> {
  try {
    const { data, error } = await supabase
      .from('pets')
      .select('*')
      .eq('user_id', userId)
      .eq('pet_id', petId)
      .single()

    if (error) {
      console.error('Error fetching pet metadata:', error)
      return null
    }

    return data as Pet | null
  } catch (error) {
    console.error('Error in getPetMetadata:', error)
    return null
  }
}

/**
 * Update pet metadata
 */
export async function updatePetMetadata(
  userId: string,
  petId: number,
  updates: Partial<PetMetadata>
): Promise<Pet | null> {
  try {
    const { data, error } = await supabase
      .from('pets')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('pet_id', petId)
      .select()
      .single()

    if (error) {
      console.error('Error updating pet metadata:', error)
      return null
    }

    return data as Pet | null
  } catch (error) {
    console.error('Error in updatePetMetadata:', error)
    return null
  }
}

/**
 * Delete pet metadata
 */
export async function deletePetMetadata(
  userId: string,
  petId: number
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('pets')
      .delete()
      .eq('user_id', userId)
      .eq('pet_id', petId)

    if (error) {
      console.error('Error deleting pet metadata:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error in deletePetMetadata:', error)
    return false
  }
}


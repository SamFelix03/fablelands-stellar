// Supabase Client Configuration
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials not configured. Please add PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY to your .env file')
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
)

// Database Types
export interface User {
  id: string
  wallet_address: string
  created_at: string
  updated_at: string
}

export interface Pet {
  id: string
  user_id: string
  pet_id: number // Token ID from contract
  pet_name: string
  creature_type: 'dragon' | 'unicorn' | 'dino' | null
  evolution_stage: number | null // 0=Egg, 1=Baby, 2=Teen, 3=Adult
  pet_image_url: string | null
  pet_sad_url: string | null
  pet_happy_url: string | null
  pet_angry_url: string | null
  created_at: string
  updated_at: string
}


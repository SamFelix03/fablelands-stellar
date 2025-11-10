// User Service
// Handles user operations with Supabase

import { supabase, type User } from '../lib/supabase'

/**
 * Get or create a user by wallet address
 * Returns the user record, creating it if it doesn't exist
 */
export async function getOrCreateUser(walletAddress: string): Promise<User | null> {
  try {
    // First, try to find existing user
    const { data: existingUser, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single()

    if (existingUser && !findError) {
      return existingUser as User
    }

    // If user doesn't exist, create it
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        wallet_address: walletAddress,
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating user:', createError)
      return null
    }

    return newUser as User
  } catch (error) {
    console.error('Error in getOrCreateUser:', error)
    return null
  }
}

/**
 * Get user by wallet address
 */
export async function getUserByWallet(walletAddress: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single()

    if (error) {
      console.error('Error fetching user:', error)
      return null
    }

    return data as User | null
  } catch (error) {
    console.error('Error in getUserByWallet:', error)
    return null
  }
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching user:', error)
      return null
    }

    return data as User | null
  } catch (error) {
    console.error('Error in getUserById:', error)
    return null
  }
}


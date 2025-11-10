// Hook for managing Supabase user
import { useEffect, useState } from 'react'
import { useWallet } from './useWallet'
import { getOrCreateUser, getUserByWallet } from '../services/userService'
import type { User } from '../lib/supabase'

export function useSupabaseUser() {
  const { address } = useWallet()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!address) {
      setUser(null)
      setLoading(false)
      return
    }

    const loadUser = async () => {
      try {
        setLoading(true)
        setError(null)
        const userData = await getOrCreateUser(address)
        setUser(userData)
      } catch (err) {
        console.error('Error loading user:', err)
        setError(err instanceof Error ? err.message : 'Failed to load user')
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [address])

  const refreshUser = async () => {
    if (!address) return

    try {
      setLoading(true)
      setError(null)
      const userData = await getUserByWallet(address)
      setUser(userData)
    } catch (err) {
      console.error('Error refreshing user:', err)
      setError(err instanceof Error ? err.message : 'Failed to refresh user')
    } finally {
      setLoading(false)
    }
  }

  return {
    user,
    loading,
    error,
    refreshUser,
  }
}


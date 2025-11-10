// Auto Update Hook
// Runs automatic pet state updates every 5 minutes when app is open

import { useEffect, useRef } from 'react'
import { autoUpdateAllPets } from '../services/autoUpdateService'

const UPDATE_INTERVAL = 5 * 60 * 1000 // 5 minutes in milliseconds

export function useAutoUpdate() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isRunningRef = useRef(false)

  useEffect(() => {
    // Get secret key from environment
    const secretKey = import.meta.env?.PUBLIC_AUTO_UPDATE_SECRET_KEY
    
    if (!secretKey || secretKey.trim() === '') {
      console.warn('⚠️ Auto-update secret key not configured. Skipping automatic updates.')
      return
    }

    // Function to perform the update
    const performUpdate = async () => {
      // Skip if tab is hidden (optional - remove if you want updates even when tab is hidden)
      if (document.hidden) {
        console.log('⏸️ Tab is hidden, skipping auto-update...')
        return
      }

      // Prevent concurrent updates
      if (isRunningRef.current) {
        console.log('⏸️ Auto-update already in progress, skipping...')
        return
      }

      isRunningRef.current = true
      try {
        console.log('🔄 Starting automatic pet state update...')
        await autoUpdateAllPets(secretKey)
      } catch (error) {
        console.error('❌ Error in auto-update:', error)
      } finally {
        isRunningRef.current = false
      }
    }

    // Set up interval to run every 5 minutes
    intervalRef.current = setInterval(() => {
      performUpdate()
    }, UPDATE_INTERVAL)

    console.log('✅ Auto-update service started. Will update pets every 5 minutes.')

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
        console.log('🛑 Auto-update service stopped.')
      }
    }
  }, []) // Empty deps - only run once on mount

  return null
}


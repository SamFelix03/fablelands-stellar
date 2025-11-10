// Auto Update Hook
// Runs automatic pet state updates every 5 minutes when app is open

import { useEffect, useRef } from 'react'
import { autoUpdateAllPets } from '../services/autoUpdateService'

// For testing: set to 30 seconds (30000)
// For production: 5 minutes (300000)
const UPDATE_INTERVAL = 5 * 60 * 1000 // 5 minutes in milliseconds
const TEST_MODE = false // Set to true for 30-second intervals for testing

export function useAutoUpdate() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isRunningRef = useRef(false)
  const hasRunOnceRef = useRef(false)

  useEffect(() => {
    // Get secret key from environment
    const secretKey = import.meta.env?.PUBLIC_AUTO_UPDATE_SECRET_KEY
    
    console.log('🔍 Auto-update hook initialized')
    console.log('   Secret key configured:', !!secretKey && secretKey.trim() !== '')
    console.log('   Secret key length:', secretKey?.length || 0)
    console.log('   Secret key starts with:', secretKey?.substring(0, 5) || 'N/A')
    console.log('   All PUBLIC_ env vars:', Object.keys(import.meta.env).filter(k => k.startsWith('PUBLIC_')))
    
    if (!secretKey || secretKey.trim() === '') {
      console.warn('⚠️ Auto-update secret key not configured. Skipping automatic updates.')
      console.warn('   Please add PUBLIC_AUTO_UPDATE_SECRET_KEY to your .env file')
      console.warn('   Then RESTART your dev server (npm run dev)')
      return
    }

    // Function to perform the update
    const performUpdate = async () => {
      const timestamp = new Date().toISOString()
      console.log(`\n🔄 [${timestamp}] Auto-update triggered`)
      
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
        const result = await autoUpdateAllPets(secretKey)
        console.log('✅ Auto-update completed:', result)
      } catch (error) {
        console.error('❌ Error in auto-update:', error)
        if (error instanceof Error) {
          console.error('   Error message:', error.message)
          console.error('   Error stack:', error.stack)
        }
      } finally {
        isRunningRef.current = false
        hasRunOnceRef.current = true
      }
    }

    // Set up interval to run every 5 minutes (or 30 seconds in test mode)
    const interval = TEST_MODE ? 30000 : UPDATE_INTERVAL
    
    // Run immediately on mount (first run)
    console.log('🚀 Running initial auto-update check...')
    performUpdate()

    // Set up interval
    intervalRef.current = setInterval(() => {
      performUpdate()
    }, interval)

    const intervalMinutes = interval / 1000 / 60
    console.log(`✅ Auto-update service started. Will update pets every ${intervalMinutes} ${intervalMinutes === 1 ? 'minute' : 'minutes'}.`)
    console.log(`   Next update in: ${intervalMinutes} ${intervalMinutes === 1 ? 'minute' : 'minutes'}`)
    console.log(`   Test mode: ${TEST_MODE ? 'ENABLED (30s intervals)' : 'DISABLED (5min intervals)'}`)

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


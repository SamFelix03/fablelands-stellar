import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '../hooks/useWallet'
import { getPetInfo, feedPet, playWithPet, updatePetState } from '../services/petworldContract'
import { PetChat } from './PetChat'
import { Button } from './ui/button'

interface PetDetailProps {
  tokenId: number
  onBack: () => void
}

const EVOLUTION_STAGES = ['🥚 Egg', '🐣 Baby', '🦖 Teen', '🐲 Adult']
const STAGE_COLORS = ['#e0e0e0', '#ffeb3b', '#ff9800', '#f44336']

export function PetDetail({ tokenId, onBack }: PetDetailProps) {
  const { address, signTransaction } = useWallet()
  const [petInfo, setPetInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadPetInfo = useCallback(async () => {
    if (!address) return
    try {
      setLoading(true)
      const info = await getPetInfo(tokenId, address)
      if (info) {
        setPetInfo(info)
        setError(null)
      } else {
        setError('Pet not found')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load pet info')
    } finally {
      setLoading(false)
    }
  }, [tokenId, address])

  useEffect(() => {
    if (address) {
      loadPetInfo()
      // Refresh pet info every 30 seconds (less frequent to avoid interference)
      const interval = setInterval(() => {
        loadPetInfo()
      }, 30000)
      return () => clearInterval(interval)
    }
  }, [address, loadPetInfo])

  const handleAction = async (action: 'feed' | 'play' | 'update') => {
    if (!address || !signTransaction) {
      setError('Please connect your wallet')
      return
    }

    try {
      setActionLoading(action)
      setError(null)
      
      let result
      switch (action) {
        case 'feed':
          result = await feedPet(tokenId, address, signTransaction)
          break
        case 'play':
          result = await playWithPet(tokenId, address, signTransaction)
          break
        case 'update':
          result = await updatePetState(tokenId, address, signTransaction)
          break
      }

      if (result.success) {
        // Wait a bit for transaction to settle, then refresh
        // Use a longer delay to ensure transaction is confirmed
        setTimeout(() => {
          loadPetInfo()
        }, 5000)
      } else {
        setError(result.error || 'Action failed')
      }
    } catch (err: any) {
      console.error('Action error:', err)
      setError(err.message || 'Action failed')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="p-10 text-center">
        <p className="text-gray-700">Loading pet information...</p>
      </div>
    )
  }

  if (error && !petInfo) {
    return (
      <div className="p-10 text-center">
        <p className="text-red-600 mb-5">{error}</p>
        <Button onClick={onBack} variant="outline">
          ← Back to Pet List
        </Button>
      </div>
    )
  }

  if (!petInfo) {
    return null
  }

  const stageEmoji = EVOLUTION_STAGES[petInfo.evolutionStage] || '🥚'
  const stageColor = STAGE_COLORS[petInfo.evolutionStage] || '#e0e0e0'

  return (
    <div className="p-5">
      <Button 
        onClick={onBack}
        variant="outline"
        className="mb-5"
      >
        ← Back to Pet List
      </Button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        {/* Left: Pet Info */}
        <div 
          className="bg-white rounded-2xl p-6 shadow-lg"
          style={{ border: `3px solid ${stageColor}` }}
        >
          <div className="text-center mb-6">
            <div className="text-7xl mb-4">
              {stageEmoji}
            </div>
            <h2 className="m-0 mb-2 text-3xl font-bold">{petInfo.name}</h2>
            <div 
              className="inline-block px-4 py-2 rounded-full text-white font-semibold text-sm"
              style={{ background: stageColor }}
            >
              {EVOLUTION_STAGES[petInfo.evolutionStage]}
            </div>
          </div>

          {/* Stats */}
          <div className="mb-6">
            <h3 className="mb-4 text-lg font-semibold">Stats</h3>
            
            <div className="mb-3">
              <div className="flex justify-between mb-1">
                <span>Happiness</span>
                <span className="font-semibold">{petInfo.happiness}/100</span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-yellow-500 to-yellow-300 transition-all duration-500"
                  style={{ width: `${petInfo.happiness}%` }}
                ></div>
              </div>
            </div>

            <div className="mb-3">
              <div className="flex justify-between mb-1">
                <span>Hunger</span>
                <span className="font-semibold">{petInfo.hunger}/100</span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-500"
                  style={{ width: `${petInfo.hunger}%` }}
                ></div>
              </div>
            </div>

            <div className="mb-3">
              <div className="flex justify-between mb-1">
                <span>Health</span>
                <span className="font-semibold">{petInfo.health}/100</span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-pink-600 to-pink-400 transition-all duration-500"
                  style={{ width: `${petInfo.health}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleAction('feed')
              }}
              disabled={actionLoading !== null}
              className="bg-gradient-to-br from-orange-600 to-orange-400 text-white border-0"
              style={{ opacity: actionLoading === 'feed' ? 0.6 : 1 }}
            >
              {actionLoading === 'feed' ? 'Feeding...' : '🍖 Feed'}
            </Button>

            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleAction('play')
              }}
              disabled={actionLoading !== null}
              className="bg-gradient-to-br from-yellow-500 to-yellow-300 text-gray-900 border-0"
              style={{ opacity: actionLoading === 'play' ? 0.6 : 1 }}
            >
              {actionLoading === 'play' ? 'Playing...' : '🎮 Play'}
            </Button>

            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleAction('update')
              }}
              disabled={actionLoading !== null}
              className="col-span-2 bg-gradient-to-br from-blue-500 to-blue-400 text-white border-0"
              style={{ opacity: actionLoading === 'update' ? 0.6 : 1 }}
            >
              {actionLoading === 'update' ? 'Updating...' : '🔄 Update State'}
            </Button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Right: Chat */}
        <div>
          <PetChat
            key={`chat-${tokenId}`}
            petName={petInfo.name}
            evolutionStage={petInfo.evolutionStage}
            happiness={petInfo.happiness}
            hunger={petInfo.hunger}
            health={petInfo.health}
            age={petInfo.age}
          />
        </div>
      </div>
    </div>
  )
}


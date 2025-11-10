import { useState, useEffect, useCallback, useRef } from 'react'
import { useWallet } from '../hooks/useWallet'
import { getPetInfo, feedPet, playWithPet, updatePetState } from '../services/petworldContract'
import { generatePetAssets } from '../services/petAssetService'
import { getPetMetadata, updatePetMetadata } from '../services/petService'
import { useSupabaseUser } from '../hooks/useSupabaseUser'
import type { CreatureType } from './MintPetModal'
import { PetChat } from './PetChat'
import { Button } from './ui/button'
import { StatBar } from './StatBar'
import { PetAvatar } from './PetAvatar'
import { GameSelectionModal } from './GameSelectionModal'
import { MemoryGame } from './MemoryGame'
import { TicTacToe } from './TicTacToe'
import { RockPaperScissors } from './RockPaperScissors'
import { PetTimeline } from './PetTimeline'
import { PetEvolutionModal } from './PetEvolutionModal'
import { PetAchievementsModal } from './PetAchievementsModal'
import { logFeed, logPlay, logEvolution, logUpdateState, logBirth, getPetHistory } from '../services/petHistory'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'

interface PetDetailProps {
  tokenId: number
  onBack: () => void
}

const EVOLUTION_STAGES = ['🥚 Egg', '🐣 Baby', '🦖 Teen', '🐲 Adult']
const STAGE_COLORS = ['#e0e0e0', '#ffeb3b', '#ff9800', '#f44336']

export function PetDetail({ tokenId, onBack }: PetDetailProps) {
  const { address, signTransaction } = useWallet()
  const { user } = useSupabaseUser()
  const [petInfo, setPetInfo] = useState<any>(null)
  const [creatureType, setCreatureType] = useState<CreatureType>('dragon') // Default to dragon
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [activeGame, setActiveGame] = useState<'selection' | 'memory' | 'tictactoe' | 'rps' | null>(null)
  const [showTimeline, setShowTimeline] = useState(false)
  const [showAchievements, setShowAchievements] = useState(false)
  const [showEvolutionModal, setShowEvolutionModal] = useState(false)
  const [evolutionProgress, setEvolutionProgress] = useState({ message: 'Your pet is evolving...', progress: 0 })
  const [evolvingFromStage, setEvolvingFromStage] = useState<number | null>(null)
  const [petMetadata, setPetMetadata] = useState<{
    imageUrl?: string | null
    videoUrls?: {
      happy?: string | null
      sad?: string | null
      angry?: string | null
    }
  } | null>(null)
  const previousStageRef = useRef<number | null>(null)
  const birthLoggedRef = useRef(false)
  const evolutionInProgressRef = useRef(false)

  const loadPetInfo = useCallback(async () => {
    if (!address) return
    try {
      setLoading(true)
      const info = await getPetInfo(tokenId, address)
      if (info) {
        // Get creature type, media URLs, and evolution stage from Supabase metadata
        let storedEvolutionStage: number | null = null
        if (user) {
          const metadata = await getPetMetadata(user.id, tokenId)
          if (metadata) {
            if (metadata.creature_type) {
              setCreatureType(metadata.creature_type as CreatureType)
            } else {
              // Default to dragon if not found (for older pets)
              setCreatureType('dragon')
            }
            
            // Get stored evolution stage
            storedEvolutionStage = metadata.evolution_stage ?? null
            
            // Store media URLs
            setPetMetadata({
              imageUrl: metadata.pet_image_url,
              videoUrls: {
                happy: metadata.pet_happy_url,
                sad: metadata.pet_sad_url,
                angry: metadata.pet_angry_url,
              },
            })
          } else {
            setCreatureType('dragon')
            setPetMetadata(null)
            storedEvolutionStage = null
          }
        }
        
        // Log birth if this is the first time loading this pet
        if (!birthLoggedRef.current) {
          const history = getPetHistory(tokenId)
          if (history.length === 0) {
            logBirth(tokenId, info.name)
            birthLoggedRef.current = true
          }
        }

        // Check for evolution by comparing contract stage with Supabase stored stage
        const contractEvolutionStage = info.evolutionStage
        const hasEvolved = storedEvolutionStage !== null && contractEvolutionStage > storedEvolutionStage

        if (hasEvolved && !evolutionInProgressRef.current && address && user && storedEvolutionStage !== null) {
          const fromStage = storedEvolutionStage
          const toStage = contractEvolutionStage
          
          console.log(`Evolution detected: Stage ${fromStage} -> ${toStage}`)
          
          logEvolution(
            tokenId,
            info.name,
            fromStage,
            toStage,
            EVOLUTION_STAGES[toStage]
          )

          // Trigger asset regeneration for evolved stage
          evolutionInProgressRef.current = true
          setEvolvingFromStage(fromStage)
          setShowEvolutionModal(true)
          
          // Generate new assets for evolved stage
          generatePetAssets({
            walletAddress: address,
            tokenId,
            petName: info.name,
            creatureType: creatureType, // Use the stored creature type
            evolutionStage: toStage,
            happiness: info.happiness,
            hunger: info.hunger,
            health: info.health,
            onProgress: (message, progress) => {
              setEvolutionProgress({
                message,
                progress: progress || 0,
              })
            },
          })
            .then(async (result) => {
              if (result.success) {
                setEvolutionProgress({
                  message: 'Evolution complete!',
                  progress: 100,
                })
                // Update Supabase with new evolution stage
                if (user) {
                  await updatePetMetadata(user.id, tokenId, {
                    evolution_stage: toStage,
                  })
                }
                // Close modal after a short delay
                setTimeout(() => {
                  setShowEvolutionModal(false)
                  evolutionInProgressRef.current = false
                  setEvolutionProgress({ message: 'Your pet is evolving...', progress: 0 })
                }, 1500)
              } else {
                setEvolutionProgress({
                  message: `Error: ${result.error || 'Failed to generate assets'}`,
                  progress: 0,
                })
                evolutionInProgressRef.current = false
              }
            })
            .catch((error) => {
              console.error('Error generating evolution assets:', error)
              setEvolutionProgress({
                message: `Error: ${error.message || 'Failed to generate assets'}`,
                progress: 0,
              })
              evolutionInProgressRef.current = false
            })
        }

        // Always update Supabase with current evolution stage (if user exists)
        if (user && contractEvolutionStage !== storedEvolutionStage) {
          await updatePetMetadata(user.id, tokenId, {
            evolution_stage: contractEvolutionStage,
          })
        }

        // Update previousStageRef for local tracking
        previousStageRef.current = contractEvolutionStage

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
  }, [tokenId, address, user, creatureType])

  useEffect(() => {
    if (address) {
      loadPetInfo()
      // NO AUTOMATIC REFRESH - Only refresh manually after actions
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
        // Log the action before refreshing
        if (petInfo) {
          switch (action) {
            case 'feed':
              logFeed(tokenId, petInfo.name, {
                happiness: petInfo.happiness,
                hunger: petInfo.hunger,
                health: petInfo.health,
              })
              // Store last action for AI context
              localStorage.setItem(`lastAction_${tokenId}`, 'feed')
              break
            case 'play':
              logPlay(tokenId, petInfo.name, {
                happiness: petInfo.happiness,
                hunger: petInfo.hunger,
                health: petInfo.health,
              })
              // Store last action for AI context
              localStorage.setItem(`lastAction_${tokenId}`, 'play')
              break
            case 'update':
              logUpdateState(tokenId, petInfo.name, {
                happiness: petInfo.happiness,
                hunger: petInfo.hunger,
                health: petInfo.health,
              })
              // Store last action for AI context
              localStorage.setItem(`lastAction_${tokenId}`, 'update')
              break
          }
        }

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

  const handleGameWin = (gameName: string) => {
    // Store the game name in localStorage for AI chat context
    localStorage.setItem('lastGameWon', gameName)
    
    // Close the game modal
    setActiveGame(null)
    
    // Trigger the play action to reward the pet
    setTimeout(() => {
      handleAction('play')
    }, 100)
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

  const stageColor = STAGE_COLORS[petInfo.evolutionStage] || '#e0e0e0'

  return (
    <div className="p-5">
      <div className="flex gap-3 mb-2 items-center">
        <Button 
          onClick={onBack}
          variant="outline"
        >
          ← Back to Pet List
        </Button>
        <Button 
          onClick={() => setShowTimeline(true)}
          variant="default"
          className="font-fredoka"
        >
          📜 View Timeline
        </Button>
        <Button 
          onClick={() => setShowAchievements(true)}
          variant="default"
          className="font-fredoka"
        >
          🏆 Achievements
        </Button>
      </div>

      {/* Pet Name and Stage - Absolutely Centered */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <h2 className="m-0 text-4xl font-bold font-chango" style={{
          textShadow: "3px 3px 0px rgba(0,0,0,0.1)",
        }}>
          {petInfo.name}
        </h2>
        <div 
          className="inline-block px-5 py-2 rounded-lg text-white font-bold text-sm border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0)]"
          style={{ background: stageColor }}
        >
          {EVOLUTION_STAGES[petInfo.evolutionStage]}
        </div>
      </div>

      {/* Top Section: Pet Avatar and Stats/Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Left: Pet Avatar - Full Container */}
        <div 
          className="bg-white rounded-2xl p-0 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0)] flex flex-col items-center justify-center overflow-hidden"
          style={{ borderColor: stageColor, minHeight: '350px', maxHeight: '550px' }}
        >
          <PetAvatar 
            evolutionStage={petInfo.evolutionStage} 
            size="xl"
            imageUrl={petMetadata?.imageUrl}
            videoUrls={petMetadata?.videoUrls}
            happiness={petInfo.happiness}
            hunger={petInfo.hunger}
            health={petInfo.health}
            className="w-full h-full"
          />
        </div>

        {/* Right: Stats and Actions */}
        <div 
          className="bg-white rounded-2xl p-8 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0)]"
          style={{ borderColor: stageColor }}
        >
          {/* Stats */}
          <div className="mb-6">
            <h3 className="mb-5 text-2xl font-bold font-fredoka">Stats</h3>
            
            <StatBar
              label="Happiness"
              value={petInfo.happiness}
              max={100}
              color="#ffc107"
            />

            <StatBar
              label="Hunger"
              value={petInfo.hunger}
              max={100}
              color="#ff5722"
            />

            <StatBar
              label="Health"
              value={petInfo.health}
              max={100}
              color="#e91e63"
            />
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-4">
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleAction('feed')
              }}
              disabled={actionLoading !== null}
              className="bg-gradient-to-br from-orange-600 to-orange-400 text-white border-0 text-lg font-bold py-4 font-fredoka"
              style={{ opacity: actionLoading === 'feed' ? 0.6 : 1 }}
            >
              {actionLoading === 'feed' ? 'Feeding...' : '🍖 Feed'}
            </Button>

            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setActiveGame('selection')
              }}
              disabled={actionLoading !== null}
              className="bg-gradient-to-br from-yellow-500 to-yellow-300 text-gray-900 border-0 text-lg font-bold py-4 font-fredoka"
            >
              🎮 Play
            </Button>

            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleAction('update')
              }}
              disabled={actionLoading !== null}
              className="col-span-2 bg-gradient-to-br from-blue-500 to-blue-400 text-white border-0 text-lg font-bold py-4 font-fredoka"
              style={{ opacity: actionLoading === 'update' ? 0.6 : 1 }}
            >
              {actionLoading === 'update' ? 'Refreshing...' : '🔄 Refresh'}
            </Button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border-2 border-red-300 font-bold">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Talk Button - Below everything */}
      <div className="flex justify-center mt-6">
        <Button
          type="button"
          onClick={() => setChatOpen(true)}
          className="w-1/3 bg-gradient-to-br from-pink-500 to-purple-500 text-white border-0 text-xl font-bold py-5 shadow-[6px_6px_0px_0px_rgba(0,0,0)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-fredoka"
        >
          💬 Talk
        </Button>
      </div>

      {/* Chat Modal - Always render but control visibility */}
      <Dialog open={chatOpen} onOpenChange={setChatOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Chat with {petInfo.name}</DialogTitle>
          </DialogHeader>
          <div className="p-0">
            <PetChat
              key={`chat-${tokenId}`}
              petName={petInfo.name}
              evolutionStage={petInfo.evolutionStage}
              happiness={petInfo.happiness}
              hunger={petInfo.hunger}
              health={petInfo.health}
              age={petInfo.age}
              tokenId={tokenId}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Game Modals */}
      {activeGame === 'selection' && (
        <GameSelectionModal
          onGameSelect={setActiveGame}
          onClose={() => setActiveGame(null)}
        />
      )}

      {activeGame === 'memory' && (
        <MemoryGame
          onGameWin={handleGameWin}
          onClose={() => setActiveGame(null)}
        />
      )}

      {activeGame === 'tictactoe' && (
        <TicTacToe
          onGameWin={handleGameWin}
          onClose={() => setActiveGame(null)}
        />
      )}

      {activeGame === 'rps' && (
        <RockPaperScissors
          onGameWin={handleGameWin}
          onClose={() => setActiveGame(null)}
        />
      )}

          {/* Timeline Modal */}
          {showTimeline && petInfo && (
            <PetTimeline
              tokenId={tokenId}
              petName={petInfo.name}
              onClose={() => setShowTimeline(false)}
            />
          )}

          {/* Achievements Modal */}
          {petInfo && (
            <PetAchievementsModal
              petId={tokenId}
              petName={petInfo.name}
              open={showAchievements}
              onOpenChange={setShowAchievements}
            />
          )}

          {/* Evolution Modal */}
          {showEvolutionModal && petInfo && evolvingFromStage !== null && (
            <PetEvolutionModal
              petName={petInfo.name}
              fromStage={evolvingFromStage}
              toStage={petInfo.evolutionStage}
              progress={evolutionProgress.progress}
              message={evolutionProgress.message}
            />
          )}
        </div>
      )
    }


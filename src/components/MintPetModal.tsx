import { useState } from 'react'
import { useWallet } from '../hooks/useWallet'
import { mintPet, getPetInfo } from '../services/petworldContract'
import { generatePetAssets } from '../services/petAssetService'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'
import { PetBirthModal } from './PetBirthModal'

interface MintPetModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onMintSuccess: () => void
}

export type CreatureType = 'dragon' | 'unicorn' | 'dino'

export function MintPetModal({ open, onOpenChange, onMintSuccess }: MintPetModalProps) {
  const { address, signTransaction } = useWallet()
  const [petName, setPetName] = useState('')
  const [creatureType, setCreatureType] = useState<CreatureType>('dragon')
  const [minting, setMinting] = useState(false)
  const [mintError, setMintError] = useState<string | null>(null)
  const [showBirthModal, setShowBirthModal] = useState(false)
  const [birthProgress, setBirthProgress] = useState({ message: 'Your pet is being born...', progress: 0 })
  const [mintedTokenId, setMintedTokenId] = useState<number | null>(null)

  const handleMint = async () => {
    if (!address || !signTransaction || !petName.trim()) {
      setMintError('Please enter a pet name')
      return
    }

    if (petName.trim().length > 20) {
      setMintError('Pet name must be 20 characters or less')
      return
    }

    try {
      setMinting(true)
      setMintError(null)

      const result = await mintPet(petName.trim(), address, signTransaction)

      if (result.success && result.tokenId && !isNaN(result.tokenId)) {
        setMinting(false)
        setMintedTokenId(result.tokenId)
        // Close the mint modal immediately
        onOpenChange(false)
        // Show birth modal after a brief delay to ensure mint modal closes first
        setTimeout(() => {
          setShowBirthModal(true)
        }, 100)
        
        console.log('Mint successful! Hash:', result.hash, 'Token ID:', result.tokenId)
        
        // Wait a bit for transaction to settle, then fetch pet info and generate assets
        setTimeout(async () => {
          try {
            // Fetch pet info to get stats
            const petInfo = await getPetInfo(result.tokenId!, address)
            
            if (!petInfo) {
              throw new Error('Failed to fetch pet info after minting')
            }

            if (!address) {
              throw new Error('Wallet address not available')
            }

            // Generate assets (image + videos)
            const assetResult = await generatePetAssets({
              walletAddress: address,
              tokenId: result.tokenId!,
              petName: petInfo.name,
              creatureType: creatureType,
              evolutionStage: petInfo.evolutionStage,
              happiness: petInfo.happiness,
              hunger: petInfo.hunger,
              health: petInfo.health,
              onProgress: (message, progress) => {
                setBirthProgress({
                  message,
                  progress: progress || 0,
                })
              },
            })

            if (assetResult.success) {
              // Close birth modal and reload pets
              setShowBirthModal(false)
              setPetName('')
              setMintError(null)
              onOpenChange(false)
              onMintSuccess()
            } else {
              // Show error in birth modal
              setBirthProgress({
                message: `Error: ${assetResult.error || 'Failed to generate assets'}`,
                progress: 0,
              })
              // Allow user to retry or close
            }
          } catch (error: any) {
            console.error('Error generating pet assets:', error)
            setBirthProgress({
              message: `Error: ${error.message || 'Failed to generate assets'}`,
              progress: 0,
            })
          }
        }, 2000)
      } else {
        const errorMessage = result.error || 'Failed to mint pet'
        setMintError(errorMessage)
        console.error('Mint failed:', errorMessage)
        console.error('Full result:', result)
        setMinting(false)
      }
    } catch (error: any) {
      setMintError(error.message || 'Failed to mint pet')
    } finally {
      setMinting(false)
    }
  }

  const handleClose = () => {
    if (!minting) {
      setPetName('')
      setCreatureType('dragon')
      setMintError(null)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mint a New Pet</DialogTitle>
          <DialogDescription>
            Give your new pet a name (1-20 characters). Each pet is a unique NFT on the Stellar blockchain.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-4 py-4">
          <div>
            <label className="block mb-2 text-sm font-semibold text-gray-700">
              Pet Name (max 20 characters)
            </label>
            <input
              type="text"
              value={petName}
              onChange={(e) => {
                setPetName(e.target.value.slice(0, 20))
                setMintError(null)
              }}
              placeholder="Enter pet name..."
              maxLength={20}
              disabled={minting}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base font-inherit focus:outline-none focus:border-primary"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !minting && petName.trim()) {
                  handleMint()
                }
              }}
            />
            <p className="mt-2 text-xs text-gray-500">
              {petName.length}/20 characters
            </p>
          </div>

          <div>
            <label className="block mb-2 text-sm font-semibold text-gray-700">
              Creature Type
            </label>
            <select
              value={creatureType}
              onChange={(e) => {
                setCreatureType(e.target.value as CreatureType)
                setMintError(null)
              }}
              disabled={minting}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base font-inherit focus:outline-none focus:border-primary bg-white"
            >
              <option value="dragon">🐲 Dragon</option>
              <option value="unicorn">🦄 Unicorn</option>
              <option value="dino">🦖 Dinosaur</option>
            </select>
          </div>
          
          {mintError && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {mintError}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={minting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleMint}
            disabled={!petName.trim() || minting || petName.trim().length === 0}
          >
            {minting ? 'Minting...' : 'Mint Pet'}
          </Button>
        </DialogFooter>
      </DialogContent>
      
      {/* Birth Modal */}
      {showBirthModal && mintedTokenId && (
        <PetBirthModal
          petName={petName.trim()}
          tokenId={mintedTokenId}
          progress={birthProgress.progress}
          message={birthProgress.message}
          onComplete={() => {
            setShowBirthModal(false)
            setPetName('')
            setMintError(null)
            onOpenChange(false)
            onMintSuccess()
          }}
          onError={(error) => {
            setBirthProgress({
              message: `Error: ${error}. Please try again.`,
              progress: 0,
            })
            // Keep modal open so user can see the error
          }}
        />
      )}
    </Dialog>
  )
}


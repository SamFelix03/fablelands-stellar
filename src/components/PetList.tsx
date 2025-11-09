import { useState, useEffect } from 'react'
import { useWallet } from '../hooks/useWallet'
import { getUserPets, getPetInfo, mintPet } from '../services/petworldContract'
import { Button } from './ui/button'

interface PetListProps {
  onSelectPet: (tokenId: number) => void
  selectedPetId: number | null
}

const EVOLUTION_STAGES = ['🥚', '🐣', '🦖', '🐲']

export function PetList({ onSelectPet, selectedPetId }: PetListProps) {
  const { address, signTransaction } = useWallet()
  const [pets, setPets] = useState<Array<{ tokenId: number; name: string; stage: number }>>([])
  const [loading, setLoading] = useState(true)
  const [showMintForm, setShowMintForm] = useState(false)
  const [petName, setPetName] = useState('')
  const [minting, setMinting] = useState(false)
  const [mintError, setMintError] = useState<string | null>(null)

  useEffect(() => {
    if (address) {
      loadPets()
    }
  }, [address])

  const loadPets = async () => {
    if (!address) return

    try {
      setLoading(true)
      console.log('Loading pets for address:', address)
      const petIds = await getUserPets(address)
      console.log('Got pet IDs:', petIds)
      
      if (petIds.length === 0) {
        console.log('No pets found for this address')
        setPets([])
        setLoading(false)
        return
      }
      
      // Load pet info for each pet
      const petsData = await Promise.all(
        petIds.map(async (tokenId) => {
          try {
            const info = await getPetInfo(tokenId, address)
            console.log(`Pet ${tokenId} info:`, info)
            return info ? { tokenId, name: info.name, stage: info.evolutionStage } : null
          } catch (error) {
            console.error(`Error loading pet ${tokenId}:`, error)
            return null
          }
        })
      )

      const validPets = petsData.filter(p => p !== null) as Array<{ tokenId: number; name: string; stage: number }>
      console.log('Valid pets:', validPets)
      setPets(validPets)
    } catch (error) {
      console.error('Error loading pets:', error)
      setPets([])
    } finally {
      setLoading(false)
    }
  }

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

      if (result.success) {
        setPetName('')
        setShowMintForm(false)
        setMintError(null)
        
        console.log('Mint successful! Hash:', result.hash, 'Token ID:', result.tokenId)
        
        // Show success message
        if (result.tokenId) {
          console.log(`Pet minted with token ID: ${result.tokenId}`)
        }
        
        // Wait for transaction to fully settle (test.js waits 5 seconds)
        // The transaction should already be confirmed by invokeContract, but wait a bit more
        // to ensure the state is fully updated on-chain
        setTimeout(() => {
          console.log('Reloading pets after mint...')
          loadPets()
        }, 2000) // Reduced since we already wait in invokeContract
      } else {
        setMintError(result.error || 'Failed to mint pet')
        console.error('Mint failed:', result.error)
      }
    } catch (error: any) {
      setMintError(error.message || 'Failed to mint pet')
    } finally {
      setMinting(false)
    }
  }

  if (!address) {
    return (
      <div className="p-10 text-center">
        <p className="text-gray-700">Please connect your wallet to view your pets</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-10 text-center">
        <p className="text-gray-700">Loading your pets...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-3xl font-bold m-0">Your Pets</h2>
        <div className="flex gap-3 items-center">
          <Button
            onClick={loadPets}
            disabled={loading}
            variant="outline"
            size="sm"
            title="Refresh pet list"
          >
            🔄 {loading ? 'Loading...' : 'Refresh'}
          </Button>
          {pets.length > 0 && (
            <Button
              onClick={() => setShowMintForm(!showMintForm)}
              variant={showMintForm ? "outline" : "default"}
              size="default"
            >
              {showMintForm ? 'Cancel' : '+ Mint New Pet'}
            </Button>
          )}
        </div>
      </div>

      {showMintForm && (
        <div className="bg-white rounded-2xl p-6 mb-5 border-2 border-gray-200 shadow-lg">
          <h3 className="m-0 mb-4 text-xl font-bold">Mint a New Pet</h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block mb-2 text-sm font-semibold text-gray-600">
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
            <Button
              onClick={handleMint}
              disabled={!petName.trim() || minting || petName.trim().length === 0}
              size="default"
            >
              {minting ? 'Minting...' : '✨ Mint Pet'}
            </Button>
          </div>
          {mintError && (
            <div className="mt-3 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {mintError}
            </div>
          )}
        </div>
      )}

      {pets.length === 0 && !showMintForm && (
        <div className="p-10 text-center bg-white rounded-2xl border-2 border-gray-200">
          <div className="text-6xl mb-4">🥚</div>
          <p className="text-lg mb-2 font-semibold">You don't have any pets yet!</p>
          <p className="text-sm text-gray-600 mb-5">
            Mint your first pet to get started
          </p>
          <Button
            onClick={() => setShowMintForm(true)}
            size="lg"
          >
            + Mint Your First Pet
          </Button>
        </div>
      )}

      {pets.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
          {pets.map((pet) => (
            <div
              key={pet.tokenId}
              onClick={() => onSelectPet(pet.tokenId)}
              className={`bg-white rounded-2xl p-5 cursor-pointer transition-all text-center ${
                selectedPetId === pet.tokenId 
                  ? 'border-4 border-primary shadow-lg' 
                  : 'border-2 border-gray-200 hover:border-primary hover:shadow-lg hover:-translate-y-1'
              }`}
            >
              <div className="text-5xl mb-3">
                {EVOLUTION_STAGES[pet.stage] || '🥚'}
              </div>
              <h3 className="m-0 mb-2 text-lg font-semibold">{pet.name}</h3>
              <p className="m-0 text-sm text-gray-600">
                ID: {pet.tokenId}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


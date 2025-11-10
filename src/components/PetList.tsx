import { useState, useEffect } from 'react'
import { useWallet } from '../hooks/useWallet'
import { getUserPets, getPetInfo } from '../services/petworldContract'
import { Button } from './ui/button'
import { MintPetModal } from './MintPetModal'
import { PetCard } from './PetCard'

interface PetListProps {
  onSelectPet: (tokenId: number) => void
  selectedPetId: number | null
}

export function PetList({ onSelectPet, selectedPetId }: PetListProps) {
  const { address } = useWallet()
  const [pets, setPets] = useState<Array<{ 
    tokenId: number
    name: string
    stage: number
    happiness: number
    hunger: number
    health: number
  }>>([])
  const [loading, setLoading] = useState(true)
  const [showMintModal, setShowMintModal] = useState(false)

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
            if (!info) {
              console.warn(`No info returned for pet ${tokenId}`)
              return null
            }
            
            // Ensure all required fields are present and valid
            const petData = {
              tokenId, 
              name: info.name || `Pet #${tokenId}`, 
              stage: typeof info.evolutionStage === 'number' ? info.evolutionStage : 0,
              happiness: typeof info.happiness === 'number' && !isNaN(info.happiness) ? info.happiness : 0,
              hunger: typeof info.hunger === 'number' && !isNaN(info.hunger) ? info.hunger : 0,
              health: typeof info.health === 'number' && !isNaN(info.health) ? info.health : 0,
            }
            
            console.log(`Pet ${tokenId} parsed data:`, petData)
            return petData
          } catch (error) {
            console.error(`Error loading pet ${tokenId}:`, error)
            // Return a pet with default values instead of null
            return {
              tokenId,
              name: `Pet #${tokenId}`,
              stage: 0,
              happiness: 0,
              hunger: 0,
              health: 0,
            }
          }
        })
      )

      // Filter out null values and ensure all pets have valid data
      const validPets = petsData
        .filter(p => p !== null)
        .map(p => ({
          tokenId: p!.tokenId,
          name: p!.name || `Pet #${p!.tokenId}`,
          stage: typeof p!.stage === 'number' ? p!.stage : 0,
          happiness: typeof p!.happiness === 'number' && !isNaN(p!.happiness) ? p!.happiness : 0,
          hunger: typeof p!.hunger === 'number' && !isNaN(p!.hunger) ? p!.hunger : 0,
          health: typeof p!.health === 'number' && !isNaN(p!.health) ? p!.health : 0,
        })) as Array<{ 
          tokenId: number
          name: string
          stage: number
          happiness: number
          hunger: number
          health: number
        }>
      console.log('Valid pets with stats:', validPets)
      setPets(validPets)
    } catch (error) {
      console.error('Error loading pets:', error)
      setPets([])
    } finally {
      setLoading(false)
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
          <Button
            onClick={() => setShowMintModal(true)}
            variant="default"
            size="default"
          >
            + Mint New Pet
          </Button>
        </div>
      </div>

      {pets.length === 0 && (
        <div className="p-10 text-center bg-white rounded-2xl border-2 border-gray-200">
          <div className="text-6xl mb-4">🥚</div>
          <p className="text-lg mb-2 font-semibold">You don't have any pets yet!</p>
          <p className="text-sm text-gray-600 mb-5">
            Mint your first pet to get started
          </p>
          <Button
            onClick={() => setShowMintModal(true)}
            size="lg"
          >
            + Mint Your First Pet
          </Button>
        </div>
      )}

      {pets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {pets.map((pet) => (
            <PetCard
              key={pet.tokenId}
              tokenId={pet.tokenId}
              name={pet.name}
              stage={pet.stage}
              happiness={pet.happiness}
              hunger={pet.hunger}
              health={pet.health}
              isSelected={selectedPetId === pet.tokenId}
              onClick={() => onSelectPet(pet.tokenId)}
            />
          ))}
        </div>
      )}

      <MintPetModal
        open={showMintModal}
        onOpenChange={setShowMintModal}
        onMintSuccess={loadPets}
      />
    </div>
  )
}


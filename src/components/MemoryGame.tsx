import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

interface MemoryGameProps {
  onGameWin: (gameName: string) => void
  onClose: () => void
}

interface Card {
  id: number
  icon: string
  isFlipped: boolean
  isMatched: boolean
}

const CARD_ICONS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊']

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function MemoryGame({ onGameWin, onClose }: MemoryGameProps) {
  const [cards, setCards] = useState<Card[]>([])
  const [flippedCards, setFlippedCards] = useState<number[]>([])
  const [matchedPairs, setMatchedPairs] = useState(0)
  const [moves, setMoves] = useState(0)
  const [isChecking, setIsChecking] = useState(false)

  // Initialize game
  useEffect(() => {
    initializeGame()
  }, [])

  const initializeGame = () => {
    // Create pairs of cards
    const cardPairs = CARD_ICONS.flatMap((icon, index) => [
      { id: index * 2, icon, isFlipped: false, isMatched: false },
      { id: index * 2 + 1, icon, isFlipped: false, isMatched: false }
    ])
    
    // Shuffle cards
    const shuffled = shuffleArray(cardPairs)
    setCards(shuffled)
    setFlippedCards([])
    setMatchedPairs(0)
    setMoves(0)
    setIsChecking(false)
  }

  const handleCardClick = (cardId: number) => {
    if (isChecking) return
    if (flippedCards.includes(cardId)) return
    if (cards[cardId].isMatched) return
    if (flippedCards.length >= 2) return

    const newFlippedCards = [...flippedCards, cardId]
    setFlippedCards(newFlippedCards)

    // Update card state to show it's flipped
    setCards(prevCards => 
      prevCards.map((card, index) => 
        index === cardId ? { ...card, isFlipped: true } : card
      )
    )

    // Check for match when 2 cards are flipped
    if (newFlippedCards.length === 2) {
      setMoves(prev => prev + 1)
      setIsChecking(true)

      const [firstId, secondId] = newFlippedCards
      const firstCard = cards[firstId]
      const secondCard = cards[secondId]

      if (firstCard.icon === secondCard.icon) {
        // Match found!
        setTimeout(() => {
          setCards(prevCards => 
            prevCards.map((card, index) => 
              index === firstId || index === secondId 
                ? { ...card, isMatched: true } 
                : card
            )
          )
          setFlippedCards([])
          setIsChecking(false)
          setMatchedPairs(prev => {
            const newMatched = prev + 1
            // Check if all pairs are matched
            if (newMatched === CARD_ICONS.length) {
              setTimeout(() => {
                onGameWin('Memory Game')
              }, 500)
            }
            return newMatched
          })
        }, 600)
      } else {
        // No match - flip back
        setTimeout(() => {
          setCards(prevCards => 
            prevCards.map((card, index) => 
              index === firstId || index === secondId 
                ? { ...card, isFlipped: false } 
                : card
            )
          )
          setFlippedCards([])
          setIsChecking(false)
        }, 1000)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0)] max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          onClick={onClose}
        >
          <X size={24} />
        </button>

        <h2 className="text-2xl font-bold font-fredoka text-center mb-2">🧠 Memory Game</h2>
        <div className="text-center mb-5 text-gray-600 font-fredoka">
          Moves: {moves} | Matched: {matchedPairs}/{CARD_ICONS.length}
        </div>

        <div className="grid grid-cols-4 gap-3 mb-4">
          {cards.map((card, index) => (
            <div
              key={card.id}
              className={`aspect-square cursor-pointer ${card.isMatched ? 'opacity-60' : ''}`}
              onClick={() => handleCardClick(index)}
              style={{
                perspective: '1000px',
              }}
            >
              <div 
                className="relative w-full h-full"
                style={{
                  transformStyle: 'preserve-3d',
                  transform: card.isFlipped || card.isMatched ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  transition: 'transform 0.6s',
                }}
              >
                <div 
                  className="absolute inset-0 rounded-lg flex items-center justify-center text-4xl font-bold border-4 border-black"
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                  }}
                >
                  ?
                </div>
                <div 
                  className="absolute inset-0 rounded-lg flex items-center justify-center text-4xl font-bold border-4 border-black"
                  style={{
                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                  }}
                >
                  {card.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        {matchedPairs === CARD_ICONS.length && (
          <div className="text-center mt-4 text-xl font-bold font-fredoka">
            🎉 You won in {moves} moves!
          </div>
        )}

        <button 
          className="w-full py-3 px-4 bg-gray-200 hover:bg-gray-300 rounded-lg font-bold font-fredoka border-2 border-black transition-all mt-4"
          onClick={initializeGame}
        >
          Reset Game
        </button>
      </div>
    </div>
  )
}


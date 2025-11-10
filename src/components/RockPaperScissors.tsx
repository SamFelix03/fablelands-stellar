import { useState } from 'react'
import { X } from 'lucide-react'

interface RockPaperScissorsProps {
  onGameWin: (gameName: string) => void
  onClose: () => void
}

type Choice = 'rock' | 'paper' | 'scissors' | null

const CHOICES = {
  rock: { emoji: '✊', label: 'Rock' },
  paper: { emoji: '✋', label: 'Paper' },
  scissors: { emoji: '✌️', label: 'Scissors' }
}

export function RockPaperScissors({ onGameWin, onClose }: RockPaperScissorsProps) {
  const [playerChoice, setPlayerChoice] = useState<Choice>(null)
  const [computerChoice, setComputerChoice] = useState<Choice>(null)
  const [result, setResult] = useState<'win' | 'lose' | 'draw' | null>(null)

  const determineWinner = (player: Choice, computer: Choice): 'win' | 'lose' | 'draw' => {
    if (player === computer) return 'draw'
    
    if (
      (player === 'rock' && computer === 'scissors') ||
      (player === 'paper' && computer === 'rock') ||
      (player === 'scissors' && computer === 'paper')
    ) {
      return 'win'
    }
    
    return 'lose'
  }

  const handleChoice = (choice: Choice) => {
    if (!choice) return

    const computerOptions: Choice[] = ['rock', 'paper', 'scissors']
    const randomChoice = computerOptions[Math.floor(Math.random() * computerOptions.length)]

    setPlayerChoice(choice)
    setComputerChoice(randomChoice)
    
    const gameResult = determineWinner(choice, randomChoice)
    setResult(gameResult)
  }

  const handleClaimReward = () => {
    onGameWin('Rock Paper Scissors')
  }

  const resetGame = () => {
    setPlayerChoice(null)
    setComputerChoice(null)
    setResult(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0)] max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          onClick={onClose}
        >
          <X size={24} />
        </button>

        <h2 className="text-2xl font-bold font-fredoka text-center mb-2">✊✋✌️ Rock Paper Scissors</h2>
        <div className="text-center mb-5 text-gray-600 font-fredoka">
          {!playerChoice && "Choose your move!"}
          {playerChoice && !result && "Calculating..."}
          {result && (
            <div className="text-lg font-bold">
              {result === 'win' && "🎉 You Win!"}
              {result === 'lose' && "😔 You Lose!"}
              {result === 'draw' && "🤝 It's a Draw!"}
            </div>
          )}
        </div>

        {!playerChoice ? (
          <div className="grid grid-cols-3 gap-4 mb-4">
            {(Object.keys(CHOICES) as Choice[]).filter(c => c !== null).map((choice) => (
              <button
                key={choice}
                className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-lg border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                onClick={() => handleChoice(choice)}
              >
                <div className="text-5xl mb-2">{CHOICES[choice!].emoji}</div>
                <div className="font-bold font-fredoka">{CHOICES[choice!].label}</div>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-around gap-4 mb-6">
              <div className="flex-1 text-center">
                <div className="text-sm text-gray-600 mb-2 font-fredoka">You chose:</div>
                <div className="text-6xl mb-2">{CHOICES[playerChoice].emoji}</div>
                <div className="font-bold font-fredoka">{CHOICES[playerChoice].label}</div>
              </div>
              
              <div className="text-2xl font-bold text-purple-600 font-fredoka">VS</div>
              
              <div className="flex-1 text-center">
                <div className="text-sm text-gray-600 mb-2 font-fredoka">Computer chose:</div>
                <div className="text-6xl mb-2">{computerChoice && CHOICES[computerChoice].emoji}</div>
                <div className="font-bold font-fredoka">{computerChoice && CHOICES[computerChoice].label}</div>
              </div>
            </div>

            <div className="mt-4">
              {result === 'win' ? (
                <button 
                  className="w-full py-3 px-4 bg-gradient-to-br from-green-500 to-emerald-500 text-white rounded-lg font-bold font-fredoka border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                  onClick={handleClaimReward}
                >
                  🎁 Claim Reward
                </button>
              ) : (
                <button 
                  className="w-full py-3 px-4 bg-gray-200 hover:bg-gray-300 rounded-lg font-bold font-fredoka border-4 border-black transition-all"
                  onClick={resetGame}
                >
                  Play Again
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}


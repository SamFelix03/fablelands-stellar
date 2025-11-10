import { X } from 'lucide-react'

interface GameSelectionModalProps {
  onGameSelect: (game: 'memory' | 'tictactoe' | 'rps') => void
  onClose: () => void
}

export function GameSelectionModal({ onGameSelect, onClose }: GameSelectionModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl p-8 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0)] max-w-2xl w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          onClick={onClose}
        >
          <X size={24} />
        </button>
        
        <h2 className="text-3xl font-bold font-fredoka text-center mb-2">🎮 Choose a Game</h2>
        <p className="text-center mb-6 text-gray-600 font-fredoka">
          Win the game to increase your pet's happiness!
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button 
            className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-xl border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            onClick={() => onGameSelect('memory')}
          >
            <div className="text-5xl mb-3">🧠</div>
            <h3 className="text-xl font-bold font-fredoka mb-2">Memory Game</h3>
            <p className="text-sm opacity-90">Match pairs of cards</p>
          </button>
          
          <button 
            className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-500 to-cyan-500 text-white rounded-xl border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            onClick={() => onGameSelect('tictactoe')}
          >
            <div className="text-5xl mb-3">❌⭕</div>
            <h3 className="text-xl font-bold font-fredoka mb-2">Tic-Tac-Toe</h3>
            <p className="text-sm opacity-90">Beat the computer</p>
          </button>
          
          <button 
            className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-xl border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            onClick={() => onGameSelect('rps')}
          >
            <div className="text-5xl mb-3">✊✋✌️</div>
            <h3 className="text-xl font-bold font-fredoka mb-2">Rock Paper Scissors</h3>
            <p className="text-sm opacity-90">Test your luck</p>
          </button>
        </div>
      </div>
    </div>
  )
}


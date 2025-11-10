import { useState } from 'react'
import { X } from 'lucide-react'

interface TicTacToeProps {
  onGameWin: (gameName: string) => void
  onClose: () => void
}

type Cell = 'X' | 'O' | null
type Board = Cell[]

export function TicTacToe({ onGameWin, onClose }: TicTacToeProps) {
  const [board, setBoard] = useState<Board>(Array(9).fill(null))
  const [isPlayerTurn, setIsPlayerTurn] = useState(true)
  const [gameStatus, setGameStatus] = useState<'playing' | 'won' | 'lost' | 'draw'>('playing')
  const [winningLine, setWinningLine] = useState<number[] | null>(null)

  const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6]             // diagonals
  ]

  const checkWinner = (currentBoard: Board): { winner: 'X' | 'O' | null; line: number[] | null } => {
    for (const pattern of winPatterns) {
      const [a, b, c] = pattern
      if (
        currentBoard[a] &&
        currentBoard[a] === currentBoard[b] &&
        currentBoard[a] === currentBoard[c]
      ) {
        return { winner: currentBoard[a], line: pattern }
      }
    }
    return { winner: null, line: null }
  }

  const isBoardFull = (currentBoard: Board): boolean => {
    return currentBoard.every(cell => cell !== null)
  }

  const getEmptyCells = (currentBoard: Board): number[] => {
    return currentBoard.map((cell, index) => cell === null ? index : -1).filter(i => i !== -1)
  }

  const makeComputerMove = (currentBoard: Board) => {
    const emptyCells = getEmptyCells(currentBoard)
    if (emptyCells.length === 0) return

    // Simple AI: Random move
    const randomIndex = emptyCells[Math.floor(Math.random() * emptyCells.length)]
    
    setTimeout(() => {
      const newBoard = [...currentBoard]
      newBoard[randomIndex] = 'O'
      setBoard(newBoard)

      const { winner, line } = checkWinner(newBoard)
      if (winner === 'O') {
        setGameStatus('lost')
        setWinningLine(line)
      } else if (isBoardFull(newBoard)) {
        setGameStatus('draw')
      } else {
        setIsPlayerTurn(true)
      }
    }, 500)
  }

  const handleCellClick = (index: number) => {
    if (!isPlayerTurn || gameStatus !== 'playing' || board[index] !== null) return

    const newBoard = [...board]
    newBoard[index] = 'X'
    setBoard(newBoard)

    const { winner, line } = checkWinner(newBoard)
    if (winner === 'X') {
      setGameStatus('won')
      setWinningLine(line)
      setTimeout(() => {
        onGameWin('Tic-Tac-Toe')
      }, 500)
      return
    }

    if (isBoardFull(newBoard)) {
      setGameStatus('draw')
      return
    }

    setIsPlayerTurn(false)
    makeComputerMove(newBoard)
  }

  const resetGame = () => {
    setBoard(Array(9).fill(null))
    setIsPlayerTurn(true)
    setGameStatus('playing')
    setWinningLine(null)
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

        <h2 className="text-2xl font-bold font-fredoka text-center mb-2">❌⭕ Tic-Tac-Toe</h2>
        <div className="text-center mb-5 text-gray-600 font-fredoka">
          {gameStatus === 'playing' && (isPlayerTurn ? "Your turn (X)" : "Computer's turn (O)...")}
          {gameStatus === 'won' && "🎉 You won!"}
          {gameStatus === 'lost' && "😔 You lost!"}
          {gameStatus === 'draw' && "🤝 It's a draw!"}
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4 max-w-xs mx-auto">
          {board.map((cell, index) => (
            <button
              key={index}
              className={`aspect-square text-5xl font-bold rounded-lg border-4 border-black transition-all ${
                winningLine?.includes(index) 
                  ? 'bg-gradient-to-br from-pink-500 to-purple-500 text-white animate-pulse' 
                  : 'bg-gradient-to-br from-blue-500 to-purple-500 text-white hover:scale-105'
              } ${gameStatus !== 'playing' || !isPlayerTurn ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer'}`}
              onClick={() => handleCellClick(index)}
              disabled={gameStatus !== 'playing' || !isPlayerTurn}
            >
              {cell}
            </button>
          ))}
        </div>

        {gameStatus !== 'playing' && (
          <button 
            className="w-full py-3 px-4 bg-gradient-to-br from-blue-500 to-purple-500 text-white rounded-lg font-bold font-fredoka border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            onClick={resetGame}
          >
            Play Again
          </button>
        )}
      </div>
    </div>
  )
}


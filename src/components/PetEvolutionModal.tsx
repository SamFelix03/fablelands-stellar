import { Loader2, Sparkles } from 'lucide-react'

interface PetEvolutionModalProps {
  petName: string
  fromStage: number
  toStage: number
  progress: number
  message: string
}

const EVOLUTION_STAGES = ['🥚 Egg', '🐣 Baby', '🦖 Teen', '🐲 Adult']

export function PetEvolutionModal({ petName, fromStage, toStage, progress, message }: PetEvolutionModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white rounded-2xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0)] max-w-md w-full p-8 text-center">
        <div className="mb-6">
          <div className="text-6xl mb-4 animate-pulse">
            <Sparkles className="w-16 h-16 mx-auto text-yellow-500" />
          </div>
          <h2 className="text-3xl font-bold font-chango mb-2" style={{
            textShadow: "3px 3px 0px rgba(0,0,0,0.1)",
          }}>
            Your Pet is Evolving!
          </h2>
          <p className="text-lg font-fredoka text-gray-700 mb-2">
            {petName} is evolving from
          </p>
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="text-2xl font-bold font-fredoka">
              {EVOLUTION_STAGES[fromStage]}
            </span>
            <span className="text-xl">→</span>
            <span className="text-2xl font-bold font-fredoka">
              {EVOLUTION_STAGES[toStage]}
            </span>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-center mb-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
          <p className="text-sm font-fredoka text-gray-600 mb-2">
            {message}
          </p>
          <div className="w-full bg-gray-200 rounded-full h-4 border-2 border-black overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs font-fredoka text-gray-500 mt-2">
            {progress}% complete
          </p>
        </div>

        <p className="text-xs font-fredoka text-gray-500">
          Generating new avatar and animations...
        </p>
      </div>
    </div>
  )
}


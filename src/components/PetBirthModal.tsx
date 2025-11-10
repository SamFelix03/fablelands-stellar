import { Loader2 } from 'lucide-react'

interface PetBirthModalProps {
  petName: string
  tokenId: number
  onComplete: () => void
  onError: (error: string) => void
  progress?: number
  message?: string
}

export function PetBirthModal({ 
  petName, 
  tokenId: _tokenId, 
  onComplete: _onComplete, 
  onError: _onError,
  progress = 0,
  message = 'Your pet is being born...'
}: PetBirthModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white rounded-2xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0)] max-w-md w-full p-8 text-center">
        <div className="mb-6">
          <div className="text-6xl mb-4 animate-bounce">🥚</div>
          <h2 className="text-3xl font-bold font-chango mb-2" style={{
            textShadow: "3px 3px 0px rgba(0,0,0,0.1)",
          }}>
            Your Pet is Being Born!
          </h2>
          <p className="text-lg font-fredoka text-gray-700 mb-4">
            {petName} is coming to life...
          </p>
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
          This may take a few minutes. Please don't close this window.
        </p>
      </div>
    </div>
  )
}


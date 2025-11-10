import { cn } from '../lib/utils'

interface PetCardProps {
  tokenId: number
  name: string
  stage: number
  happiness: number
  hunger: number
  health: number
  imageUrl?: string | null
  isSelected?: boolean
  onClick: () => void
}

const STAGE_COLORS = ['#e0e0e0', '#ffeb3b', '#ff9800', '#f44336']

export function PetCard({ tokenId, name, stage, happiness, hunger, health, imageUrl, isSelected, onClick }: PetCardProps) {
  const stageColor = STAGE_COLORS[stage] || '#e0e0e0'
  
  // Ensure stats are valid numbers, default to 0 if not
  const safeHappiness = typeof happiness === 'number' && !isNaN(happiness) ? Math.max(0, Math.min(100, happiness)) : 0
  const safeHunger = typeof hunger === 'number' && !isNaN(hunger) ? Math.max(0, Math.min(100, hunger)) : 0
  const safeHealth = typeof health === 'number' && !isNaN(health) ? Math.max(0, Math.min(100, health)) : 0

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white rounded-2xl p-6 cursor-pointer transition-all text-center",
        "border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0)]",
        "hover:shadow-[4px_4px_0px_0px_rgba(0,0,0)] hover:translate-x-[4px] hover:translate-y-[4px]",
        "active:shadow-[2px_2px_0px_0px_rgba(0,0,0)] active:translate-x-[6px] active:translate-y-[6px]",
        isSelected && "ring-4 ring-primary ring-offset-2"
      )}
      style={{
        borderColor: isSelected ? stageColor : '#000',
      }}
    >
      <div className="mb-4 transform transition-transform hover:scale-110">
        {imageUrl && typeof imageUrl === 'string' && imageUrl.trim() !== '' ? (
          <div className="w-32 h-32 mx-auto flex items-center justify-center overflow-hidden rounded-lg border-2 border-black">
            <img
              src={imageUrl}
              alt={name}
              className="w-full h-full object-cover"
              onError={(e) => {
                console.error(`❌ Image failed to load for pet ${name}:`, imageUrl)
                // If image fails, replace with placeholder
                const container = e.currentTarget.parentElement
                if (container) {
                  container.innerHTML = `
                    <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0)]">
                      <span class="text-4xl">🐾</span>
                    </div>
                  `
                }
              }}
              onLoad={() => {
                console.log(`✅ Image loaded successfully for pet ${name}:`, imageUrl)
              }}
            />
          </div>
        ) : (
          <div className="w-32 h-32 mx-auto flex items-center justify-center">
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0)]">
              <span className="text-4xl">🐾</span>
            </div>
          </div>
        )}
      </div>
      <h3 className="m-0 mb-2 text-2xl font-bold font-chango" style={{
        textShadow: "2px 2px 0px rgba(0,0,0,0.1)",
      }}>
        {name}
      </h3>
      <div 
        className="inline-block px-3 py-1 rounded-lg text-white font-semibold text-xs mb-3"
        style={{ background: stageColor }}
      >
        Stage {stage}
      </div>

      {/* Stats */}
      <div className="w-full space-y-2 mb-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold font-fredoka text-gray-700">Happiness</span>
          <span className="font-black font-fredoka">{safeHappiness}/100</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden border-2 border-black">
          <div 
            className="h-full bg-gradient-to-r from-yellow-500 to-yellow-300 transition-all duration-300"
            style={{ width: `${safeHappiness}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="font-bold font-fredoka text-gray-700">Hunger</span>
          <span className="font-black font-fredoka">{safeHunger}/100</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden border-2 border-black">
          <div 
            className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-300"
            style={{ width: `${safeHunger}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="font-bold font-fredoka text-gray-700">Health</span>
          <span className="font-black font-fredoka">{safeHealth}/100</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden border-2 border-black">
          <div 
            className="h-full bg-gradient-to-r from-pink-600 to-pink-400 transition-all duration-300"
            style={{ width: `${safeHealth}%` }}
          />
        </div>
      </div>

      <p className="m-0 text-sm text-gray-500 font-mono">
        #{tokenId}
      </p>
    </div>
  )
}


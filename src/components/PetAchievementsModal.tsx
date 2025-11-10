import { useState, useEffect } from 'react'
import { getUserAchievements, type Achievement } from '../services/achievementService'
import { useWallet } from '../hooks/useWallet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Loader2 } from 'lucide-react'

interface PetAchievementsModalProps {
  petId: number
  petName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const RARITY_COLORS: Record<string, string> = {
  common: '#9e9e9e',
  uncommon: '#4caf50',
  rare: '#2196f3',
  epic: '#9c27b0',
  legendary: '#ff9800',
  mythic: '#f44336',
}

export function PetAchievementsModal({ petId: _petId, petName: _petName, open, onOpenChange }: PetAchievementsModalProps) {
  const { address } = useWallet()
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && address) {
      loadAchievements()
    }
  }, [open, address])

  const loadAchievements = async () => {
    if (!address) return

    try {
      setLoading(true)
      setError(null)
      
      // Get user's earned achievements (using getUserAchievements.js approach)
      const userAchievements = await getUserAchievements(address)
      
      // All achievements returned are earned (getUserAchievements only returns earned ones)
      setAchievements(userAchievements)
    } catch (err: any) {
      console.error('Error loading achievements:', err)
      setError(err.message || 'Failed to load achievements')
    } finally {
      setLoading(false)
    }
  }

  const earnedCount = achievements.length
  const totalCount = achievements.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold font-chango mb-2" style={{
            textShadow: "3px 3px 0px rgba(0,0,0,0.1)",
          }}>
            🏆 Your Achievements
          </DialogTitle>
          <div className="text-sm font-fredoka text-gray-600">
            {earnedCount} / {totalCount} achievements earned
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <style>{`
            .achievements-list::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          <div className="achievements-list space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-3 font-fredoka">Loading achievements...</span>
              </div>
            ) : error ? (
              <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm border-2 border-red-300 font-bold text-center">
                {error}
              </div>
            ) : achievements.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-6xl mb-4">🏆</div>
                <p className="text-lg font-fredoka text-gray-600">
                  No achievements available yet
                </p>
              </div>
            ) : (
              achievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className="bg-white rounded-2xl p-5 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0)] transition-all flex items-center gap-4 opacity-100"
                  style={{
                    borderColor: RARITY_COLORS[achievement.rarity.toLowerCase()] || '#000',
                  }}
                >
                  <div className="text-5xl flex-shrink-0">{achievement.icon || '🏆'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold font-fredoka">
                        {achievement.name}
                      </h3>
                      <span
                        className="px-3 py-1 rounded-lg text-white font-bold border-2 border-black text-xs flex-shrink-0"
                        style={{
                          background: RARITY_COLORS[achievement.rarity.toLowerCase()] || '#9e9e9e',
                        }}
                      >
                        {achievement.rarity.toUpperCase()}
                      </span>
                      <span className="text-green-600 font-bold text-sm flex-shrink-0">✓ Earned</span>
                    </div>
                    <p className="text-sm font-fredoka text-gray-600 mb-1">
                      {achievement.description}
                    </p>
                    {achievement.totalEarned > 0 && (
                      <div className="text-xs font-fredoka text-gray-500">
                        {achievement.totalEarned} total earned
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}


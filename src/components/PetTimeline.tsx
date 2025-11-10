import { useState, useEffect } from 'react'
import { X, TrendingUp } from 'lucide-react'
import { getPetHistory, getMilestones, formatTimestamp, type HistoryEvent } from '../services/petHistory'
import { Button } from './ui/button'

interface PetTimelineProps {
  tokenId: number
  petName: string
  onClose: () => void
}

export function PetTimeline({ tokenId, petName, onClose }: PetTimelineProps) {
  const [history, setHistory] = useState<HistoryEvent[]>([])
  const [milestones, setMilestones] = useState({
    totalFeeds: 0,
    totalPlays: 0,
    totalEvolutions: 0,
    totalEvents: 0,
    longestStreak: 0,
  })
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    loadHistory()
  }, [tokenId])

  const loadHistory = () => {
    const data = getPetHistory(tokenId)
    setHistory(data)
    setMilestones(getMilestones(tokenId))
  }

  const filteredHistory = filter === 'all' 
    ? history 
    : history.filter(e => e.type === filter)

  const getEventColor = (type: string): string => {
    switch (type) {
      case 'birth': return '#4caf50'
      case 'evolution': return '#9c27b0'
      case 'feed': return '#ff9800'
      case 'play': return '#2196f3'
      case 'random-event': return '#00bcd4'
      case 'death': return '#f44336'
      case 'revival': return '#8bc34a'
      case 'health-milestone': return '#ff5722'
      case 'update-state': return '#607d8b'
      default: return '#757575'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0)] max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b-4 border-black bg-gradient-to-r from-purple-500 to-pink-500">
          <div>
            <h2 className="text-3xl font-bold font-chango text-white m-0" style={{
              textShadow: "3px 3px 0px rgba(0,0,0,0.3)",
            }}>
              📜 {petName}'s Timeline
            </h2>
            <p className="text-white/90 font-fredoka mt-1 m-0">
              Complete history of {petName}'s journey
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/20 border-2 border-white"
          >
            <X size={24} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {/* Milestones Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 border-2 border-black text-center shadow-[4px_4px_0px_0px_rgba(0,0,0)]">
              <div className="text-3xl mb-2">🍖</div>
              <div className="text-2xl font-bold font-fredoka">{milestones.totalFeeds}</div>
              <div className="text-xs font-fredoka text-gray-600">Times Fed</div>
            </div>
            <div className="bg-white rounded-xl p-4 border-2 border-black text-center shadow-[4px_4px_0px_0px_rgba(0,0,0)]">
              <div className="text-3xl mb-2">🎮</div>
              <div className="text-2xl font-bold font-fredoka">{milestones.totalPlays}</div>
              <div className="text-xs font-fredoka text-gray-600">Times Played</div>
            </div>
            <div className="bg-white rounded-xl p-4 border-2 border-black text-center shadow-[4px_4px_0px_0px_rgba(0,0,0)]">
              <div className="text-3xl mb-2">✨</div>
              <div className="text-2xl font-bold font-fredoka">{milestones.totalEvolutions}</div>
              <div className="text-xs font-fredoka text-gray-600">Evolutions</div>
            </div>
            <div className="bg-white rounded-xl p-4 border-2 border-black text-center shadow-[4px_4px_0px_0px_rgba(0,0,0)]">
              <div className="text-3xl mb-2">🎲</div>
              <div className="text-2xl font-bold font-fredoka">{milestones.totalEvents}</div>
              <div className="text-xs font-fredoka text-gray-600">Random Events</div>
            </div>
            <div className="bg-white rounded-xl p-4 border-2 border-black text-center shadow-[4px_4px_0px_0px_rgba(0,0,0)]">
              <div className="text-3xl mb-2">🔥</div>
              <div className="text-2xl font-bold font-fredoka">{milestones.longestStreak}</div>
              <div className="text-xs font-fredoka text-gray-600">Day Streak</div>
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2 mb-6">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
              className="font-fredoka"
            >
              All ({history.length})
            </Button>
            <Button
              variant={filter === 'evolution' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('evolution')}
              className="font-fredoka"
            >
              ✨ Evolutions
            </Button>
            <Button
              variant={filter === 'feed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('feed')}
              className="font-fredoka"
            >
              🍖 Feeds
            </Button>
            <Button
              variant={filter === 'play' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('play')}
              className="font-fredoka"
            >
              🎮 Plays
            </Button>
            <Button
              variant={filter === 'random-event' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('random-event')}
              className="font-fredoka"
            >
              🎲 Events
            </Button>
          </div>

          {/* Timeline List */}
          <div className="space-y-4">
            {filteredHistory.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border-2 border-black">
                <TrendingUp size={48} className="mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-fredoka text-gray-600">
                  No events yet. Start caring for {petName}!
                </p>
              </div>
            ) : (
              filteredHistory.map((event) => (
                <div
                  key={event.id}
                  className="bg-white rounded-xl p-4 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0)] flex gap-4"
                >
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl flex-shrink-0 border-2 border-black"
                    style={{ backgroundColor: getEventColor(event.type) }}
                  >
                    {event.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-bold font-fredoka m-0">{event.title}</h3>
                      <span className="text-xs font-fredoka text-gray-500 whitespace-nowrap ml-2">
                        {formatTimestamp(event.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm font-fredoka text-gray-700 mb-2 m-0">
                      {event.description}
                    </p>
                    {event.stats && (
                      <div className="flex flex-wrap gap-2">
                        {event.stats.happiness !== undefined && (
                          <span className="px-2 py-1 bg-yellow-100 rounded text-xs font-bold font-fredoka border border-black">
                            💛 {event.stats.happiness}
                          </span>
                        )}
                        {event.stats.hunger !== undefined && (
                          <span className="px-2 py-1 bg-orange-100 rounded text-xs font-bold font-fredoka border border-black">
                            🍖 {event.stats.hunger}
                          </span>
                        )}
                        {event.stats.health !== undefined && (
                          <span className="px-2 py-1 bg-pink-100 rounded text-xs font-bold font-fredoka border border-black">
                            ❤️ {event.stats.health}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


// Pet History Service - Tracks all major events in pet's life

export interface HistoryEvent {
  id: string
  tokenId: number
  timestamp: number
  type: 'birth' | 'evolution' | 'feed' | 'play' | 'random-event' | 'death' | 'revival' | 'health-milestone' | 'update-state'
  title: string
  description: string
  icon: string
  stats?: {
    happiness?: number
    hunger?: number
    health?: number
    evolutionStage?: number
  }
}

const STORAGE_KEY_PREFIX = 'pet_history_'

// Get history for a specific pet
export function getPetHistory(tokenId: number): HistoryEvent[] {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${tokenId}`)
    if (!stored) return []
    return JSON.parse(stored)
  } catch (error) {
    console.error('Error loading pet history:', error)
    return []
  }
}

// Add event to history
export function addHistoryEvent(event: HistoryEvent): void {
  try {
    const history = getPetHistory(event.tokenId)
    history.unshift(event) // Add to beginning (newest first)
    
    // Keep only last 100 events to prevent storage overflow
    const trimmed = history.slice(0, 100)
    
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${event.tokenId}`, JSON.stringify(trimmed))
  } catch (error) {
    console.error('Error saving history event:', error)
  }
}

// Clear history for a pet
export function clearPetHistory(tokenId: number): void {
  localStorage.removeItem(`${STORAGE_KEY_PREFIX}${tokenId}`)
}

// Generate unique ID for event
export function generateEventId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Helper: Log birth event
export function logBirth(tokenId: number, petName: string): void {
  addHistoryEvent({
    id: generateEventId(),
    tokenId,
    timestamp: Date.now(),
    type: 'birth',
    title: '🎉 Pet Born',
    description: `${petName} was created and started their journey!`,
    icon: '🥚',
    stats: {
      happiness: 50,
      hunger: 50,
      health: 100,
      evolutionStage: 0,
    },
  })
}

// Helper: Log evolution
export function logEvolution(
  tokenId: number,
  petName: string,
  _fromStage: number,
  toStage: number,
  stageName: string
): void {
  addHistoryEvent({
    id: generateEventId(),
    tokenId,
    timestamp: Date.now(),
    type: 'evolution',
    title: '✨ Evolution!',
    description: `${petName} evolved to ${stageName}!`,
    icon: '✨',
    stats: {
      evolutionStage: toStage,
    },
  })
}

// Helper: Log feeding
export function logFeed(
  tokenId: number,
  petName: string,
  stats: { happiness: number; hunger: number; health: number }
): void {
  addHistoryEvent({
    id: generateEventId(),
    tokenId,
    timestamp: Date.now(),
    type: 'feed',
    title: '🍖 Fed',
    description: `${petName} was fed and feels satisfied!`,
    icon: '🍖',
    stats,
  })
}

// Helper: Log playing
export function logPlay(
  tokenId: number,
  petName: string,
  stats: { happiness: number; hunger: number; health: number }
): void {
  addHistoryEvent({
    id: generateEventId(),
    tokenId,
    timestamp: Date.now(),
    type: 'play',
    title: '🎮 Played',
    description: `${petName} had fun playing!`,
    icon: '🎮',
    stats,
  })
}

// Helper: Log random event
export function logRandomEvent(
  tokenId: number,
  _petName: string,
  eventTitle: string,
  eventDescription: string,
  stats: { happiness: number; hunger: number; health: number }
): void {
  addHistoryEvent({
    id: generateEventId(),
    tokenId,
    timestamp: Date.now(),
    type: 'random-event',
    title: eventTitle,
    description: eventDescription,
    icon: '🎲',
    stats,
  })
}

// Helper: Log update state
export function logUpdateState(
  tokenId: number,
  petName: string,
  stats: { happiness: number; hunger: number; health: number }
): void {
  addHistoryEvent({
    id: generateEventId(),
    tokenId,
    timestamp: Date.now(),
    type: 'update-state',
    title: '🔄 State Updated',
    description: `${petName}'s state was automatically updated!`,
    icon: '🔄',
    stats,
  })
}

// Helper: Log health milestone
export function logHealthMilestone(
  tokenId: number,
  petName: string,
  milestone: string,
  health: number
): void {
  addHistoryEvent({
    id: generateEventId(),
    tokenId,
    timestamp: Date.now(),
    type: 'health-milestone',
    title: '⚠️ Health Alert',
    description: `${petName}: ${milestone}`,
    icon: '❤️',
    stats: {
      health,
    },
  })
}

// Format timestamp for display
export function formatTimestamp(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'Just now'
}

// Get milestone stats from history
export function getMilestones(tokenId: number): {
  totalFeeds: number
  totalPlays: number
  totalEvolutions: number
  totalEvents: number
  longestStreak: number
} {
  const history = getPetHistory(tokenId)
  
  return {
    totalFeeds: history.filter(e => e.type === 'feed').length,
    totalPlays: history.filter(e => e.type === 'play').length,
    totalEvolutions: history.filter(e => e.type === 'evolution').length,
    totalEvents: history.filter(e => e.type === 'random-event').length,
    longestStreak: calculateStreak(history),
  }
}

// Calculate longest daily care streak
function calculateStreak(history: HistoryEvent[]): number {
  if (history.length === 0) return 0
  
  const interactions = history.filter(e => e.type === 'feed' || e.type === 'play')
  if (interactions.length === 0) return 0
  
  const days = new Set<string>()
  interactions.forEach(event => {
    const date = new Date(event.timestamp).toDateString()
    days.add(date)
  })
  
  return days.size
}


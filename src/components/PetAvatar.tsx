import { useEffect, useMemo, useRef } from 'react'

interface PetAvatarProps {
  evolutionStage: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  imageUrl?: string | null
  videoUrls?: {
    happy?: string | null
    sad?: string | null
    angry?: string | null
  }
  mood?: 'happy' | 'sad' | 'angry' | 'neutral'
  happiness?: number
  hunger?: number
  health?: number
}

const SIZE_CLASSES = {
  sm: 'w-16 h-16',
  md: 'w-24 h-24',
  lg: 'w-32 h-32',
  xl: 'w-full h-full', // Full container for pet details page
}

/**
 * Determine pet mood based on stats
 */
function determineMood(
  happiness?: number,
  hunger?: number,
  health?: number
): 'happy' | 'sad' | 'angry' | 'neutral' {
  if (happiness === undefined || hunger === undefined || health === undefined) {
    return 'neutral'
  }

  // Angry: very low health or very low happiness
  if (health < 30 || happiness < 20) {
    return 'angry'
  }

  // Sad: low happiness or high hunger
  if (happiness < 50 || hunger > 70) {
    return 'sad'
  }

  // Happy: good stats overall
  if (happiness >= 70 && hunger < 50 && health >= 50) {
    return 'happy'
  }

  return 'neutral'
}

export function PetAvatar({ 
  evolutionStage, 
  size = 'lg', 
  className = '',
  imageUrl,
  videoUrls,
  mood,
  happiness,
  hunger,
  health,
}: PetAvatarProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  const stage = useMemo(() => Math.max(0, Math.min(3, evolutionStage)), [evolutionStage])
  const sizeClass = SIZE_CLASSES[size]

  // Determine mood if not provided
  const petMood = useMemo(() => {
    if (mood) return mood
    return determineMood(happiness, hunger, health)
  }, [mood, happiness, hunger, health])

  // Get video URL based on mood
  const videoUrl = useMemo(() => {
    if (!videoUrls) return null
    
    switch (petMood) {
      case 'happy':
        return videoUrls.happy || null
      case 'sad':
        return videoUrls.sad || null
      case 'angry':
        return videoUrls.angry || null
      default:
        return null
    }
  }, [videoUrls, petMood])


  // Auto-play video when it changes
  useEffect(() => {
    if (videoRef.current && videoUrl) {
      videoRef.current.load()
      videoRef.current.play().catch((err) => {
        console.warn('Error playing video:', err)
      })
    }
  }, [videoUrl])

  // Priority 1: Show video if available and mood is determined
  if (videoUrl && petMood !== 'neutral') {
    return (
      <div className={`${sizeClass} ${className} flex items-center justify-center w-full h-full`}>
        <video
          ref={videoRef}
          src={videoUrl}
          loop
          muted
          playsInline
          autoPlay
          className="w-full h-full object-cover"
          onError={() => {
            // Fallback to image if video fails
            console.warn('Video failed to load, falling back to image')
          }}
        >
          Your browser does not support the video tag.
        </video>
      </div>
    )
  }

  // Priority 2: Show image if available
  if (imageUrl) {
    return (
      <div className={`${sizeClass} ${className} flex items-center justify-center w-full h-full`}>
        <img
          src={imageUrl}
          alt={`Pet stage ${stage}`}
          className="w-full h-full object-cover"
        />
      </div>
    )
  }

  // Fallback: Show placeholder if no image or video
  return (
    <div className={`${sizeClass} ${className} flex items-center justify-center`}>
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0)]">
        <span className="text-4xl">🐾</span>
      </div>
    </div>
  )
}

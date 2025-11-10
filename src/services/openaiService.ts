// OpenAI service for pet chat functionality
// Uses GPT-4o model for AI-powered pet responses

export interface PetContext {
  name: string
  evolutionStage: number
  happiness: number
  hunger: number
  health: number
  age: number
  interaction: 'feed' | 'play' | 'greet' | 'evolve' | 'chat'
  userMessage?: string
  tokenId?: number // Optional tokenId for better context tracking
}

const STAGE_NAMES = ['Egg', 'Baby', 'Teen', 'Adult']

const PERSONALITY_PROMPTS = {
  0: `You are a mysterious egg, about to hatch. You communicate with soft vibrations and gentle pulses of warmth. Keep responses very short (1-2 sentences) and mystical.`,
  
  1: `You are a baby Evolvagotchi - innocent, excitable, and full of wonder. You see everything for the first time and express emotions openly with simple words. Use emojis like 🥺, 😊, 🎉. Keep responses SHORT (1-2 sentences) and childlike.`,
  
  2: `You are a teenage Evolvagotchi - curious, energetic, but sometimes moody. You're discovering your personality and can be dramatic or sarcastic when neglected, but loving when cared for. Use emojis like 😎, 😤, 💪. Keep responses 2-3 sentences.`,
  
  3: `You are a fully evolved adult Evolvagotchi - wise, loyal, and protective of your trainer. You speak with maturity and gratitude, remembering all the care you've received. Use emojis like 🐲, ✨, 💎. Keep responses 2-3 sentences but thoughtful.`,
}

function buildPrompt(context: PetContext): string {
  const { name, evolutionStage, happiness, hunger, health, interaction, userMessage, tokenId } = context
  const stage = STAGE_NAMES[evolutionStage]
  const personalityBase = PERSONALITY_PROMPTS[evolutionStage as keyof typeof PERSONALITY_PROMPTS]

  // Check if a game was recently played
  const lastGame = localStorage.getItem('lastGameWon') || null
  
  // Check for last action (feed/play/update) - use tokenId if available
  let lastAction: string | null = null
  if (tokenId !== undefined) {
    lastAction = localStorage.getItem(`lastAction_${tokenId}`)
  } else {
    // Fallback: try to get last action for any pet
    try {
      const keys = Object.keys(localStorage)
      const actionKeys = keys.filter(k => k.startsWith('lastAction_'))
      if (actionKeys.length > 0) {
        lastAction = localStorage.getItem(actionKeys[actionKeys.length - 1])
      }
    } catch (e) {
      // Ignore errors
    }
  }
  
  let situationContext = ''
  
  // Analyze pet's current state
  if (hunger > 80) {
    situationContext = 'You are VERY HUNGRY and feel weak. '
  } else if (hunger > 50) {
    situationContext = 'You are getting hungry. '
  }

  if (happiness < 20) {
    situationContext += 'You feel very sad and neglected. '
  } else if (happiness < 50) {
    situationContext += 'You are feeling a bit down. '
  } else if (happiness > 80) {
    situationContext += 'You are very happy and energetic! '
  }

  if (health < 30) {
    situationContext += 'You feel sick and unwell. '
  }

  // Interaction-specific context
  let interactionContext = ''
  switch (interaction) {
    case 'feed':
      interactionContext = 'Your trainer just fed you. React with gratitude and describe how you feel. '
      break
    case 'play':
      if (lastGame) {
        interactionContext = `Your trainer just played a game of **${lastGame}** with you! React with joy and talk about how much fun you had playing that specific game. `
      } else {
        interactionContext = 'Your trainer just played with you. React with joy and excitement. '
      }
      break
    case 'greet':
      interactionContext = 'Your trainer just opened your profile. Greet them warmly and let them know how you are feeling. '
      break
    case 'evolve':
      interactionContext = `You just evolved from ${STAGE_NAMES[evolutionStage - 1]} to ${stage}! Express your excitement and transformation. This is a HUGE moment! `
      break
    case 'chat':
      // Include context about recent actions if available
      let recentActionContext = ''
      if (lastAction === 'feed') {
        recentActionContext = 'Your trainer just fed you a moment ago. '
        // Clear the action after using it (so it doesn't persist)
        if (tokenId !== undefined) {
          localStorage.removeItem(`lastAction_${tokenId}`)
        }
      } else if (lastAction === 'play') {
        if (lastGame) {
          recentActionContext = `Your trainer just played a game of **${lastGame}** with you! `
          // Clear game context after using it
          localStorage.removeItem('lastGameWon')
        } else {
          recentActionContext = 'Your trainer just played with you a moment ago. '
        }
        // Clear the action after using it
        if (tokenId !== undefined) {
          localStorage.removeItem(`lastAction_${tokenId}`)
        }
      } else if (lastAction === 'update') {
        recentActionContext = 'Your state was just refreshed. '
        // Clear the action after using it
        if (tokenId !== undefined) {
          localStorage.removeItem(`lastAction_${tokenId}`)
        }
      }
      
      interactionContext = `${recentActionContext}Your trainer said: "${userMessage}". Respond naturally to what they said, and acknowledge any recent care they gave you if relevant. `
      break
  }

  const fullPrompt = `${personalityBase}

Your name is ${name}. You are currently a ${stage} stage Evolvagotchi.

Current stats:
- Happiness: ${happiness}/100
- Hunger: ${hunger}/100  
- Health: ${health}/100

${situationContext}
${interactionContext}

IMPORTANT: 
- Stay in character as a ${stage}
- Keep response SHORT and emotional
- Be authentic to your current feelings (happy, sad, hungry, etc.)
- NO explanations, just respond as the pet would
- Use 1-2 emojis maximum

Respond now:`

  return fullPrompt
}

export async function getPetResponse(context: PetContext): Promise<string> {
  try {
    // Use dotenv-loaded environment variable
    // Vite automatically loads .env files with PUBLIC_ prefix
    const apiKey = import.meta.env.PUBLIC_OPENAI_API_KEY
    
    // Debug: Log all env vars (in dev only)
    if (import.meta.env.DEV) {
      console.log('🔍 Environment check:')
      console.log('   PUBLIC_OPENAI_API_KEY exists:', !!apiKey)
      console.log('   PUBLIC_OPENAI_API_KEY length:', apiKey?.length || 0)
      console.log('   All PUBLIC_ env vars:', Object.keys(import.meta.env).filter(k => k.startsWith('PUBLIC_')))
    }
    
    if (!apiKey || apiKey.trim() === '' || apiKey === 'your_api_key_here') {
      console.error('❌ OpenAI API key not found or invalid!')
      console.error('   Current value:', apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined')
      console.error('   Please create a .env file in the project root with:')
      console.error('   PUBLIC_OPENAI_API_KEY=sk-your-actual-api-key')
      console.error('   Then restart the development server (stop and run npm run dev again)')
      return '💭 *Pet is deep in thought...* (API key not configured. Check console for setup instructions.)'
    }

    const prompt = buildPrompt(context)
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an AI-powered virtual pet in a blockchain game. Respond naturally and emotionally based on your current state and evolution stage. Keep responses concise and in-character.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.9, // High creativity for personality
        max_tokens: 100,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error('OpenAI API error:', error)
      return '💭 *Pet is deep in thought...*'
    }

    const data = await response.json()
    const petResponse = data.choices?.[0]?.message?.content || 'Pet is thinking...'
    return petResponse.trim()
  } catch (error) {
    console.error('OpenAI API error:', error)
    return '💭 *Pet is deep in thought...*'
  }
}

// Fallback responses if API fails
export const FALLBACK_RESPONSES = {
  feed: {
    0: '✨ *The egg glows warmly* ✨',
    1: 'Yummy yummy! 😋 Thank you!',
    2: 'Finally! I was starving! 😤',
    3: 'Your care sustains me. Thank you, trainer. 🙏',
  },
  play: {
    0: '✨ *The egg wiggles happily* ✨',
    1: 'Yay! This is so fun! 🎉',
    2: 'Now this is what I am talking about! 💪',
    3: 'It is good to bond with you, old friend. ✨',
  },
  greet: {
    0: '✨ *A presence stirs within* ✨',
    1: 'Hi hi! I missed you! 🥺',
    2: 'Oh, you are finally here! 😎',
    3: 'Welcome back, trainer. I have been waiting. 🐲',
  },
}


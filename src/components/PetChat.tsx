import { useState, useEffect, useRef, memo } from 'react'
import { getPetResponse } from '../services/openaiService'
import type { PetContext } from '../services/openaiService'

interface Message {
  id: string
  text: string
  sender: 'user' | 'pet'
  timestamp: Date
}

interface PetChatProps {
  petName: string
  evolutionStage: number
  happiness: number
  hunger: number
  health: number
  age: number
  tokenId?: number
}

function PetChatComponent({ petName, evolutionStage, happiness, hunger, health, age, tokenId }: PetChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messageIdCounter = useRef(0)

  const chatMessagesRef = useRef<HTMLDivElement>(null)
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    // Only scroll if user is already near the bottom
    const chatDiv = chatMessagesRef.current
    if (!chatDiv) return
    const threshold = 80 // px
    const atBottom = chatDiv.scrollHeight - chatDiv.scrollTop - chatDiv.clientHeight < threshold
    if (atBottom) {
      scrollToBottom()
    }
  }, [messages])

  // Send greeting when component mounts (only once per pet)
  // Use a ref to track if we've already greeted for this pet
  const greetingSentRef = useRef<string>('')
  const currentPetKey = `${petName}-${evolutionStage}`
  
  useEffect(() => {
    // Only send greeting if we haven't greeted this pet yet AND we have no messages
    if (greetingSentRef.current === currentPetKey || messages.length > 0) {
      return
    }
    
    const handleGreeting = async () => {
      setIsLoading(true)
      greetingSentRef.current = currentPetKey
      const context: PetContext = {
        name: petName,
        evolutionStage,
        happiness,
        hunger,
        health,
        age,
        interaction: 'greet',
        tokenId,
      }

      try {
        const response = await getPetResponse(context)
        addMessage(response, 'pet')
      } catch (error) {
        console.error('Error sending greeting:', error)
        addMessage("Hello! I'm here to chat with you!", 'pet')
      } finally {
        setIsLoading(false)
      }
    }
    
    handleGreeting()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPetKey]) // Only reset when pet name or stage changes

  const addMessage = (text: string, sender: 'user' | 'pet') => {
    // Use counter + timestamp to ensure unique IDs
    messageIdCounter.current += 1
    const newMessage: Message = {
      id: `${Date.now()}-${messageIdCounter.current}-${Math.random().toString(36).substr(2, 9)}`,
      text,
      sender,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, newMessage])
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    addMessage(userMessage, 'user')

    setIsLoading(true)

    const context: PetContext = {
      name: petName,
      evolutionStage,
      happiness,
      hunger,
      health,
      age,
      interaction: 'chat',
      userMessage,
      tokenId,
    }

    const response = await getPetResponse(context)
    addMessage(response, 'pet')
    setIsLoading(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="pet-chat">
      <div className="chat-header">
        <span className="text-xl">✨</span>
        <h3 className="font-bold text-lg">Talk to {petName}</h3>
      </div>

      <div className="chat-messages" ref={chatMessagesRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message ${msg.sender}`}>
            <div className="message-bubble">
              {msg.text}
            </div>
            <span className="message-time">
              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        {isLoading && (
          <div className="chat-message pet">
            <div className="message-bubble loading">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={`Chat with ${petName}...`}
          disabled={isLoading}
        />
        <button onClick={handleSend} disabled={!input.trim() || isLoading}>
          <span className="text-lg">➤</span>
        </button>
      </div>
    </div>
  )
}

// Memoize the component to prevent remounting when props change
// Only re-render if critical props change (name or evolution stage)
// This prevents chat from resetting when pet stats update after feeding/playing
export const PetChat = memo(PetChatComponent, (prevProps, nextProps) => {
  // Return true if props are equal (skip re-render), false if different (re-render)
  // We only care about name and evolution stage - ignore stat changes
  const propsEqual = (
    prevProps.petName === nextProps.petName &&
    prevProps.evolutionStage === nextProps.evolutionStage &&
    prevProps.tokenId === nextProps.tokenId
  )
  return propsEqual // true = skip re-render, false = re-render
})


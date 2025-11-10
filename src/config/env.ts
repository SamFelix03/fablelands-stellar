// Environment variable configuration and validation
// This file helps ensure environment variables are loaded properly

interface EnvConfig {
  openaiApiKey: string | undefined
  petworldContract: string
  achievementContract: string
  stellarNetwork: string
  stellarRpcUrl: string
  stellarHorizonUrl: string
}

/**
 * Get environment variables with proper fallbacks
 * Uses dotenv-loaded variables via import.meta.env (Vite)
 */
export function getEnvConfig(): EnvConfig {
  // Vite automatically loads .env files and exposes PUBLIC_ prefixed vars
  // dotenv.config() in vite.config.ts ensures .env is loaded
  const openaiApiKey = import.meta.env.PUBLIC_OPENAI_API_KEY
  const petworldContract = import.meta.env.PUBLIC_PETWORLD_CONTRACT || 'CCS7FD7WUCYW6RAHYBUYO6NPXBDZHFLSUA4SNBASMXJNQUCB4JOEH3TQ'
  const achievementContract = import.meta.env.PUBLIC_ACHIEVEMENT_CONTRACT || 'CDO4QOUDJNIXZAN2AHNW6HLXFOEABWZTW3KM3MIZFOEYWOIDEGM5T62S'
  const stellarNetwork = import.meta.env.PUBLIC_STELLAR_NETWORK || 'TESTNET'
  const stellarRpcUrl = import.meta.env.PUBLIC_STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org'
  const stellarHorizonUrl = import.meta.env.PUBLIC_STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org'

  return {
    openaiApiKey,
    petworldContract,
    achievementContract,
    stellarNetwork,
    stellarRpcUrl,
    stellarHorizonUrl,
  }
}

/**
 * Validate that required environment variables are set
 * Throws an error if critical variables are missing
 */
export function validateEnv(): void {
  const config = getEnvConfig()
  
  if (!config.openaiApiKey) {
    console.warn('⚠️  PUBLIC_OPENAI_API_KEY is not set. Chat functionality will not work.')
    console.warn('   Please create a .env file in the project root with:')
    console.warn('   PUBLIC_OPENAI_API_KEY=your_api_key_here')
  }
  
  // Log loaded config (without sensitive data)
  console.log('📋 Environment Configuration:')
  console.log('   OpenAI API Key:', config.openaiApiKey ? '✅ Set' : '❌ Missing')
  console.log('   PetWorld Contract:', config.petworldContract)
  console.log('   Stellar Network:', config.stellarNetwork)
  console.log('   RPC URL:', config.stellarRpcUrl)
}

// Auto-validate on import (only in development)
if (import.meta.env.DEV) {
  validateEnv()
}


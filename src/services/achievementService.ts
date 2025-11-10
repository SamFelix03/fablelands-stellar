// Achievement Service
// Handles reading achievements from the achievement contract
// Uses the exact same logic as getUserAchievements.js

import * as StellarSdk from '@stellar/stellar-sdk'
import { rpc as StellarRpc } from '@stellar/stellar-sdk'
import { Contract } from '@stellar/stellar-sdk'
import { networkPassphrase } from '../contracts/util'
import { getEnvConfig } from '../config/env'

// Get achievement contract address from environment
const envConfig = getEnvConfig()
const ACHIEVEMENT_CONTRACT = envConfig.achievementContract
const RPC_URL = envConfig.stellarRpcUrl

let server: any
let contract: Contract

function getServer() {
  if (!server) {
    server = new StellarRpc.Server(RPC_URL, {
      allowHttp: new URL(RPC_URL).hostname === 'localhost',
    })
  }
  return server
}

function getAchievementContract() {
  if (!contract) {
    contract = new Contract(ACHIEVEMENT_CONTRACT)
  }
  return contract
}

// Helper to extract u128 from ScVal (matching test.js)
function extractU128(scVal: any): bigint | null {
  if (scVal && scVal.u128) {
    const lo = scVal.u128.lo || 0
    const hi = scVal.u128.hi || 0
    return BigInt(lo) + (BigInt(hi) << 64n)
  }
  if (scVal && typeof scVal === 'object' && 'value' in scVal) {
    return BigInt(scVal.value || 0)
  }
  if (typeof scVal === 'number' || typeof scVal === 'string') {
    return BigInt(scVal)
  }
  // Try scValToNative for u128
  try {
    const { scValToNative } = StellarSdk as any
    if (scValToNative) {
      const native = scValToNative(scVal)
      if (typeof native === 'bigint' || typeof native === 'number') {
        return BigInt(native)
      }
    }
  } catch (e) {
    // Ignore
  }
  return null
}

// Helper to extract string from ScVal (matching test.js)
function extractString(scVal: any): string | null {
  if (scVal && scVal.str) return scVal.str
  if (scVal && typeof scVal === 'string') return scVal
  // Try scValToNative
  try {
    const { scValToNative } = StellarSdk as any
    if (scValToNative) {
      const native = scValToNative(scVal)
      if (typeof native === 'string') return native
    }
  } catch (e) {
    // Ignore
  }
  return null
}

// Read function (view only) - matching test.js
async function readContract(contract: Contract, methodName: string, params: any[] = [], sourceAccount: string): Promise<any> {
  try {
    const server = getServer()
    const account = await server.getAccount(sourceAccount)
    
    const builtTransaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: networkPassphrase,
    })
      .addOperation(contract.call(methodName, ...params))
      .setTimeout(30)
      .build()
    
    const simulation = await server.simulateTransaction(builtTransaction)
    
    // Handle different API versions (matching test.js)
    const SorobanRpc = (StellarSdk as any).SorobanRpc || (StellarSdk as any).rpc || StellarSdk
    const isError = SorobanRpc.Api?.isSimulationError 
      ? SorobanRpc.Api.isSimulationError(simulation)
      : simulation.error !== undefined
    
    if (isError) {
      console.error(`   ❌ Read failed for ${methodName}:`, simulation.error)
      return null
    }
    
    if (simulation.result?.retval) {
      return simulation.result.retval
    }
    
    return null
  } catch (error) {
    console.error(`   ❌ Error reading ${methodName}:`, error)
    return null
  }
}

// Get achievement details by ID (matching test.js)
async function getAchievementDetails(achievementId: number, userAddress: string): Promise<any> {
  try {
    const contract = getAchievementContract()
    const achIdVal = StellarSdk.nativeToScVal(achievementId, { type: 'u128' })
    const achDetails = await readContract(contract, 'get_achievement_details', [achIdVal], userAddress)
    
    if (!achDetails) {
      return null
    }
    
    // Try using SDK's scValToNative (matching test.js)
    try {
      const { scValToNative } = StellarSdk as any
      if (scValToNative) {
        const native = scValToNative(achDetails)
        if (native && typeof native === 'object') {
          return {
            id: native.id?.toString() || achievementId.toString(),
            name: native.name || 'Unknown',
            description: native.description || 'Unknown',
            rarity: native.rarity || 'Unknown',
            icon: native.icon || 'Unknown',
            total_earned: native.total_earned?.toString() || '0',
          }
        }
      }
    } catch (e) {
      // Fall through to manual parsing
    }
    
    // Manual parsing fallback (matching test.js)
    if (Array.isArray(achDetails) && achDetails.length >= 6) {
      return {
        id: extractU128(achDetails[0])?.toString() || achievementId.toString(),
        name: extractString(achDetails[1]) || 'Unknown',
        description: extractString(achDetails[2]) || 'Unknown',
        rarity: extractString(achDetails[3]) || 'Unknown',
        icon: extractString(achDetails[4]) || 'Unknown',
        total_earned: extractU128(achDetails[5])?.toString() || '0',
      }
    }
    
    return null
  } catch (error) {
    console.error(`   ❌ Error getting achievement ${achievementId}:`, error)
    return null
  }
}

export interface Achievement {
  id: number
  name: string
  description: string
  rarity: string
  icon: string
  totalEarned: number
  earned: boolean // Always true for getUserAchievements
}

/**
 * Get user's achievements
 * Uses the exact same logic as getUserAchievements.js
 */
export async function getUserAchievements(userAddress: string): Promise<Achievement[]> {
  try {
    const contract = getAchievementContract()
    
    // Convert user address to Address ScVal (matching test.js)
    const userAddr = new StellarSdk.Address(userAddress)
    const userAddrVal = userAddr.toScVal()
    
    // 1. Get list of achievement IDs for the user (matching test.js)
    console.log('📤 Fetching user achievements...')
    const userAchievements = await readContract(contract, 'get_user_achievements', [userAddrVal], userAddress)
    
    if (!userAchievements) {
      console.log('❌ Failed to retrieve user achievements')
      return []
    }

    // Parse the vector of achievement IDs (matching test.js exactly)
    let achievementIds: number[] = []
    try {
      const { scValToNative } = StellarSdk as any
      if (scValToNative) {
        const native = scValToNative(userAchievements)
        if (Array.isArray(native)) {
          achievementIds = native
            .map((id: any) => {
              if (typeof id === 'bigint') return Number(id)
              if (typeof id === 'number') return id
              const extracted = extractU128(id)
              return extracted ? Number(extracted) : null
            })
            .filter((id: any): id is number => id !== null)
        }
      }
    } catch (e) {
      // Fallback: manual parsing (matching test.js)
      if (userAchievements && userAchievements._arm === 'vec' && Array.isArray(userAchievements._value)) {
        achievementIds = userAchievements._value
          .map((ach: any) => {
            const id = extractU128(ach)
            return id ? Number(id) : null
          })
          .filter((id: any): id is number => id !== null)
      } else if (Array.isArray(userAchievements)) {
        achievementIds = userAchievements
          .map((ach: any) => {
            const id = extractU128(ach)
            return id ? Number(id) : null
          })
          .filter((id: any): id is number => id !== null)
      }
    }

    if (achievementIds.length === 0) {
      console.log('ℹ️  This user has not earned any achievements yet.')
      return []
    }

    console.log(`✅ User has earned ${achievementIds.length} achievement(s):`, achievementIds)

    const achievementsData: Achievement[] = []

    // 2. Get details for each achievement (matching test.js)
    for (let i = 0; i < achievementIds.length; i++) {
      const achId = achievementIds[i]
      const achievement = await getAchievementDetails(achId, userAddress)
      
      if (achievement) {
        achievementsData.push({
          id: Number(achievement.id),
          name: achievement.name,
          description: achievement.description,
          rarity: achievement.rarity,
          icon: achievement.icon,
          totalEarned: Number(achievement.total_earned) || 0,
          earned: true, // All achievements from getUserAchievements are earned
        })
      } else {
        console.log(`⚠️  Achievement ID ${achId}: Could not retrieve details`)
      }
    }

    console.log(`✅ Successfully loaded ${achievementsData.length} achievement details`)
    return achievementsData
  } catch (error) {
    console.error('❌ Error getting user achievements:', error)
    return []
  }
}


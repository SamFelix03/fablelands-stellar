// Achievement Service
// Handles reading achievements from the achievement contract

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

// Helper to extract u128 from ScVal
function extractU128(val: any): bigint | null {
  if (!val) return null
  
  try {
    // Try scValToBigInt from SDK
    const { scValToBigInt } = StellarSdk as any
    if (scValToBigInt && typeof scValToBigInt === 'function') {
      try {
        return scValToBigInt(val)
      } catch (e) {
        // Continue to other methods
      }
    }
    
    // Handle ScVal object format
    if (typeof val === 'object') {
      if (val._arm === 'u128' && val._value !== undefined) {
        return typeof val._value === 'bigint' ? val._value : BigInt(val._value)
      }
      if ('u128' in val) {
        const u128Val = val.u128
        if (typeof u128Val === 'bigint') return u128Val
        if (typeof u128Val === 'string') return BigInt(u128Val)
        if (typeof u128Val === 'number') return BigInt(u128Val)
      }
      if ('hi' in val && 'lo' in val) {
        // Handle u128 as {hi: bigint, lo: bigint}
        const hi = BigInt(val.hi || 0)
        const lo = BigInt(val.lo || 0)
        return hi * BigInt(2**64) + lo
      }
    }
    
    if (typeof val === 'bigint') return val
    if (typeof val === 'number') return BigInt(val)
    if (typeof val === 'string') {
      const num = BigInt(val)
      return isNaN(Number(num)) ? null : num
    }
  } catch (e) {
    console.warn('Error extracting u128:', e)
  }
  
  return null
}

// Helper to extract string from ScVal
function extractString(val: any): string | null {
  if (!val) return null
  
  try {
    // Try scValToNative from SDK
    const { scValToNative } = StellarSdk as any
    if (scValToNative && typeof scValToNative === 'function') {
      try {
        const native = scValToNative(val)
        if (typeof native === 'string') return native
      } catch (e) {
        // Continue to other methods
      }
    }
    
    // Handle ScVal object format
    if (typeof val === 'object') {
      if (val._arm === 'string' && val._value) {
        return val._value.toString()
      }
      if ('string' in val) {
        return val.string.toString()
      }
    }
    
    if (typeof val === 'string') return val
    if (val && typeof val.toString === 'function') {
      return val.toString()
    }
  } catch (e) {
    console.warn('Error extracting string:', e)
  }
  
  return null
}

// Helper to extract bool from ScVal
function extractBool(val: any): boolean | null {
  if (!val) return null
  
  try {
    // Handle ScVal object format
    if (typeof val === 'object') {
      if (val._arm === 'bool') {
        return val._value === true || val._value === 1
      }
      if ('bool' in val) {
        return val.bool === true || val.bool === 1
      }
    }
    
    if (typeof val === 'boolean') return val
    if (val === 1 || val === 'true' || val === true) return true
    if (val === 0 || val === 'false' || val === false) return false
  } catch (e) {
    console.warn('Error extracting bool:', e)
  }
  
  return null
}

// Read from achievement contract
async function readAchievementContract(
  methodName: string,
  params: any[] = [],
  sourceAccount: string
): Promise<any> {
  try {
    const server = getServer()
    const contract = getAchievementContract()
    
    const account = await server.getAccount(sourceAccount)
    
    const builtTransaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: networkPassphrase,
    })
      .addOperation(contract.call(methodName, ...params))
      .setTimeout(30)
      .build()
    
    const simulation = await server.simulateTransaction(builtTransaction)
    
    if (simulation.error) {
      const errorMessage = simulation.error?.message || ''
      const isNotFoundError = errorMessage.includes('UnreachableCodeReached') || 
                             errorMessage.includes('InvalidAction') ||
                             errorMessage.includes('WasmVm')
      
      if (!isNotFoundError) {
        console.error(`Achievement contract read failed for ${methodName}:`, simulation.error)
      }
      return null
    }
    
    if (simulation.result?.retval) {
      return simulation.result.retval
    }
    
    return null
  } catch (error) {
    console.error(`Error reading achievement contract ${methodName}:`, error)
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
  earned: boolean
}

export interface PetAchievements {
  petId: number
  achievements: Achievement[]
  totalCount: number
}

/**
 * Get all available achievements
 */
export async function getAllAchievements(userAddress: string): Promise<Achievement[]> {
  try {
    const result = await readAchievementContract('get_all_achievements', [], userAddress)
    
    if (!result || !Array.isArray(result)) {
      return []
    }
    
    const achievements: Achievement[] = []
    
    for (const ach of result) {
      if (ach && Array.isArray(ach) && ach.length >= 2) {
        const id = extractU128(ach[0])
        const name = extractString(ach[1])
        
        if (id !== null && name !== null) {
          // Get full details for this achievement
          const details = await getAchievementDetails(Number(id), userAddress)
          if (details) {
            achievements.push(details)
          }
        }
      }
    }
    
    return achievements
  } catch (error) {
    console.error('Error getting all achievements:', error)
    return []
  }
}

/**
 * Get achievement details by ID
 */
export async function getAchievementDetails(achievementId: number, userAddress: string): Promise<Achievement | null> {
  try {
    const achIdVal = StellarSdk.nativeToScVal(achievementId, { type: 'u128' })
    const result = await readAchievementContract('get_achievement_details', [achIdVal], userAddress)
    
    if (!result || !Array.isArray(result) || result.length < 6) {
      return null
    }
    
    const id = extractU128(result[0])
    const name = extractString(result[1])
    const description = extractString(result[2])
    const rarity = extractString(result[3])
    const icon = extractString(result[4])
    const totalEarned = extractU128(result[5])
    
    // Check if user has earned this achievement
    const callerAddr = new StellarSdk.Address(userAddress).toScVal()
    const hasEarnedResult = await readAchievementContract('has_earned', [callerAddr, achIdVal], userAddress)
    const earned = extractBool(hasEarnedResult) || false
    
    if (id === null || name === null) {
      return null
    }
    
    return {
      id: Number(id),
      name: name || 'Unknown Achievement',
      description: description || '',
      rarity: rarity || 'common',
      icon: icon || '🏆',
      totalEarned: totalEarned ? Number(totalEarned) : 0,
      earned,
    }
  } catch (error) {
    console.error('Error getting achievement details:', error)
    return null
  }
}

/**
 * Get user's achievements
 */
export async function getUserAchievements(userAddress: string): Promise<Achievement[]> {
  try {
    const callerAddr = new StellarSdk.Address(userAddress).toScVal()
    const result = await readAchievementContract('get_user_achievements', [callerAddr], userAddress)
    
    if (!result || !Array.isArray(result)) {
      return []
    }
    
    const achievementIds: number[] = []
    
    for (const ach of result) {
      const id = extractU128(ach)
      if (id !== null) {
        achievementIds.push(Number(id))
      }
    }
    
    // Get details for each achievement
    const achievements = await Promise.all(
      achievementIds.map(id => getAchievementDetails(id, userAddress))
    )
    
    return achievements.filter((ach): ach is Achievement => ach !== null)
  } catch (error) {
    console.error('Error getting user achievements:', error)
    return []
  }
}

/**
 * Get pet-specific achievements
 */
export async function getPetAchievements(petId: number, userAddress: string): Promise<PetAchievements> {
  try {
    const petIdVal = StellarSdk.nativeToScVal(petId, { type: 'u128' })
    const result = await readAchievementContract('get_pet_achievements', [petIdVal], userAddress)
    
    if (!result || !Array.isArray(result)) {
      return {
        petId,
        achievements: [],
        totalCount: 0,
      }
    }
    
    const achievementIds: number[] = []
    
    for (const ach of result) {
      const id = extractU128(ach)
      if (id !== null) {
        achievementIds.push(Number(id))
      }
    }
    
    // Get details for each achievement
    const achievements = await Promise.all(
      achievementIds.map(id => getAchievementDetails(id, userAddress))
    )
    
    const validAchievements = achievements.filter((ach): ach is Achievement => ach !== null)
    
    return {
      petId,
      achievements: validAchievements,
      totalCount: validAchievements.length,
    }
  } catch (error) {
    console.error('Error getting pet achievements:', error)
    return {
      petId,
      achievements: [],
      totalCount: 0,
    }
  }
}

/**
 * Get all achievements with earned status for a pet
 * This combines all achievements with their earned status
 */
export async function getAllAchievementsWithStatus(petId: number, userAddress: string): Promise<Achievement[]> {
  try {
    // Get all available achievements
    const allAchievements = await getAllAchievements(userAddress)
    
    // Get pet's earned achievements
    const petAchievements = await getPetAchievements(petId, userAddress)
    const earnedIds = new Set(petAchievements.achievements.map(a => a.id))
    
    // Mark which achievements are earned
    return allAchievements.map(ach => ({
      ...ach,
      earned: earnedIds.has(ach.id),
    }))
  } catch (error) {
    console.error('Error getting all achievements with status:', error)
    return []
  }
}


// Auto Update Service
// Handles automatic pet state updates using a secret key
// Updates ALL pets in the contract regardless of owner

import * as StellarSdk from '@stellar/stellar-sdk'
import { rpc as StellarRpc } from '@stellar/stellar-sdk'
import { Contract } from '@stellar/stellar-sdk'
import { rpcUrl, networkPassphrase } from '../contracts/util'
import { getPetInfo } from './petworldContract'

// Get contract address from environment
const getContractAddress = () => {
  return import.meta.env?.PUBLIC_PETWORLD_CONTRACT || 'CCS7FD7WUCYW6RAHYBUYO6NPXBDZHFLSUA4SNBASMXJNQUCB4JOEH3TQ'
}

const PETWORLD_CONTRACT = getContractAddress()
const RPC_URL = rpcUrl || 'https://soroban-testnet.stellar.org'

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

function getContract() {
  if (!contract) {
    contract = new Contract(PETWORLD_CONTRACT)
  }
  return contract
}

// Sign transaction with secret key
function signWithSecretKey(
  transaction: StellarSdk.Transaction,
  secretKey: string
): StellarSdk.Transaction {
  const keypair = StellarSdk.Keypair.fromSecret(secretKey)
  transaction.sign(keypair)
  return transaction
}

// Update pet state using secret key
export async function autoUpdatePetState(
  tokenId: number | bigint,
  secretKey: string
): Promise<{ success: boolean; hash?: string; error?: string }> {
  try {
    const server = getServer()
    const contract = getContract()
    
    // Get the account from the secret key
    const keypair = StellarSdk.Keypair.fromSecret(secretKey)
    const userAddress = keypair.publicKey()
    
    const sourceAccount = await server.getAccount(userAddress)
    
    const petIdVal = StellarSdk.nativeToScVal(tokenId, { type: 'u128' })
    
    const builtTransaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: networkPassphrase,
    })
      .addOperation(contract.call('update_state', petIdVal))
      .setTimeout(30)
      .build()
    
    const simulation = await server.simulateTransaction(builtTransaction)
    
    if (simulation.error) {
      return {
        success: false,
        error: simulation.error?.message || 'Simulation failed',
      }
    }
    
    // Prepare transaction
    const preparedTx = await server.prepareTransaction(builtTransaction)
    
    // Sign with secret key
    const signedTx = signWithSecretKey(preparedTx, secretKey)
    
    // Send transaction
    const sendResponse = await server.sendTransaction(signedTx)
    
    // Wait for transaction to be included in a ledger
    let txResponse = null
    const MAX_ATTEMPTS = 10
    let attempts = 0
    
    while (attempts++ < MAX_ATTEMPTS && txResponse?.status !== 'SUCCESS') {
      try {
        txResponse = await server.getTransaction(sendResponse.hash)
        
        if (txResponse.status === 'SUCCESS') {
          break
        } else if (txResponse.status === 'FAILED') {
          return {
            success: false,
            error: 'Transaction failed',
          }
        }
        // Wait 1 second before next attempt
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        // Transaction not found yet, wait and retry
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    if (!txResponse || txResponse.status !== 'SUCCESS') {
      return {
        success: false,
        error: 'Transaction not confirmed in time',
      }
    }
    
    return {
      success: true,
      hash: sendResponse.hash,
    }
  } catch (error: any) {
    console.error('Error auto-updating pet state:', error)
    return {
      success: false,
      error: error.message || 'Unknown error',
    }
  }
}

// Get all pet IDs in the contract by iterating through token IDs
async function getAllPetIds(secretKey: string): Promise<number[]> {
  try {
    const keypair = StellarSdk.Keypair.fromSecret(secretKey)
    const userAddress = keypair.publicKey()
    
    console.log(`🔍 Scanning for all pets in contract...`)
    console.log(`   Using account: ${userAddress}`)
    
    const petIds: number[] = []
    let tokenId = 1 // Start from token ID 1
    const MAX_ITERATIONS = 10000 // Safety limit to prevent infinite loops
    let consecutiveNotFound = 0
    const MAX_CONSECUTIVE_NOT_FOUND = 10 // Stop after 10 consecutive not found
    
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      try {
        // Try to get pet info - if it exists, add to list
        const petInfo = await getPetInfo(tokenId, userAddress)
        if (petInfo && petInfo.name) {
          petIds.push(tokenId)
          consecutiveNotFound = 0 // Reset counter
          console.log(`  ✅ Found pet #${tokenId}: ${petInfo.name}`)
        } else {
          // Pet doesn't exist (returned null)
          consecutiveNotFound++
          if (consecutiveNotFound >= MAX_CONSECUTIVE_NOT_FOUND) {
            console.log(`  ⏹️ Stopped scanning after ${MAX_CONSECUTIVE_NOT_FOUND} consecutive not found (last checked: #${tokenId})`)
            break
          }
        }
      } catch (error: any) {
        // Contract panics for non-existent pets - this is expected
        const errorMessage = error?.message || ''
        const isNotFoundError = errorMessage.includes('UnreachableCodeReached') || 
                               errorMessage.includes('InvalidAction') ||
                               errorMessage.includes('WasmVm') ||
                               errorMessage.includes('HostError')
        
        if (isNotFoundError) {
          // This is expected - pet doesn't exist
          consecutiveNotFound++
          if (consecutiveNotFound >= MAX_CONSECUTIVE_NOT_FOUND) {
            console.log(`  ⏹️ Stopped scanning after ${MAX_CONSECUTIVE_NOT_FOUND} consecutive not found (last checked: #${tokenId})`)
            break
          }
        } else {
          // Unexpected error - log it
          console.warn(`  ⚠️ Unexpected error checking pet #${tokenId}:`, errorMessage)
          consecutiveNotFound++
          if (consecutiveNotFound >= MAX_CONSECUTIVE_NOT_FOUND) {
            console.log(`  ⏹️ Stopped scanning after ${MAX_CONSECUTIVE_NOT_FOUND} consecutive errors (last checked: #${tokenId})`)
            break
          }
        }
        
        // If we've found pets and checked many IDs past the last one, stop
        if (petIds.length > 0 && tokenId > petIds[petIds.length - 1] + MAX_CONSECUTIVE_NOT_FOUND) {
          console.log(`  ⏹️ Stopped scanning (checked ${MAX_CONSECUTIVE_NOT_FOUND} IDs past last found pet)`)
          break
        }
      }
      
      tokenId++
      
      // Small delay to avoid overwhelming the network
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    console.log(`✅ Found ${petIds.length} pet(s) in contract: [${petIds.join(', ')}]`)
    return petIds
  } catch (error: any) {
    console.error('❌ Error in getAllPetIds:', error)
    console.error('   Error message:', error.message)
    return []
  }
}

// Update all pets in the contract (regardless of owner)
export async function autoUpdateAllPets(
  secretKey: string
): Promise<{ success: boolean; updated: number; errors: string[] }> {
  try {
    // Get all pet IDs in the contract
    const petIds = await getAllPetIds(secretKey)
    
    if (petIds.length === 0) {
      console.log('ℹ️ No pets found in contract')
      return {
        success: true,
        updated: 0,
        errors: [],
      }
    }
    
    console.log(`🔄 Auto-updating ${petIds.length} pet(s) in contract...`)
    
    const errors: string[] = []
    let updated = 0
    
    // Update each pet sequentially to avoid rate limiting
    for (const petId of petIds) {
      const result = await autoUpdatePetState(petId, secretKey)
      if (result.success) {
        updated++
        console.log(`✅ Updated pet #${petId}`)
      } else {
        errors.push(`Pet #${petId}: ${result.error || 'Unknown error'}`)
        console.error(`❌ Failed to update pet #${petId}:`, result.error)
      }
      
      // Small delay between updates to avoid overwhelming the network
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    console.log(`✅ Auto-update complete: ${updated}/${petIds.length} pets updated`)
    
    return {
      success: errors.length === 0,
      updated,
      errors,
    }
  } catch (error: any) {
    console.error('Error in auto-update all pets:', error)
    return {
      success: false,
      updated: 0,
      errors: [error.message || 'Unknown error'],
    }
  }
}


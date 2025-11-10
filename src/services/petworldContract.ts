// Stellar PetWorld Contract Service
// Handles all contract interactions for reading and writing pet data

import * as StellarSdk from '@stellar/stellar-sdk'
import { Contract, rpc as StellarRpc, scValToBigInt, scValToNative } from '@stellar/stellar-sdk'
import { rpcUrl, networkPassphrase } from '../contracts/util'

// Get contract address from environment or use default testnet contract
const getContractAddress = () => {
  // @ts-ignore - import.meta.env is available in Vite
  return import.meta.env?.PUBLIC_PETWORLD_CONTRACT || 'CCS7FD7WUCYW6RAHYBUYO6NPXBDZHFLSUA4SNBASMXJNQUCB4JOEH3TQ'
}

const PETWORLD_CONTRACT = getContractAddress()
const RPC_URL = rpcUrl || 'https://soroban-testnet.stellar.org'

let server: any
let contract: Contract

// Initialize server and contract
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

export interface PetInfo {
  name: string
  birthDate: number
  age: number
  evolutionStage: number // 0 = Egg, 1 = Baby, 2 = Teen, 3 = Adult
  happiness: number
  hunger: number
  health: number
  ledgersSinceUpdate: number
  isDead: boolean
  deathTimestamp: number
}

// Read contract data (view only, no transaction needed)
export async function readContract(
  methodName: string,
  params: any[] = [],
  sourceAccount?: string
): Promise<any> {
  try {
    const server = getServer()
    const contract = getContract()
    
    // For read operations, we need a real account that exists on the network
    // If no source account provided, we'll try to use a well-known account or fail
    if (!sourceAccount) {
      console.warn(`readContract called without sourceAccount for ${methodName}. This may fail.`)
      // Try to use a dummy account - but this will likely fail
      // The caller should provide a valid account address
      throw new Error('Source account is required for read operations')
    }
    
    const account = await server.getAccount(sourceAccount)
    
    const builtTransaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: networkPassphrase,
    })
      .addOperation(contract.call(methodName, ...params))
      .setTimeout(30)
      .build()
    
    const simulation = await server.simulateTransaction(builtTransaction)
    
    // Check for errors
    if (simulation.error) {
      // Check if it's a "pet doesn't exist" error (UnreachableCodeReached)
      const errorMessage = simulation.error?.message || ''
      const isNotFoundError = errorMessage.includes('UnreachableCodeReached') || 
                             errorMessage.includes('InvalidAction') ||
                             errorMessage.includes('WasmVm')
      
      // Only log non-expected errors (suppress "not found" errors for scanning)
      if (!isNotFoundError) {
        console.error(`Read failed for ${methodName}:`, simulation.error)
      }
      return null
    }
    
    if (simulation.result?.retval) {
      return simulation.result.retval
    }
    
    return null
  } catch (error) {
    console.error(`Error reading ${methodName}:`, error)
    return null
  }
}

// Get pet information from contract
export async function getPetInfo(tokenId: number | bigint, userAddress?: string): Promise<PetInfo | null> {
  try {
    const petIdVal = StellarSdk.nativeToScVal(tokenId, { type: 'u128' })
    const result = await readContract('get_pet_info', [petIdVal], userAddress)
    
    if (!result) {
      return null
    }

    // Parse the result tuple
    // Result format: (String, u32, u32, EvolutionStage, u32, u32, u32, u32, bool, u64)
    // name, birth_date, age, evolution_stage, happiness, hunger, health, ledgers_since_update, is_dead, death_timestamp
    
    const DEBUG = false // Set to true for detailed parsing logs
    
    if (DEBUG) {
      console.log('Raw pet info result:', result)
      console.log('Result type:', typeof result)
      console.log('Result keys:', result ? Object.keys(result) : 'null')
    }
    
    let arr: any[] = []
    
    // Try different ways to extract tuple values
    try {
      // Method 1: Check if it's an ScVal tuple with _value array
      if (result && typeof result === 'object') {
        if (result._arm === 'vec' && result._value) {
          // Tuple is returned as a Vec
          arr = Array.from(result._value)
        } else if (result._value && Array.isArray(result._value)) {
          arr = Array.from(result._value)
        } else if (result.values && typeof result.values === 'function') {
          arr = Array.from(result.values())
        } else if (Array.isArray(result)) {
          arr = result
        } else if (result instanceof Array) {
          arr = Array.from(result)
        }
      }
      
      if (DEBUG) {
        console.log('Extracted array:', arr)
        console.log('Array length:', arr.length)
      }
      
      // Parse each value in the tuple
      const parseValue = (val: any, index: number): any => {
        if (DEBUG) {
          console.log(`  Parsing value ${index}:`, val, 'Type:', typeof val)
        }
        
        // Try scValToNative first
        if (scValToNative && typeof scValToNative === 'function') {
          try {
            const native = scValToNative(val)
            if (DEBUG) {
              console.log(`    -> scValToNative: ${native}`)
            }
            return native
          } catch (e) {
            // Continue to other methods
          }
        }
        
        // Handle string
        if (val && typeof val === 'object' && val._arm === 'string' && val._value) {
          return val._value.toString()
        }
        
        // Handle u32/u64/u128
        if (val && typeof val === 'object' && (val._arm === 'u32' || val._arm === 'u64' || val._arm === 'u128')) {
          if (scValToBigInt && typeof scValToBigInt === 'function') {
            try {
              return Number(scValToBigInt(val))
            } catch (e) {
              // Continue
            }
          }
          if (val._value !== undefined) {
            return typeof val._value === 'bigint' ? Number(val._value) : Number(val._value)
          }
        }
        
        // Handle bool
        if (val && typeof val === 'object' && val._arm === 'bool') {
          return val._value === true || val._value === 1
        }
        
        // Direct values
        if (typeof val === 'bigint') return Number(val)
        if (typeof val === 'number') return val
        if (typeof val === 'string') return val
        if (typeof val === 'boolean') return val
        
        // Try toString
        if (val && typeof val.toString === 'function') {
          const str = val.toString()
          // Try to parse as number if it looks like one
          if (!isNaN(Number(str)) && str.trim() !== '') {
            return Number(str)
          }
          return str
        }
        
        return val
      }
      
      const parsedValues = arr.map((val, idx) => parseValue(val, idx))
      if (DEBUG) {
        console.log('Parsed values:', parsedValues)
      }
      
      return {
        name: parsedValues[0]?.toString() || '',
        birthDate: Number(parsedValues[1]) || 0,
        age: Number(parsedValues[2]) || 0,
        evolutionStage: Number(parsedValues[3]) || 0,
        happiness: Number(parsedValues[4]) || 0,
        hunger: Number(parsedValues[5]) || 0,
        health: Number(parsedValues[6]) || 0,
        ledgersSinceUpdate: Number(parsedValues[7]) || 0,
        isDead: parsedValues[8] === true || parsedValues[8] === 1 || parsedValues[8] === 'true',
        deathTimestamp: Number(parsedValues[9]) || 0,
      }
    } catch (parseError) {
      console.error('Error parsing pet info tuple:', parseError)
      return null
    }
  } catch (error) {
    console.error('Error getting pet info:', error)
    return null
  }
}

// Get all pets owned by a user
export async function getUserPets(userAddress: string): Promise<number[]> {
  try {
    const callerAddr = new StellarSdk.Address(userAddress).toScVal()
    const result = await readContract('get_user_pets', [callerAddr], userAddress)
    
    if (!result) {
      return []
    }

    // Parse Vec<u128> result
    // The result might be an ScVal Vec or an array-like object
    let petIds: number[] = []
    
    try {
      // Handle ScVal object format: {_switch, _arm: 'vec', _value: Array}
      if (result && typeof result === 'object' && result._arm === 'vec' && result._value) {
        const values = result._value
        console.log('Raw values array:', values)
        console.log('First value structure:', values[0])
        console.log('First value type:', typeof values[0])
        console.log('First value keys:', values[0] ? Object.keys(values[0]) : 'null')
        
        petIds = Array.from(values).map((v: any, index: number) => {
          console.log(`Processing value ${index}:`, v, 'Type:', typeof v)
          
          try {
            // Try using SDK's scValToBigInt first (most reliable)
            if (scValToBigInt && typeof scValToBigInt === 'function') {
              try {
                const bigIntVal = scValToBigInt(v)
                const num = Number(bigIntVal)
                console.log(`  -> scValToBigInt: ${bigIntVal} -> ${num}`)
                if (!isNaN(num)) return num
              } catch (e) {
                console.log(`  -> scValToBigInt failed:`, e)
              }
            }
            
            // Try using SDK's scValToNative
            if (scValToNative && typeof scValToNative === 'function') {
              try {
                const nativeVal = scValToNative(v)
                const num = typeof nativeVal === 'bigint' ? Number(nativeVal) : Number(nativeVal)
                console.log(`  -> scValToNative: ${nativeVal} -> ${num}`)
                if (!isNaN(num)) return num
              } catch (e) {
                console.log(`  -> scValToNative failed:`, e)
              }
            }
            
            // Fallback: Handle different ScVal formats for u128 values
            if (typeof v === 'bigint') {
              const num = Number(v)
              console.log(`  -> bigint: ${v} -> ${num}`)
              return num
            }
            if (typeof v === 'number') {
              console.log(`  -> number: ${v}`)
              return v
            }
            if (typeof v === 'string') {
              const num = Number(v)
              console.log(`  -> string: ${v} -> ${num}`)
              return num
            }
            // Handle ScVal u128 format: {_switch, _arm: 'u128', _value: bigint}
            if (v && typeof v === 'object') {
              console.log(`  -> object, keys:`, Object.keys(v))
              if (v._arm === 'u128' && v._value !== undefined) {
                const num = typeof v._value === 'bigint' ? Number(v._value) : Number(v._value)
                console.log(`  -> ScVal u128: ${v._value} -> ${num}`)
                if (!isNaN(num)) return num
              }
              // Try other possible property names
              if (v.value !== undefined) {
                const num = typeof v.value === 'bigint' ? Number(v.value) : Number(v.value)
                console.log(`  -> v.value: ${v.value} -> ${num}`)
                if (!isNaN(num)) return num
              }
              // Try to find any numeric property
              for (const key of Object.keys(v)) {
                if (key === '_value' || key === 'value' || key === 'val') {
                  const val = v[key]
                  const num = typeof val === 'bigint' ? Number(val) : Number(val)
                  console.log(`  -> ${key}: ${val} -> ${num}`)
                  if (!isNaN(num)) return num
                }
              }
            }
            if (v && typeof v.toString === 'function') {
              const num = Number(v.toString())
              console.log(`  -> toString(): ${v.toString()} -> ${num}`)
              if (!isNaN(num)) return num
            }
            console.warn(`  -> Could not parse value:`, v)
            return NaN
          } catch (error) {
            console.error(`  -> Error parsing value ${index}:`, error)
            return NaN
          }
        })
      } else if (result.values && typeof result.values === 'function') {
        const values = result.values()
        petIds = Array.from(values).map((v: any) => {
          // Handle different ScVal formats
          if (typeof v === 'bigint') return Number(v)
          if (typeof v === 'number') return v
          if (typeof v === 'string') return Number(v)
          if (v && typeof v === 'object' && v._arm === 'u128' && v._value !== undefined) {
            return Number(v._value)
          }
          if (v && typeof v.toString === 'function') return Number(v.toString())
          if (v && v.value !== undefined) return Number(v.value)
          return Number(v)
        })
      } else if (Array.isArray(result)) {
        petIds = result.map((v: any) => {
          if (v && typeof v === 'object' && v._arm === 'u128' && v._value !== undefined) {
            return Number(v._value)
          }
          return Number(v)
        })
      } else if (result instanceof Array) {
        petIds = Array.from(result).map((v: any) => {
          if (v && typeof v === 'object' && v._arm === 'u128' && v._value !== undefined) {
            return Number(v._value)
          }
          return Number(v)
        })
      } else {
        // Try to access as object with length or similar
        console.warn('Unexpected getUserPets result format:', result)
      }
    } catch (parseError) {
      console.error('Error parsing getUserPets result:', parseError, result)
    }
    
    console.log('Parsed pet IDs:', petIds)
    return petIds.filter(id => !isNaN(id) && id > 0)
  } catch (error) {
    console.error('Error getting user pets:', error)
    return []
  }
}

// Invoke contract method (write operation)
// signTransactionFn should be from useWallet hook
export async function invokeContract(
  methodName: string,
  params: any[] = [],
  userAddress: string,
  signTransactionFn: (xdr: string, options: { address: string; networkPassphrase: string }) => Promise<{ signedTxXdr: string }>
): Promise<{ success: boolean; hash?: string; returnValue?: any; error?: string }> {
  try {
    const server = getServer()
    const contract = getContract()
    
    const sourceAccount = await server.getAccount(userAddress)
    
    const builtTransaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: networkPassphrase,
    })
      .addOperation(contract.call(methodName, ...params))
      .setTimeout(30)
      .build()
    
    const simulation = await server.simulateTransaction(builtTransaction)
    
    if (simulation.error) {
      return {
        success: false,
        error: simulation.error?.message || 'Simulation failed',
      }
    }
    
    // Use prepareTransaction which handles both simulation and assembly
    const preparedTx = await server.prepareTransaction(builtTransaction)
    const preparedTransaction = preparedTx
    
    // Sign transaction using wallet
    const xdr = preparedTransaction.toXDR()
    let signedResult
    try {
      signedResult = await signTransactionFn(xdr, {
        address: userAddress,
        networkPassphrase: networkPassphrase,
      })
    } catch (error: any) {
      // User rejected the transaction or signing failed
      return {
        success: false,
        error: error.message || 'Transaction was rejected or signing failed',
      }
    }
    
    if (!signedResult || !signedResult.signedTxXdr) {
      return {
        success: false,
        error: 'Transaction signing failed - no signed transaction returned',
      }
    }
    
    const signedTx = StellarSdk.TransactionBuilder.fromXDR(
      signedResult.signedTxXdr,
      networkPassphrase
    )
    
    let sendResponse
    try {
      sendResponse = await server.sendTransaction(signedTx)
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to send transaction to network',
      }
    }
    
    if (!sendResponse || !sendResponse.hash) {
      return {
        success: false,
        error: 'Transaction send failed - no hash returned',
      }
    }
    
    // Extract return value from simulation (for mint, this is the token ID)
    let returnValue: any = null
    if (simulation.result?.retval) {
      returnValue = simulation.result.retval
    }
    
    // Wait for transaction to be included in a ledger
    // Poll until transaction is found
    let txResponse = null
    const MAX_ATTEMPTS = 10
    let attempts = 0
    
    while (attempts++ < MAX_ATTEMPTS && txResponse?.status !== 'SUCCESS') {
      try {
        txResponse = await server.getTransaction(sendResponse.hash)
        
        if (txResponse.status === 'SUCCESS') {
          break
        } else if (txResponse.status === 'FAILED') {
          // Try to get more details about the failure
          const errorMessage = txResponse.resultXdr 
            ? 'Transaction failed on-chain' 
            : 'Transaction failed'
          return {
            success: false,
            error: errorMessage,
          }
        }
        // Wait 1 second before next attempt
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error: any) {
        // Transaction not found yet, wait and retry
        if (attempts >= MAX_ATTEMPTS) {
          return {
            success: false,
            error: `Transaction not found after ${MAX_ATTEMPTS} attempts: ${error.message || 'Unknown error'}`,
          }
        }
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    if (!txResponse || txResponse.status !== 'SUCCESS') {
      return {
        success: false,
        error: txResponse?.status === 'FAILED' 
          ? 'Transaction failed on-chain' 
          : 'Transaction not confirmed in time',
      }
    }
    
    return {
      success: true,
      hash: sendResponse.hash,
      returnValue: returnValue, // This will contain the token ID for mint
    }
  } catch (error: any) {
    console.error(`Error invoking ${methodName}:`, error)
    return {
      success: false,
      error: error.message || 'Unknown error',
    }
  }
}

// Feed a pet
export async function feedPet(
  tokenId: number | bigint,
  userAddress: string,
  signTransactionFn: (xdr: string, options: { address: string; networkPassphrase: string }) => Promise<{ signedTxXdr: string }>
): Promise<{ success: boolean; hash?: string; error?: string }> {
  const callerAddr = new StellarSdk.Address(userAddress).toScVal()
  const petIdVal = StellarSdk.nativeToScVal(tokenId, { type: 'u128' })
  
  return invokeContract('feed', [callerAddr, petIdVal], userAddress, signTransactionFn)
}

// Play with a pet
export async function playWithPet(
  tokenId: number | bigint,
  userAddress: string,
  signTransactionFn: (xdr: string, options: { address: string; networkPassphrase: string }) => Promise<{ signedTxXdr: string }>
): Promise<{ success: boolean; hash?: string; error?: string }> {
  const callerAddr = new StellarSdk.Address(userAddress).toScVal()
  const petIdVal = StellarSdk.nativeToScVal(tokenId, { type: 'u128' })
  
  return invokeContract('play', [callerAddr, petIdVal], userAddress, signTransactionFn)
}

// Update pet state
export async function updatePetState(
  tokenId: number | bigint,
  userAddress: string,
  signTransactionFn: (xdr: string, options: { address: string; networkPassphrase: string }) => Promise<{ signedTxXdr: string }>
): Promise<{ success: boolean; hash?: string; error?: string }> {
  const petIdVal = StellarSdk.nativeToScVal(tokenId, { type: 'u128' })
  
  return invokeContract('update_state', [petIdVal], userAddress, signTransactionFn)
}

// Mint a new pet
export async function mintPet(
  petName: string,
  userAddress: string,
  signTransactionFn: (xdr: string, options: { address: string; networkPassphrase: string }) => Promise<{ signedTxXdr: string }>
): Promise<{ success: boolean; tokenId?: number; hash?: string; error?: string }> {
  try {
    // Validate name length (contract requires 1-20 characters)
    if (!petName || petName.trim().length === 0 || petName.length > 20) {
      return {
        success: false,
        error: 'Pet name must be between 1 and 20 characters',
      }
    }

    const callerAddr = new StellarSdk.Address(userAddress).toScVal()
    const nameVal = StellarSdk.nativeToScVal(petName.trim(), { type: 'string' })
    
    const result = await invokeContract('mint', [callerAddr, nameVal], userAddress, signTransactionFn)
    
    if (result.success) {
      // Extract token ID from return value (u128) if available
      let tokenId: number | undefined
      
      if (result.returnValue) {
        try {
          console.log('Attempting to extract token ID from returnValue:', result.returnValue)
          console.log('ReturnValue type:', typeof result.returnValue)
          console.log('ReturnValue keys:', typeof result.returnValue === 'object' ? Object.keys(result.returnValue) : 'N/A')
          
          // Try to extract the u128 value from ScVal
          // ScVal for u128 might be in different formats depending on SDK version
          if (typeof result.returnValue === 'object' && result.returnValue !== null) {
            // Handle ScVal object - might have a 'u128' property or be a BigInt
            if ('u128' in result.returnValue) {
              const u128Val = result.returnValue.u128
              if (typeof u128Val === 'bigint') {
                tokenId = Number(u128Val)
              } else if (typeof u128Val === 'string') {
                tokenId = Number(u128Val)
              } else if (typeof u128Val === 'number') {
                tokenId = u128Val
              } else if (u128Val && typeof u128Val === 'object' && 'hi' in u128Val && 'lo' in u128Val) {
                // Handle u128 as {hi: bigint, lo: bigint}
                const hi = BigInt(u128Val.hi || 0)
                const lo = BigInt(u128Val.lo || 0)
                tokenId = Number(hi * BigInt(2**64) + lo)
              }
            } else if ('_arm' in result.returnValue && result.returnValue._arm === 'u128') {
              // Handle ScVal with _arm: 'u128'
              if (result.returnValue._value !== undefined) {
                const val = result.returnValue._value
                if (typeof val === 'bigint') {
                  tokenId = Number(val)
                } else if (typeof val === 'string') {
                  tokenId = Number(val)
                } else if (typeof val === 'number') {
                  tokenId = val
                } else if (val && typeof val === 'object' && 'hi' in val && 'lo' in val) {
                  const hi = BigInt(val.hi || 0)
                  const lo = BigInt(val.lo || 0)
                  tokenId = Number(hi * BigInt(2**64) + lo)
                }
              }
            } else if (result.returnValue.toString) {
              const str = result.returnValue.toString()
              tokenId = Number(str)
            } else if (result.returnValue.value !== undefined) {
              const val = result.returnValue.value
              if (typeof val === 'bigint') {
                tokenId = Number(val)
              } else {
                tokenId = Number(val)
              }
            } else if ('hi' in result.returnValue && 'lo' in result.returnValue) {
              // Handle u128 as {hi: bigint, lo: bigint}
              const hi = BigInt(result.returnValue.hi || 0)
              const lo = BigInt(result.returnValue.lo || 0)
              tokenId = Number(hi * BigInt(2**64) + lo)
            }
          } else if (typeof result.returnValue === 'bigint') {
            tokenId = Number(result.returnValue)
          } else if (typeof result.returnValue === 'number') {
            tokenId = result.returnValue
          } else if (typeof result.returnValue === 'string') {
            tokenId = Number(result.returnValue)
          }
          
          // Validate tokenId
          if (tokenId !== undefined && (isNaN(tokenId) || tokenId < 0)) {
            console.warn('Extracted tokenId is invalid:', tokenId)
            tokenId = undefined
          }
        } catch (e) {
          console.warn('Could not extract token ID from return value:', e)
          console.warn('ReturnValue:', result.returnValue)
        }
      }
      
      // If we couldn't extract tokenId, try to get it from the user's pets list
      if (tokenId === undefined || isNaN(tokenId)) {
        console.log('Token ID extraction failed, attempting to fetch from user pets...')
        try {
          // Wait a bit for the transaction to be indexed
          await new Promise(resolve => setTimeout(resolve, 2000))
          const userPets = await getUserPets(userAddress)
          if (userPets.length > 0) {
            // Get the highest token ID (most recent mint)
            const maxTokenId = Math.max(...userPets)
            tokenId = maxTokenId
            console.log('Found token ID from user pets:', tokenId)
          }
        } catch (e) {
          console.warn('Could not fetch token ID from user pets:', e)
        }
      }
      
      return {
        success: true,
        hash: result.hash,
        tokenId: tokenId,
      }
    }
    
    // If not successful, ensure we have an error message
    return {
      success: false,
      error: result.error || 'Minting failed - unknown error',
      hash: result.hash,
    }
  } catch (error: any) {
    console.error('Error minting pet:', error)
    return {
      success: false,
      error: error.message || 'Failed to mint pet',
    }
  }
}


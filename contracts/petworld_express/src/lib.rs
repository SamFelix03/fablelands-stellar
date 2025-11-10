#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, String, Vec, log, Symbol, IntoVal,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EvolutionStage {
    Egg = 0,
    Baby = 1,
    Teen = 2,
    Adult = 3,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Pet {
    pub name: String,
    pub birth_date: u32,              // Ledger sequence when minted
    pub last_updated_ledger: u32,     // Last ledger sequence when stats were updated
    pub evolution_stage: EvolutionStage,
    pub happiness: u32,
    pub hunger: u32,
    pub health: u32,
    pub is_dead: bool,
    pub death_timestamp: u64,
}

#[contracttype]
pub enum DataKey {
    Owner,                            // Contract owner
    NextTokenId,                      // Next token ID to mint
    Pet(u128),                        // token_id -> Pet struct
    TokenOwner(u128),                // token_id -> owner Address
    OwnerBalance(Address),            // owner -> balance count
    OwnerTokens(Address, u128),       // (owner, index) -> token_id
    TokenURI(u128),                   // token_id -> URI string
    AchievementContract,             // Achievement contract address
    
    // Constants stored in instance storage
    BlocksPerHungerPoint,
    BlocksPerHappinessDecay,
    FeedCost,
    MintCost,
    RevivalCost,
    EggToBabyBlocks,
    BabyToTeenBlocks,
    TeenToAdultBlocks,
    EvolutionHappinessThreshold,
}

#[contract]
pub struct PetWorld;

#[contractimpl]
impl PetWorld {
    /// Initialize the PetWorld contract
    pub fn initialize(env: Env, owner: Address) {
        if env.storage().instance().has(&DataKey::Owner) {
            panic!("Already initialized");
        }

        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage().instance().set(&DataKey::NextTokenId, &1u128);

        // Set constants
        // Hunger: +1 per 30 ledgers (~2.5 minutes per point, 0→100 in ~4.2 hours)
        env.storage().instance().set(&DataKey::BlocksPerHungerPoint, &30u32);
        // Happiness: -1 per 60 ledgers (~5 minutes per point, 100→0 in ~8.3 hours)
        env.storage().instance().set(&DataKey::BlocksPerHappinessDecay, &60u32);
        env.storage().instance().set(&DataKey::FeedCost, &1000000000u64); // 0.001 XLM in stroops
        env.storage().instance().set(&DataKey::MintCost, &10000000000u64); // 0.01 XLM in stroops
        env.storage().instance().set(&DataKey::RevivalCost, &5000000000u64); // 0.005 XLM in stroops
        env.storage().instance().set(&DataKey::EggToBabyBlocks, &36u32);   // 3 minutes
        env.storage().instance().set(&DataKey::BabyToTeenBlocks, &84u32);   // 7 minutes (cumulative)
        env.storage().instance().set(&DataKey::TeenToAdultBlocks, &144u32);  // 12 minutes (cumulative)
        env.storage().instance().set(&DataKey::EvolutionHappinessThreshold, &60u32);

        log!(&env, "PetWorld initialized: owner={}", owner);
    }

    /// Mint a new pet
    pub fn mint(env: Env, caller: Address, name: String) -> u128 {
        caller.require_auth();
        
        // Validate name length
        if name.len() == 0 || name.len() > 20 {
            panic!("Invalid name length");
        }

        // Get mint cost (for future payment verification)
        let _mint_cost: u64 = env.storage()
            .instance()
            .get(&DataKey::MintCost)
            .unwrap_or(10000000000u64);



        // Get next token ID
        let token_id: u128 = env.storage()
            .instance()
            .get(&DataKey::NextTokenId)
            .unwrap_or(1);
        
        let next_id = token_id + 1;
        env.storage().instance().set(&DataKey::NextTokenId, &next_id);

        // Get current ledger sequence
        let current_ledger = env.ledger().sequence();

        // Create pet
        let pet = Pet {
            name: name.clone(),
            birth_date: current_ledger,
            last_updated_ledger: current_ledger,
            evolution_stage: EvolutionStage::Egg,
            happiness: 100u32,
            hunger: 0u32,
            health: 100u32,
            is_dead: false,
            death_timestamp: 0,
        };

        // Store pet
        env.storage().persistent().set(&DataKey::Pet(token_id), &pet);
        env.storage().persistent().set(&DataKey::TokenOwner(token_id), &caller);

        // Update balance
        let balance: u128 = env.storage()
            .persistent()
            .get(&DataKey::OwnerBalance(caller.clone()))
            .unwrap_or(0);
        let new_balance = balance + 1;
        env.storage().persistent().set(&DataKey::OwnerBalance(caller.clone()), &new_balance);

        // Store token in owner's list
        env.storage().persistent().set(
            &DataKey::OwnerTokens(caller.clone(), balance),
            &token_id
        );

        // Set default URI
        let default_uri = String::from_str(&env, "ipfs://QmEggMetadata");
        env.storage().persistent().set(&DataKey::TokenURI(token_id), &default_uri);

        log!(&env, "Pet minted: token_id={}, name={}, owner={}", token_id, name, caller);

        // Call achievement contract to record first pet
        Self::_call_record_first_pet(&env, caller.clone(), token_id);

        token_id
    }

    /// Update pet state (stat decay based on ledger sequence)
    pub fn update_state(env: Env, token_id: u128) {
        let pet: Pet = env.storage()
            .persistent()
            .get(&DataKey::Pet(token_id))
            .unwrap_or_else(|| panic!("Pet does not exist"));

        // Don't update if dead
        if pet.is_dead {
            return;
        }

        let current_ledger = env.ledger().sequence();
        let ledgers_passed = current_ledger - pet.last_updated_ledger;

        if ledgers_passed == 0 {
            return;
        }

        // Get constants
        let blocks_per_hunger: u32 = env.storage()
            .instance()
            .get(&DataKey::BlocksPerHungerPoint)
            .unwrap_or(30);
        let blocks_per_happiness: u32 = env.storage()
            .instance()
            .get(&DataKey::BlocksPerHappinessDecay)
            .unwrap_or(60);

        // Calculate stat changes
        let hunger_increase = ledgers_passed / blocks_per_hunger;
        let happiness_decrease = ledgers_passed / blocks_per_happiness;

        let mut updated_pet = pet.clone();

        // Update hunger
        if hunger_increase > 0 {
            let new_hunger = (updated_pet.hunger + hunger_increase).min(100);
            updated_pet.hunger = new_hunger;
        }

        // Update happiness
        if happiness_decrease > 0 {
            if happiness_decrease >= updated_pet.happiness {
                updated_pet.happiness = 0;
            } else {
                updated_pet.happiness -= happiness_decrease;
            }
        }

        // Health logic
        if updated_pet.hunger > 80 && updated_pet.health > 0 {
            let health_decrease = (updated_pet.hunger - 80) / 5;
            if health_decrease >= updated_pet.health {
                updated_pet.health = 0;
            } else {
                updated_pet.health -= health_decrease;
            }
        }

        if updated_pet.hunger < 30 && updated_pet.happiness > 70 && updated_pet.health < 100 {
            updated_pet.health = (updated_pet.health + 1).min(100);
        }

        updated_pet.last_updated_ledger = current_ledger;

        // Check for death
        if updated_pet.health == 0 && !updated_pet.is_dead {
            updated_pet.is_dead = true;
            updated_pet.death_timestamp = env.ledger().timestamp();
            log!(&env, "Pet died: token_id={}", token_id);
        }

        // Save updated pet
        env.storage().persistent().set(&DataKey::Pet(token_id), &updated_pet);

        // Check evolution
        Self::_check_and_evolve(env.clone(), token_id);
    }

    /// Feed a pet
    pub fn feed(env: Env, caller: Address, token_id: u128) {
        caller.require_auth();
        
        let owner: Address = env.storage()
            .persistent()
            .get(&DataKey::TokenOwner(token_id))
            .unwrap_or_else(|| panic!("Pet does not exist"));

        if owner != caller {
            panic!("Not your pet");
        }

        // Get feed cost (for future payment verification)
        let _feed_cost: u64 = env.storage()
            .instance()
            .get(&DataKey::FeedCost)
            .unwrap_or(1000000000u64);

        // Note: Payment verification would be done via token contract
        // For now, we skip it

        // Update state first
        Self::update_state(env.clone(), token_id);

        let mut pet: Pet = env.storage()
            .persistent()
            .get(&DataKey::Pet(token_id))
            .unwrap();

        if pet.is_dead {
            panic!("Cannot feed a dead pet");
        }

        // Apply feed effects
        pet.hunger = if pet.hunger > 40 { pet.hunger - 40 } else { 0u32 };
        pet.happiness = (pet.happiness + 15).min(100);

        env.storage().persistent().set(&DataKey::Pet(token_id), &pet);

        log!(&env, "Pet fed: token_id={}, hunger={}, happiness={}", token_id, pet.hunger as u128, pet.happiness as u128);

        // Call achievement contract to record feed
        Self::_call_record_feed(&env, caller.clone(), token_id);

        // Check for perfect stats achievement
        if pet.happiness == 100 && pet.hunger == 0 && pet.health == 100 {
            Self::_call_record_perfect_stats(&env, caller.clone(), token_id);
        }

        Self::_check_and_evolve(env, token_id);
    }

    /// Play with a pet
    pub fn play(env: Env, caller: Address, token_id: u128) {
        caller.require_auth();
        
        let owner: Address = env.storage()
            .persistent()
            .get(&DataKey::TokenOwner(token_id))
            .unwrap_or_else(|| panic!("Pet does not exist"));

        if owner != caller {
            panic!("Not your pet");
        }

        // Update state first
        Self::update_state(env.clone(), token_id);

        let mut pet: Pet = env.storage()
            .persistent()
            .get(&DataKey::Pet(token_id))
            .unwrap();

        if pet.is_dead {
            panic!("Cannot play with a dead pet");
        }

        // Apply play effects
        pet.happiness = (pet.happiness + 25).min(100);

        env.storage().persistent().set(&DataKey::Pet(token_id), &pet);

        log!(&env, "Pet played: token_id={}, happiness={}", token_id, pet.happiness as u128);

        // Call achievement contract to record play
        Self::_call_record_play(&env, caller.clone(), token_id);

        // Check for perfect stats achievement
        if pet.happiness == 100 && pet.hunger == 0 && pet.health == 100 {
            Self::_call_record_perfect_stats(&env, caller.clone(), token_id);
        }

        Self::_check_and_evolve(env, token_id);
    }

    /// Revive a dead pet
    pub fn revive(env: Env, caller: Address, token_id: u128) {
        caller.require_auth();
        
        let owner: Address = env.storage()
            .persistent()
            .get(&DataKey::TokenOwner(token_id))
            .unwrap_or_else(|| panic!("Pet does not exist"));

        if owner != caller {
            panic!("Not your pet");
        }

        // Get revival cost (for future payment verification)
        let _revival_cost: u64 = env.storage()
            .instance()
            .get(&DataKey::RevivalCost)
            .unwrap_or(5000000000u64);

        // Note: Payment verification would be done via token contract

        let mut pet: Pet = env.storage()
            .persistent()
            .get(&DataKey::Pet(token_id))
            .unwrap();

        if !pet.is_dead {
            panic!("Pet is not dead");
        }

        // Revive with partial stats
        pet.is_dead = false;
        pet.health = 50u32;
        pet.happiness = 30u32;
        pet.hunger = 50u32;
        pet.death_timestamp = 0;
        pet.last_updated_ledger = env.ledger().sequence();

        env.storage().persistent().set(&DataKey::Pet(token_id), &pet);

        log!(&env, "Pet revived: token_id={}", token_id);

        // Call achievement contract to record revival
        Self::_call_record_revival(&env, caller.clone(), token_id);
    }

    /// Get pet information
    pub fn get_pet_info(env: Env, token_id: u128) -> (String, u32, u32, EvolutionStage, u32, u32, u32, u32, bool, u64) {
        let pet: Pet = env.storage()
            .persistent()
            .get(&DataKey::Pet(token_id))
            .unwrap_or_else(|| panic!("Pet does not exist"));

        let current_ledger = env.ledger().sequence();
        let age = (current_ledger as u64).saturating_sub(pet.birth_date as u64) as u32;
        let ledgers_since_update = (current_ledger as u64).saturating_sub(pet.last_updated_ledger as u64) as u32;

        (
            pet.name,
            pet.birth_date,
            age,
            pet.evolution_stage,
            pet.happiness,
            pet.hunger,
            pet.health,
            ledgers_since_update,
            pet.is_dead,
            pet.death_timestamp,
        )
    }

    /// Get all pets owned by a user
    pub fn get_user_pets(env: Env, user: Address) -> Vec<u128> {
        let balance: u128 = env.storage()
            .persistent()
            .get(&DataKey::OwnerBalance(user.clone()))
            .unwrap_or(0);

        let mut tokens = Vec::new(&env);
        
        for i in 0..balance {
            if let Some(token_id) = env.storage()
                .persistent()
                .get(&DataKey::OwnerTokens(user.clone(), i)) {
                tokens.push_back(token_id);
            }
        }
        
        tokens
    }

    /// Batch update state for multiple pets
    pub fn batch_update_state(env: Env, token_ids: Vec<u128>) {
        for i in 0..token_ids.len() {
            let token_id = token_ids.get(i).unwrap();
            if env.storage().persistent().has(&DataKey::Pet(token_id)) {
                Self::update_state(env.clone(), token_id);
            }
        }
    }

    /// Apply accumulated event effects
    pub fn apply_event_effects(
        env: Env,
        caller: Address,
        token_id: u128,
        happiness_delta: i32,
        hunger_delta: i32,
        health_delta: i32,
    ) {
        caller.require_auth();
        
        let owner: Address = env.storage()
            .persistent()
            .get(&DataKey::TokenOwner(token_id))
            .unwrap_or_else(|| panic!("Pet does not exist"));

        if owner != caller {
            panic!("Not your pet");
        }

        // Update state first
        Self::update_state(env.clone(), token_id);

        let mut pet: Pet = env.storage()
            .persistent()
            .get(&DataKey::Pet(token_id))
            .unwrap();

        if pet.is_dead {
            panic!("Cannot apply effects to a dead pet");
        }

        // Apply deltas with clamping
        if happiness_delta != 0 {
            let new_happiness = (pet.happiness as i64 + happiness_delta as i64)
                .max(0).min(100) as u32;
            pet.happiness = new_happiness;
        }

        if hunger_delta != 0 {
            let new_hunger = (pet.hunger as i64 + hunger_delta as i64)
                .max(0).min(100) as u32;
            pet.hunger = new_hunger;
        }

        if health_delta != 0 {
            let new_health = (pet.health as i64 + health_delta as i64)
                .max(0).min(100) as u32;
            pet.health = new_health;
        }

        // Check for death
        if pet.health == 0 && !pet.is_dead {
            pet.is_dead = true;
            pet.death_timestamp = env.ledger().timestamp();
        }

        env.storage().persistent().set(&DataKey::Pet(token_id), &pet);

        // Check for perfect stats achievement
        if pet.happiness == 100 && pet.hunger == 0 && pet.health == 100 {
            Self::_call_record_perfect_stats(&env, caller.clone(), token_id);
        }

        Self::_check_and_evolve(env, token_id);
    }

    /// Update token URI
    pub fn update_token_uri(env: Env, caller: Address, token_id: u128, new_token_uri: String) {
        caller.require_auth();
        
        let owner: Address = env.storage()
            .persistent()
            .get(&DataKey::TokenOwner(token_id))
            .unwrap_or_else(|| panic!("Pet does not exist"));

        if owner != caller {
            panic!("Not your pet");
        }

        env.storage().persistent().set(&DataKey::TokenURI(token_id), &new_token_uri);
        log!(&env, "Token URI updated: token_id={}", token_id);
    }

    /// Get token URI
    pub fn token_uri(env: Env, token_id: u128) -> String {
        if !env.storage().persistent().has(&DataKey::Pet(token_id)) {
            panic!("Pet does not exist");
        }

        env.storage()
            .persistent()
            .get(&DataKey::TokenURI(token_id))
            .unwrap_or(String::from_str(&env, "ipfs://QmEggMetadata"))
    }

    /// Get owner of a token
    pub fn owner_of(env: Env, token_id: u128) -> Address {
        env.storage()
            .persistent()
            .get(&DataKey::TokenOwner(token_id))
            .unwrap_or_else(|| panic!("Pet does not exist"))
    }

    /// Get balance of an address
    pub fn balance_of(env: Env, owner: Address) -> u128 {
        env.storage()
            .persistent()
            .get(&DataKey::OwnerBalance(owner))
            .unwrap_or(0)
    }

    /// Transfer a pet
    pub fn transfer(env: Env, from: Address, to: Address, token_id: u128) {
        from.require_auth();

        let current_owner = Self::owner_of(env.clone(), token_id);
        if current_owner != from {
            panic!("Not the owner of this token");
        }

        if from == to {
            return;
        }

        // Update owner
        env.storage().persistent().set(&DataKey::TokenOwner(token_id), &to);

        // Update balances
        let from_balance = Self::balance_of(env.clone(), from.clone());
        let to_balance = Self::balance_of(env.clone(), to.clone());

        // Remove from old owner's list (simplified - would need proper list management)
        // For now, we'll just update the balance
        env.storage().persistent().set(&DataKey::OwnerBalance(from.clone()), &(from_balance - 1));
        env.storage().persistent().set(&DataKey::OwnerBalance(to.clone()), &(to_balance + 1));

        // Add to new owner's list
        env.storage().persistent().set(
            &DataKey::OwnerTokens(to.clone(), to_balance),
            &token_id
        );

        log!(&env, "Pet transferred: token_id={}, from={}, to={}", token_id, from, to);
    }

    /// Internal function to check and evolve pet
    fn _check_and_evolve(env: Env, token_id: u128) {
        let mut pet: Pet = env.storage()
            .persistent()
            .get(&DataKey::Pet(token_id))
            .unwrap();

        let current_ledger = env.ledger().sequence();
        let age = (current_ledger as u64).saturating_sub(pet.birth_date as u64) as u32;

        // Get constants
        let egg_to_baby: u32 = env.storage()
            .instance()
            .get(&DataKey::EggToBabyBlocks)
            .unwrap_or(36);
        let baby_to_teen: u32 = env.storage()
            .instance()
            .get(&DataKey::BabyToTeenBlocks)
            .unwrap_or(84);
        let teen_to_adult: u32 = env.storage()
            .instance()
            .get(&DataKey::TeenToAdultBlocks)
            .unwrap_or(144);
        let happiness_threshold: u32 = env.storage()
            .instance()
            .get(&DataKey::EvolutionHappinessThreshold)
            .unwrap_or(60);

        let mut evolved = false;
        let mut new_stage: Option<u128> = None;

        match pet.evolution_stage {
            EvolutionStage::Egg => {
                if (age as u64) >= (egg_to_baby as u64) {
                    pet.evolution_stage = EvolutionStage::Baby;
                    let uri = String::from_str(&env, "ipfs://QmBabyMetadata");
                    env.storage().persistent().set(&DataKey::TokenURI(token_id), &uri);
                    evolved = true;
                    new_stage = Some(1); // Baby stage
                }
            }
            EvolutionStage::Baby => {
                if (age as u64) >= (baby_to_teen as u64) && pet.happiness >= happiness_threshold {
                    pet.evolution_stage = EvolutionStage::Teen;
                    let uri = String::from_str(&env, "ipfs://QmTeenMetadata");
                    env.storage().persistent().set(&DataKey::TokenURI(token_id), &uri);
                    evolved = true;
                    new_stage = Some(2); // Teen stage
                }
            }
            EvolutionStage::Teen => {
                if (age as u64) >= (teen_to_adult as u64) 
                    && pet.happiness >= happiness_threshold 
                    && pet.health >= 80 {
                    pet.evolution_stage = EvolutionStage::Adult;
                    let uri = String::from_str(&env, "ipfs://QmAdultMetadata");
                    env.storage().persistent().set(&DataKey::TokenURI(token_id), &uri);
                    evolved = true;
                    new_stage = Some(3); // Adult stage
                }
            }
            EvolutionStage::Adult => {
                // Already fully evolved
            }
        }

        if evolved {
            env.storage().persistent().set(&DataKey::Pet(token_id), &pet);
            log!(&env, "Pet evolved: token_id={}, stage={:?}", token_id, pet.evolution_stage);
            
            // Call achievement contract to record evolution
            if let Some(stage) = new_stage {
                if let Some(owner) = env.storage()
                    .persistent()
                    .get::<_, Address>(&DataKey::TokenOwner(token_id)) {
                    Self::_call_record_evolution(&env, owner, token_id, stage);
                }
            }
        }
    }

    /// Get contract owner
    pub fn owner(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Owner)
            .unwrap_or_else(|| panic!("Not initialized"))
    }

    /// Set the achievement contract address (only owner)
    pub fn set_achievement_contract(env: Env, contract_address: Address) {
        let owner = Self::owner(env.clone());
        owner.require_auth();
        
        env.storage().instance().set(&DataKey::AchievementContract, &contract_address);
        log!(&env, "Achievement contract set: {}", contract_address);
    }

    /// Helper function to call achievement contract's record_first_pet
    fn _call_record_first_pet(env: &Env, user: Address, pet_token_id: u128) {
        if let Some(achievement_contract) = env.storage()
            .instance()
            .get::<_, Address>(&DataKey::AchievementContract) {
            let caller = env.current_contract_address();
            let mut args = Vec::new(env);
            args.push_back(caller.into_val(env));
            args.push_back(user.into_val(env));
            args.push_back(pet_token_id.into_val(env));
            let func_name = Symbol::new(env, "record_first_pet");
            let _: () = env.invoke_contract(
                &achievement_contract,
                &func_name,
                args,
            );
        }
    }

    /// Helper function to call achievement contract's record_feed
    fn _call_record_feed(env: &Env, user: Address, pet_token_id: u128) {
        if let Some(achievement_contract) = env.storage()
            .instance()
            .get::<_, Address>(&DataKey::AchievementContract) {
            let caller = env.current_contract_address();
            let mut args = Vec::new(env);
            args.push_back(caller.into_val(env));
            args.push_back(user.into_val(env));
            args.push_back(pet_token_id.into_val(env));
            let func_name = Symbol::new(env, "record_feed");
            let _: () = env.invoke_contract(
                &achievement_contract,
                &func_name,
                args,
            );
        }
    }

    /// Helper function to call achievement contract's record_play
    fn _call_record_play(env: &Env, user: Address, pet_token_id: u128) {
        if let Some(achievement_contract) = env.storage()
            .instance()
            .get::<_, Address>(&DataKey::AchievementContract) {
            let caller = env.current_contract_address();
            let mut args = Vec::new(env);
            args.push_back(caller.into_val(env));
            args.push_back(user.into_val(env));
            args.push_back(pet_token_id.into_val(env));
            let func_name = Symbol::new(env, "record_play");
            let _: () = env.invoke_contract(
                &achievement_contract,
                &func_name,
                args,
            );
        }
    }

    /// Helper function to call achievement contract's record_evolution
    fn _call_record_evolution(env: &Env, user: Address, pet_token_id: u128, stage: u128) {
        if let Some(achievement_contract) = env.storage()
            .instance()
            .get::<_, Address>(&DataKey::AchievementContract) {
            let caller = env.current_contract_address();
            let mut args = Vec::new(env);
            args.push_back(caller.into_val(env));
            args.push_back(user.into_val(env));
            args.push_back(pet_token_id.into_val(env));
            args.push_back(stage.into_val(env));
            let func_name = Symbol::new(env, "record_evolution");
            let _: () = env.invoke_contract(
                &achievement_contract,
                &func_name,
                args,
            );
        }
    }

    /// Helper function to call achievement contract's record_revival
    fn _call_record_revival(env: &Env, user: Address, pet_token_id: u128) {
        if let Some(achievement_contract) = env.storage()
            .instance()
            .get::<_, Address>(&DataKey::AchievementContract) {
            let caller = env.current_contract_address();
            let mut args = Vec::new(env);
            args.push_back(caller.into_val(env));
            args.push_back(user.into_val(env));
            args.push_back(pet_token_id.into_val(env));
            let func_name = Symbol::new(env, "record_revival");
            let _: () = env.invoke_contract(
                &achievement_contract,
                &func_name,
                args,
            );
        }
    }

    /// Helper function to call achievement contract's record_perfect_stats
    fn _call_record_perfect_stats(env: &Env, user: Address, pet_token_id: u128) {
        if let Some(achievement_contract) = env.storage()
            .instance()
            .get::<_, Address>(&DataKey::AchievementContract) {
            let caller = env.current_contract_address();
            let mut args = Vec::new(env);
            args.push_back(caller.into_val(env));
            args.push_back(user.into_val(env));
            args.push_back(pet_token_id.into_val(env));
            let func_name = Symbol::new(env, "record_perfect_stats");
            let _: () = env.invoke_contract(
                &achievement_contract,
                &func_name,
                args,
            );
        }
    }

    /// Withdraw funds (owner only)
    pub fn withdraw(env: Env) {
        let owner = Self::owner(env.clone());
        owner.require_auth();
        
        // In Stellar, this would transfer XLM from contract to owner
        // Implementation depends on Stellar Asset Contract integration
        log!(&env, "Withdraw called by owner");
    }
}
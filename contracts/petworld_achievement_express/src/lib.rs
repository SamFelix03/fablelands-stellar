#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, String, Vec, log,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Achievement {
    pub id: u128,
    pub name: String,
    pub description: String,
    pub rarity: String,
    pub icon: String,
    pub total_earned: u128,
}

#[contracttype]
pub enum DataKey {
    Owner,                                    // Contract owner
    PetWorldContract,                         // Reference to main PetWorld contract
    Achievement(u128),                        // achievement_id -> Achievement struct
    HasEarnedBadge(Address, u128),           // (user, achievement_id) -> bool
    PetHasBadge(u128, u128),                 // (pet_token_id, achievement_id) -> bool
    
    // Counters for tracking
    FeedCount(Address),                       // user -> count
    PlayCount(Address),                       // user -> count
    HasFirstPet(Address),                     // user -> bool
    HasEvolved(Address),                      // user -> bool
    HasRevived(Address),                      // user -> bool
    ReachedStage(Address, u128),             // (user, stage) -> bool
    
    // ERC-1155-like storage
    Balance(Address, u128),                  // (owner, achievement_id) -> balance
    TotalSupply(u128),                        // achievement_id -> total supply
}

const TOTAL_ACHIEVEMENTS: u128 = 8;

#[contract]
pub struct PetWorldAchievement;

#[contractimpl]
impl PetWorldAchievement {
    /// Initialize the PetWorldAchievement contract
    pub fn initialize(env: Env, owner: Address) {
        if env.storage().instance().has(&DataKey::Owner) {
            panic!("Already initialized");
        }

        env.storage().instance().set(&DataKey::Owner, &owner);
        Self::_initialize_achievements(env.clone());
        
        log!(&env, "PetWorldAchievement initialized: owner={}", owner);
    }

    /// Initialize all achievement definitions
    fn _initialize_achievements(env: Env) {
        let achievements = [
            (0u128, "First Steps", "Mint your first PetWorld pet", "Common", "🥚"),
            (1u128, "Metamorphosis", "Evolve your pet for the first time", "Rare", "🦋"),
            (2u128, "Death Survivor", "Revive a pet from death", "Rare", "💀"),
            (3u128, "Triple Evolution", "Reach Teen stage (Level 3)", "Epic", "🌟"),
            (4u128, "Perfectionist", "Get all stats to 100", "Epic", "💯"),
            (5u128, "Streak Master", "Feed your pet 10 times", "Uncommon", "🔥"),
            (6u128, "Active Player", "Play with your pet 10 times", "Uncommon", "🎮"),
            (7u128, "Legend", "Reach Adult stage (Level 4)", "Legendary", "👑"),
        ];

        for (id, name, desc, rarity, icon) in achievements.iter() {
            let achievement = Achievement {
                id: *id,
                name: String::from_str(&env, name),
                description: String::from_str(&env, desc),
                rarity: String::from_str(&env, rarity),
                icon: String::from_str(&env, icon),
                total_earned: 0,
            };
            env.storage().persistent().set(&DataKey::Achievement(*id), &achievement);
        }
    }

    /// Set the PetWorld contract address (only owner)
    pub fn set_petworld_contract(env: Env, contract_address: Address) {
        let owner = Self::owner(env.clone());
        owner.require_auth();
        
        env.storage().instance().set(&DataKey::PetWorldContract, &contract_address);
        log!(&env, "PetWorld contract set: {}", contract_address);
    }

    /// Award an achievement badge to a user
    pub fn award_achievement(
        env: Env,
        caller: Address,
        user: Address,
        achievement_id: u128,
        pet_token_id: u128,
    ) {
        // Check authorization - only PetWorld contract or owner can call
        caller.require_auth();
        let owner = Self::owner(env.clone());
        let petworld_contract: Option<Address> = env.storage()
            .instance()
            .get(&DataKey::PetWorldContract);

        if caller != owner && 
            (petworld_contract.is_none() || caller != petworld_contract.unwrap()) {
            panic!("Only PetWorld contract or owner");
        }

        if achievement_id >= TOTAL_ACHIEVEMENTS {
            panic!("Invalid achievement ID");
        }

        // Check if already earned
        let already_earned: bool = env.storage()
            .persistent()
            .get(&DataKey::HasEarnedBadge(user.clone(), achievement_id))
            .unwrap_or(false);

        if already_earned {
            panic!("Already earned");
        }

        // Mark as earned
        env.storage().persistent().set(&DataKey::HasEarnedBadge(user.clone(), achievement_id), &true);
        env.storage().persistent().set(&DataKey::PetHasBadge(pet_token_id, achievement_id), &true);

        // Update achievement total
        let mut achievement: Achievement = env.storage()
            .persistent()
            .get(&DataKey::Achievement(achievement_id))
            .unwrap();
        achievement.total_earned += 1;
        env.storage().persistent().set(&DataKey::Achievement(achievement_id), &achievement);

        // Mint the achievement NFT (ERC-1155 like)
        let balance: u128 = env.storage()
            .persistent()
            .get(&DataKey::Balance(user.clone(), achievement_id))
            .unwrap_or(0);
        env.storage().persistent().set(&DataKey::Balance(user.clone(), achievement_id), &(balance + 1));

        // Update total supply
        let supply: u128 = env.storage()
            .persistent()
            .get(&DataKey::TotalSupply(achievement_id))
            .unwrap_or(0);
        env.storage().persistent().set(&DataKey::TotalSupply(achievement_id), &(supply + 1));

        log!(&env, "Achievement earned: user={}, achievement_id={}, pet_token_id={}", 
             user, achievement_id, pet_token_id);
    }

    /// Record that a user minted their first pet
    pub fn record_first_pet(env: Env, caller: Address, user: Address, pet_token_id: u128) {
        caller.require_auth();
        let owner = Self::owner(env.clone());
        let petworld_contract: Option<Address> = env.storage()
            .instance()
            .get(&DataKey::PetWorldContract);

        if caller != owner && 
            (petworld_contract.is_none() || caller != petworld_contract.unwrap()) {
            panic!("Only PetWorld contract or owner");
        }

        let has_first: bool = env.storage()
            .persistent()
            .get(&DataKey::HasFirstPet(user.clone()))
            .unwrap_or(false);

            if !has_first {
            env.storage().persistent().set(&DataKey::HasFirstPet(user.clone()), &true);
            Self::award_achievement(env.clone(), caller.clone(), user.clone(), 0, pet_token_id); // First Steps
        }
    }

    /// Record a feed action
    pub fn record_feed(env: Env, caller: Address, user: Address, pet_token_id: u128) {
        caller.require_auth();
        let owner = Self::owner(env.clone());
        let petworld_contract: Option<Address> = env.storage()
            .instance()
            .get(&DataKey::PetWorldContract);

        if caller != owner && 
            (petworld_contract.is_none() || caller != petworld_contract.unwrap()) {
            panic!("Only PetWorld contract or owner");
        }

        let count: u128 = env.storage()
            .persistent()
            .get(&DataKey::FeedCount(user.clone()))
            .unwrap_or(0);
        let new_count = count + 1;
        env.storage().persistent().set(&DataKey::FeedCount(user.clone()), &new_count);

        // Check if should award Streak Master (achievement 5)
        if new_count >= 10 {
            let has_earned: bool = env.storage()
                .persistent()
                .get(&DataKey::HasEarnedBadge(user.clone(), 5))
                .unwrap_or(false);
            
            if !has_earned {
                Self::award_achievement(env.clone(), caller.clone(), user.clone(), 5, pet_token_id); // Streak Master
            }
        }
    }

    /// Record a play action
    pub fn record_play(env: Env, caller: Address, user: Address, pet_token_id: u128) {
        caller.require_auth();
        let owner = Self::owner(env.clone());
        let petworld_contract: Option<Address> = env.storage()
            .instance()
            .get(&DataKey::PetWorldContract);

        if caller != owner && 
            (petworld_contract.is_none() || caller != petworld_contract.unwrap()) {
            panic!("Only PetWorld contract or owner");
        }

        let count: u128 = env.storage()
            .persistent()
            .get(&DataKey::PlayCount(user.clone()))
            .unwrap_or(0);
        let new_count = count + 1;
        env.storage().persistent().set(&DataKey::PlayCount(user.clone()), &new_count);

        // Check if should award Active Player (achievement 6)
        if new_count >= 10 {
            let has_earned: bool = env.storage()
                .persistent()
                .get(&DataKey::HasEarnedBadge(user.clone(), 6))
                .unwrap_or(false);
            
            if !has_earned {
                Self::award_achievement(env.clone(), caller.clone(), user.clone(), 6, pet_token_id); // Active Player
            }
        }
    }

    /// Record an evolution
    pub fn record_evolution(env: Env, caller: Address, user: Address, pet_token_id: u128, stage: u128) {
        caller.require_auth();
        let owner = Self::owner(env.clone());
        let petworld_contract: Option<Address> = env.storage()
            .instance()
            .get(&DataKey::PetWorldContract);

        if caller != owner && 
            (petworld_contract.is_none() || caller != petworld_contract.unwrap()) {
            panic!("Only PetWorld contract or owner");
        }

        // First evolution (Egg -> Baby, stage 1)
        if stage == 1 {
            let has_evolved: bool = env.storage()
                .persistent()
                .get(&DataKey::HasEvolved(user.clone()))
                .unwrap_or(false);
            
            if !has_evolved {
                env.storage().persistent().set(&DataKey::HasEvolved(user.clone()), &true);
                Self::award_achievement(env.clone(), caller.clone(), user.clone(), 1, pet_token_id); // Metamorphosis
            }
        }

        // Reached Teen stage (stage 2)
        if stage == 2 {
            let reached: bool = env.storage()
                .persistent()
                .get(&DataKey::ReachedStage(user.clone(), 2))
                .unwrap_or(false);
            
            if !reached {
                env.storage().persistent().set(&DataKey::ReachedStage(user.clone(), 2), &true);
                Self::award_achievement(env.clone(), caller.clone(), user.clone(), 3, pet_token_id); // Triple Evolution
            }
        }

        // Reached Adult stage (stage 3)
        if stage == 3 {
            let reached: bool = env.storage()
                .persistent()
                .get(&DataKey::ReachedStage(user.clone(), 3))
                .unwrap_or(false);
            
            if !reached {
                env.storage().persistent().set(&DataKey::ReachedStage(user.clone(), 3), &true);
                Self::award_achievement(env.clone(), caller.clone(), user.clone(), 7, pet_token_id); // Legend
            }
        }
    }

    /// Record a revival
    pub fn record_revival(env: Env, caller: Address, user: Address, pet_token_id: u128) {
        caller.require_auth();
        let owner = Self::owner(env.clone());
        let petworld_contract: Option<Address> = env.storage()
            .instance()
            .get(&DataKey::PetWorldContract);

        if caller != owner && 
            (petworld_contract.is_none() || caller != petworld_contract.unwrap()) {
            panic!("Only PetWorld contract or owner");
        }

        let has_revived: bool = env.storage()
            .persistent()
            .get(&DataKey::HasRevived(user.clone()))
            .unwrap_or(false);

        if !has_revived {
            env.storage().persistent().set(&DataKey::HasRevived(user.clone()), &true);
            Self::award_achievement(env.clone(), caller.clone(), user.clone(), 2, pet_token_id); // Death Survivor
        }
    }

    /// Award Perfectionist achievement (all stats at 100)
    pub fn record_perfect_stats(env: Env, caller: Address, user: Address, pet_token_id: u128) {
        caller.require_auth();
        let owner = Self::owner(env.clone());
        let petworld_contract: Option<Address> = env.storage()
            .instance()
            .get(&DataKey::PetWorldContract);

        if caller != owner && 
            (petworld_contract.is_none() || caller != petworld_contract.unwrap()) {
            panic!("Only PetWorld contract or owner");
        }

        let has_earned: bool = env.storage()
            .persistent()
            .get(&DataKey::HasEarnedBadge(user.clone(), 4))
            .unwrap_or(false);

        if !has_earned {
            Self::award_achievement(env.clone(), caller.clone(), user.clone(), 4, pet_token_id); // Perfectionist
        }
    }

    /// Get all achievements earned by a user
    pub fn get_user_achievements(env: Env, user: Address) -> Vec<u128> {
        let mut earned = Vec::new(&env);
        
        for i in 0..TOTAL_ACHIEVEMENTS {
            let has_earned: bool = env.storage()
                .persistent()
                .get(&DataKey::HasEarnedBadge(user.clone(), i))
                .unwrap_or(false);
            
            if has_earned {
                earned.push_back(i);
            }
        }
        
        earned
    }

    /// Get all achievements for a specific pet token
    pub fn get_pet_achievements(env: Env, pet_token_id: u128) -> Vec<u128> {
        let mut earned = Vec::new(&env);
        
        for i in 0..TOTAL_ACHIEVEMENTS {
            let has_badge: bool = env.storage()
                .persistent()
                .get(&DataKey::PetHasBadge(pet_token_id, i))
                .unwrap_or(false);
            
            if has_badge {
                earned.push_back(i);
            }
        }
        
        earned
    }

    /// Get achievement details
    pub fn get_achievement_details(env: Env, achievement_id: u128) -> Achievement {
        if achievement_id >= TOTAL_ACHIEVEMENTS {
            panic!("Invalid achievement ID");
        }
        
        env.storage()
            .persistent()
            .get(&DataKey::Achievement(achievement_id))
            .unwrap()
    }

    /// Get all achievements
    pub fn get_all_achievements(env: Env) -> Vec<Achievement> {
        let mut achievements = Vec::new(&env);
        
        for i in 0..TOTAL_ACHIEVEMENTS {
            let achievement: Achievement = env.storage()
                .persistent()
                .get(&DataKey::Achievement(i))
                .unwrap();
            achievements.push_back(achievement);
        }
        
        achievements
    }

    /// Check if user has earned a specific achievement
    pub fn has_earned(env: Env, user: Address, achievement_id: u128) -> bool {
        if achievement_id >= TOTAL_ACHIEVEMENTS {
            panic!("Invalid achievement ID");
        }
        
        env.storage()
            .persistent()
            .get(&DataKey::HasEarnedBadge(user, achievement_id))
            .unwrap_or(false)
    }

    /// Get user's achievement count
    pub fn get_user_achievement_count(env: Env, user: Address) -> u128 {
        let mut count = 0u128;
        
        for i in 0..TOTAL_ACHIEVEMENTS {
            let has_earned: bool = env.storage()
                .persistent()
                .get(&DataKey::HasEarnedBadge(user.clone(), i))
                .unwrap_or(false);
            
            if has_earned {
                count += 1;
            }
        }
        
        count
    }

    /// Get balance of a specific achievement for a user (ERC-1155 like)
    pub fn balance_of(env: Env, owner: Address, achievement_id: u128) -> u128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(owner, achievement_id))
            .unwrap_or(0)
    }

    /// Get total supply of an achievement
    pub fn total_supply(env: Env, achievement_id: u128) -> u128 {
        env.storage()
            .persistent()
            .get(&DataKey::TotalSupply(achievement_id))
            .unwrap_or(0)
    }

    /// Get contract owner
    pub fn owner(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Owner)
            .unwrap_or_else(|| panic!("Not initialized"))
    }
}


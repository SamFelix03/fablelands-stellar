# Pet World - Complete Flow Diagram

```mermaid
flowchart TD
    Start([User Starts]) --> Mint[Mint Egg]
    
    Mint --> |Call mint function| CreatePet[Create Pet NFT]
    CreatePet --> |Initialize<br/>⛓️ Record birth_date = current ledger| PetState[Pet State:<br/>Stage: Egg<br/>Happiness: 100<br/>Hunger: 0<br/>Health: 100<br/>⛓️ birth_date: Block-height]
    
    PetState --> |Auto-trigger| FirstAchievement[🎯 Achievement Unlocked:<br/>First Steps 🥚]
    FirstAchievement --> |Call achievement contract| RecordFirstPet[Record First Pet]
    
    PetState --> |Time passes<br/>⛓️ Block-height dependent| StateDecay[State Decay:<br/>⛓️ Based on Ledger Sequence<br/>Hunger increases every 30 ledgers<br/>Happiness decreases every 60 ledgers<br/>Health affected by hunger]
    
    StateDecay --> UserActions{User Actions}
    
    UserActions --> Feed[Feed Pet]
    UserActions --> Play[Play Games]
    UserActions --> Chat[💬 Chat with Pet]
    UserActions --> Update[Update State]
    
    Feed --> |Call feed function| FeedEffects[Feed Effects:<br/>Hunger -40<br/>Happiness +15]
    FeedEffects --> |Check| PerfectStats{Perfect Stats?<br/>Happiness=100<br/>Hunger=0<br/>Health=100}
    PerfectStats -->|Yes| PerfectionistAchievement[🎯 Achievement Unlocked:<br/>Perfectionist 💯]
    PerfectStats -->|No| RecordFeed[Record Feed Action]
    PerfectionistAchievement --> RecordFeed
    RecordFeed --> |Count feeds| FeedCount{Feed Count >= 10?}
    FeedCount -->|Yes| StreakMaster[🎯 Achievement Unlocked:<br/>Streak Master 🔥]
    FeedCount -->|No| CheckEvolution1[Check Evolution]
    StreakMaster --> CheckEvolution1
    
    Play --> |Select Game| GameSelection{Choose Game}
    GameSelection --> MemoryGame[🧠 Memory Game]
    GameSelection --> TicTacToe[❌⭕ Tic-Tac-Toe]
    GameSelection --> RockPaperScissors[✊✋✌️ Rock Paper Scissors]
    
    MemoryGame --> GameWin{Win Game?}
    TicTacToe --> GameWin
    RockPaperScissors --> GameWin
    
    GameWin -->|Yes| PlayEffects[Play Effects:<br/>Happiness +25]
    GameWin -->|No| UserActions
    
    PlayEffects --> |Check| PerfectStats2{Perfect Stats?}
    PerfectStats2 -->|Yes| PerfectionistAchievement2[🎯 Achievement Unlocked:<br/>Perfectionist 💯]
    PerfectStats2 -->|No| RecordPlay[Record Play Action]
    PerfectionistAchievement2 --> RecordPlay
    RecordPlay --> |Count plays| PlayCount{Play Count >= 10?}
    PlayCount -->|Yes| ActivePlayer[🎯 Achievement Unlocked:<br/>Active Player 🎮]
    PlayCount -->|No| CheckEvolution2[Check Evolution]
    ActivePlayer --> CheckEvolution2
    
    Chat --> |Open chat interface| PetGreeting[Pet sends greeting<br/>based on current stats]
    PetGreeting --> |User sends message| ChatResponse[Pet responds via AI<br/>Context: stats, stage, recent actions]
    ChatResponse --> UserActions
    
    Update --> |Call update_state<br/>⛓️ Uses current ledger sequence| StateDecay
    
    CheckEvolution1 --> EvolutionCheck{Evolution Check}
    CheckEvolution2 --> EvolutionCheck
    
    EvolutionCheck --> |⛓️ Check age & stats<br/>Age = Current Block-height - Birth Block-height| EggStage{Stage: Egg?}
    EggStage -->|Yes| EggToBaby{⛓️ Age >= 36 ledgers?<br/>Block-height based}
    EggToBaby -->|Yes| EvolveToBaby[Evolve to Baby 🐣]
    EggToBaby -->|No| UserActions
    
    EvolveToBaby --> |Auto-trigger| MetamorphosisAchievement[🎯 Achievement Unlocked:<br/>Metamorphosis 🦋]
    MetamorphosisAchievement --> |Update URI| BabyState[Pet State:<br/>Stage: Baby<br/>Stats updated]
    
    EggStage -->|No| BabyStage{Stage: Baby?}
    BabyStage -->|Yes| BabyToTeen{⛓️ Age >= 84 ledgers<br/>Block-height based<br/>AND<br/>Happiness >= 60?}
    BabyToTeen -->|Yes| EvolveToTeen[Evolve to Teen 🦖]
    BabyToTeen -->|No| UserActions
    
    EvolveToTeen --> |Auto-trigger| TripleEvolution[🎯 Achievement Unlocked:<br/>Triple Evolution 🌟]
    TripleEvolution --> |Update URI| TeenState[Pet State:<br/>Stage: Teen<br/>Stats updated]
    
    BabyStage -->|No| TeenStage{Stage: Teen?}
    TeenStage -->|Yes| TeenToAdult{⛓️ Age >= 144 ledgers<br/>Block-height based<br/>AND<br/>Happiness >= 60<br/>AND<br/>Health >= 80?}
    TeenToAdult -->|Yes| EvolveToAdult[Evolve to Adult 🐲]
    TeenToAdult -->|No| UserActions
    
    EvolveToAdult --> |Auto-trigger| LegendAchievement[🎯 Achievement Unlocked:<br/>Legend 👑]
    LegendAchievement --> |Update URI| AdultState[Pet State:<br/>Stage: Adult<br/>Stats updated]
    
    TeenStage -->|No| AdultStage[Already Adult]
    
    AdultState --> ContinuePlaying[Continue Playing & Caring]
    AdultStage --> ContinuePlaying
    ContinuePlaying --> UserActions
    
    %% Death and Revival Flow
    StateDecay --> |If health = 0| PetDeath[Pet Dies 💀]
    PetDeath --> |User can revive| Revive{Revive Pet?}
    Revive -->|Yes| RevivalEffects[Revival Effects:<br/>Health: 50<br/>Happiness: 30<br/>Hunger: 50]
    RevivalEffects --> |Auto-trigger| DeathSurvivor[🎯 Achievement Unlocked:<br/>Death Survivor 💀]
    DeathSurvivor --> PetState
    Revive -->|No| EndDeath([Pet Remains Dead])
    
    %% Styling
    classDef achievement fill:#FFD700,stroke:#FFA500,stroke-width:3px,color:#000
    classDef evolution fill:#9B59B6,stroke:#6C3483,stroke-width:3px,color:#fff
    classDef action fill:#3498DB,stroke:#2874A6,stroke-width:2px,color:#fff
    classDef state fill:#2ECC71,stroke:#1E8449,stroke-width:2px,color:#fff
    classDef game fill:#E74C3C,stroke:#C0392B,stroke-width:2px,color:#fff
    classDef chat fill:#E91E63,stroke:#C2185B,stroke-width:2px,color:#fff
    
    class FirstAchievement,PerfectionistAchievement,PerfectionistAchievement2,StreakMaster,ActivePlayer,MetamorphosisAchievement,TripleEvolution,LegendAchievement,DeathSurvivor achievement
    class EvolveToBaby,EvolveToTeen,EvolveToAdult evolution
    class Feed,Play,Chat,Update,Revive action
    class PetState,BabyState,TeenState,AdultState state
    class MemoryGame,TicTacToe,RockPaperScissors game
    class PetGreeting,ChatResponse chat


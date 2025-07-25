# Solana Program Development Guide

This guide provides a comprehensive template for creating new Solana programs using the Pinocchio framework and following proven architectural patterns.

## Project Structure Overview

```
src/
├── lib.rs              # Main entry point and instruction routing
├── error.rs            # Custom program errors
├── utils.rs            # Utility functions
├── instructions/       # Instruction handlers
│   ├── mod.rs         # Module exports
│   └── *.rs           # Individual instruction implementations
└── state/             # Account state definitions
    ├── mod.rs         # Module exports
    └── *.rs           # Individual state structs
```

## Initial Setup

### 1. Cargo.toml Configuration

```toml
[package]
name = "your-program-name"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "lib"]

[dependencies]
bytemuck = { version = "1.23.1", features = ["derive"] }
pinocchio = { git = "https://github.com/anza-xyz/pinocchio", branch = "main" }
pinocchio-pubkey = { git = "https://github.com/anza-xyz/pinocchio", branch = "main" }
pinocchio-system = { git = "https://github.com/anza-xyz/pinocchio", branch = "main" }
pinocchio-log = { git = "https://github.com/anza-xyz/pinocchio", branch = "main" }
pinocchio-token = { git = "https://github.com/anza-xyz/pinocchio", branch = "main" }
pinocchio-associated-token-account = { git = "https://github.com/anza-xyz/pinocchio", branch = "main" }
shank = { version = "0.4.3" }
bs58 = "0.5.1"

[dev-dependencies]
mollusk-svm = "0.4.0"
mollusk-svm-bencher = "0.4.0"
solana-sdk = "2.3.1"

[profile.release]
overflow-checks = true
lto = "fat"
codegen-units = 1

[profile.release.build-override]
opt-level = 3
incremental = false
codegen-units = 1
```

### 2. Main Library File (src/lib.rs)

```rust
#![no_std]
#![allow(unexpected_cfgs)]

use pinocchio::{
    account_info::AccountInfo, entrypoint, program_error::ProgramError, ProgramResult,
};
use shank::ShankInstruction;

pub mod error;
pub mod instructions;
pub mod state;
pub mod utils;

pub use error::*;
pub use instructions::*;

// Replace with your program ID
pinocchio_pubkey::declare_id!("YOUR_PROGRAM_ID_HERE");

entrypoint!(process_instruction);

fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    // Validate program ID
    if program_id != &crate::ID {
        return Err(ProgramError::IncorrectProgramId);
    }
    
    // Route instructions based on discriminator
    match instruction_data.split_first() {
        Some((0, data)) => YourFirstInstruction::try_from((accounts, data))?.process(),
        Some((1, data)) => YourSecondInstruction::try_from((accounts, data))?.process(),
        // Add more instructions as needed
        _ => Err(YourProgramError::InvalidDiscriminator.into()),
    }
}

/// Instructions enum for IDL generation
#[repr(u8)]
#[derive(Clone, Debug, PartialEq, ShankInstruction)]
pub enum YourProgramInstructions {
    // Define your instructions here with account annotations
    // Example:
    #[account(0, signer, writable, name="authority", desc = "Authority account")]
    #[account(1, writable, name = "target_account", desc = "Target account to modify")]
    YourFirstInstruction { param1: u64, param2: [u8; 32] },
    
    // Add more instructions...
}
```

## Architecture Patterns

### 1. Error Handling (src/error.rs)

```rust
use pinocchio::program_error::ProgramError;
use shank::ShankType;

#[derive(Clone, PartialEq, ShankType)]
pub enum YourProgramError {
    InvalidDiscriminator = 6001,
    InvalidAccountOwner = 6002,
    AccountAlreadyInitialized = 6003,
    UninitializedAccount = 6004,
    // Add your custom errors here
}

impl From<YourProgramError> for ProgramError {
    fn from(e: YourProgramError) -> Self {
        Self::Custom(e as u32)
    }
}
```

### 2. State Management (src/state/mod.rs)

```rust
pub mod your_state;
// Add more state modules

pub use your_state::*;
// Export all state structs
```

### 3. State Struct Pattern (src/state/your_state.rs)

```rust
use bytemuck::{Pod, Zeroable};
use pinocchio::{account_info::AccountInfo, program_error::ProgramError, pubkey::Pubkey};
use shank::ShankAccount;

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable, ShankAccount)]
pub struct YourState {
    pub field1: Pubkey,
    pub field2: [u8; 8],    // u64
    pub field3: [u8; 4],    // u32
    pub field4: u8,
    // Add your fields here
}

impl YourState {
    pub const LEN: usize = core::mem::size_of::<Self>();

    pub fn load(account: &mut AccountInfo) -> Result<&mut Self, ProgramError> {
        let data = unsafe { account.borrow_mut_data_unchecked() };
        let state = bytemuck::try_from_bytes_mut::<YourState>(data)
            .map_err(|_| ProgramError::InvalidAccountData)?;
        Ok(state)
    }
}
```

### 4. Instruction Pattern (src/instructions/your_instruction.rs)

```rust
use bytemuck::{Pod, Zeroable};
use pinocchio::{
    account_info::AccountInfo, 
    program_error::ProgramError, 
    sysvars::{rent::Rent, Sysvar}, 
    ProgramResult
};
use pinocchio_log::log;

use crate::{state::YourState, YourProgramError};

// Account validation struct
#[repr(C)]
pub struct YourInstructionAccounts<'info> {
    pub authority: &'info AccountInfo,
    pub target_account: &'info AccountInfo,
    // Add required accounts
}

impl<'info> TryFrom<&'info [AccountInfo]> for YourInstructionAccounts<'info> {
    type Error = ProgramError;

    fn try_from(accounts: &'info [AccountInfo]) -> Result<Self, Self::Error> {
        let [authority, target_account, ..] = accounts else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        // Validate accounts
        if !authority.is_signer() {
            log!("authority was not signer");
            return Err(ProgramError::MissingRequiredSignature);
        }

        if !target_account.is_owned_by(&crate::ID) {
            log!("target_account not owned by our program");
            return Err(ProgramError::InvalidAccountOwner);
        }

        Ok(Self {
            authority,
            target_account,
        })
    }
}

// Instruction data struct
#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
pub struct YourInstructionData {
    pub param1: [u8; 8],  // u64
    pub param2: [u8; 32], // Pubkey or other data
}

impl YourInstructionData {
    pub const LEN: usize = core::mem::size_of::<YourInstructionData>();
}

impl<'info> TryFrom<&'info [u8]> for YourInstructionData {
    type Error = ProgramError;

    fn try_from(data: &'info [u8]) -> Result<Self, Self::Error> {
        let result: &YourInstructionData = bytemuck::try_from_bytes::<Self>(data)
            .map_err(|_| ProgramError::InvalidInstructionData)?;
        Ok(*result)
    }
}

// Main instruction struct
#[repr(C)]
pub struct YourInstruction<'info> {
    pub accounts: YourInstructionAccounts<'info>,
    pub instruction_data: YourInstructionData,
}

impl<'info> TryFrom<(&'info [AccountInfo], &'info [u8])> for YourInstruction<'info> {
    type Error = ProgramError;

    fn try_from(
        (accounts, data): (&'info [AccountInfo], &'info [u8]),
    ) -> Result<Self, Self::Error> {
        let accounts = YourInstructionAccounts::try_from(accounts)?;
        let instruction_data = YourInstructionData::try_from(data)?;

        Ok(Self {
            accounts,
            instruction_data,
        })
    }
}

impl<'info> YourInstruction<'info> {
    pub fn process(&mut self) -> ProgramResult {
        // Implement your instruction logic here
        
        // Example: Load and modify state
        let mut target = self.accounts.target_account.clone();
        let state = YourState::load(&mut target)?;
        
        // Modify state based on instruction data
        state.field2 = self.instruction_data.param1;
        
        log!("Instruction processed successfully");
        Ok(())
    }
}
```

### 5. Instructions Module (src/instructions/mod.rs)

```rust
pub mod your_instruction;
// Add more instruction modules

pub use your_instruction::*;
// Export all instructions
```

### 6. Utilities (src/utils.rs)

```rust
// Add reusable utility functions here
// Example:

pub fn calculate_fees(amount: u64, bps: u16) -> u64 {
    amount * bps as u64 / 10_000
}

pub fn validate_pubkey(key: &Pubkey) -> bool {
    // Add validation logic
    true
}
```

## Development Best Practices

### 1. Account Validation
- Always validate account ownership
- Check signer requirements
- Verify account initialization state
- Use proper error handling

### 2. Data Serialization
- Use `bytemuck` for zero-copy deserialization
- Implement `Pod` and `Zeroable` for state structs
- Handle endianness consistently (use arrays for multi-byte values)

### 3. Error Handling
- Create custom error types with descriptive names
- Use logging for debugging (`pinocchio_log::log!`)
- Return appropriate error codes

### 4. Security Considerations
- Validate all input parameters
- Check account ownership and permissions
- Implement proper access controls
- Use PDAs for deterministic addresses

### 5. Testing
- Write unit tests for individual functions
- Use `mollusk-svm` for integration testing
- Test error conditions and edge cases

## Common Patterns

### PDA Derivation
```rust
use pinocchio_pubkey::{derive_address, find_program_address};

// Find PDA
let (pda, bump) = find_program_address(&[b"seed", authority.key().as_ref()], &crate::ID);

// Derive with known bump
let derived_pda = derive_address(&[b"seed", authority.key().as_ref()], Some(bump), &crate::ID);
```

### Account Creation
```rust
use pinocchio_system::instructions::CreateAccount;

CreateAccount {
    from: payer,
    to: new_account,
    space: YourState::LEN as u64,
    lamports: Rent::get()?.minimum_balance(YourState::LEN),
    owner: &crate::ID,
}.invoke()?;
```

### Token Operations
```rust
use pinocchio_token::instructions::Transfer;

Transfer {
    from: source_account,
    to: destination_account,
    authority: authority_account,
    amount: transfer_amount,
}.invoke()?;
```

## Getting Started Checklist

1. [ ] Set up Cargo.toml with required dependencies
2. [ ] Create main lib.rs with program ID and instruction routing
3. [ ] Define custom error types in error.rs
4. [ ] Create state structs in state/ directory
5. [ ] Implement instruction handlers in instructions/ directory
6. [ ] Add utility functions as needed
7. [ ] Write tests for your instructions
8. [ ] Generate IDL using Shank
9. [ ] Deploy and test on devnet

## Additional Resources

- [Pinocchio Documentation](https://github.com/anza-xyz/pinocchio)
- [Shank IDL Generation](https://github.com/metaplex-foundation/shank)
- [Solana Program Development](https://docs.solana.com/developing/on-chain-programs/overview)

This structure provides a solid foundation for building efficient, maintainable Solana programs with clear separation of concerns and robust error handling.
# Solana Programming Model Guide

A comprehensive overview of the Solana programming model for developers building on-chain programs.

## Table of Contents

1. [Introduction](#introduction)
2. [Core Concepts](#core-concepts)
3. [Accounts Model](#accounts-model)
4. [Programs and Instructions](#programs-and-instructions)
5. [Transaction Processing](#transaction-processing)
6. [Program Derived Addresses (PDAs)](#program-derived-addresses-pdas)
7. [Cross-Program Invocations (CPIs)](#cross-program-invocations-cpis)
8. [Rent and Account Management](#rent-and-account-management)
9. [Security Considerations](#security-considerations)
10. [Best Practices](#best-practices)

## Introduction

Solana's programming model is fundamentally different from Ethereum's account-based model. Understanding these differences is crucial for building efficient and secure Solana programs.

### Key Differences from Ethereum

- **Stateless Programs**: Programs don't store state; they operate on external accounts
- **Account-Based Architecture**: Everything is an account (programs, data, system accounts)
- **Parallel Processing**: Transactions can execute in parallel when they don't conflict
- **Rent Model**: Accounts must pay rent to remain on-chain (or be rent-exempt)

## Core Concepts

### 1. Everything is an Account

In Solana, everything is represented as an account:

- **Program Accounts**: Contain executable code (immutable)
- **Data Accounts**: Store program state and user data
- **System Accounts**: Native accounts (SOL balances, etc.)
- **Sysvar Accounts**: System variables (clock, rent, etc.)

### 2. Programs are Stateless

Unlike Ethereum smart contracts, Solana programs:

- Don't store state internally
- Operate on data passed via accounts
- Are immutable once deployed
- Can be upgraded through specific mechanisms

### 3. Parallel Execution

Solana can process transactions in parallel when:

- They don't access the same accounts
- Account access patterns don't conflict
- Proper account locking is maintained

## Accounts Model

### Account Structure

In Pinocchio, accounts are accessed through `AccountInfo`:

```rust
use pinocchio::{account_info::AccountInfo, pubkey::Pubkey};

// AccountInfo provides access to account properties
pub struct AccountInfo {
    pub key: &Pubkey,           // Account's public key
    pub lamports: &RefCell<&mut u64>,  // SOL balance in lamports
    pub data: &RefCell<&mut [u8]>,     // Account data (no Vec, fixed slice)
    pub owner: &Pubkey,         // Program that owns this account
    pub executable: bool,       // Whether this account is a program
    pub rent_epoch: Epoch,      // Next epoch to pay rent
}
```

Key differences in Pinocchio:

- No `Vec<u8>` for data (uses `&mut [u8]` slices)
- Uses `RefCell` for interior mutability
- `no_std` compatible

### Account Types

#### 1. Program Accounts

- Contain executable bytecode
- Owned by the BPF Loader or BPF Loader Upgradeable
- Immutable data (executable code)
- Cannot be modified after deployment (unless upgradeable)

#### 2. Data Accounts

- Store program state and user data
- Owned by specific programs
- Mutable (can be modified by owning program)
- Must pay rent or be rent-exempt

#### 3. System Accounts

- Native SOL accounts
- Owned by the System Program
- Used for basic operations (transfers, account creation)

### Account Ownership Rules

- Only the owner program can modify an account's data
- Only the owner program can debit lamports
- Any program can credit lamports to any account
- Account ownership can be transferred (with restrictions)

## Programs and Instructions

### Program Structure

A typical Pinocchio program follows this structure:

```rust
#![no_std]
#![allow(unexpected_cfgs)]

use pinocchio::{
    account_info::AccountInfo,
    entrypoint,
    program_error::ProgramError,
    ProgramResult,
};
use shank::ShankInstruction;

pub mod error;
pub mod instructions;
pub mod state;
pub mod utils;

pub use error::*;
pub use instructions::*;

// Declare program ID using Pinocchio
pinocchio_pubkey::declare_id!("YourProgramIDHere");

// Program entry point
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
        _ => Err(YourProgramError::InvalidDiscriminator.into()),
    }
}
```

### Instruction Processing

Instructions are processed through:

1. **Deserialization**: Parse instruction data and accounts
2. **Validation**: Verify account ownership, signatures, and constraints
3. **Execution**: Perform the requested operation
4. **State Updates**: Modify account data as needed

### Account Validation Pattern

Pinocchio uses structured account validation with `TryFrom`:

```rust
use pinocchio::{account_info::AccountInfo, program_error::ProgramError};
use pinocchio_log::log;

#[repr(C)]
pub struct YourInstructionAccounts<'info> {
    pub authority: &'info AccountInfo,
    pub data_account: &'info AccountInfo,
    pub system_program: &'info AccountInfo,
}

impl<'info> TryFrom<&'info [AccountInfo]> for YourInstructionAccounts<'info> {
    type Error = ProgramError;

    fn try_from(accounts: &'info [AccountInfo]) -> Result<Self, Self::Error> {
        let [authority, data_account, system_program, ..] = accounts else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        // Validate signer
        if !authority.is_signer() {
            log!("authority was not signer");
            return Err(ProgramError::MissingRequiredSignature);
        }

        // Validate ownership
        if !data_account.is_owned_by(&crate::ID) {
            log!("data_account not owned by our program");
            return Err(ProgramError::IncorrectProgramId);
        }

        // Check initialization state
        if data_account.lamports().eq(&0) {
            return Err(ProgramError::UninitializedAccount);
        }

        Ok(Self {
            authority,
            data_account,
            system_program,
        })
    }
}
```

## Transaction Processing

### Transaction Structure

In Pinocchio programs, you work with instruction data and accounts directly:

```rust
use bytemuck::{Pod, Zeroable};
use pinocchio::{account_info::AccountInfo, program_error::ProgramError};

// Instruction data structure (no_std compatible)
#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
pub struct YourInstructionData {
    pub param1: [u8; 8],  // u64 as byte array
    pub param2: [u8; 32], // Pubkey as byte array
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
```

### Transaction Lifecycle

1. **Construction**: Client builds transaction with instructions
2. **Signing**: Required signers sign the transaction
3. **Submission**: Transaction sent to RPC node
4. **Validation**: Basic validation (signatures, format)
5. **Processing**: Runtime executes instructions
6. **Confirmation**: Transaction included in block

### Account Locking

During transaction processing:

- Accounts are locked to prevent conflicts
- Read-only accounts can be accessed by multiple transactions
- Writable accounts are exclusively locked
- Proper account ordering prevents deadlocks

## Program Derived Addresses (PDAs)

### What are PDAs?

PDAs are deterministic addresses derived from:

- A program ID
- A set of seeds (strings, pubkeys, etc.)
- An optional bump seed

### PDA Properties

- **Deterministic**: Same seeds always produce same address
- **Off the Curve**: Not valid Ed25519 public keys
- **Program Controlled**: Only the deriving program can sign for them
- **No Private Key**: Cannot be controlled by external wallets

### PDA Usage Patterns

Pinocchio provides PDA utilities through `pinocchio_pubkey`:

```rust
use pinocchio::{pubkey, account_info::AccountInfo};
use pinocchio_pubkey::derive_address;

// Find PDA with bump
let (pda, bump) = pubkey::find_program_address(
    &[b"config", user_account.key().as_ref()],
    &crate::ID
);

// Derive PDA with known bump (more efficient)
let pda = derive_address(
    &[b"config", user_account.key().as_ref()],
    Some(bump),
    &crate::ID,
);

// Validate PDA in instruction
if account.key().ne(&expected_pda) {
    return Err(YourProgramError::InvalidPDA.into());
}
```

### Common PDA Use Cases

- **Global State**: Program configuration accounts
- **User State**: Per-user data accounts
- **Associated Accounts**: Token accounts, metadata
- **Authority**: Program-controlled signing authority

## Cross-Program Invocations (CPIs)

### What are CPIs?

CPIs allow programs to call other programs, enabling:

- Composability between programs
- Access to system programs (Token, System, etc.)
- Complex multi-program workflows

### CPI Mechanics

Pinocchio provides CPI support through `pinocchio::cpi`:

```rust
use pinocchio::{
    cpi::invoke,
    instruction::{AccountMeta, Instruction},
    account_info::AccountInfo,
};

// Create instruction for another program (no Vec, use arrays)
let account_metas = [
    AccountMeta::new(account1.key(), false, false),
    AccountMeta::readonly(account2.key()),
];

let instruction = Instruction {
    program_id: &target_program_id,
    accounts: &account_metas,
    data: &instruction_data,
};

let account_infos = [account1, account2];

// Invoke the instruction
invoke(&instruction, &account_infos)?;
```

### CPI with PDA Signing

Pinocchio supports signed CPIs for PDA authorities:

```rust
use pinocchio::cpi::invoke_signed;

// Sign with PDA (no nested Vec, use arrays)
let authority_seeds = [b"authority", &[authority_bump]];
let signer_seeds = [&authority_seeds[..]];

invoke_signed(
    &instruction,
    &account_infos,
    &signer_seeds,
)?;

// For multiple PDAs
let seeds1 = [b"authority", &[bump1]];
let seeds2 = [b"config", user.key().as_ref(), &[bump2]];
let signer_seeds = [&seeds1[..], &seeds2[..]];

invoke_signed(&instruction, &account_infos, &signer_seeds)?;
```

### CPI Security Considerations

- **Privilege Escalation**: Called programs inherit caller's privileges
- **Account Validation**: Validate all accounts before CPI
- **Reentrancy**: Be aware of potential reentrancy attacks
- **Resource Limits**: CPIs consume compute units

## Rent and Account Management

### Rent Model

Solana uses a rent model where:

- Accounts pay rent every epoch to remain on-chain
- Rent-exempt accounts (≥2 years of rent) don't pay ongoing rent
- Accounts with insufficient rent are deleted

### Rent Calculation

Pinocchio provides sysvar access through `pinocchio::sysvars`:

```rust
use pinocchio::sysvars::{rent::Rent, Sysvar};

let rent = Rent::get()?;
let minimum_balance = rent.minimum_balance(account_size);

// Also available: Clock for timestamps
use pinocchio::sysvars::clock::Clock;
let clock = Clock::get()?;
let current_timestamp = clock.unix_timestamp;
```

### Account Creation Patterns

Pinocchio provides system program instructions through `pinocchio_system`:

```rust
use pinocchio::sysvars::{rent::Rent, Sysvar};
use pinocchio_system::instructions::CreateAccount;

// Create account with sufficient lamports for rent exemption
let space = YourState::LEN;
let rent = Rent::get()?;
let lamports = rent.minimum_balance(space);

// Use Pinocchio's CreateAccount instruction
CreateAccount {
    from: payer_account,
    to: new_account,
    space: space as u64,
    lamports,
    owner: &crate::ID,
}.invoke()?;

// For transfers
use pinocchio_system::instructions::Transfer;
Transfer {
    from: source_account,
    to: destination_account,
    lamports: amount,
}.invoke()?;
```

### Account Lifecycle

1. **Creation**: Account created with initial lamports
2. **Usage**: Program modifies account data
3. **Rent Payment**: Automatic rent deduction each epoch
4. **Deletion**: Account deleted if rent balance insufficient

## Security Considerations

### Common Vulnerabilities

#### 1. Missing Ownership Checks

```rust
// BAD: No ownership check
// (This would cause compilation error in Pinocchio)

// GOOD: Use Pinocchio's ownership validation
if !data_account.is_owned_by(&crate::ID) {
    log!("data_account not owned by our program");
    return Err(ProgramError::IncorrectProgramId);
}
```

#### 2. Missing Signer Checks

```rust
// BAD: No signer verification
// (This would cause compilation error in Pinocchio)

// GOOD: Use Pinocchio's signer validation
if !authority.is_signer() {
    log!("authority was not signer");
    return Err(ProgramError::MissingRequiredSignature);
}
```

#### 3. Integer Overflow

```rust
// BAD: Potential overflow (same in Pinocchio)
let result = a + b; // Could overflow

// GOOD: Checked arithmetic (works in no_std)
let result = a.checked_add(b)
    .ok_or(ProgramError::ArithmeticOverflow)?;

// For byte array conversions
let amount = u64::from_le_bytes(amount_bytes);
let result_bytes = result.to_le_bytes();
```

#### 4. Account Confusion

```rust
// BAD: Assuming account order
let user_account = &accounts[0];
let data_account = &accounts[1];

// GOOD: Structured validation with TryFrom
impl<'info> TryFrom<&'info [AccountInfo]> for YourAccounts<'info> {
    type Error = ProgramError;

    fn try_from(accounts: &'info [AccountInfo]) -> Result<Self, Self::Error> {
        let [user_account, data_account, ..] = accounts else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        // Validate each account...
        Ok(Self { user_account, data_account })
    }
}
```

### Security Best Practices

1. **Validate Everything**: Check all accounts, signatures, and data
2. **Use Checked Math**: Prevent integer overflow/underflow
3. **Minimize Trust**: Don't trust client-provided data
4. **Access Control**: Implement proper authorization
5. **Test Thoroughly**: Include edge cases and attack scenarios

## Complete Pinocchio Instruction Example

Here's a complete example of a Pinocchio instruction following all best practices:

```rust
use bytemuck::{Pod, Zeroable};
use pinocchio::{
    account_info::AccountInfo,
    program_error::ProgramError,
    sysvars::{rent::Rent, Sysvar},
    ProgramResult,
};
use pinocchio_log::log;
use pinocchio_system::instructions::CreateAccount;
use shank::ShankAccount;

// State struct (no_std compatible)
#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable, ShankAccount)]
pub struct UserData {
    pub owner: [u8; 32],      // Pubkey as byte array
    pub balance: [u8; 8],     // u64 as byte array
    pub created_at: [u8; 8],  // i64 timestamp
    pub bump: u8,
}

impl UserData {
    pub const LEN: usize = core::mem::size_of::<Self>();

    pub fn load(account: &mut AccountInfo) -> Result<&mut Self, ProgramError> {
        let data = unsafe { account.borrow_mut_data_unchecked() };
        let state = bytemuck::try_from_bytes_mut::<UserData>(data)
            .map_err(|_| ProgramError::InvalidAccountData)?;
        Ok(state)
    }
}

// Account validation struct
#[repr(C)]
pub struct InitializeUserAccounts<'info> {
    pub authority: &'info AccountInfo,
    pub user_data: &'info AccountInfo,
    pub system_program: &'info AccountInfo,
}

impl<'info> TryFrom<&'info [AccountInfo]> for InitializeUserAccounts<'info> {
    type Error = ProgramError;

    fn try_from(accounts: &'info [AccountInfo]) -> Result<Self, Self::Error> {
        let [authority, user_data, system_program, ..] = accounts else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        // Validate authority is signer
        if !authority.is_signer() {
            log!("authority was not signer");
            return Err(ProgramError::MissingRequiredSignature);
        }

        // Validate user_data is owned by system (uninitialized)
        if !user_data.is_owned_by(&pinocchio_system::ID) {
            log!("user_data account already initialized");
            return Err(ProgramError::AccountAlreadyInitialized);
        }

        // Validate user_data has no lamports (uninitialized)
        if user_data.lamports().ne(&0) {
            return Err(ProgramError::AccountAlreadyInitialized);
        }

        Ok(Self {
            authority,
            user_data,
            system_program,
        })
    }
}

// Instruction data struct
#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
pub struct InitializeUserData {
    pub initial_balance: [u8; 8], // u64 as bytes
}

impl InitializeUserData {
    pub const LEN: usize = core::mem::size_of::<InitializeUserData>();
}

impl<'info> TryFrom<&'info [u8]> for InitializeUserData {
    type Error = ProgramError;

    fn try_from(data: &'info [u8]) -> Result<Self, Self::Error> {
        let result: &InitializeUserData = bytemuck::try_from_bytes::<Self>(data)
            .map_err(|_| ProgramError::InvalidInstructionData)?;
        Ok(*result)
    }
}

// Main instruction struct
#[repr(C)]
pub struct InitializeUser<'info> {
    pub accounts: InitializeUserAccounts<'info>,
    pub instruction_data: InitializeUserData,
}

impl<'info> TryFrom<(&'info [AccountInfo], &'info [u8])> for InitializeUser<'info> {
    type Error = ProgramError;

    fn try_from(
        (accounts, data): (&'info [AccountInfo], &'info [u8]),
    ) -> Result<Self, Self::Error> {
        let accounts = InitializeUserAccounts::try_from(accounts)?;
        let instruction_data = InitializeUserData::try_from(data)?;

        Ok(Self {
            accounts,
            instruction_data,
        })
    }
}

impl<'info> InitializeUser<'info> {
    pub fn process(&mut self) -> ProgramResult {
        // Create the account
        let rent = Rent::get()?;
        let lamports = rent.minimum_balance(UserData::LEN);

        CreateAccount {
            from: self.accounts.authority,
            to: self.accounts.user_data,
            space: UserData::LEN as u64,
            lamports,
            owner: &crate::ID,
        }.invoke()?;

        log!("User data account created");

        // Initialize account data
        let mut user_data_account = self.accounts.user_data.clone();
        let user_data = UserData::load(&mut user_data_account)?;

        // Set data (convert types to byte arrays)
        user_data.owner = self.accounts.authority.key().to_bytes();
        user_data.balance = self.instruction_data.initial_balance;
        user_data.created_at = pinocchio::sysvars::clock::Clock::get()?.unix_timestamp.to_le_bytes();

        log!("User data initialized successfully");
        Ok(())
    }
}
```

## Best Practices

### Program Design

1. **Stateless Design**: Keep programs stateless and data in accounts
2. **Modular Architecture**: Separate concerns into different instructions
3. **Error Handling**: Use custom error enums with `From<YourError> for ProgramError`
4. **Documentation**: Document all instructions and account requirements
5. **No-std Compatibility**: Use `core::` instead of `std::`, avoid `Vec`, use arrays and slices

### Account Management

1. **Rent Exemption**: Make accounts rent-exempt when possible
2. **Size Planning**: Plan account sizes carefully (resizing is complex)
3. **PDA Usage**: Use PDAs for program-controlled accounts
4. **Account Validation**: Always validate account ownership and properties
5. **Data Layout**: Use `#[repr(C)]` and `bytemuck` for consistent memory layout
6. **Byte Arrays**: Store multi-byte values as byte arrays (`[u8; N]`) for endianness control

### Performance Optimization

1. **Compute Units**: Monitor and optimize compute usage
2. **Account Access**: Minimize account reads/writes
3. **Parallel Processing**: Design for parallel execution
4. **Memory Usage**: Minimize stack usage (no heap in `no_std`)
5. **Zero-Copy Deserialization**: Use `bytemuck` for efficient data access
6. **Logging**: Use `pinocchio_log::log!` for debugging (removed in production)

### Development Workflow

1. **Testing**: Use local validators and comprehensive tests
2. **Deployment**: Test on devnet before mainnet
3. **Monitoring**: Monitor program usage and errors
4. **Upgrades**: Plan for program upgrades if needed

## Pinocchio-Specific Features

### Key Advantages

1. **No-std Environment**: Smaller binary size and reduced compute units
2. **Zero-Copy Operations**: Direct memory access without allocations
3. **Type Safety**: Compile-time guarantees for account validation
4. **Modular Design**: Use only the components you need

### Pinocchio Modules

```rust
// Core functionality
use pinocchio::{
    account_info::AccountInfo,
    entrypoint,
    program_error::ProgramError,
    ProgramResult,
};

// Pubkey operations
use pinocchio_pubkey::{declare_id, derive_address};

// System program interactions
use pinocchio_system::instructions::{CreateAccount, Transfer};

// Token program interactions
use pinocchio_token::instructions::{Transfer as TokenTransfer, MintTo};

// Associated token account operations
use pinocchio_associated_token_account;

// Logging (debug only)
use pinocchio_log::log;

// Sysvars
use pinocchio::sysvars::{clock::Clock, rent::Rent, Sysvar};
```

### Memory Management

Pinocchio's `no_std` environment requires careful memory management:

```rust
// ✅ GOOD: Use fixed-size arrays
let seeds = [b"config", user.key().as_ref(), &[bump]];

// ❌ BAD: Vec not available in no_std
// let seeds = vec![b"config", user.key().as_ref(), &[bump]];

// ✅ GOOD: Use core library functions
use core::mem::size_of;
let size = size_of::<YourStruct>();

// ❌ BAD: std not available
// use std::mem::size_of;

// ✅ GOOD: Use slices for variable data
fn process_data(data: &[u8]) -> Result<(), ProgramError> {
    // Process slice
    Ok(())
}
```

### Error Handling Pattern

```rust
use pinocchio::program_error::ProgramError;
use shank::ShankType;

#[derive(Clone, PartialEq, ShankType)]
pub enum YourProgramError {
    InvalidDiscriminator = 6001,
    InvalidAccountOwner = 6002,
    AccountAlreadyInitialized = 6003,
    // Add more errors...
}

impl From<YourProgramError> for ProgramError {
    fn from(e: YourProgramError) -> Self {
        Self::Custom(e as u32)
    }
}

// Usage in instructions
if !account.is_signer() {
    return Err(YourProgramError::InvalidAccountOwner.into());
}
```

## Modern Development Tools (2022+)

### Frameworks and SDKs

- **Pinocchio**: Lightweight, `no_std` framework for efficient program development
- **Anchor**: High-level framework with more abstractions (uses `std`)
- **Native Solana Program**: Direct Solana program development with full SDK
- **Seahorse**: Python-based Solana development (compiles to Anchor)

### Testing Tools

- **Solana Test Validator**: Local development environment
- **Surfpool**: Enhanced test validator with mainnet program access
- **Mollusk**: Fast unit testing framework
- **Bankrun**: Lightweight testing framework

### Client Development

- **@solana/web3.js**: Official JavaScript SDK
- **Gill**: Modern TypeScript SDK
- **Solana Rust SDK**: Native Rust client development
- **Codama**: Multi-language client generation from IDL

## Conclusion

The Solana programming model offers unique advantages:

- **High Performance**: Parallel processing and efficient runtime
- **Composability**: Programs can interact seamlessly
- **Flexibility**: Account-based model supports complex applications
- **Cost Efficiency**: Low transaction costs and predictable fees

Understanding these concepts is essential for building successful Solana applications. The stateless program model, account ownership rules, and parallel processing capabilities enable developers to create highly efficient and scalable blockchain applications.

## Additional Resources

- **Solana Documentation**: https://docs.solana.com/
- **Solana Cookbook**: https://solanacookbook.com/
- **Helius Blog**: https://www.helius.dev/blog/
- **Solana Program Examples**: https://github.com/solana-labs/solana-program-library
- **Anchor Book**: https://book.anchor-lang.com/

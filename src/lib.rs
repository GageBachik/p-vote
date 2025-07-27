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

pinocchio_pubkey::declare_id!("pVoTew8KNhq6rsrYq9jEUzKypytaLtQR62UbagWTCvu");

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
    // maybe update to enum for #[derive(ShankInstruction)]
    match instruction_data.split_first() {
        Some((0, data)) => InitializePlatform::try_from((accounts, data))?.process(),
        Some((1, data)) => UpdatePlatform::try_from((accounts, data))?.process(),
        Some((2, data)) => InitializeVote::try_from((accounts, data))?.process(),
        Some((3, data)) => InitializePosition::try_from((accounts, data))?.process(),
        Some((4, data)) => UpdatePosition::try_from((accounts, data))?.process(),
        Some((5, data)) => RedeemWinnings::try_from((accounts, data))?.process(),
        _ => Err(PTokenProgramError::InvalidDiscriminator.into()),
    }
}

/// Instructions for ptoken. This is currently not used in the
/// program business logic, but we include it for IDL generation.
#[repr(u8)]
#[derive(Clone, Debug, PartialEq, ShankInstruction)]
pub enum PTokenInstructions {
    #[account(
        0,
        signer,
        writable,
        name = "authority",
        desc = "Authority of the vault"
    )]
    #[account(1, writable, name = "platform", desc = "Platform pda key")]
    #[account(2, writable, name = "vault", desc = "platforms fee vault pda")]
    #[account(3, name = "rent", desc = "Rent program")]
    #[account(4, name = "system_program", desc = "System program")]
    InitializePlatform {
        fee: [u8; 2],
        platform_bump: u8,
        vault_bump: u8,
    },

    #[account(
        0,
        signer,
        writable,
        name = "authority",
        desc = "Authority of the vault"
    )]
    #[account(1, name = "new_authority", desc = "new authority of the vault")]
    #[account(2, writable, name = "platform", desc = "Platform pda key")]
    #[account(3, name = "vault", desc = "platforms fee vault pda")]
    #[account(4, name = "rent", desc = "Rent program")]
    #[account(5, name = "system_program", desc = "System program")]
    UpdatePlatform { new_fee: [u8; 2] },

    #[account(
        0,
        signer,
        writable,
        name = "authority",
        desc = "Authority of the vault"
    )]
    #[account(1, name = "platform", desc = "Platform pda key")]
    #[account(2, name = "vault", desc = "platforms fee vault pda")]
    #[account(3, signer, writable, name = "vote", desc = "new vote account")]
    #[account(4, name = "token", desc = "vote token")]
    #[account(5, writable, name = "vote_vault", desc = "votes vault pda")]
    #[account(
        6,
        writable,
        name = "vote_vault_token_account",
        desc = "votes token account for storing funds"
    )]
    #[account(
        7,
        writable,
        name = "vault_token_account",
        desc = "votes token account for storing funds"
    )]
    #[account(8, name = "rent", desc = "Rent program")]
    #[account(9, name = "system_program", desc = "System program")]
    #[account(10, name = "token_program", desc = "Token program")]
    #[account(
        11,
        name = "associated_token_program",
        desc = "Associated Token program"
    )]
    InitializeVote { time_to_add: [u8; 8] },

    #[account(
        0,
        signer,
        writable,
        name = "authority",
        desc = "Authority of the vault"
    )]
    #[account(1, name = "platform", desc = "Platform pda key")]
    #[account(2, name = "vault", desc = "platforms fee vault pda")]
    #[account(3, writable, name = "vote", desc = "vote account")]
    #[account(4, name = "token", desc = "vote token")]
    #[account(5, name = "vote_vault", desc = "votes vault pda")]
    #[account(
        6,
        writable,
        name = "vote_vault_token_account",
        desc = "votes token account for storing funds"
    )]
    #[account(
        7,
        writable,
        name = "authority_token_account",
        desc = "authorities token account for storing funds"
    )]
    #[account(
        8,
        writable,
        name = "vault_token_account",
        desc = "vault token account for storing funds"
    )]
    #[account(
        9,
        writable,
        name = "position",
        desc = "position pda for voting on one side"
    )]
    #[account(10, name = "rent", desc = "Rent program")]
    #[account(11, name = "system_program", desc = "System program")]
    #[account(12, name = "token_program", desc = "Token program")]
    IntitializePosition { amount: [u8; 8], side: u8 },

    #[account(
        0,
        signer,
        writable,
        name = "authority",
        desc = "Authority of the vault"
    )]
    #[account(1, name = "platform", desc = "Platform pda key")]
    #[account(2, name = "vault", desc = "platforms fee vault pda")]
    #[account(3, writable, name = "vote", desc = "vote account")]
    #[account(4, name = "token", desc = "vote token")]
    #[account(5, name = "vote_vault", desc = "votes vault pda")]
    #[account(
        6,
        writable,
        name = "vote_vault_token_account",
        desc = "votes token account for storing funds"
    )]
    #[account(
        7,
        writable,
        name = "authority_token_account",
        desc = "authorities token account for storing funds"
    )]
    #[account(
        8,
        writable,
        name = "vault_token_account",
        desc = "vault token account for storing funds"
    )]
    #[account(
        9,
        writable,
        name = "position",
        desc = "position pda for voting on one side"
    )]
    #[account(10, name = "rent", desc = "Rent program")]
    #[account(11, name = "system_program", desc = "System program")]
    #[account(12, name = "token_program", desc = "Token program")]
    UpdatePosition { amount: [u8; 8] },

    #[account(
        0,
        signer,
        writable,
        name = "authority",
        desc = "Authority of the vault"
    )]
    #[account(1, name = "platform", desc = "Platform pda key")]
    #[account(2, name = "vault", desc = "platforms fee vault pda")]
    #[account(3, writable, name = "vote", desc = "vote account")]
    #[account(4, name = "token", desc = "vote token")]
    #[account(5, name = "vote_vault", desc = "votes vault pda")]
    #[account(
        6,
        writable,
        name = "vote_vault_token_account",
        desc = "votes token account for storing funds"
    )]
    #[account(
        7,
        writable,
        name = "authority_token_account",
        desc = "authorities token account for storing funds"
    )]
    #[account(
        8,
        writable,
        name = "vault_token_account",
        desc = "vault token account for storing funds"
    )]
    #[account(
        9,
        writable,
        name = "position",
        desc = "position pda for voting on one side"
    )]
    #[account(10, name = "rent", desc = "Rent program")]
    #[account(11, name = "system_program", desc = "System program")]
    RedeemWinnings,
}

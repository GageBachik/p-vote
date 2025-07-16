#![no_std]
#![allow(unexpected_cfgs)]
// Allow unsafe mut for editing accounts from clippy
#![allow(clippy::mut_from_ref)]

use pinocchio::{
    ProgramResult, account_info::AccountInfo, entrypoint, program_error::ProgramError,
};

pub mod instructions;
pub mod state;
pub mod error;

pub use instructions::*;
pub use error::*;

pinocchio_pubkey::declare_id!("2YwymitHUGW6vwk66cZpVoq5oGD31Ziz41UNokMBrKeY");

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
        _ => Err(PTokenProgramError::InvalidDiscriminator.into()),
    }
}

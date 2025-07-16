use bytemuck::{Pod, Zeroable};
use pinocchio::{
    ProgramResult,
    account_info::AccountInfo,
    instruction::{Seed, Signer},
    program_error::ProgramError,
    sysvars::{Sysvar, rent::Rent},
};
use pinocchio_log::log;
use pinocchio_pubkey::derive_address;
use pinocchio_system::instructions::Transfer;
use shank::ShankType;

use crate::state::Platform;

pub const PLATFORM_SEED: &'static [u8; 6] = b"config";

#[repr(C)]
pub struct InitializePlatformAccounts<'info> {
    pub authority: &'info AccountInfo,
    pub platform: &'info AccountInfo,
    pub vault: &'info AccountInfo,
}

impl<'info> TryFrom<&'info [AccountInfo]> for InitializePlatformAccounts<'info> {
    type Error = ProgramError;

    fn try_from(accounts: &'info [AccountInfo]) -> Result<Self, Self::Error> {
        let [authority, platform, vault, ..] = accounts else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        if !authority.is_signer() {
            return Err(ProgramError::InvalidAccountOwner);
        }

        if !platform.is_owned_by(&pinocchio_system::ID) {
            return Err(ProgramError::InvalidAccountOwner);
        }

        if platform.lamports().ne(&0) {
            return Err(ProgramError::AccountAlreadyInitialized);
        }

        if platform.key().ne(&derive_address(&[b"config"], None, &crate::ID)) {
            log!("platform key: {} | Derived: {}", platform.key(), &derive_address(&[PLATFORM_SEED], None, &crate::ID));
            return Err(ProgramError::InvalidAccountData);
        }

        if vault.key().ne(&derive_address(&[platform.key().as_ref()], None, &crate::ID)) {
            log!("vault key: {} | Derived: {}", vault.key(), &derive_address(&[platform.key().as_ref()], None, &crate::ID));
            return Err(ProgramError::InvalidAccountData);
        }

        Ok(Self { authority, platform, vault})
    }
}

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable, ShankType)]
pub struct InitializePlatformInstructionData {
    pub fee: [u8; 2],
    pub bump: u8
}

impl InitializePlatformInstructionData {
    pub const LEN: usize = core::mem::size_of::<InitializePlatformInstructionData>();
}

impl<'info> TryFrom<&'info [u8]> for InitializePlatformInstructionData {
    type Error = ProgramError;

    fn try_from(data: &'info [u8]) -> Result<Self, Self::Error> {
        let result: &InitializePlatformInstructionData = bytemuck::try_from_bytes::<Self>(&data)
            .map_err(|_| ProgramError::InvalidInstructionData)?;

        Ok(*result)
    }
}

#[repr(C)]
pub struct InitializePlatform<'info> {
    pub accounts: InitializePlatformAccounts<'info>,
    pub instruction_data: InitializePlatformInstructionData,
}

impl<'info> TryFrom<(&'info [AccountInfo], &'info [u8])> for InitializePlatform<'info> {
    type Error = ProgramError;

    fn try_from(
        (accounts, data): (&'info [AccountInfo], &'info [u8]),
    ) -> Result<Self, Self::Error> {
        let accounts = InitializePlatformAccounts::try_from(accounts)?;
        let instruction_data = InitializePlatformInstructionData::try_from(data)?;

        Ok(Self {
            accounts,
            instruction_data,
        })
    }
}

impl<'info> InitializePlatform<'info> {
    pub fn process(&mut self) -> ProgramResult {

        let bump = [self.instruction_data.bump];
        let seed = [
            Seed::from(PLATFORM_SEED),
            Seed::from(&bump),
        ];
        let signer_seeds = Signer::from(&seed);

        // Initialize the counter account
        pinocchio_system::instructions::CreateAccount {
            from: self.accounts.authority,
            to: self.accounts.platform,
            space: Platform::LEN as u64,
            lamports: Rent::get()?.minimum_balance(Platform::LEN),
            owner: &crate::ID,
        }
        .invoke_signed(&[signer_seeds])?;

        // Initialize config account.
        let platform_state = Platform::load(self.accounts.platform)?;

        platform_state.fee = self.instruction_data.fee;
        platform_state.bump = self.instruction_data.bump;

        // Initialize the vault by sending it some sol (but don't actually init the data)
        Transfer {
            from: self.accounts.authority,
            to: self.accounts.vault,
            lamports: (0.01 * 1e9) as u64,
        }
        .invoke()?;

        Ok(())
    }
}
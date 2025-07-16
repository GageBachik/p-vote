use bytemuck::{Pod, Zeroable};
use pinocchio::{
    account_info::AccountInfo, instruction::{Seed, Signer}, program_error::ProgramError, pubkey, sysvars::{rent::Rent, Sysvar}, ProgramResult
};

use pinocchio_log::log;
use pinocchio_pubkey::derive_address;
use pinocchio_system::instructions::Transfer;
use pinocchio::sysvars::clock::Clock;
use shank::ShankType;

use crate::{state::{Platform, Vote, PLATFORM_SEED}, PTokenProgramError};

#[repr(C)]
pub struct InitializeVoteAccounts<'info> {
    pub authority: &'info AccountInfo,
    pub platform: &'info AccountInfo,
    pub vault: &'info AccountInfo,
    pub vote: &'info AccountInfo,
    pub token: &'info AccountInfo,
    pub vote_vault: &'info AccountInfo,
}

impl<'info> TryFrom<&'info [AccountInfo]> for InitializeVoteAccounts<'info> {
    type Error = ProgramError;

    fn try_from(accounts: &'info [AccountInfo]) -> Result<Self, Self::Error> {
        let [authority, platform, vault, vote, token, vote_vault,  ..] = accounts else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        if !authority.is_signer() {
            return Err(ProgramError::InvalidAccountOwner);
        }

        if !platform.is_owned_by(&crate::ID) {
            return Err(ProgramError::InvalidAccountOwner);
        }

        if platform.lamports().eq(&0) {
            return Err(ProgramError::UninitializedAccount);
        }

        if !vote.is_signer(){
            return Err(ProgramError::InvalidAccountOwner);
        }

        if !vote.is_owned_by(&pinocchio_system::ID) {
            return Err(ProgramError::InvalidAccountOwner);
        }

        if vote.lamports().ne(&0) {
            return Err(ProgramError::AccountAlreadyInitialized);
        }

        if token.lamports().eq(&0) {
            return Err(ProgramError::UninitializedAccount);
        }

        if !token.is_owned_by(&pinocchio_token::ID) {
            return Err(ProgramError::InvalidAccountOwner);
        }

        if !vote_vault.is_owned_by(&pinocchio_system::ID) {
            return Err(ProgramError::InvalidAccountOwner);
        }

        if vote_vault.lamports().ne(&0) {
            return Err(ProgramError::AccountAlreadyInitialized);
        }

        Ok(Self { authority, platform, vault, vote, token, vote_vault})
    }
}

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable, ShankType)]
pub struct InitializeVoteInstructionData {
    pub end_timestamp: [u8; 8],
    pub vault_bump: u8
}

impl InitializeVoteInstructionData {
    pub const LEN: usize = core::mem::size_of::<InitializeVoteInstructionData>();
}

impl<'info> TryFrom<&'info [u8]> for InitializeVoteInstructionData {
    type Error = ProgramError;

    fn try_from(data: &'info [u8]) -> Result<Self, Self::Error> {
        let result: &InitializeVoteInstructionData = bytemuck::try_from_bytes::<Self>(data)
            .map_err(|_| ProgramError::InvalidInstructionData)?;

        Ok(*result)
    }
}

#[repr(C)]
pub struct InitializeVote<'info> {
    pub accounts: InitializeVoteAccounts<'info>,
    pub instruction_data: InitializeVoteInstructionData,
}

impl<'info> TryFrom<(&'info [AccountInfo], &'info [u8])> for InitializeVote<'info> {
    type Error = ProgramError;

    fn try_from(
        (accounts, data): (&'info [AccountInfo], &'info [u8]),
    ) -> Result<Self, Self::Error> {
        let accounts = InitializeVoteAccounts::try_from(accounts)?;
        let instruction_data = InitializeVoteInstructionData::try_from(data)?;

        Ok(Self {
            accounts,
            instruction_data,
        })
    }
}

impl<'info> InitializeVote<'info> {
    pub fn process(&mut self) -> ProgramResult {
        // Handle extra checks here
        // mainly that vault and platform are correct
        let mut platform = self.accounts.platform.clone();
        let platform_state = Platform::load(&mut platform)?;

        if self.accounts.platform.key().ne(&derive_address(&[PLATFORM_SEED], Some(platform_state.platform_bump), &crate::ID)) {
            log!("self.accounts.platform key: {} | Derived: {}", self.accounts.platform.key(), &derive_address(&[PLATFORM_SEED], None, &crate::ID));
            return Err(PTokenProgramError::PlatformKeyIncorrect.into());
        }
        // cant use derive_address for security concerns
        // find the vault PDA
        let (vote_vault_pda, vote_vault_bump) =
        pubkey::find_program_address(&[self.accounts.vote.key().as_ref()], &crate::ID);
        // check that it matches what the user supplied:
        if self.accounts.vote_vault.key().ne(&vote_vault_pda) {
            return Err(PTokenProgramError::VoteVaultKeyIncorrect.into());
        }

        // Initialize the vote account
        pinocchio_system::instructions::CreateAccount {
            from: self.accounts.authority,
            to: self.accounts.vote,
            space: Vote::LEN as u64,
            lamports: Rent::get()?.minimum_balance(Vote::LEN),
            owner: &crate::ID,
        }
        .invoke()?;

        // Initialize vote account.
        let mut vote = self.accounts.vote.clone();
        let vote_state = Vote::load(&mut vote)?;

        vote_state.token = *self.accounts.token.key();
        vote_state.vault_bump = vote_vault_bump;

        // Initialize the vote vault by sending it some sol (but don't actually init the data)
        Transfer {
            from: self.accounts.authority,
            to: self.accounts.vote_vault,
            lamports: (0.01 * 1e9) as u64,
        }
        .invoke()?;

        Ok(())
    }
}
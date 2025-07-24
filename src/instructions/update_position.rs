use bytemuck::{Pod, Zeroable};
use pinocchio::{
    account_info::AccountInfo, program_error::ProgramError, sysvars::Sysvar, ProgramResult,
};

use pinocchio::sysvars::clock::Clock;
use pinocchio_pubkey::derive_address;
use pinocchio_token::instructions::Transfer;

use crate::{
    state::{Platform, Position, Vote, PLATFORM_SEED, POSITION_SEED},
    utils::calculate_fees,
    PTokenProgramError,
};

#[repr(C)]
pub struct UpdatePositionAccounts<'info> {
    pub authority: &'info AccountInfo,
    pub platform: &'info AccountInfo,
    pub vault: &'info AccountInfo,
    pub vote: &'info AccountInfo,
    pub token: &'info AccountInfo,
    pub vote_vault: &'info AccountInfo,
    pub vote_vault_token_account: &'info AccountInfo,
    pub authority_token_account: &'info AccountInfo,
    pub vault_token_account: &'info AccountInfo,
    pub position: &'info AccountInfo,
}

impl<'info> TryFrom<&'info [AccountInfo]> for UpdatePositionAccounts<'info> {
    type Error = ProgramError;

    fn try_from(accounts: &'info [AccountInfo]) -> Result<Self, Self::Error> {
        let [authority, platform, vault, vote, token, vote_vault, vote_vault_token_account, authority_token_account, vault_token_account, position, ..] =
            accounts
        else {
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

        if !vote.is_owned_by(&crate::ID) {
            return Err(ProgramError::InvalidAccountOwner);
        }

        if vote.lamports().eq(&0) {
            return Err(ProgramError::InvalidAccountData);
        }

        if !token.is_owned_by(&pinocchio_token::ID) {
            return Err(ProgramError::InvalidAccountOwner);
        }

        if token.lamports().eq(&0) {
            return Err(ProgramError::UninitializedAccount);
        }

        // since we're going to do an actual derive on this from here on out
        // maybe we don't need to check anything else on it to save compute?
        if vote_vault.lamports().eq(&0) {
            return Err(ProgramError::InvalidAccountData);
        }

        if !position.is_owned_by(&crate::ID) {
            return Err(ProgramError::InvalidAccountOwner);
        }

        if position.lamports().eq(&0) {
            return Err(ProgramError::InvalidAccountData);
        }

        if vote_vault_token_account.is_owned_by(&pinocchio_token::ID) {
            return Err(ProgramError::InvalidAccountOwner);
        }

        if authority_token_account.is_owned_by(&pinocchio_token::ID) {
            return Err(ProgramError::InvalidAccountOwner);
        }

        if vault_token_account.is_owned_by(&pinocchio_token::ID) {
            return Err(ProgramError::InvalidAccountOwner);
        }

        Ok(Self {
            authority,
            platform,
            vault,
            vote,
            token,
            vote_vault,
            vote_vault_token_account,
            authority_token_account,
            vault_token_account,
            position,
        })
    }
}

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
pub struct UpdatesPositionInstructionData {
    pub amount: [u8; 8],
}

impl UpdatesPositionInstructionData {
    pub const LEN: usize = core::mem::size_of::<UpdatesPositionInstructionData>();
}

impl<'info> TryFrom<&'info [u8]> for UpdatesPositionInstructionData {
    type Error = ProgramError;

    fn try_from(data: &'info [u8]) -> Result<Self, Self::Error> {
        let result: &UpdatesPositionInstructionData = bytemuck::try_from_bytes::<Self>(data)
            .map_err(|_| ProgramError::InvalidInstructionData)?;

        Ok(*result)
    }
}

#[repr(C)]
pub struct UpdatePosition<'info> {
    pub accounts: UpdatePositionAccounts<'info>,
    pub instruction_data: UpdatesPositionInstructionData,
}

impl<'info> TryFrom<(&'info [AccountInfo], &'info [u8])> for UpdatePosition<'info> {
    type Error = ProgramError;

    fn try_from(
        (accounts, data): (&'info [AccountInfo], &'info [u8]),
    ) -> Result<Self, Self::Error> {
        let accounts = UpdatePositionAccounts::try_from(accounts)?;
        let instruction_data = UpdatesPositionInstructionData::try_from(data)?;

        Ok(Self {
            accounts,
            instruction_data,
        })
    }
}

impl<'info> UpdatePosition<'info> {
    pub fn process(&mut self) -> ProgramResult {
        // Handle extra security checks here
        // mainly that platform, vault, vote_vault, and poisition_pda are correct
        let mut platform = self.accounts.platform.clone();
        let platform_state = Platform::load(&mut platform)?;
        if self.accounts.platform.key().ne(&derive_address(
            &[PLATFORM_SEED],
            Some(platform_state.platform_bump),
            &crate::ID,
        )) {
            return Err(PTokenProgramError::PlatformKeyIncorrect.into());
        }
        if self.accounts.vault.key().ne(&derive_address(
            &[self.accounts.platform.key().as_ref()],
            Some(platform_state.vault_bump),
            &crate::ID,
        )) {
            return Err(PTokenProgramError::VaultKeyIncorrect.into());
        }
        let mut vote = self.accounts.vote.clone();
        let vote_state = Vote::load(&mut vote)?;
        if self.accounts.vote_vault.key().ne(&derive_address(
            &[self.accounts.vote.key().as_ref()],
            Some(vote_state.vault_bump),
            &crate::ID,
        )) {
            return Err(PTokenProgramError::VoteVaultKeyIncorrect.into());
        };

        let mut position = self.accounts.position.clone();
        let position_state = Position::load(&mut position)?;
        // find the position PDA
        if self.accounts.position.key().ne(&derive_address(
            &[
                POSITION_SEED,
                self.accounts.vote.key().as_ref(),
                self.accounts.authority.key().as_ref(),
            ],
            Some(position_state.bump),
            &crate::ID,
        )) {
            return Err(PTokenProgramError::VoteVaultKeyIncorrect.into());
        };

        // Don't let user create or update positions if the vote
        // has already ended
        let now = Clock::get()?.unix_timestamp;
        let vote_deadline = i64::from_le_bytes(vote_state.end_timestamp);
        if now > vote_deadline {
            return Err(PTokenProgramError::VoteHasAlreadyEnded.into());
        }

        // Transfer appropiate token and fees
        let update_amount = u64::from_be_bytes(self.instruction_data.amount);
        let fee_amount = calculate_fees(update_amount, u16::from_le_bytes(platform_state.fee));
        // Initialize the position vault by sending it some sol (but don't actually init the data)
        Transfer {
            from: self.accounts.authority_token_account,
            to: self.accounts.vote_vault_token_account,
            authority: self.accounts.authority,
            amount: update_amount,
        }
        .invoke()?;
        // Take our fee
        Transfer {
            from: self.accounts.authority_token_account,
            to: self.accounts.vault_token_account,
            authority: self.accounts.authority,
            amount: fee_amount,
        }
        .invoke()?;

        position_state.amount =
            (u64::from_be_bytes(self.instruction_data.amount) + update_amount).to_be_bytes();

        if position_state.side == 0 {
            vote_state.false_votes =
                (u64::from_le_bytes(vote_state.false_votes) + update_amount).to_le_bytes();
        } else {
            vote_state.true_votes =
                (u64::from_le_bytes(vote_state.true_votes) + update_amount).to_le_bytes();
        }

        Ok(())
    }
}

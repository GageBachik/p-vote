use bytemuck::{Pod, Zeroable};
use pinocchio::{
    account_info::AccountInfo,
    instruction::{Seed, Signer},
    program_error::ProgramError,
    sysvars::Sysvar,
    ProgramResult,
};

use pinocchio::sysvars::clock::Clock;
use pinocchio_pubkey::derive_address;
use pinocchio_token::instructions::Transfer;
use shank::ShankType;

use crate::{
    state::{Platform, Position, Vote, PLATFORM_SEED, POSITION_SEED},
    utils::calculate_fees,
    PTokenProgramError,
};

#[repr(C)]
pub struct RedeemWinningsAccounts<'info> {
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

impl<'info> TryFrom<&'info [AccountInfo]> for RedeemWinningsAccounts<'info> {
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
#[derive(Clone, Copy, Pod, Zeroable, ShankType)]
pub struct RedeemWinningsInstructionData {}

impl RedeemWinningsInstructionData {
    pub const LEN: usize = core::mem::size_of::<RedeemWinningsInstructionData>();
}

impl<'info> TryFrom<&'info [u8]> for RedeemWinningsInstructionData {
    type Error = ProgramError;

    fn try_from(data: &'info [u8]) -> Result<Self, Self::Error> {
        let result: &RedeemWinningsInstructionData = bytemuck::try_from_bytes::<Self>(data)
            .map_err(|_| ProgramError::InvalidInstructionData)?;

        Ok(*result)
    }
}

#[repr(C)]
pub struct RedeemWinnings<'info> {
    pub accounts: RedeemWinningsAccounts<'info>,
    pub instruction_data: RedeemWinningsInstructionData,
}

impl<'info> TryFrom<(&'info [AccountInfo], &'info [u8])> for RedeemWinnings<'info> {
    type Error = ProgramError;

    fn try_from(
        (accounts, data): (&'info [AccountInfo], &'info [u8]),
    ) -> Result<Self, Self::Error> {
        let accounts = RedeemWinningsAccounts::try_from(accounts)?;
        let instruction_data = RedeemWinningsInstructionData::try_from(data)?;

        Ok(Self {
            accounts,
            instruction_data,
        })
    }
}

impl<'info> RedeemWinnings<'info> {
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

        // Don't let users redeem if the vote is still going on
        let now = Clock::get()?.unix_timestamp;
        let vote_deadline = i64::from_le_bytes(vote_state.end_timestamp);
        // purposely non-inclusive to allow flashloan exploit for learning purposes
        // I should be able to sway the votes and redeem all on the vote deadline.
        if now < vote_deadline {
            return Err(PTokenProgramError::VoteIsStillRunning.into());
        }

        // Redeem winnings

        let voted_true = position_state.side != 0;
        let total_true = u64::from_be_bytes(vote_state.true_votes);
        let total_false = u64::from_le_bytes(vote_state.false_votes);
        let winning_side = if total_true > total_false {
            Some(true)
        } else if total_false > total_true {
            Some(false)
        } else {
            None // it's a tie
        };

        // make sure user voted correctly otherwise they can't redeem.
        if let Some(winner) = winning_side {
            if voted_true != winner {
                return Err(PTokenProgramError::DidNotVoteForWinningSide.into());
            }
        } else {
            return Err(PTokenProgramError::VoteWasTied.into());
        }

        let winning_side = winning_side.unwrap(); // safe now

        let winning_total = if winning_side {
            total_true
        } else {
            total_false
        };
        let losing_total = if winning_side {
            total_false
        } else {
            total_true
        };

        let position_amount = u64::from_le_bytes(position_state.amount);
        let reward = position_amount + (position_amount * losing_total) / winning_total;

        // Transfer appropiate token and fees
        let fee_amount = calculate_fees(reward, u16::from_le_bytes(platform_state.fee));

        let bump = [vote_state.vault_bump];
        let seeds = [
            Seed::from(self.accounts.vote.key().as_ref()),
            Seed::from(&bump),
        ];
        let signer_seeds = Signer::from(&seeds);

        Transfer {
            from: self.accounts.vote_vault_token_account,
            to: self.accounts.authority_token_account,
            authority: self.accounts.vote_vault,
            amount: reward,
        }
        .invoke_signed(&[signer_seeds])?;
        // Take our fee
        Transfer {
            from: self.accounts.vote_vault_token_account,
            to: self.accounts.vault_token_account,
            authority: self.accounts.vote_vault,
            amount: fee_amount,
        }
        .invoke()?;

        // lastly close the position account data so it can no longer be redeemed.
        {
            let mut data = self.accounts.position.try_borrow_mut_data()?;
            data[0] = 0xff;
        }

        *self.accounts.vault.try_borrow_mut_lamports()? +=
            *self.accounts.position.try_borrow_lamports()?;
        self.accounts.position.resize(1)?;
        self.accounts.position.close()?;

        Ok(())
    }
}

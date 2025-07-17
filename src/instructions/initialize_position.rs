use bytemuck::{Pod, Zeroable};
use pinocchio::{
    account_info::AccountInfo, instruction::{Seed, Signer}, program_error::ProgramError, pubkey, sysvars::{rent::Rent, Sysvar}, ProgramResult
};

use pinocchio_pubkey::derive_address;
use pinocchio_token::instructions::Transfer;
use pinocchio::sysvars::clock::Clock;
use shank::ShankType;

use crate::{state::{Platform, Position, Vote, PLATFORM_SEED, POSITION_SEED}, utils::calculate_fees, PTokenProgramError};

#[repr(C)]
pub struct InitializePositionAccounts<'info> {
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

impl<'info> TryFrom<&'info [AccountInfo]> for InitializePositionAccounts<'info> {
    type Error = ProgramError;

    fn try_from(accounts: &'info [AccountInfo]) -> Result<Self, Self::Error> {
        let [authority, platform, vault, vote, token, vote_vault, vote_vault_token_account, authority_token_account, vault_token_account, position,  ..] = accounts else {
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

        if !position.is_owned_by(&pinocchio_system::ID) {
            return Err(ProgramError::InvalidAccountOwner);
        }

        if position.lamports().ne(&0) {
            return Err(ProgramError::AccountAlreadyInitialized);
        }

        if vote_vault_token_account.is_owned_by(&pinocchio_token::ID){
            return Err(ProgramError::InvalidAccountOwner);
        }

        if authority_token_account.is_owned_by(&pinocchio_token::ID){
            return Err(ProgramError::InvalidAccountOwner);
        }

        if vault_token_account.is_owned_by(&pinocchio_token::ID){
            return Err(ProgramError::InvalidAccountOwner);
        }

        Ok(Self { authority, platform, vault, vote, token, vote_vault, vote_vault_token_account, authority_token_account, vault_token_account, position})
    }
}

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable, ShankType)]
pub struct InitializePositionInstructionData {
    pub amount: [u8; 8],
    pub side: u8,
}

impl InitializePositionInstructionData {
    pub const LEN: usize = core::mem::size_of::<InitializePositionInstructionData>();
}

impl<'info> TryFrom<&'info [u8]> for InitializePositionInstructionData {
    type Error = ProgramError;

    fn try_from(data: &'info [u8]) -> Result<Self, Self::Error> {
        let result: &InitializePositionInstructionData = bytemuck::try_from_bytes::<Self>(data)
            .map_err(|_| ProgramError::InvalidInstructionData)?;

        Ok(*result)
    }
}

#[repr(C)]
pub struct InitializePosition<'info> {
    pub accounts: InitializePositionAccounts<'info>,
    pub instruction_data: InitializePositionInstructionData,
}

impl<'info> TryFrom<(&'info [AccountInfo], &'info [u8])> for InitializePosition<'info> {
    type Error = ProgramError;

    fn try_from(
        (accounts, data): (&'info [AccountInfo], &'info [u8]),
    ) -> Result<Self, Self::Error> {
        let accounts = InitializePositionAccounts::try_from(accounts)?;
        let instruction_data = InitializePositionInstructionData::try_from(data)?;

        Ok(Self {
            accounts,
            instruction_data,
        })
    }
}

impl<'info> InitializePosition<'info> {
    pub fn process(&mut self) -> ProgramResult {
        // Handle extra security checks here
        // mainly that platform, vault, vote_vault, and poisition_pda are correct
        let mut platform = self.accounts.platform.clone();
        let platform_state = Platform::load(&mut platform)?;
        if self.accounts.platform.key().ne(&derive_address(&[PLATFORM_SEED], Some(platform_state.platform_bump), &crate::ID)) {
            return Err(PTokenProgramError::PlatformKeyIncorrect.into());
        }
        if self.accounts.vault.key().ne(&derive_address(&[self.accounts.platform.key().as_ref()], Some(platform_state.vault_bump), &crate::ID)){
            return Err(PTokenProgramError::VaultKeyIncorrect.into());
        }
        let mut vote = self.accounts.vote.clone();
        let vote_state = Vote::load(&mut vote)?;
        if self.accounts.vote_vault.key().ne(&derive_address(&[self.accounts.vote.key().as_ref()], Some(vote_state.vault_bump), &crate::ID)) {
            return Err(PTokenProgramError::VoteVaultKeyIncorrect.into());
        };

        // cant use derive_address yet for security concerns
        // find the vault PDA
        let (position_pda, position_bump) =
        pubkey::find_program_address(&[POSITION_SEED, self.accounts.vote.key().as_ref(), self.accounts.authority.key().as_ref()], &crate::ID);
        // check that it matches what the user supplied:
        if self.accounts.position.key().ne(&position_pda) {
            return Err(PTokenProgramError::PositionKeyIncorrect.into());
        }

        // Don't let user create or update positions if the vote
        // has already ended
        let now = Clock::get()?.unix_timestamp;
        let vote_deadline = i64::from_le_bytes(vote_state.end_timestamp);
        if now > vote_deadline {
            return Err(PTokenProgramError::VoteHasAlreadyEnded.into());
        }

        // Initialize the position account
        let bump = [position_bump];
        let seed = [
            Seed::from(self.accounts.vote.key().as_ref()),
            Seed::from(&bump),
        ];
        let signer_seeds = Signer::from(&seed);
        pinocchio_system::instructions::CreateAccount {
            from: self.accounts.authority,
            to: self.accounts.position,
            space: Position::LEN as u64,
            lamports: Rent::get()?.minimum_balance(Position::LEN),
            owner: &crate::ID,
        }
        .invoke_signed(&[signer_seeds])?;


        // Transfer appropiate token and fees
        let init_amount = u64::from_be_bytes(self.instruction_data.amount);
        let fee_amount = calculate_fees(init_amount, u16::from_le_bytes(platform_state.fee));
        // Initialize the position vault by sending it some sol (but don't actually init the data)
        Transfer {
            from: self.accounts.authority_token_account,
            to: self.accounts.vote_vault_token_account,
            authority: self.accounts.authority,
            amount: init_amount,
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

        // lastly set position and vote account data
        let mut position = self.accounts.position.clone();
        let position_state = Position::load(&mut position)?;

        position_state.amount = self.instruction_data.amount;
        position_state.side = self.instruction_data.side;
        position_state.bump = position_bump;

        if self.instruction_data.side == 0 {
            vote_state.false_votes = (u64::from_le_bytes(vote_state.false_votes) + init_amount).to_le_bytes();
        }else {
            vote_state.true_votes = (u64::from_le_bytes(vote_state.true_votes) + init_amount).to_le_bytes();
        }

        Ok(())
    }
}
use bytemuck::{Pod, Zeroable};
use pinocchio::{
    account_info::AccountInfo, program_error::ProgramError, pubkey, sysvars::{rent::Rent, Sysvar}, ProgramResult
};

use pinocchio_log::log;
use pinocchio_pubkey::derive_address;
use pinocchio_system::instructions::Transfer;
use pinocchio::sysvars::clock::Clock;
use pinocchio_token::{instructions::{InitializeAccount3}, state::TokenAccount};
use shank::ShankType;

use crate::{state::{Platform, Vote, PLATFORM_SEED}, utils::calculate_fees, PTokenProgramError};

#[repr(C)]
pub struct InitializeVoteAccounts<'info> {
    pub authority: &'info AccountInfo,
    pub platform: &'info AccountInfo,
    pub vault: &'info AccountInfo,
    pub vote: &'info AccountInfo,
    pub token: &'info AccountInfo,
    pub vote_vault: &'info AccountInfo,
    pub vote_vault_token_account: &'info AccountInfo,
}

impl<'info> TryFrom<&'info [AccountInfo]> for InitializeVoteAccounts<'info> {
    type Error = ProgramError;

    fn try_from(accounts: &'info [AccountInfo]) -> Result<Self, Self::Error> {
        let [authority, platform, vault, vote, token, vote_vault, vote_vault_token_account,  ..] = accounts else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        if !authority.is_signer() {
            log!("authority was not signer");
            return Err(ProgramError::InvalidAccountOwner);
        }

        if !platform.is_owned_by(&crate::ID) {
            log!("platform not owned by our program");
            return Err(ProgramError::InvalidAccountOwner);
        }

        if platform.lamports().eq(&0) {
            return Err(ProgramError::UninitializedAccount);
        }

        if !vote.is_signer(){
            log!("vote was not signer");
            return Err(ProgramError::InvalidAccountOwner);
        }

        if !vote.is_owned_by(&pinocchio_system::ID) {
            log!("vote account already initialized");
            return Err(ProgramError::InvalidAccountOwner);
        }

        if vote.lamports().ne(&0) {
            return Err(ProgramError::AccountAlreadyInitialized);
        }

        if token.lamports().eq(&0) {
            return Err(ProgramError::UninitializedAccount);
        }

        if !token.is_owned_by(&pinocchio_token::ID) {
            log!("token mint not owned by token program");
            return Err(ProgramError::InvalidAccountOwner);
        }

        if !vote_vault.is_owned_by(&pinocchio_system::ID) {
            log!("vote vault isn't owned by system? | {}", vote_vault.owner());
            return Err(ProgramError::InvalidAccountOwner);
        }

        if vote_vault.lamports().ne(&0) {
            return Err(ProgramError::AccountAlreadyInitialized);
        }

        if !vote_vault_token_account.is_owned_by(&pinocchio_system::ID) {
            log!("vote vault token account not owned by system");
            return Err(ProgramError::InvalidAccountOwner);
        }

        if vote_vault_token_account.lamports().ne(&0) {
            return Err(ProgramError::AccountAlreadyInitialized);
        }

        Ok(Self { authority, platform, vault, vote, token, vote_vault, vote_vault_token_account})
    }
}

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable, ShankType)]
pub struct InitializeVoteInstructionData {
    pub time_to_add: [u8; 8],
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
        // mainly that platform, vault, and vote_vault are correct
        let mut platform = self.accounts.platform.clone();
        let platform_state = Platform::load(&mut platform)?;
        if self.accounts.platform.key().ne(&derive_address(&[PLATFORM_SEED], Some(platform_state.platform_bump), &crate::ID)) {
            return Err(PTokenProgramError::PlatformKeyIncorrect.into());
        }
        // cant use derive_address yet for security concerns
        // find the vault PDA
        let (vote_vault_pda, vote_vault_bump) =
        pubkey::find_program_address(&[self.accounts.vote.key().as_ref()], &crate::ID);
        // check that it matches what the user supplied:
        if self.accounts.vote_vault.key().ne(&vote_vault_pda) {
            return Err(PTokenProgramError::VoteVaultKeyIncorrect.into());
        }
        // make sure the token account is correct for the vault and then make it
        let (vote_vault_token_account_pda, _vote_vault_token_account_bump) = pubkey::find_program_address(
            &[
                self.accounts.vote_vault.key().as_ref(),
                pinocchio_token::ID.as_ref(),
                self.accounts.token.key().as_ref(),
            ],
            &pinocchio_associated_token_account::ID,
        );
        // check that it matches what the user supplied:
        if self.accounts.vote_vault_token_account.key().ne(&vote_vault_token_account_pda) {
            return Err(PTokenProgramError::VoteVaultTokenAccountIncorrect.into());
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

        // Initialize the vote vault associated token account
        pinocchio_system::instructions::CreateAccount {
            from: self.accounts.authority,
            to: self.accounts.vote_vault_token_account,
            space: TokenAccount::LEN as u64,
            lamports: Rent::get()?.minimum_balance(TokenAccount::LEN),
            owner: &pinocchio_token::ID,
        }
        .invoke()?;

        // Initialize the Associated Token Account
        InitializeAccount3 {
            account: self.accounts.vote_vault_token_account,
            mint: self.accounts.token,
            owner: self.accounts.vote_vault.key(),
        }.invoke()?;


        // set vote account data
        let mut vote = self.accounts.vote.clone();
        let vote_state = Vote::load(&mut vote)?;

        vote_state.token = *self.accounts.token.key();
        vote_state.vault_bump = vote_vault_bump;
        // get the current timestamp onchain and add however long the user wants for the vote to it.
        // dont let the user arbitratily choose a timestamp for safety.
        vote_state.end_timestamp = (i64::from_le_bytes(self.instruction_data.time_to_add) + Clock::get()?.unix_timestamp).to_be_bytes();

        let init_sol = (0.01 * 1e9) as u64;
        let fee_sol = calculate_fees(init_sol, u16::from_le_bytes(platform_state.fee));
        // Initialize the vote vault by sending it some sol (but don't actually init the data)
        Transfer {
            from: self.accounts.authority,
            to: self.accounts.vote_vault,
            lamports: init_sol,
        }
        .invoke()?;
        // Take our fee
        Transfer {
            from: self.accounts.authority,
            to: self.accounts.vote_vault,
            lamports: fee_sol,
        }
        .invoke()?;

        Ok(())
    }
}
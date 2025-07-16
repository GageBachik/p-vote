use bytemuck::{Pod, Zeroable};
use pinocchio::{
      account_info::AccountInfo, program_error::ProgramError, pubkey::Pubkey
};
use shank::ShankAccount;

// vote accounts are full accounts so no need for seeds
// however there will be a vote vault account

#[repr(C)] //keeps the struct layout the same across different architectures
#[derive(Clone, Copy, Pod, Zeroable, ShankAccount)]
pub struct Vote {
    pub token: Pubkey,
    pub true_votes: [u8; 8], //u64
    pub false_votes: [u8; 8], //u64
    pub end_timestamp: [u8; 8], //i64
    pub vault_bump: u8
}

impl Vote {
    pub const LEN: usize = core::mem::size_of::<Self>();

    pub fn load(vote_account: &mut AccountInfo) -> Result<&mut Self, ProgramError> {
        let data = unsafe { vote_account.borrow_mut_data_unchecked() };
        let vote_state = bytemuck::try_from_bytes_mut::<Vote>(data)
            .map_err(|_| ProgramError::InvalidAccountData)?;
        Ok(vote_state)
    }
}
use bytemuck::{Pod, Zeroable};
use pinocchio::{account_info::AccountInfo, program_error::ProgramError};
use shank::ShankAccount;

// Full account will be positon_seed + vote_account + user keypair
pub const POSITION_SEED: &[u8; 8] = b"position";

#[repr(C)] //keeps the struct layout the same across different architectures
#[derive(Clone, Copy, Pod, Zeroable, ShankAccount)]
pub struct Position {
    pub amount: [u8; 8], //u64
    pub side: u8,
    pub bump: u8,
}

impl Position {
    pub const LEN: usize = core::mem::size_of::<Self>();

    pub fn load(vote_account: &mut AccountInfo) -> Result<&mut Self, ProgramError> {
        let data = unsafe { vote_account.borrow_mut_data_unchecked() };
        let vote_state = bytemuck::try_from_bytes_mut::<Position>(data)
            .map_err(|_| ProgramError::InvalidAccountData)?;
        Ok(vote_state)
    }
}

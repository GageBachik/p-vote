use bytemuck::{Pod, Zeroable};
use pinocchio::{
      account_info::AccountInfo, program_error::ProgramError, pubkey::Pubkey
};
use shank::ShankAccount;

pub const PLATFORM_SEED: &[u8; 6] = b"config";

#[repr(C)] //keeps the struct layout the same across different architectures
#[derive(Clone, Copy, Pod, Zeroable, ShankAccount)]
pub struct Platform {
    pub authority: Pubkey,
    // u16 -> pod cant convert between types. keep it u8
    pub fee: [u8; 2],
    pub platform_bump: u8,
    pub vault_bump: u8,
}

impl Platform {
    pub const LEN: usize = core::mem::size_of::<Self>();

    pub fn load(platform_account: &AccountInfo) -> Result<&mut Self, ProgramError> {
        let data = unsafe { platform_account.borrow_mut_data_unchecked() };
        let platform_state = bytemuck::try_from_bytes_mut::<Platform>(data)
            .map_err(|_| ProgramError::InvalidAccountData)?;
        Ok(platform_state)
    }
}
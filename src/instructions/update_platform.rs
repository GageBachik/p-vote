use bytemuck::{Pod, Zeroable};
use pinocchio::{account_info::AccountInfo, program_error::ProgramError, ProgramResult};
use pinocchio_log::log;
use pinocchio_pubkey::derive_address;

use crate::{
    state::{Platform, PLATFORM_SEED},
    PTokenProgramError,
};

// This is where we'll try and preform most of our safety checks
// anything that cant be done here can be done in the process functions
#[repr(C)]
pub struct UpdatePlatformAccounts<'info> {
    pub old_authority: &'info AccountInfo,
    pub new_authority: &'info AccountInfo,
    pub platform: &'info AccountInfo,
    pub vault: &'info AccountInfo,
}

impl<'info> TryFrom<&'info [AccountInfo]> for UpdatePlatformAccounts<'info> {
    type Error = ProgramError;

    fn try_from(accounts: &'info [AccountInfo]) -> Result<Self, Self::Error> {
        let [old_authority, new_authority, platform, vault, ..] = accounts else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        if !old_authority.is_signer() {
            return Err(ProgramError::IncorrectAuthority);
        }

        if !platform.is_owned_by(&crate::ID) {
            return Err(ProgramError::InvalidAccountOwner);
        }

        if platform.lamports().eq(&0) {
            return Err(ProgramError::InvalidAccountData);
        }

        Ok(Self {
            old_authority,
            new_authority,
            platform,
            vault,
        })
    }
}

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
pub struct UpdatePlatformInstructionData {
    pub new_fee: [u8; 2],
}

impl UpdatePlatformInstructionData {
    pub const LEN: usize = core::mem::size_of::<UpdatePlatformInstructionData>();
}

impl<'info> TryFrom<&'info [u8]> for UpdatePlatformInstructionData {
    type Error = ProgramError;

    fn try_from(data: &'info [u8]) -> Result<Self, Self::Error> {
        let result: &UpdatePlatformInstructionData = bytemuck::try_from_bytes::<Self>(data)
            .map_err(|_| ProgramError::InvalidInstructionData)?;

        Ok(*result)
    }
}

#[repr(C)]
pub struct UpdatePlatform<'info> {
    pub accounts: UpdatePlatformAccounts<'info>,
    pub instruction_data: UpdatePlatformInstructionData,
}

impl<'info> TryFrom<(&'info [AccountInfo], &'info [u8])> for UpdatePlatform<'info> {
    type Error = ProgramError;

    fn try_from(
        (accounts, data): (&'info [AccountInfo], &'info [u8]),
    ) -> Result<Self, Self::Error> {
        let accounts = UpdatePlatformAccounts::try_from(accounts)?;
        let instruction_data = UpdatePlatformInstructionData::try_from(data)?;

        Ok(Self {
            accounts,
            instruction_data,
        })
    }
}

impl<'info> UpdatePlatform<'info> {
    pub fn process(&mut self) -> ProgramResult {
        // Start with any checks that aren't possible from the accounts alone.
        // Things that need BOTH accounts and data to handle:
        // load the current config account
        // could do it in accounts but then we'd have to load it twice. one to view and one to mutate.
        // worth considering doing just to have all validations in the same place

        let mut platform = self.accounts.platform.clone();
        let platform_state = Platform::load(&mut platform)?;

        if self.accounts.platform.key().ne(&derive_address(
            &[PLATFORM_SEED],
            Some(platform_state.platform_bump),
            &crate::ID,
        )) {
            log!(
                "self.accounts.platform key: {} | Derived: {}",
                self.accounts.platform.key(),
                &derive_address(&[PLATFORM_SEED], None, &crate::ID)
            );
            return Err(PTokenProgramError::PlatformKeyIncorrect.into());
        }

        // Check if the current authority is the one we expect.
        if platform_state
            .authority
            .ne(self.accounts.old_authority.key())
        {
            return Err(ProgramError::IncorrectAuthority);
        }

        // If all checks out we can swap authorities (in intended). and or change the platform fee
        platform_state.authority = *self.accounts.new_authority.key();
        platform_state.fee = self.instruction_data.new_fee;

        Ok(())
    }
}

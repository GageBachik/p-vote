use pinocchio::program_error::ProgramError;
use shank::ShankType;

#[derive(Clone, PartialEq, ShankType)]
pub enum PTokenProgramError {
    // Invalid instruction discriminator
    InvalidDiscriminator = 6001,
    PlatformKeyIncorrect = 6002,
    VaultKeyIncorrect = 6003,
    VoteVaultKeyIncorrect = 6004,
}

impl From<PTokenProgramError> for ProgramError {
    fn from(e: PTokenProgramError) -> Self {
        Self::Custom(e as u32)
    }
}
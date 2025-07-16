use mollusk_svm::result::{Check, ProgramResult};
use mollusk_svm::{program, Mollusk};
use solana_sdk::account::Account;
use solana_sdk::instruction::{AccountMeta, Instruction};
use solana_sdk::native_token::LAMPORTS_PER_SOL;
use solana_sdk::pubkey;
use solana_sdk::pubkey::Pubkey;
extern crate alloc;
use alloc::vec;

use p_vote::instructions::{initialize_platform::{PLATFORM_SEED, InitializePlatformInstructionData}};
use p_vote::ID;
use solana_sdk::rent::Rent;
use solana_sdk::sysvar::Sysvar;

pub const PROGRAM: Pubkey = Pubkey::new_from_array(ID);
pub const RENT: Pubkey = pubkey!("SysvarRent111111111111111111111111111111111");
pub const AUTHORITY: Pubkey = pubkey!("GKPoVMxhDTi3SGxK8wRgguwfXjV8EmNkpqCfeQWyhniT");

pub fn mollusk() -> Mollusk {
    let mollusk = Mollusk::new(&PROGRAM, "target/deploy/p_vote");
    mollusk
}

pub fn get_rent_data() -> Vec<u8> {
    let rent = Rent::default();
    unsafe {
        core::slice::from_raw_parts(&rent as *const Rent as *const u8, Rent::size_of()).to_vec()
    }
}

#[test]
fn test_initialize_platform() {
    let mollusk = mollusk();

    //system program and system account
    let (system_program, system_account) = program::keyed_account_for_system_program();

    // Create the Platform PDA
    let (platform_pda, platform_bump) =
        Pubkey::find_program_address(&[PLATFORM_SEED, &AUTHORITY.to_bytes()], &PROGRAM);
    // Create the vault PDA
    let (vault_pda, _vault_bump) =
    Pubkey::find_program_address(&[platform_pda.to_bytes().as_ref()], &PROGRAM);

    //Initialize the accounts
    let authority_account = Account::new(1 * LAMPORTS_PER_SOL, 0, &system_program);
    let platform_account = Account::new(0, 0, &system_program);
    let min_balance = mollusk.sysvars.rent.minimum_balance(Rent::size_of());
    let mut rent_account = Account::new(min_balance, Rent::size_of(), &RENT);
    rent_account.data = get_rent_data();

    //Push the accounts in to the instruction_accounts vec!
    let ix_accounts = vec![
        AccountMeta::new(AUTHORITY, true),
        AccountMeta::new(platform_pda, false),
        AccountMeta::new(vault_pda, false),
        // AccountMeta::new_readonly(RENT, false),
        AccountMeta::new_readonly(system_program, false),
    ];

    // Create the instruction data
    let ix_data = InitializePlatformInstructionData {
        fee: (500 as u16).to_le_bytes(),
        bump: platform_bump
    };

    // Bytemuck serialize the data
    let ix_data_bytes = bytemuck::bytes_of(&ix_data);

    // add the discriminator to tell it what ix to run 0 => initialize_program
    let instruction_data = [vec![0], ix_data_bytes.to_vec()].concat();

    // Create instruction
    let instruction = Instruction::new_with_bytes(PROGRAM, &instruction_data, ix_accounts);

    // Create tx_accounts vec
    let tx_accounts = &vec![
        (AUTHORITY, authority_account.clone()),
        (platform_pda, platform_account.clone()),
        (RENT, rent_account.clone()),
        (system_program, system_account.clone()),
    ];

    let init_res =
        mollusk.process_and_validate_instruction(&instruction, tx_accounts, &[Check::success()]);

    assert!(init_res.program_result == ProgramResult::Success);
}
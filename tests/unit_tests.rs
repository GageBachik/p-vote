use mollusk_svm::result::{Check, ProgramResult};
use mollusk_svm::{program, Mollusk};
use p_vote::state::Platform;
use solana_sdk::account::{Account, AccountSharedData, WritableAccount};
use solana_sdk::instruction::{AccountMeta, Instruction};
use solana_sdk::native_token::LAMPORTS_PER_SOL;
use solana_sdk::program_option::COption;
use solana_sdk::program_pack::Pack;
use solana_sdk::pubkey;
use solana_sdk::pubkey::Pubkey;
extern crate alloc;
use alloc::vec;

use p_vote::instructions::{initialize_platform::InitializePlatformInstructionData, update_platform::UpdatePlatformInstructionData};
use p_vote::state::{PLATFORM_SEED};
use p_vote::{InitializeVoteInstructionData, ID};
use solana_sdk::rent::Rent;
use solana_sdk::sysvar::Sysvar;
// use spl_token::state::AccountState;

pub const PROGRAM: Pubkey = Pubkey::new_from_array(ID);
pub const RENT: Pubkey = pubkey!("SysvarRent111111111111111111111111111111111");
pub const AUTHORITY: Pubkey = pubkey!("GKPoVMxhDTi3SGxK8wRgguwfXjV8EmNkpqCfeQWyhniT");

pub fn mollusk() -> Mollusk {
    let mut mollusk = Mollusk::new(&PROGRAM, "target/deploy/p_vote");
    mollusk.add_program(
        &spl_token::ID,
        "tests/elf_files/spl_token",
        &mollusk_svm::program::loader_keys::LOADER_V3,
    );
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

    println!("authority: {:?}", AUTHORITY);

    // Create the Platform PDA
    let (platform_pda, platform_bump) =
        Pubkey::find_program_address(&[PLATFORM_SEED], &PROGRAM);
    println!("platform: {:?}", platform_pda);

    // Create the vault PDA
    let (vault_pda, vault_bump) =
    Pubkey::find_program_address(&[platform_pda.to_bytes().as_ref()], &PROGRAM);
    println!("vault: {:?}", vault_pda);

    //Initialize the accounts
    let authority_account = Account::new(1 * LAMPORTS_PER_SOL, 0, &system_program);
    let platform_account = Account::new(0, 0, &system_program);
    let vault_account = Account::new(0, 0, &system_program);
    let min_balance = mollusk.sysvars.rent.minimum_balance(Rent::size_of());
    let mut rent_account = Account::new(min_balance, Rent::size_of(), &RENT);
    rent_account.data = get_rent_data();

    //Push the accounts in to the instruction_accounts vec!
    let initialize_platform_ix_accounts = vec![
        AccountMeta::new(AUTHORITY, true),
        AccountMeta::new(platform_pda, false),
        AccountMeta::new(vault_pda, false),
        AccountMeta::new_readonly(RENT, false),
        AccountMeta::new_readonly(system_program, false),
    ];

    // Create the instruction data
    let initialize_platform_ix_data = InitializePlatformInstructionData {
        fee: (500 as u16).to_le_bytes(),
        platform_bump: platform_bump,
        vault_bump: vault_bump
    };

    // Bytemuck serialize the data
    let initialize_platform_ix_data_bytes = bytemuck::bytes_of(&initialize_platform_ix_data);

    // add the discriminator to tell it what ix to run 0 => initialize_program
    let initialize_platform_instruction_data = [vec![0], initialize_platform_ix_data_bytes.to_vec()].concat();

    // Create instruction
    let initialize_platform_instruction = Instruction::new_with_bytes(PROGRAM, &initialize_platform_instruction_data, initialize_platform_ix_accounts);

    // Create tx_accounts vec
    let initialize_platform_tx_accounts = &vec![
        (AUTHORITY, authority_account.clone()),
        (platform_pda, platform_account.clone()),
        (vault_pda, vault_account.clone()),
        (RENT, rent_account.clone()),
        (system_program, system_account.clone()),
    ];

    let result = 
                mollusk.process_and_validate_instruction(&initialize_platform_instruction, initialize_platform_tx_accounts, &[Check::success()]);
    
    let updated_data = result.get_account(&platform_pda).unwrap();
    let parsed_data = bytemuck::from_bytes::<Platform>(&updated_data.data);

    println!("Platform authority: {:?}",  bs58::encode(parsed_data.authority).into_string());
    println!("Platform fee: {:?}", u16::from_le_bytes(parsed_data.fee));
    println!("Platform bump: {}", parsed_data.platform_bump);
    println!("Vault bump: {}", parsed_data.vault_bump);

    assert!(result.program_result == ProgramResult::Success);
}

#[test]
fn test_update_platform() {
    let mollusk = mollusk();

    //system program and system account
    let (system_program, system_account) = program::keyed_account_for_system_program();

    println!("old authority: {:?}", AUTHORITY);

    let new_authority = Pubkey::new_unique();
    println!("new authority: {:?}", new_authority);

    // Create the Platform PDA
    let (platform_pda, platform_bump) =
        Pubkey::find_program_address(&[PLATFORM_SEED], &PROGRAM);
    println!("platform: {:?}", platform_pda);

    // Create the vault PDA
    let (vault_pda, vault_bump) =
    Pubkey::find_program_address(&[platform_pda.to_bytes().as_ref()], &PROGRAM);
    println!("vault: {:?}", vault_pda);


    //Initialize the accounts
    let old_authority_account = Account::new(1 * LAMPORTS_PER_SOL, 0, &system_program);
    let new_authority_account = Account::new(2 * LAMPORTS_PER_SOL, 0, &system_program);
    let platform_init_state = Platform {
        authority: AUTHORITY.to_bytes(),
        fee: (100 as u16).to_le_bytes(),
        platform_bump: platform_bump,
        vault_bump: vault_bump
    };
    let mut platform_account = AccountSharedData::new(
        mollusk.sysvars.rent.minimum_balance(Platform::LEN),
        Platform::LEN,
        &PROGRAM
    );
    platform_account.set_data_from_slice(bytemuck::bytes_of(&platform_init_state));
    let vault_account = Account::new(( 0.01 * 1e9 ) as u64, 0, &system_program);
    let min_balance = mollusk.sysvars.rent.minimum_balance(Rent::size_of());
    let mut rent_account = Account::new(min_balance, Rent::size_of(), &RENT);
    rent_account.data = get_rent_data();

    //Push the accounts in to the instruction_accounts vec!
    let update_platform_ix_accounts = vec![
        AccountMeta::new(AUTHORITY, true),
        AccountMeta::new(new_authority, true),
        AccountMeta::new(platform_pda, false),
        AccountMeta::new(vault_pda, false),
        // Required for ix
        AccountMeta::new_readonly(RENT, false),
        AccountMeta::new_readonly(system_program, false),
    ];

    // Create the instruction data
    let update_platform_instruction_data = UpdatePlatformInstructionData {
        new_fee: (333 as u16).to_le_bytes(),
    };

    // Bytemuck serialize the data
    let update_platform_instruction_data_bytes = bytemuck::bytes_of(&update_platform_instruction_data);

    // add the discriminator to tell it what ix to run 0 => update_program
    let update_platform_instruction_data = [vec![1], update_platform_instruction_data_bytes.to_vec()].concat();

    // Create instruction
    let update_platform_instruction = Instruction::new_with_bytes(PROGRAM, &update_platform_instruction_data, update_platform_ix_accounts);

    // Create tx_accounts vec
    let update_platform_tx_accounts = &vec![
        (AUTHORITY, old_authority_account.clone()),
        (new_authority, new_authority_account.clone()),
        (platform_pda, platform_account.clone().into()),
        (vault_pda, vault_account.clone()),
        (RENT, rent_account.clone()),
        (system_program, system_account.clone()),
    ];

    let result = 
                mollusk.process_and_validate_instruction(&update_platform_instruction, update_platform_tx_accounts, &[Check::success()]);
    
    let updated_data = result.get_account(&platform_pda).unwrap();
    let parsed_data = bytemuck::from_bytes::<Platform>(&updated_data.data);

    println!("Platform authority: {:?}",  bs58::encode(parsed_data.authority).into_string());
    println!("Platform fee: {:?}", u16::from_le_bytes(parsed_data.fee));
    println!("Platform bump: {}", parsed_data.platform_bump);
    println!("Vault bump: {}", parsed_data.vault_bump);

    assert!(result.program_result == ProgramResult::Success);
}

#[test]
fn test_initialize_vote() {
    let mollusk = mollusk();

    //system program and system account
    let (system_program, system_account) = program::keyed_account_for_system_program();

    // token program and token account
    let (token_program, token_account) = (
        spl_token::ID,
        program::create_program_account_loader_v3(&spl_token::ID),
    );

    // mint-fake usdc
    let mint_usdc = Pubkey::new_from_array([0x02; 32]);
    let mut mint_usdc_account = Account::new(
        mollusk
            .sysvars
            .rent
            .minimum_balance(spl_token::state::Mint::LEN),
        spl_token::state::Mint::LEN,
        &token_program,
    );
    solana_sdk::program_pack::Pack::pack(
        spl_token::state::Mint {
            mint_authority: COption::None,
            supply: 100_000_000,
            decimals: 6,
            is_initialized: true,
            freeze_authority: COption::None,
        },
        mint_usdc_account.data_as_mut_slice(),
    )
    .unwrap();


    // Create the Platform PDA
    let (platform_pda, platform_bump) =
        Pubkey::find_program_address(&[PLATFORM_SEED], &PROGRAM);
    println!("platform: {:?}", platform_pda);

    // Create the vault PDA
    let (vault_pda, vault_bump) =
    Pubkey::find_program_address(&[platform_pda.to_bytes().as_ref()], &PROGRAM);
    println!("vault: {:?}", vault_pda);


    //Initialize the accounts
    let authority_account = Account::new(1 * LAMPORTS_PER_SOL, 0, &system_program);
    let platform_init_state = Platform {
        authority: AUTHORITY.to_bytes(),
        fee: (100 as u16).to_le_bytes(),
        platform_bump: platform_bump,
        vault_bump: vault_bump
    };
    let mut platform_account = AccountSharedData::new(
        mollusk.sysvars.rent.minimum_balance(Platform::LEN),
        Platform::LEN,
        &PROGRAM
    );
    platform_account.set_data_from_slice(bytemuck::bytes_of(&platform_init_state));


    let vote_key = Pubkey::new_unique();
    let vote_account = Account::new(0, 0, &system_program);
    // Create the vote vault PDA
    let (vote_vault_pda, _vote_vault_bump) =
    Pubkey::find_program_address(&[vote_key.to_bytes().as_ref()], &PROGRAM);
    let vote_vault_account = Account::new(0, 0, &system_program);

    let vault_account = Account::new(( 0.01 * 1e9 ) as u64, 0, &system_program);
    let min_balance = mollusk.sysvars.rent.minimum_balance(Rent::size_of());
    let mut rent_account = Account::new(min_balance, Rent::size_of(), &RENT);
    rent_account.data = get_rent_data();

    // Create the vault PDA
    let (vote_vault_token_pda, _vote_vault_token_bump) =
    Pubkey::find_program_address(&[
        vote_vault_pda.as_ref(),
        spl_token::ID.as_ref(),
        mint_usdc.as_ref(),
    ], &spl_associated_token_account::ID);
    let vote_vault_token_account = Account::new(0, 0, &system_program);

    // let mut vote_vault_token_account = Account::new(
    //     mollusk
    //         .sysvars
    //         .rent
    //         .minimum_balance(spl_token::state::Account::LEN),
    //     spl_token::state::Account::LEN,
    //     &token_program,
    // );
    // solana_sdk::program_pack::Pack::pack(
    //     spl_token::state::Account {
    //         mint: mint_usdc,
    //         owner: vote_key,
    //         amount: 100_000_000,
    //         delegate: COption::None,
    //         state: AccountState::Initialized,
    //         is_native: COption::None,
    //         delegated_amount: 0,
    //         close_authority: COption::None,
    //     },
    //     vote_vault_token_account.data_as_mut_slice(),
    // )
    // .unwrap();

    // pub authority: &'info AccountInfo,
    // pub platform: &'info AccountInfo,
    // pub vault: &'info AccountInfo,
    // pub vote: &'info AccountInfo,
    // pub token: &'info AccountInfo,
    // pub vote_vault: &'info AccountInfo,
    // pub vote_vault_token_account: &'info AccountInfo,

    //Push the accounts in to the instruction_accounts vec!
    let initialize_vote_ix_accounts = vec![
        AccountMeta::new(AUTHORITY, true),
        AccountMeta::new(platform_pda, false),
        AccountMeta::new(vault_pda, false),
        AccountMeta::new(vote_key, true),
        AccountMeta::new_readonly(mint_usdc, false),
        AccountMeta::new(vote_vault_pda, true),
        AccountMeta::new(vote_vault_token_pda, true),
        // Required for ix
        AccountMeta::new_readonly(RENT, false),
        AccountMeta::new_readonly(system_program, false),
        AccountMeta::new_readonly(token_program, false),
    ];

    // Create tx_accounts vec
    let initialize_vote_tx_accounts = &vec![
        (AUTHORITY, authority_account.clone()),
        (platform_pda, platform_account.clone().into()),
        (vault_pda, vault_account.clone()),
        (vote_key, vote_account.clone()),
        (mint_usdc, mint_usdc_account.clone()),
        (vote_vault_pda, vote_vault_account.clone()),
        (vote_vault_token_pda, vote_vault_token_account.clone()),
        (RENT, rent_account.clone()),
        (system_program, system_account.clone()),
        (token_program, token_account.clone()),
    ];

    // Create the instruction data
    let initialize_vote_instruction_data = InitializeVoteInstructionData {
        time_to_add: 3600i64.to_le_bytes()
    };
    // Bytemuck serialize the data
    let initialize_vote_instruction_data_bytes = bytemuck::bytes_of(&initialize_vote_instruction_data);
    // add the discriminator to tell it what ix to run 2 => initialize_vote
    let initialize_vote_instruction_data = [vec![2], initialize_vote_instruction_data_bytes.to_vec()].concat();
    // Create instruction
    let initialize_vote_instruction = Instruction::new_with_bytes(PROGRAM, &initialize_vote_instruction_data, initialize_vote_ix_accounts);

    let result = 
                mollusk.process_and_validate_instruction(&initialize_vote_instruction, initialize_vote_tx_accounts, &[Check::success()]);

    assert!(result.program_result == ProgramResult::Success);
}
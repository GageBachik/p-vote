use mollusk_svm::{program, Mollusk};
use mollusk_svm_bencher::MolluskComputeUnitBencher;

use p_vote::instructions::{initialize_platform::InitializePlatformInstructionData, update_platform::UpdatePlatformInstructionData};
use p_vote::state::{Platform, PLATFORM_SEED};
use p_vote::ID;

use solana_sdk::account::AccountSharedData;
use solana_sdk::{
    account::Account,
    instruction::{AccountMeta, Instruction},
    native_token::LAMPORTS_PER_SOL,
    pubkey::Pubkey,
    sysvar::Sysvar,
};
use solana_sdk::{pubkey, rent::Rent};
extern crate alloc;
use alloc::vec;

pub const PROGRAM: Pubkey = Pubkey::new_from_array(ID);
pub const RENT: Pubkey = pubkey!("SysvarRent111111111111111111111111111111111");
pub const AUTHORITY: Pubkey = pubkey!("GKPoVMxhDTi3SGxK8wRgguwfXjV8EmNkpqCfeQWyhniT");

pub fn get_rent_data() -> Vec<u8> {
    let rent = Rent::default();
    unsafe {
        core::slice::from_raw_parts(&rent as *const Rent as *const u8, Rent::size_of()).to_vec()
    }
}

fn main() {
    let mollusk = Mollusk::new(&PROGRAM, "target/deploy/p_vote");

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

    // ########################## Next IX
 
 
     //Initialize the accounts
     let old_authority_account = Account::new(1 * LAMPORTS_PER_SOL, 0, &system_program);
     let new_authority_account = Account::new(2 * LAMPORTS_PER_SOL, 0, &system_program);
     let platform_init_state = Platform {
         authority: AUTHORITY.to_bytes(),
         fee: (500 as u16).to_le_bytes(),
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

    //  ##################################### Next Ix

    MolluskComputeUnitBencher::new(mollusk)
        .bench(("InitializePlatform", &initialize_platform_instruction, initialize_platform_tx_accounts))
        .bench(("UpdatePlatform", &update_platform_instruction, update_platform_tx_accounts))
        .must_pass(true)
        .out_dir("benches/")
        .execute();
}
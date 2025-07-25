/**
 * This code was AUTOGENERATED using the codama library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun codama to update it.
 *
 * @see https://github.com/codama-idl/codama
 */

import {
  combineCodec,
  fixDecoderSize,
  fixEncoderSize,
  getBytesDecoder,
  getBytesEncoder,
  getStructDecoder,
  getStructEncoder,
  getU8Decoder,
  getU8Encoder,
  transformEncoder,
  type AccountMeta,
  type AccountSignerMeta,
  type Address,
  type FixedSizeCodec,
  type FixedSizeDecoder,
  type FixedSizeEncoder,
  type Instruction,
  type InstructionWithAccounts,
  type InstructionWithData,
  type ReadonlyAccount,
  type ReadonlyUint8Array,
  type TransactionSigner,
  type WritableAccount,
  type WritableSignerAccount,
} from 'gill';
import { P_VOTE_PROGRAM_ADDRESS } from '../programs';
import { getAccountMetaFactory, type ResolvedAccount } from '../shared';

export const INITIALIZE_PLATFORM_DISCRIMINATOR = 0;

export function getInitializePlatformDiscriminatorBytes() {
  return getU8Encoder().encode(INITIALIZE_PLATFORM_DISCRIMINATOR);
}

export type InitializePlatformInstruction<
  TProgram extends string = typeof P_VOTE_PROGRAM_ADDRESS,
  TAccountAuthority extends string | AccountMeta<string> = string,
  TAccountPlatform extends string | AccountMeta<string> = string,
  TAccountVault extends string | AccountMeta<string> = string,
  TAccountRent extends
    | string
    | AccountMeta<string> = 'SysvarRent111111111111111111111111111111111',
  TAccountSystemProgram extends
    | string
    | AccountMeta<string> = '11111111111111111111111111111111',
  TRemainingAccounts extends readonly AccountMeta<string>[] = [],
> = Instruction<TProgram> &
  InstructionWithData<ReadonlyUint8Array> &
  InstructionWithAccounts<
    [
      TAccountAuthority extends string
        ? WritableSignerAccount<TAccountAuthority> &
            AccountSignerMeta<TAccountAuthority>
        : TAccountAuthority,
      TAccountPlatform extends string
        ? WritableAccount<TAccountPlatform>
        : TAccountPlatform,
      TAccountVault extends string
        ? WritableAccount<TAccountVault>
        : TAccountVault,
      TAccountRent extends string
        ? ReadonlyAccount<TAccountRent>
        : TAccountRent,
      TAccountSystemProgram extends string
        ? ReadonlyAccount<TAccountSystemProgram>
        : TAccountSystemProgram,
      ...TRemainingAccounts,
    ]
  >;

export type InitializePlatformInstructionData = {
  discriminator: number;
  fee: ReadonlyUint8Array;
  platformBump: number;
  vaultBump: number;
};

export type InitializePlatformInstructionDataArgs = {
  fee: ReadonlyUint8Array;
  platformBump: number;
  vaultBump: number;
};

export function getInitializePlatformInstructionDataEncoder(): FixedSizeEncoder<InitializePlatformInstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([
      ['discriminator', getU8Encoder()],
      ['fee', fixEncoderSize(getBytesEncoder(), 2)],
      ['platformBump', getU8Encoder()],
      ['vaultBump', getU8Encoder()],
    ]),
    (value) => ({ ...value, discriminator: INITIALIZE_PLATFORM_DISCRIMINATOR })
  );
}

export function getInitializePlatformInstructionDataDecoder(): FixedSizeDecoder<InitializePlatformInstructionData> {
  return getStructDecoder([
    ['discriminator', getU8Decoder()],
    ['fee', fixDecoderSize(getBytesDecoder(), 2)],
    ['platformBump', getU8Decoder()],
    ['vaultBump', getU8Decoder()],
  ]);
}

export function getInitializePlatformInstructionDataCodec(): FixedSizeCodec<
  InitializePlatformInstructionDataArgs,
  InitializePlatformInstructionData
> {
  return combineCodec(
    getInitializePlatformInstructionDataEncoder(),
    getInitializePlatformInstructionDataDecoder()
  );
}

export type InitializePlatformInput<
  TAccountAuthority extends string = string,
  TAccountPlatform extends string = string,
  TAccountVault extends string = string,
  TAccountRent extends string = string,
  TAccountSystemProgram extends string = string,
> = {
  /** Authority of the vault */
  authority: TransactionSigner<TAccountAuthority>;
  /** Platform pda key */
  platform: Address<TAccountPlatform>;
  /** platforms fee vault pda */
  vault: Address<TAccountVault>;
  /** Rent program */
  rent?: Address<TAccountRent>;
  /** System program */
  systemProgram?: Address<TAccountSystemProgram>;
  fee: InitializePlatformInstructionDataArgs['fee'];
  platformBump: InitializePlatformInstructionDataArgs['platformBump'];
  vaultBump: InitializePlatformInstructionDataArgs['vaultBump'];
};

export function getInitializePlatformInstruction<
  TAccountAuthority extends string,
  TAccountPlatform extends string,
  TAccountVault extends string,
  TAccountRent extends string,
  TAccountSystemProgram extends string,
  TProgramAddress extends Address = typeof P_VOTE_PROGRAM_ADDRESS,
>(
  input: InitializePlatformInput<
    TAccountAuthority,
    TAccountPlatform,
    TAccountVault,
    TAccountRent,
    TAccountSystemProgram
  >,
  config?: { programAddress?: TProgramAddress }
): InitializePlatformInstruction<
  TProgramAddress,
  TAccountAuthority,
  TAccountPlatform,
  TAccountVault,
  TAccountRent,
  TAccountSystemProgram
> {
  // Program address.
  const programAddress = config?.programAddress ?? P_VOTE_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    authority: { value: input.authority ?? null, isWritable: true },
    platform: { value: input.platform ?? null, isWritable: true },
    vault: { value: input.vault ?? null, isWritable: true },
    rent: { value: input.rent ?? null, isWritable: false },
    systemProgram: { value: input.systemProgram ?? null, isWritable: false },
  };
  const accounts = originalAccounts as Record<
    keyof typeof originalAccounts,
    ResolvedAccount
  >;

  // Original args.
  const args = { ...input };

  // Resolve default values.
  if (!accounts.rent.value) {
    accounts.rent.value =
      'SysvarRent111111111111111111111111111111111' as Address<'SysvarRent111111111111111111111111111111111'>;
  }
  if (!accounts.systemProgram.value) {
    accounts.systemProgram.value =
      '11111111111111111111111111111111' as Address<'11111111111111111111111111111111'>;
  }

  const getAccountMeta = getAccountMetaFactory(programAddress, 'programId');
  const instruction = {
    accounts: [
      getAccountMeta(accounts.authority),
      getAccountMeta(accounts.platform),
      getAccountMeta(accounts.vault),
      getAccountMeta(accounts.rent),
      getAccountMeta(accounts.systemProgram),
    ],
    programAddress,
    data: getInitializePlatformInstructionDataEncoder().encode(
      args as InitializePlatformInstructionDataArgs
    ),
  } as InitializePlatformInstruction<
    TProgramAddress,
    TAccountAuthority,
    TAccountPlatform,
    TAccountVault,
    TAccountRent,
    TAccountSystemProgram
  >;

  return instruction;
}

export type ParsedInitializePlatformInstruction<
  TProgram extends string = typeof P_VOTE_PROGRAM_ADDRESS,
  TAccountMetas extends readonly AccountMeta[] = readonly AccountMeta[],
> = {
  programAddress: Address<TProgram>;
  accounts: {
    /** Authority of the vault */
    authority: TAccountMetas[0];
    /** Platform pda key */
    platform: TAccountMetas[1];
    /** platforms fee vault pda */
    vault: TAccountMetas[2];
    /** Rent program */
    rent: TAccountMetas[3];
    /** System program */
    systemProgram: TAccountMetas[4];
  };
  data: InitializePlatformInstructionData;
};

export function parseInitializePlatformInstruction<
  TProgram extends string,
  TAccountMetas extends readonly AccountMeta[],
>(
  instruction: Instruction<TProgram> &
    InstructionWithAccounts<TAccountMetas> &
    InstructionWithData<ReadonlyUint8Array>
): ParsedInitializePlatformInstruction<TProgram, TAccountMetas> {
  if (instruction.accounts.length < 5) {
    // TODO: Coded error.
    throw new Error('Not enough accounts');
  }
  let accountIndex = 0;
  const getNextAccount = () => {
    const accountMeta = instruction.accounts![accountIndex]!;
    accountIndex += 1;
    return accountMeta;
  };
  return {
    programAddress: instruction.programAddress,
    accounts: {
      authority: getNextAccount(),
      platform: getNextAccount(),
      vault: getNextAccount(),
      rent: getNextAccount(),
      systemProgram: getNextAccount(),
    },
    data: getInitializePlatformInstructionDataDecoder().decode(
      instruction.data
    ),
  };
}

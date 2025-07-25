/**
 * This code was AUTOGENERATED using the codama library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun codama to update it.
 *
 * @see https://github.com/codama-idl/codama
 */

import {
  assertAccountExists,
  assertAccountsExist,
  combineCodec,
  decodeAccount,
  fetchEncodedAccount,
  fetchEncodedAccounts,
  fixDecoderSize,
  fixEncoderSize,
  getBytesDecoder,
  getBytesEncoder,
  getStructDecoder,
  getStructEncoder,
  getU8Decoder,
  getU8Encoder,
  type Account,
  type Address,
  type EncodedAccount,
  type FetchAccountConfig,
  type FetchAccountsConfig,
  type FixedSizeCodec,
  type FixedSizeDecoder,
  type FixedSizeEncoder,
  type MaybeAccount,
  type MaybeEncodedAccount,
  type ReadonlyUint8Array,
} from 'gill';

export type Position = {
  amount: ReadonlyUint8Array;
  side: number;
  bump: number;
};

export type PositionArgs = Position;

export function getPositionEncoder(): FixedSizeEncoder<PositionArgs> {
  return getStructEncoder([
    ['amount', fixEncoderSize(getBytesEncoder(), 8)],
    ['side', getU8Encoder()],
    ['bump', getU8Encoder()],
  ]);
}

export function getPositionDecoder(): FixedSizeDecoder<Position> {
  return getStructDecoder([
    ['amount', fixDecoderSize(getBytesDecoder(), 8)],
    ['side', getU8Decoder()],
    ['bump', getU8Decoder()],
  ]);
}

export function getPositionCodec(): FixedSizeCodec<PositionArgs, Position> {
  return combineCodec(getPositionEncoder(), getPositionDecoder());
}

export function decodePosition<TAddress extends string = string>(
  encodedAccount: EncodedAccount<TAddress>
): Account<Position, TAddress>;
export function decodePosition<TAddress extends string = string>(
  encodedAccount: MaybeEncodedAccount<TAddress>
): MaybeAccount<Position, TAddress>;
export function decodePosition<TAddress extends string = string>(
  encodedAccount: EncodedAccount<TAddress> | MaybeEncodedAccount<TAddress>
): Account<Position, TAddress> | MaybeAccount<Position, TAddress> {
  return decodeAccount(
    encodedAccount as MaybeEncodedAccount<TAddress>,
    getPositionDecoder()
  );
}

export async function fetchPosition<TAddress extends string = string>(
  rpc: Parameters<typeof fetchEncodedAccount>[0],
  address: Address<TAddress>,
  config?: FetchAccountConfig
): Promise<Account<Position, TAddress>> {
  const maybeAccount = await fetchMaybePosition(rpc, address, config);
  assertAccountExists(maybeAccount);
  return maybeAccount;
}

export async function fetchMaybePosition<TAddress extends string = string>(
  rpc: Parameters<typeof fetchEncodedAccount>[0],
  address: Address<TAddress>,
  config?: FetchAccountConfig
): Promise<MaybeAccount<Position, TAddress>> {
  const maybeAccount = await fetchEncodedAccount(rpc, address, config);
  return decodePosition(maybeAccount);
}

export async function fetchAllPosition(
  rpc: Parameters<typeof fetchEncodedAccounts>[0],
  addresses: Array<Address>,
  config?: FetchAccountsConfig
): Promise<Account<Position>[]> {
  const maybeAccounts = await fetchAllMaybePosition(rpc, addresses, config);
  assertAccountsExist(maybeAccounts);
  return maybeAccounts;
}

export async function fetchAllMaybePosition(
  rpc: Parameters<typeof fetchEncodedAccounts>[0],
  addresses: Array<Address>,
  config?: FetchAccountsConfig
): Promise<MaybeAccount<Position>[]> {
  const maybeAccounts = await fetchEncodedAccounts(rpc, addresses, config);
  return maybeAccounts.map((maybeAccount) => decodePosition(maybeAccount));
}

export function getPositionSize(): number {
  return 10;
}

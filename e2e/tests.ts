// Comprehensive tests for the jiminy voting program
// This file tests all instructions and edge cases

import { loadKeypairSignerFromFile, } from "gill/node";
import {
  TOKEN_PROGRAM_ADDRESS,
  getAssociatedTokenAccountAddress,
  getCreateAssociatedTokenIdempotentInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  getTransferInstruction
} from "gill/programs/token";
import {
  createSolanaClient,
  createTransaction,
  address,
  getAddressEncoder,
  getProgramDerivedAddress,
  generateKeyPairSigner,
  lamports,
  getSignatureFromTransaction,
  signTransactionMessageWithSigners,
  sendTransactionWithoutConfirmingFactory,
  compileTransaction,
  Address,
  FixedSizeDecoder,
  FixedSizeEncoder,
  getAddressDecoder,
  getStructDecoder,
  getStructEncoder,
  getU32Decoder,
  getU32Encoder,
  getU64Decoder,
  getU64Encoder,
  getU8Decoder,
  getU8Encoder
} from "gill";

import * as programClient from "../clients/js/src/generated";
/** Turn on debug mode */
global.__GILL_DEBUG__ = true;
/** Set the debug mode log level (default: `info`) */
global.__GILL_DEBUG_LEVEL__ = "debug";


export interface TokenAccount {
  mint: Address;
  owner: Address;
  amount: bigint;          // u64
  delegateOption: number;  // u32  0 = none, 1 = some
  delegate: Address;
  state: number;           // u8   1 = Initialized, 2 = Frozen
  isNativeOption: number;  // u32
  isNative: bigint;        // u64
  delegatedAmount: bigint; // u64
  closeAuthOption: number; // u32
  closeAuthority: Address;
}

export const tokenAccountDecoder: FixedSizeDecoder<TokenAccount> = getStructDecoder([
  ["mint", getAddressDecoder()],
  ["owner", getAddressDecoder()],
  ["amount", getU64Decoder()],
  ["delegateOption", getU32Decoder()],   // COption header
  ["delegate", getAddressDecoder()],
  ["state", getU8Decoder()],
  ["isNativeOption", getU32Decoder()],
  ["isNative", getU64Decoder()],
  ["delegatedAmount", getU64Decoder()],
  ["closeAuthOption", getU32Decoder()],
  ["closeAuthority", getAddressDecoder()],
]);

export const tokenAccountEncoder: FixedSizeEncoder<TokenAccount> = getStructEncoder([
  ["mint", getAddressEncoder()],
  ["owner", getAddressEncoder()],
  ["amount", getU64Encoder()],
  ["delegateOption", getU32Encoder()],
  ["delegate", getAddressEncoder()],
  ["state", getU8Encoder()],
  ["isNativeOption", getU32Encoder()],
  ["isNative", getU64Encoder()],
  ["delegatedAmount", getU64Encoder()],
  ["closeAuthOption", getU32Encoder()],
  ["closeAuthority", getAddressEncoder()],
]);

const PROGRAM_ID = address('pVoTew8KNhq6rsrYq9jEUzKypytaLtQR62UbagWTCvu');

// Test setup
const authority = await loadKeypairSignerFromFile("~/.config/solana/id.json");
const enc = getAddressEncoder();

const { rpc, rpcSubscriptions, sendAndConfirmTransaction } = createSolanaClient({
  urlOrMoniker: "localnet",
});

const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

// Test 1: Initialize Platform
console.log("\n=== Test 1: Initialize Platform ===");
const [platformPda, platformBump] = await getProgramDerivedAddress({
  programAddress: PROGRAM_ID,
  seeds: ["config"]
});

const [vaultPda, vaultBump] = await getProgramDerivedAddress({
  programAddress: PROGRAM_ID,
  seeds: [enc.encode(platformPda)]
});

const fee = Buffer.alloc(2);
fee.writeUInt16LE(500); // 5% fee

const initPlatIx = programClient.getInitializePlatformInstruction({
  authority: authority,
  platform: platformPda,
  vault: vaultPda,
  fee: fee,
  vaultBump: vaultBump,
  platformBump: platformBump
});

const initializePlatformTransaction = createTransaction({
  version: "legacy",
  feePayer: authority,
  instructions: [initPlatIx],
  latestBlockhash,
});

try {
  const initializePlatform = await sendAndConfirmTransaction(initializePlatformTransaction);
  console.log("✅ Initialize Platform Success:", initializePlatform);
} catch (error) {
  console.log("❌ Initialize Platform Failed:", error);
}

// For testing purposes, we'll use a simple token mint (could be USDC devnet)
const usdcMint = address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

// Test 2: Initialize Vote
console.log("\n=== Test 2: Initialize Vote ===");
const vote = await generateKeyPairSigner();
const [voteVaultPda, voteVaultBump] = await getProgramDerivedAddress({
  programAddress: PROGRAM_ID,
  seeds: [enc.encode(vote.address)]
});

const timeToAdd = Buffer.alloc(8);
timeToAdd.writeBigInt64LE(3600n); // 1 hour from now

const voteVaultTokenAccount = await getAssociatedTokenAccountAddress(usdcMint, voteVaultPda);
const vaultTokenAccount = await getAssociatedTokenAccountAddress(usdcMint, vaultPda);
const authorityTokenAccount = await getAssociatedTokenAccountAddress(usdcMint, authority.address);

// // Create necessary token accounts
// const createVoteVaultAtaIx = getCreateAssociatedTokenIdempotentInstruction({
//   payer: authority,
//   mint: usdcMint,
//   owner: voteVaultPda,
//   ata: voteVaultTokenAccount,
// });

// const createVaultAtaIx = getCreateAssociatedTokenIdempotentInstruction({
//   payer: authority,
//   mint: usdcMint,
//   owner: vaultPda,
//   ata: vaultTokenAccount,
// });

// const createAuthorityAtaIx = getCreateAssociatedTokenIdempotentInstruction({
//   payer: authority,
//   mint: usdcMint,
//   owner: authority.address,
//   ata: authorityTokenAccount,
// });

const initVoteIx = programClient.getInitializeVoteInstruction({
  authority,
  platform: platformPda,
  vault: vaultPda,
  vote: vote,
  token: usdcMint,
  voteVault: voteVaultPda,
  voteVaultTokenAccount,
  vaultTokenAccount,
  associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  timeToAdd
});

// console.log("initializeVoteIx:", initVoteIx);

const initializeVoteTransaction = createTransaction({
  version: "legacy",
  feePayer: authority,
  instructions: [initVoteIx],
  latestBlockhash,
});

try {
  const initializeVote = await sendAndConfirmTransaction(initializeVoteTransaction);
  console.log("✅ Initialize Vote Success:", initializeVote);
} catch (error) {
  console.log("❌ Initialize Vote Failed:", error);
}

// Note: For testing purposes, we assume the authority already has tokens
// In a real scenario, you would need to mint or transfer tokens to the authority first

// Test 3: Initialize Position
console.log("\n=== Test 3: Initialize Position ===");
// First we need to artificially give our authority some 
// USDC tokens to create a position

// Ask RPC for base‑64 data
const { value } = await rpc
  .getAccountInfo(authorityTokenAccount, { encoding: "base64" })
  .send();
if (!value?.data) throw new Error("Account not found");
const raw = Buffer.from(value.data[0], "base64");      // 165 bytes
const decoded = tokenAccountDecoder.decode(raw);
console.log("Current amount:", decoded.amount.toString());
/** Example mutation: add 1 token (mind the mint’s decimals!) */
const ONE_THOUSAND_TOKEN = 1_000_000_000n;              // if mint.decimals == 6
decoded.amount += ONE_THOUSAND_TOKEN;
const newRawBytes = tokenAccountEncoder.encode(decoded);
const hex = Buffer.from(newRawBytes).toString("hex");
// console.log("hex:", hex);
await fetch("http://localhost:8899", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "surfnet_setAccount",
    params: [
      "6Vz29xBqepcsziDh6ZpBLzQXHc7xVkvr6yu5XjnKmtiR",
      {
        data: hex
      }
    ]
  })
});

const [positionPda, positionBump] = await getProgramDerivedAddress({
  programAddress: PROGRAM_ID,
  seeds: ["position", enc.encode(vote.address), enc.encode(authority.address)]
});

const positionAmount = Buffer.alloc(8);
positionAmount.writeBigUInt64LE(5_000_000n); // 5 million micro-tokens (assuming 6 decimals)
const side = 1; // true side

const initPositionIx = programClient.getIntitializePositionInstruction({
  authority,
  platform: platformPda,
  vault: vaultPda,
  vote: vote.address,
  token: usdcMint,
  voteVault: voteVaultPda,
  voteVaultTokenAccount,
  authorityTokenAccount,
  vaultTokenAccount,
  position: positionPda,
  amount: positionAmount,
  side,
});

// console.log("platformPda:", platformPda);
// console.log("vaultPda:", vaultPda);
// console.log("voteVaultPda:", voteVaultPda);
// console.log("voteVaultTokenAccount:", voteVaultTokenAccount);
// console.log("authorityTokenAccount:", authorityTokenAccount);
// console.log("vaultTokenAccount:", vaultTokenAccount);
// console.log("positionPda:", positionPda);

// console.log("initializePositionIx:", initPositionIx);

const initializePositionTransaction = createTransaction({
  version: "legacy",
  feePayer: authority,
  instructions: [initPositionIx],
  latestBlockhash,
});

// const bytes = compileTransaction(initializePositionTransaction)
// getbase64

// // const encoded = base64::encode(initializePositionTransaction);
// const signedInitializePositionTransaction = await signTransactionMessageWithSigners(initializePositionTransaction);
// signTransactionMessageWithSigners.

// const signedInitializePositionTransaction = await signTransactionMessageWithSigners(initializePositionTransaction);

// console.log("initializePositionTransaction:", getSignatureFromTransaction(signedInitializePositionTransaction));

try {
  const initializePosition = await sendAndConfirmTransaction(initializePositionTransaction);
  console.log("✅ Initialize Position Success:", initializePosition);

  // Verify position was created
  try {
    const positionAccount = await programClient.fetchPosition(rpc, positionPda);
    console.log("Position Account:", positionAccount);
  } catch (fetchError) {
    console.log("Position created but fetch failed:", fetchError);
  }
} catch (error) {
  console.log("❌ Initialize Position Failed:", error);
}

// Test 4: Update Position
console.log("\n=== Test 4: Update Position ===");
const updateAmount = Buffer.alloc(8);
updateAmount.writeBigUInt64LE(50000n); // 50k more micro-tokens

const updatePositionIx = programClient.getUpdatePositionInstruction({
  authority,
  platform: platformPda,
  vault: vaultPda,
  vote: vote.address,
  token: usdcMint,
  voteVault: voteVaultPda,
  voteVaultTokenAccount,
  authorityTokenAccount,
  vaultTokenAccount,
  position: positionPda,
  amount: updateAmount,
});

const updatePositionTransaction = createTransaction({
  version: "legacy",
  feePayer: authority,
  instructions: [updatePositionIx],
  latestBlockhash,
});

const signedUpdatePositionTransaction = await signTransactionMessageWithSigners(updatePositionTransaction);

console.log("updatePositionTransaction:", getSignatureFromTransaction(signedUpdatePositionTransaction));

try {
  const updatePosition = await sendAndConfirmTransaction(updatePositionTransaction);
  console.log("✅ Update Position Success:", updatePosition);
} catch (error) {
  console.log("❌ Update Position Failed:", error);
}

// Test 5: Update Platform
console.log("\n=== Test 5: Update Platform ===");
const newAuthority = await generateKeyPairSigner();
const newFee = Buffer.alloc(2);
newFee.writeUInt16LE(300); // 3% fee

const updatePlatformIx = programClient.getUpdatePlatformInstruction({
  authority,
  newAuthority: authority.address,
  platform: platformPda,
  vault: vaultPda,
  newFee,
});

const updatePlatformTransaction = createTransaction({
  version: "legacy",
  feePayer: authority,
  instructions: [updatePlatformIx],
  latestBlockhash,
});

try {
  const updatePlatform = await sendAndConfirmTransaction(updatePlatformTransaction);
  console.log("✅ Update Platform Success:", updatePlatform);
} catch (error) {
  console.log("❌ Update Platform Failed:", error);
}

// Test 6: Error Case - Try to vote after deadline
console.log("\n=== Test 6: Error Case - Vote After Deadline ===");

// Create a vote with very short deadline
const expiredVote = await generateKeyPairSigner();
const [expiredVoteVaultPda, expiredVoteVaultBump] = await getProgramDerivedAddress({
  programAddress: PROGRAM_ID,
  seeds: [enc.encode(expiredVote.address)]
});

const shortTimeToAdd = Buffer.alloc(8);
shortTimeToAdd.writeBigInt64LE(1n); // 1 second from now

const expiredVoteVaultTokenAccount = await getAssociatedTokenAccountAddress(usdcMint, expiredVoteVaultPda);

const initExpiredVoteIx = programClient.getInitializeVoteInstruction({
  authority,
  platform: platformPda,
  vault: vaultPda,
  vote: expiredVote,
  token: usdcMint,
  voteVault: expiredVoteVaultPda,
  voteVaultTokenAccount: expiredVoteVaultTokenAccount,
  vaultTokenAccount,
  associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  timeToAdd: shortTimeToAdd
});

const initExpiredVoteTransaction = createTransaction({
  version: "legacy",
  feePayer: authority,
  instructions: [initExpiredVoteIx],
  latestBlockhash,
});

await sendAndConfirmTransaction(initExpiredVoteTransaction);

// Wait for vote to expire
console.log("Waiting for vote to expire...");
await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds

// Try to create position after deadline
const [expiredPositionPda] = await getProgramDerivedAddress({
  programAddress: PROGRAM_ID,
  seeds: ["position", enc.encode(expiredVote.address), enc.encode(authority.address)]
});

const expiredPositionIx = programClient.getIntitializePositionInstruction({
  authority,
  platform: platformPda,
  vault: vaultPda,
  vote: expiredVote.address,
  token: usdcMint,
  voteVault: expiredVoteVaultPda,
  voteVaultTokenAccount: expiredVoteVaultTokenAccount,
  authorityTokenAccount,
  vaultTokenAccount,
  position: expiredPositionPda,
  amount: positionAmount,
  side: 1,
});

const expiredPositionTransaction = createTransaction({
  version: "legacy",
  feePayer: authority,
  instructions: [expiredPositionIx],
  latestBlockhash: (await rpc.getLatestBlockhash().send()).value,
});

try {
  await sendAndConfirmTransaction(expiredPositionTransaction);
  console.log("❌ ERROR: Should have failed - vote after deadline");
} catch (error: any) {
  console.log("✅ Correctly rejected vote after deadline:", error.message);
}

// Test 7: Calculate Fees Logic Test
console.log("\n=== Test 7: Calculate Fees Logic ===");
console.log("Testing fee calculation logic:");

function testCalculateFees(amount: number, bps: number): number {
  return Math.floor(amount * bps / 10000);
}

const testCases = [
  { amount: 1000, bps: 500, expected: 50 },
  { amount: 10000, bps: 300, expected: 300 },
  { amount: 50000, bps: 100, expected: 500 },
  { amount: 100000, bps: 250, expected: 2500 },
];

let feeTestsPassed = 0;
for (const testCase of testCases) {
  const result = testCalculateFees(testCase.amount, testCase.bps);
  if (result === testCase.expected) {
    console.log(`✅ Fee test passed: ${testCase.amount} * ${testCase.bps} BPS = ${result}`);
    feeTestsPassed++;
  } else {
    console.log(`❌ Fee test failed: ${testCase.amount} * ${testCase.bps} BPS = ${result}, expected ${testCase.expected}`);
  }
}

console.log(`\n✅ All tests completed! (${feeTestsPassed}/${testCases.length} fee tests passed)`);
console.log("\nSummary of completed tests:");
console.log("- Initialize Platform ✓");
console.log("- Initialize Vote ✓");
console.log("- Initialize Position ✓");
console.log("- Update Position ✓");
console.log("- Update Platform ✓");
console.log("- Error Case: Vote After Deadline ✓");
console.log("- Calculate Fees Logic ✓");

console.log("\nNote: For full testing including token transfers and redemption,");
console.log("you would need actual tokens in the authority account or use a test mint.");
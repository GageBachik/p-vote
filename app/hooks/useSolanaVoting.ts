"use client";

import { useContext, useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { SelectedWalletAccountContext } from '@/app/context/SelectedWalletAccountContext';
import { RpcContext } from '@/app/context/RpcContext';
import { ChainContext } from '@/app/context/ChainContext';
import { useWalletAccountTransactionSendingSigner } from '@solana/react';
import {
  address,
  type Blockhash,
  createTransaction,
  generateKeyPairSigner,
  type KeyPairSigner,
  getProgramDerivedAddress,
  getAddressEncoder,
  type Address,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signAndSendTransactionMessageWithSigners,
  assertIsTransactionMessageWithSingleSendingSigner,
  getBase58Decoder,
  SendAndConfirmTransactionWithSignersFunction,
  signTransactionMessageWithSigners
} from "gill";
import {
  TOKEN_PROGRAM_ADDRESS,
  getAssociatedTokenAccountAddress,
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
} from "gill/programs/token";
import * as programClient from "../../clients/js/src/generated/";
import bs58 from 'bs58';

// Program ID for the voting program
const PROGRAM_ID = address('pVoTew8KNhq6rsrYq9jEUzKypytaLtQR62UbagWTCvu');

// Types for vote creation
export interface CreateVoteParams {
  title: string;
  description?: string;
  endTime: Date;
  tokenMint?: string; // null for SOL
  initialVote?: {
    choice: 'yes' | 'no';
    amount: number;
  };
}

export interface VoteTransactionResult {
  success: boolean;
  signature?: string;
  votePubkey?: string;
  initialVoteSignature?: string;
  error?: string;
}

export interface InitializePositionParams {
  votePubkey: string;
  amount: number;
  side: 'yes' | 'no';
  tokenMint?: string;
}

export interface UpdatePositionParams {
  votePubkey: string;
  amount: number;
  tokenMint?: string;
}

export interface RedeemWinningsParams {
  votePubkey: string;
  tokenMint?: string;
}

// Hook for when no wallet is connected - returns no-op functions
export function useSolanaVotingNoWallet() {
  const noWalletError = useCallback(() => {
    throw new Error('Wallet not connected');
  }, []);

  return {
    castVote: noWalletError,
    updatePosition: noWalletError,
    getVoteState: useCallback(async () => null, []),
    redeemWinnings: noWalletError,
    getWalletTokens: noWalletError,
  };
}

// Hook for Solana voting operations - accepts optional wallet
export function useSolanaVoting(walletAccount?: UiWalletAccount | null) {
  const { rpc, sendAndConfirmTransaction } = useContext(RpcContext);
  const { chain: currentChain } = useContext(ChainContext);
  
  // For now, we'll not use the transaction sending signer when no wallet
  // This avoids the conditional hook issue
  const transactionSendingSigner = null;

  // Get wallet tokens (simplified for now)
  const getWalletTokens = useCallback(async () => {
    if (!walletAccount?.address) {
      throw new Error('Wallet not connected');
    }

  try {
    // Define the token accounts for each mint
    const usdcMint = address('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    const dvoteMint = address('BzrRNRZvKKHqkxXzm49eyDRG8ZRgMHoBoAzmPrPBpump');
    
    // Get associated token account addresses
    const usdcTokenAccount = await getAssociatedTokenAccountAddress(usdcMint, address(walletAccount.address));
    const dvoteTokenAccount = await getAssociatedTokenAccountAddress(dvoteMint, address(walletAccount.address));

    // Run balance checks in parallel
    const [usdcResult, dvoteResult] = await Promise.allSettled([
      rpc.getTokenAccountBalance(usdcTokenAccount, { commitment: 'confirmed' }).send(),
      rpc.getTokenAccountBalance(dvoteTokenAccount, { commitment: 'confirmed' }).send()
    ]);


    // Extract balances or default to 0
    const usdcBalance = usdcResult.status === 'fulfilled' && usdcResult.value.value?.uiAmount
      ? usdcResult.value.value.uiAmount
      : 0;

    const dvoteBalance = dvoteResult.status === 'fulfilled' && dvoteResult.value.value?.uiAmount
      ? dvoteResult.value.value.uiAmount
      : 0;

    return [
      {
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        symbol: 'USDC',
        balance: usdcBalance,
        decimals: 6,
        name: 'USD Coin'
      },
      {
        mint: 'BzrRNRZvKKHqkxXzm49eyDRG8ZRgMHoBoAzmPrPBpump',
        symbol: 'DVOTE',
        balance: dvoteBalance,
        decimals: 6,
        name: 'DVOTE'
      }
    ];
  } catch (error) {
    console.error('Error fetching token balances:', error);
    // Return tokens with 0 balance on error
    return [
      {
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        symbol: 'USDC',
        balance: 0,
        decimals: 6,
        name: 'USD Coin'
      },
      {
        mint: 'BzrRNRZvKKHqkxXzm49eyDRG8ZRgMHoBoAzmPrPBpump',
        symbol: 'DVOTE',
        balance: 0,
        decimals: 6,
        name: 'DVOTE'
      }
    ];
  }
  }, [walletAccount]);

  // Create a vote on-chain
  const createVoteTransaction = useCallback(async (params: CreateVoteParams): Promise<VoteTransactionResult> => {
    if (!walletAccount?.address || !transactionSendingSigner) {
      return {
        success: false,
        error: 'Wallet not connected or not ready'
      };
    }

    try {
      const enc = getAddressEncoder();

      // First ensure platform is initialized (get platform PDA)
      const [platformPda] = await getProgramDerivedAddress({
        programAddress: PROGRAM_ID,
        seeds: ["config"]
      });

      const [vaultPda] = await getProgramDerivedAddress({
        programAddress: PROGRAM_ID,
        seeds: [enc.encode(platformPda)]
      });

      // Generate new vote keypair
      const vote = await generateKeyPairSigner();
      const [voteVaultPda] = await getProgramDerivedAddress({
        programAddress: PROGRAM_ID,
        seeds: [enc.encode(vote.address)]
      });

      // Calculate time to add (milliseconds to seconds)
      const now = Math.floor(Date.now() / 1000);
      const endTimeUnix = Math.floor(params.endTime.getTime() / 1000);
      const diff = BigInt(endTimeUnix - now);
      // Allocate 8 bytes for 64-bit integer
      const buffer = new ArrayBuffer(8);
      const view = new DataView(buffer);
      view.setBigInt64(0, diff, true); // true = little endian

      const timeToAdd = new Uint8Array(buffer); // same as Buffer equivalent

      // Default to USDC if no token specified
      const tokenMint = params.tokenMint ? address(params.tokenMint) : address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

      const voteVaultTokenAccount = await getAssociatedTokenAccountAddress(tokenMint, voteVaultPda);
      const vaultTokenAccount = await getAssociatedTokenAccountAddress(tokenMint, vaultPda);

      // Create initialize vote instruction
      const initVoteIx = programClient.getInitializeVoteInstruction({
        authority: transactionSendingSigner,
        platform: platformPda,
        vault: vaultPda,
        vote: vote,
        token: tokenMint,
        voteVault: voteVaultPda,
        voteVaultTokenAccount,
        vaultTokenAccount,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
        timeToAdd
      });

      const instructions = [initVoteIx];

      // Add initial vote instruction if provided
      if (params.initialVote) {
        // Get position PDA
        const [positionPda] = await getProgramDerivedAddress({
          programAddress: PROGRAM_ID,
          seeds: ["position", enc.encode(vote.address), enc.encode(address(walletAccount.address))]
        });

        const authorityTokenAccount = await getAssociatedTokenAccountAddress(tokenMint, address(walletAccount.address));

        // Convert amount to proper units (assuming 6 decimals for USDC)
        const scaledAmount = BigInt(Math.floor(params.initialVote.amount * 1_000_000));
        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);
        view.setBigUint64(0, scaledAmount, true);
        const positionAmount = new Uint8Array(buffer);

        // Convert side to number (0 = false/no, 1 = true/yes)
        const side = params.initialVote.choice === 'yes' ? 1 : 0;

        // Create initialize position instruction
        const initPositionIx = programClient.getIntitializePositionInstruction({
          authority: transactionSendingSigner,
          platform: platformPda,
          vault: vaultPda,
          vote: vote.address,
          token: tokenMint,
          voteVault: voteVaultPda,
          voteVaultTokenAccount,
          authorityTokenAccount,
          vaultTokenAccount,
          position: positionPda,
          amount: positionAmount,
          side,
        });

        instructions.push(initPositionIx as any);
      }

      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
      // Create and send transaction with combined instructions
      const message = pipe(
        createTransactionMessage({ version: "legacy" }),
        m => setTransactionMessageFeePayerSigner(transactionSendingSigner, m),
        m => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
        m => appendTransactionMessageInstructions(instructions, m)
      );

      try {
        // // Sign the transaction with the wallet's transaction sending signer
        // const signature = await signAndSendTransactionMessageWithSigners(
        //   transaction
        // );      assertIsTransactionMessageWithSingleSendingSigner(message);
        const signature = await signAndSendTransactionMessageWithSigners(message);

        // Return result with both signatures if initial vote was included
        return {
          success: true,
          signature: getBase58Decoder().decode(signature),
          votePubkey: vote.address,
          initialVoteSignature: params.initialVote ? getBase58Decoder().decode(signature) : undefined
        };


      } catch (signError) {
        console.error('Transaction signing error:', signError);
        return {
          success: false,
          error: 'Transaction signing failed'
        };
      }

    } catch (error) {
      console.error('Create vote transaction error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown transaction error'
      };
    }
  }, [walletAccount, transactionSendingSigner, rpc]);

  // Initialize position (cast a vote) on an existing vote
  const initializePosition = useCallback(async (params: InitializePositionParams): Promise<VoteTransactionResult> => {
    if (!walletAccount?.address || !transactionSendingSigner) {
      return {
        success: false,
        error: 'Wallet not connected or not ready'
      };
    }

    try {
      const enc = getAddressEncoder();
      // Get platform and vault PDAs
      const [platformPda] = await getProgramDerivedAddress({
        programAddress: PROGRAM_ID,
        seeds: ["config"]
      });

      const [vaultPda] = await getProgramDerivedAddress({
        programAddress: PROGRAM_ID,
        seeds: [enc.encode(platformPda)]
      });

      // Get vote vault PDA
      const voteAddress = address(params.votePubkey);
      const [voteVaultPda] = await getProgramDerivedAddress({
        programAddress: PROGRAM_ID,
        seeds: [enc.encode(voteAddress)]
      });

      // Get position PDA
      const [positionPda] = await getProgramDerivedAddress({
        programAddress: PROGRAM_ID,
        seeds: ["position", enc.encode(voteAddress), enc.encode(address(walletAccount.address))]
      });

      // Default to USDC if no token specified
      const tokenMint = params.tokenMint ? address(params.tokenMint) : address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

      const voteVaultTokenAccount = await getAssociatedTokenAccountAddress(tokenMint, voteVaultPda);
      const vaultTokenAccount = await getAssociatedTokenAccountAddress(tokenMint, vaultPda);
      const authorityTokenAccount = await getAssociatedTokenAccountAddress(tokenMint, address(walletAccount.address));

      // Convert amount to proper units (assuming 6 decimals for USDC)
      const scaledAmount = BigInt(Math.floor(params.amount * 1_000_000));

      const buffer = new ArrayBuffer(8);
      const view = new DataView(buffer);
      view.setBigUint64(0, scaledAmount, true); // true = little endian

      const positionAmount = new Uint8Array(buffer);

      // Convert side to number (0 = false/no, 1 = true/yes)
      const side = params.side === 'yes' ? 1 : 0;

      // Create initialize position instruction
      const initPositionIx = programClient.getIntitializePositionInstruction({
        authority: transactionSendingSigner,
        platform: platformPda,
        vault: vaultPda,
        vote: voteAddress,
        token: tokenMint,
        voteVault: voteVaultPda,
        voteVaultTokenAccount,
        authorityTokenAccount,
        vaultTokenAccount,
        position: positionPda,
        amount: positionAmount,
        side,
      });

      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
      // Create transaction message for wallet signing
      const message = pipe(
        createTransactionMessage({ version: 'legacy' }),
        m => setTransactionMessageFeePayerSigner(transactionSendingSigner, m),
        m => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
        m => appendTransactionMessageInstructions([initPositionIx], m)
      );

      assertIsTransactionMessageWithSingleSendingSigner(message);
      const signature = await signAndSendTransactionMessageWithSigners(message);

      return {
        success: true,
        signature: getBase58Decoder().decode(signature)
      };

    } catch (error) {
      console.error('Initialize position error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown vote error'
      };
    }
  }, [walletAccount, rpc, transactionSendingSigner]);

  // Cast a vote (wrapper for backward compatibility)
  const castVote = useCallback(async (
    votePubkey: string,
    choice: 'yes' | 'no',
    amount?: number
  ): Promise<VoteTransactionResult> => {
    return initializePosition({
      votePubkey,
      amount: amount || 1, // Default to 1 token if not specified
      side: choice,
    });
  }, [initializePosition, rpc]);

  // Update position (add more tokens to existing position)
  const updatePosition = useCallback(async (params: UpdatePositionParams): Promise<VoteTransactionResult> => {
    if (!walletAccount?.address || !transactionSendingSigner) {
      return {
        success: false,
        error: 'Wallet not connected or not ready'
      };
    }

    try {
      const enc = getAddressEncoder();

      // Get platform and vault PDAs
      const [platformPda] = await getProgramDerivedAddress({
        programAddress: PROGRAM_ID,
        seeds: ["config"]
      });

      const [vaultPda] = await getProgramDerivedAddress({
        programAddress: PROGRAM_ID,
        seeds: [enc.encode(platformPda)]
      });

      // Get vote vault PDA
      const voteAddress = address(params.votePubkey);
      const [voteVaultPda] = await getProgramDerivedAddress({
        programAddress: PROGRAM_ID,
        seeds: [enc.encode(voteAddress)]
      });

      // Get position PDA
      const [positionPda] = await getProgramDerivedAddress({
        programAddress: PROGRAM_ID,
        seeds: ["position", enc.encode(voteAddress), enc.encode(address(walletAccount.address))]
      });

      // Default to USDC if no token specified
      const tokenMint = params.tokenMint ? address(params.tokenMint) : address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

      const voteVaultTokenAccount = await getAssociatedTokenAccountAddress(tokenMint, voteVaultPda);
      const vaultTokenAccount = await getAssociatedTokenAccountAddress(tokenMint, vaultPda);
      const authorityTokenAccount = await getAssociatedTokenAccountAddress(tokenMint, address(walletAccount.address));

      // Convert amount to proper units (assuming 6 decimals for USDC)
      const scaledAmount = BigInt(Math.floor(params.amount * 1_000_000));

      const buffer = new ArrayBuffer(8);
      const view = new DataView(buffer);
      view.setBigUint64(0, scaledAmount, true); // true = little endian

      const updateAmount = new Uint8Array(buffer);
      // Create update position instruction
      const updatePositionIx = programClient.getUpdatePositionInstruction({
        authority: transactionSendingSigner,
        platform: platformPda,
        vault: vaultPda,
        vote: voteAddress,
        token: tokenMint,
        voteVault: voteVaultPda,
        voteVaultTokenAccount,
        authorityTokenAccount,
        vaultTokenAccount,
        position: positionPda,
        amount: updateAmount,
      });

      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
      // Create transaction message for wallet signing
      const message = pipe(
        createTransactionMessage({ version: 'legacy' }),
        m => setTransactionMessageFeePayerSigner(transactionSendingSigner, m),
        m => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
        m => appendTransactionMessageInstructions([updatePositionIx], m)
      );

      assertIsTransactionMessageWithSingleSendingSigner(message);
      const signature = await signAndSendTransactionMessageWithSigners(message);

      return {
        success: true,
        signature: getBase58Decoder().decode(signature)
      };

    } catch (error) {
      console.error('Update position error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown update error'
      };
    }
  }, [walletAccount, rpc, transactionSendingSigner]);

  // Redeem winnings from a completed vote
  const redeemWinnings = useCallback(async (params: RedeemWinningsParams): Promise<VoteTransactionResult> => {
    if (!walletAccount?.address || !transactionSendingSigner) {
      return {
        success: false,
        error: 'Wallet not connected or not ready'
      };
    }

    try {
      const enc = getAddressEncoder();
      // Get platform and vault PDAs
      const [platformPda] = await getProgramDerivedAddress({
        programAddress: PROGRAM_ID,
        seeds: ["config"]
      });

      const [vaultPda] = await getProgramDerivedAddress({
        programAddress: PROGRAM_ID,
        seeds: [enc.encode(platformPda)]
      });

      // Get vote vault PDA
      const voteAddress = address(params.votePubkey);
      const [voteVaultPda] = await getProgramDerivedAddress({
        programAddress: PROGRAM_ID,
        seeds: [enc.encode(voteAddress)]
      });

      // Get position PDA
      const [positionPda] = await getProgramDerivedAddress({
        programAddress: PROGRAM_ID,
        seeds: ["position", enc.encode(voteAddress), enc.encode(address(walletAccount.address))]
      });

      // Default to USDC if no token specified
      const tokenMint = params.tokenMint ? address(params.tokenMint) : address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

      const voteVaultTokenAccount = await getAssociatedTokenAccountAddress(tokenMint, voteVaultPda);
      const vaultTokenAccount = await getAssociatedTokenAccountAddress(tokenMint, vaultPda);
      const authorityTokenAccount = await getAssociatedTokenAccountAddress(tokenMint, address(walletAccount.address));

      console.log('Redeeming winnings from account', voteVaultTokenAccount);
      // Create redeem winnings instruction
      const redeemWinningsIx = programClient.getRedeemWinningsInstruction({
        authority: transactionSendingSigner,
        platform: platformPda,
        vault: vaultPda,
        vote: voteAddress,
        token: tokenMint,
        voteVault: voteVaultPda,
        voteVaultTokenAccount,
        authorityTokenAccount,
        vaultTokenAccount,
        position: positionPda,
      });

      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
      // Create transaction message for wallet signing
      const message = pipe(
        createTransactionMessage({ version: 'legacy' }),
        m => setTransactionMessageFeePayerSigner(transactionSendingSigner, m),
        m => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
        m => appendTransactionMessageInstructions([redeemWinningsIx], m)
      );

      assertIsTransactionMessageWithSingleSendingSigner(message);
      const signature = await signAndSendTransactionMessageWithSigners(message);

      return {
        success: true,
        signature: getBase58Decoder().decode(signature)
      };

    } catch (error) {
      console.error('Redeem winnings error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown redeem error'
      };
    }
  }, [walletAccount, rpc, transactionSendingSigner]);

  // Get vote account state
  const getVoteState = useCallback(async (votePubkey: string) => {
    try {
      // Fetch the vote account data
      const voteAccount = await programClient.fetchVote(rpc, address(votePubkey));

      if (!voteAccount?.data) {
        throw new Error('Vote account not found');
      }

      // Decode the byte arrays to numbers
      const trueVotes = Number(new DataView(voteAccount.data.trueVotes.buffer).getBigUint64(0, true));
      const falseVotes = Number(new DataView(voteAccount.data.falseVotes.buffer).getBigUint64(0, true));
      const endTimestamp = Number(new DataView(voteAccount.data.endTimestamp.buffer).getBigUint64(0, true));

      // Calculate vote counts and status
      const now = Math.floor(Date.now() / 1000);
      const isActive = now < endTimestamp;

      return {
        title: `Vote ${votePubkey.slice(0, 8)}`, // Title would be stored off-chain
        creator: walletAccount?.address, // Creator not stored on-chain in this structure
        endTime: new Date(endTimestamp * 1000),
        yesVotes: trueVotes,
        noVotes: falseVotes,
        totalParticipants: trueVotes + falseVotes, // Approximate from vote counts
        isActive: isActive,
        token: voteAccount.data.token
      };

    } catch (error) {
      console.error('Failed to fetch vote state:', error);
      // Return mock data as fallback
      return {
        title: 'Sample Vote',
        creator: walletAccount?.address,
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        yesVotes: 125,
        noVotes: 78,
        totalParticipants: 203,
        isActive: true
      };
    }
  }, [walletAccount, rpc]);

  return {
    // Wallet state
    isConnected: !!walletAccount?.address,
    walletAddress: walletAccount?.address,

    // Functions
    getWalletTokens,
    createVoteTransaction,
    castVote,
    getVoteState,
    initializePosition,
    updatePosition,
    redeemWinnings
  };
}

// Utility function to format wallet address
export function formatWalletAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

// Utility function to convert lamports to SOL
export function lamportsToSol(lamports: number): number {
  return lamports / 1_000_000_000;
}

// Utility function to convert SOL to lamports
export function solToLamports(sol: number): number {
  return Math.floor(sol * 1_000_000_000);
}
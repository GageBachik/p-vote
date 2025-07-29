"use client";

import { useContext, useCallback } from 'react';
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
import * as programClient from "@/../../clients/js/src/generated";
import bs58 from "bs58";
import { send } from 'process';

// Program ID for the voting program
const PROGRAM_ID = address('pVoTew8KNhq6rsrYq9jEUzKypytaLtQR62UbagWTCvu');

// Types for vote creation
export interface CreateVoteParams {
  title: string;
  description?: string;
  endTime: Date;
  tokenMint?: string; // null for SOL
  blockhash: Blockhash;
}

export interface VoteTransactionResult {
  success: boolean;
  signature?: string;
  votePubkey?: string;
  error?: string;
}

export interface InitializePositionParams {
  votePubkey: string;
  amount: number;
  side: 'yes' | 'no';
  tokenMint?: string;
  blockhash: Blockhash;
}

export interface UpdatePositionParams {
  votePubkey: string;
  amount: number;
  tokenMint?: string;
  blockhash: Blockhash;
}

// Hook for Solana voting operations
export function useSolanaVoting() {
  const [selectedWalletAccount] = useContext(SelectedWalletAccountContext);
  const { rpc, sendAndConfirmTransaction } = useContext(RpcContext);
  const { chain: currentChain } = useContext(ChainContext);
  const transactionSendingSigner = selectedWalletAccount
    ? useWalletAccountTransactionSendingSigner(selectedWalletAccount, currentChain)
    : null;

  // Get wallet tokens (simplified for now)
  const getWalletTokens = useCallback(async () => {
    if (!selectedWalletAccount?.address) {
      throw new Error('Wallet not connected');
    }

    // TODO: Implement actual RPC calls to fetch user's token accounts
    // For now, return mock data
    return [
      // {
      //   mint: 'So11111111111111111111111111111111111111112',
      //   symbol: 'SOL',
      //   balance: 2.5,
      //   decimals: 9,
      //   name: 'Solana'
      // },
      {
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        symbol: 'USDC',
        balance: 0,
        decimals: 6,
        name: 'USD Coin'
      },
      // {
      //   mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      //   symbol: 'USDT',
      //   balance: 75.25,
      //   decimals: 6,
      //   name: 'Tether USD'
      // }
    ];
  }, [selectedWalletAccount]);

  // Create a vote on-chain
  const createVoteTransaction = useCallback(async (params: CreateVoteParams): Promise<VoteTransactionResult> => {
    if (!selectedWalletAccount?.address || !transactionSendingSigner) {
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
      const timeToAdd = Buffer.alloc(8);
      timeToAdd.writeBigInt64LE(BigInt(endTimeUnix - now));

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

      // Get latest blockhash if not provided
      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
      console.log('Latest blockhash:', latestBlockhash);
      // Create and send transaction with only wallet signature needed
      const message = pipe(
        createTransactionMessage({ version: "legacy" }),
        m => setTransactionMessageFeePayerSigner(transactionSendingSigner, m),
        m => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
        m => appendTransactionMessageInstructions([initVoteIx], m)
      );

      try {
        // // Sign the transaction with the wallet's transaction sending signer
        // const signature = await signAndSendTransactionMessageWithSigners(
        //   transaction
        // );      assertIsTransactionMessageWithSingleSendingSigner(message);
        const signature = await signAndSendTransactionMessageWithSigners(message);

        // For now, we'll return the vote address and let the UI handle the actual transaction sending
        // since we need to handle the vote keypair signing separately
        return {
          success: true,
          signature: getBase58Decoder().decode(signature), // Placeholder signature
          votePubkey: vote.address
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
  }, [selectedWalletAccount, transactionSendingSigner, rpc]);

  // Initialize position (cast a vote) on an existing vote
  const initializePosition = useCallback(async (params: InitializePositionParams): Promise<VoteTransactionResult> => {
    if (!selectedWalletAccount?.address || !transactionSendingSigner) {
      return {
        success: false,
        error: 'Wallet not connected or not ready'
      };
    }

    try {
      const enc = getAddressEncoder();
      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

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
        seeds: ["position", enc.encode(voteAddress), enc.encode(address(selectedWalletAccount.address))]
      });

      // Default to USDC if no token specified
      const tokenMint = params.tokenMint ? address(params.tokenMint) : address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

      const voteVaultTokenAccount = await getAssociatedTokenAccountAddress(tokenMint, voteVaultPda);
      const vaultTokenAccount = await getAssociatedTokenAccountAddress(tokenMint, vaultPda);
      const authorityTokenAccount = await getAssociatedTokenAccountAddress(tokenMint, address(selectedWalletAccount.address));

      // Convert amount to proper units (assuming 6 decimals for USDC)
      const positionAmount = Buffer.alloc(8);
      positionAmount.writeBigUInt64LE(BigInt(Math.floor(params.amount * 1_000_000)));

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

      // Create transaction message for wallet signing
      const message = pipe(
        createTransactionMessage({ version: 0 }),
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
  }, [selectedWalletAccount, rpc, transactionSendingSigner]);

  // Cast a vote (wrapper for backward compatibility)
  const castVote = useCallback(async (
    votePubkey: string,
    choice: 'yes' | 'no',
    amount?: number
  ): Promise<VoteTransactionResult> => {
    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
    return initializePosition({
      votePubkey,
      amount: amount || 1, // Default to 1 token if not specified
      side: choice,
      blockhash: latestBlockhash.blockhash
    });
  }, [initializePosition, rpc]);

  // Update position (add more tokens to existing position)
  const updatePosition = useCallback(async (params: UpdatePositionParams): Promise<VoteTransactionResult> => {
    if (!selectedWalletAccount?.address || !transactionSendingSigner) {
      return {
        success: false,
        error: 'Wallet not connected or not ready'
      };
    }

    try {
      const enc = getAddressEncoder();
      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

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
        seeds: ["position", enc.encode(voteAddress), enc.encode(address(selectedWalletAccount.address))]
      });

      // Default to USDC if no token specified
      const tokenMint = params.tokenMint ? address(params.tokenMint) : address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

      const voteVaultTokenAccount = await getAssociatedTokenAccountAddress(tokenMint, voteVaultPda);
      const vaultTokenAccount = await getAssociatedTokenAccountAddress(tokenMint, vaultPda);
      const authorityTokenAccount = await getAssociatedTokenAccountAddress(tokenMint, address(selectedWalletAccount.address));

      // Convert amount to proper units (assuming 6 decimals for USDC)
      const updateAmount = Buffer.alloc(8);
      updateAmount.writeBigUInt64LE(BigInt(Math.floor(params.amount * 1_000_000)));

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

      // Create transaction message for wallet signing
      const message = pipe(
        createTransactionMessage({ version: 0 }),
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
  }, [selectedWalletAccount, rpc, transactionSendingSigner]);

  // Get vote account state
  const getVoteState = useCallback(async (votePubkey: string) => {
    try {
      // Fetch the vote account data
      const voteAccount = await programClient.fetchVote(rpc as any, address(votePubkey));

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
        creator: selectedWalletAccount?.address, // Creator not stored on-chain in this structure
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
        creator: selectedWalletAccount?.address,
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        yesVotes: 125,
        noVotes: 78,
        totalParticipants: 203,
        isActive: true
      };
    }
  }, [selectedWalletAccount, rpc]);

  return {
    // Wallet state
    isConnected: !!selectedWalletAccount?.address,
    walletAddress: selectedWalletAccount?.address,

    // Functions
    getWalletTokens,
    createVoteTransaction,
    castVote,
    getVoteState,
    initializePosition,
    updatePosition
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
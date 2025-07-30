"use client";
import type {
  Rpc,
  RpcSubscriptions,
  SolanaRpcApiMainnet,
  SolanaRpcSubscriptionsApi,
} from "@solana/kit";
import { createContext } from "react";
import {
  createSolanaClient,
  SendAndConfirmTransactionWithSignersFunction,
} from "gill";

const { rpc, rpcSubscriptions, sendAndConfirmTransaction } = createSolanaClient(
  {
    urlOrMoniker: "mainnet", // or full RPC URL
  }
);

export const RpcContext = createContext<{
  rpc: Rpc<SolanaRpcApiMainnet>; // Limit the API to only those methods found on Mainnet (ie. not `requestAirdrop`)
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
  sendAndConfirmTransaction: SendAndConfirmTransactionWithSignersFunction;
}>({
  rpc: rpc,
  rpcSubscriptions: rpcSubscriptions,
  sendAndConfirmTransaction,
});

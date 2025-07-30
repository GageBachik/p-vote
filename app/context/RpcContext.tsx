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
    urlOrMoniker:
      "https:///mainnet.helius-rpc.com/?api-key=1e722833-0c3e-47ac-9974-13de5c01d1ee", // or full RPC URL
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

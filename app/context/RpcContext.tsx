"use client"
import type { Rpc, RpcSubscriptions, SolanaRpcApiMainnet, SolanaRpcSubscriptionsApi } from '@solana/kit';
import { createSolanaRpc, createSolanaRpcSubscriptions, devnet } from '@solana/kit';
import { createContext } from 'react';

export const RpcContext = createContext<{
    rpc: Rpc<SolanaRpcApiMainnet>; // Limit the API to only those methods found on Mainnet (ie. not `requestAirdrop`)
    rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
}>({
    rpc: createSolanaRpc(devnet('https://api.devnet.solana.com')),
    rpcSubscriptions: createSolanaRpcSubscriptions(devnet('wss://api.devnet.solana.com')),
});
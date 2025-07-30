"use client";
import type { ClusterUrl } from "@solana/kit";
import { devnet } from "@solana/kit";
import { createContext } from "react";

export type ChainContext = Readonly<{
  chain: `solana:${string}`;
  displayName: string;
  setChain?(chain: `solana:${string}`): void;
  solanaExplorerClusterName: "devnet" | "mainnet-beta" | "testnet" | "localnet";
  solanaRpcSubscriptionsUrl: ClusterUrl;
  solanaRpcUrl: ClusterUrl;
}>;

// export const DEFAULT_CHAIN_CONFIG = Object.freeze({
//   chain: "solana:localnet",
//   displayName: "Localnet",
//   solanaExplorerClusterName: "localnet",
//   solanaRpcSubscriptionsUrl: "wss://127.0.0.1:8899",
//   solanaRpcUrl: "http://127.0.0.1:8899",
// });

export const DEFAULT_CHAIN_CONFIG = Object.freeze({
  chain: "solana:mainnet",
  displayName: "Mainnet",
  solanaExplorerClusterName: "mainnet-beta",
  solanaRpcSubscriptionsUrl:
    "wss:///mainnet.helius-rpc.com/?api-key=1e722833-0c3e-47ac-9974-13de5c01d1ee",
  solanaRpcUrl:
    "https:///mainnet.helius-rpc.com/?api-key=1e722833-0c3e-47ac-9974-13de5c01d1ee",
});

export const ChainContext = createContext<ChainContext>(DEFAULT_CHAIN_CONFIG);

"use client";

import { devnet, mainnet, testnet } from "@solana/kit";
import { useEffect, useMemo, useState } from "react";

import { ChainContext, DEFAULT_CHAIN_CONFIG } from "./ChainContext";

const STORAGE_KEY = "solana-example-react-app:selected-chain";

export function ChainContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [chain, setChain] = useState("solana:localnet");

  // Load chain from localStorage after component mounts
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedChain = localStorage.getItem(STORAGE_KEY);
      if (savedChain) {
        setChain(savedChain);
      }
    }
  }, []);
  const contextValue = useMemo<ChainContext>(() => {
    switch (chain) {
      case "solana:mainnet":
        if (process.env.REACT_EXAMPLE_APP_ENABLE_MAINNET === "true") {
          return {
            chain: "solana:mainnet",
            displayName: "Mainnet Beta",
            solanaExplorerClusterName: "mainnet-beta",
            solanaRpcSubscriptionsUrl: mainnet(
              "wss://api.mainnet-beta.solana.com"
            ),
            solanaRpcUrl: mainnet("https://api.mainnet-beta.solana.com"),
          };
        }
      // falls through
      case "solana:testnet":
        return {
          chain: "solana:testnet",
          displayName: "Testnet",
          solanaExplorerClusterName: "testnet",
          solanaRpcSubscriptionsUrl: testnet("wss://api.testnet.solana.com"),
          solanaRpcUrl: testnet("https://api.testnet.solana.com"),
        };
      case "solana:devnet":
        return {
          chain: "solana:devnet",
          displayName: "Devnet",
          solanaExplorerClusterName: "devnet",
          solanaRpcSubscriptionsUrl: devnet("wss://api.devnet.solana.com"),
          solanaRpcUrl: devnet("https://api.devnet.solana.com"),
        };
      case "solana:localnet":
        console.warn(
          "Using localnet chain configuration. Ensure you have a local Solana node running."
        );
        return {
          chain: "solana:localnet",
          displayName: "Localnet",
          solanaExplorerClusterName: "localnet",
          solanaRpcSubscriptionsUrl: "wss://127.0.0.1:8899",
          solanaRpcUrl: "http://127.0.0.1:8899",
        };
      default:
        if (chain !== "solana:devnet") {
          if (typeof window !== "undefined") {
            localStorage.removeItem(STORAGE_KEY);
          }
          console.error(`Unrecognized chain \`${chain}\``);
        }
        return DEFAULT_CHAIN_CONFIG;
    }
  }, [chain]);
  return (
    <ChainContext.Provider
      value={useMemo(
        () => ({
          ...contextValue,
          setChain(chain) {
            if (typeof window !== "undefined") {
              localStorage.setItem(STORAGE_KEY, chain);
            }
            setChain(chain);
          },
        }),
        [contextValue]
      )}
    >
      {children}
    </ChainContext.Provider>
  );
}

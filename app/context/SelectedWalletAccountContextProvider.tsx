"use client";

import {
  getUiWalletAccountStorageKey,
  UiWallet,
  UiWalletAccount,
  uiWalletAccountBelongsToUiWallet,
  uiWalletAccountsAreSame,
  useWallets,
} from "@wallet-standard/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  SelectedWalletAccountContext,
  SelectedWalletAccountState,
} from "./SelectedWalletAccountContext";

const STORAGE_KEY =
  "solana-wallet-standard-example-react:selected-wallet-and-address";

// --- Safe storage helpers ----------------------------------------------------

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

// last-resort, per-tab memory fallback (won’t survive reloads)
function createMemoryStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

/**
 * Returns the best available storage:
 * 1) localStorage (if usable),
 * 2) sessionStorage (if usable),
 * 3) in-memory fallback.
 *
 * Important: call this *after* window exists (i.e., inside effects or client components).
 */
function getSafeStorage(): StorageLike {
  if (typeof window === "undefined") return createMemoryStorage();

  // Try localStorage
  try {
    const t = "__test_local__";
    window.localStorage.setItem(t, "1");
    window.localStorage.removeItem(t);
    return window.localStorage;
  } catch (_) {
    // ignore
  }

  // Try sessionStorage
  try {
    const t = "__test_session__";
    window.sessionStorage.setItem(t, "1");
    window.sessionStorage.removeItem(t);
    return window.sessionStorage;
  } catch (_) {
    // ignore
  }

  // Fallback
  return createMemoryStorage();
}

// ---------------------------------------------------------------------------

let wasSetterInvoked = false;

function getSavedWalletAccount(
  wallets: readonly UiWallet[],
  storage: StorageLike
): UiWalletAccount | undefined {
  if (wasSetterInvoked) return;

  const saved = storage.getItem(STORAGE_KEY);
  if (!saved || typeof saved !== "string") return;

  const [savedWalletName, savedAccountAddress] = saved.split(":");
  if (!savedWalletName || !savedAccountAddress) return;

  for (const wallet of wallets) {
    if (wallet.name === savedWalletName) {
      for (const account of wallet.accounts) {
        if (account.address === savedAccountAddress) {
          return account;
        }
      }
    }
  }
}

export function SelectedWalletAccountContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const wallets = useWallets();

  // hold a ref to whichever storage is actually available on this device/mode
  const storageRef = useRef<StorageLike>(createMemoryStorage());

  // late-bind to safe storage on the client
  useEffect(() => {
    storageRef.current = getSafeStorage();
  }, []);

  const [selectedWalletAccount, setSelectedWalletAccountInternal] =
    useState<SelectedWalletAccountState>(undefined);

  // Hydrate initial selection once we know which storage we can use
  useEffect(() => {
    const savedWalletAccount = getSavedWalletAccount(wallets, storageRef.current);
    if (savedWalletAccount) {
      setSelectedWalletAccountInternal(savedWalletAccount);
    }
    // run on wallets change too, so we can match once the wallet appears
  }, [wallets]);

  const setSelectedWalletAccount: React.Dispatch<
    React.SetStateAction<SelectedWalletAccountState>
  > = (setStateAction) => {
    setSelectedWalletAccountInternal((prev) => {
      wasSetterInvoked = true;
      const nextWalletAccount =
        typeof setStateAction === "function"
          ? setStateAction(prev)
          : setStateAction;

      const accountKey = nextWalletAccount
        ? getUiWalletAccountStorageKey(nextWalletAccount)
        : undefined;

      // Use safe storage (won’t throw in private/incognito)
      const storage = storageRef.current;
      try {
        if (accountKey) {
          storage.setItem(STORAGE_KEY, accountKey);
        } else {
          storage.removeItem(STORAGE_KEY);
        }
      } catch {
        // ignore – fallbacks already chosen; worst case is memory-only
      }

      return nextWalletAccount;
    });
  };

  const walletAccount = useMemo(() => {
    if (selectedWalletAccount) {
      for (const uiWallet of wallets) {
        for (const uiWalletAccount of uiWallet.accounts) {
          if (
            uiWalletAccountsAreSame(selectedWalletAccount, uiWalletAccount)
          ) {
            return uiWalletAccount;
          }
        }
        if (
          uiWalletAccountBelongsToUiWallet(selectedWalletAccount, uiWallet) &&
          uiWallet.accounts[0]
        ) {
          // If the selected account belongs to this connected wallet, at least,
          // select one of its accounts.
          return uiWallet.accounts[0];
        }
      }
    }
    return undefined;
  }, [selectedWalletAccount, wallets]);

  useEffect(() => {
    // If the selected wallet disconnects, clear selection
    if (selectedWalletAccount && !walletAccount) {
      setSelectedWalletAccountInternal(undefined);
    }
  }, [selectedWalletAccount, walletAccount]);

  return (
    <SelectedWalletAccountContext.Provider
      value={useMemo(() => [walletAccount, setSelectedWalletAccount], [walletAccount])}
    >
      {children}
    </SelectedWalletAccountContext.Provider>
  );
}

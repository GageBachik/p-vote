"use client";

import { Suspense } from "react";
import { Loader2, Database } from "lucide-react";
import type { UiWalletAccount } from "@wallet-standard/react";
import { Balance } from "../Balance";
import { ErrorBoundary } from "react-error-boundary";

interface CyberBalanceProps {
  account: string;
}

export function CyberBalance({ account }: CyberBalanceProps) {
  return (
    <div className="flex items-center space-x-2 neon-border-cyan px-4 py-2 bg-cyber-dark">
      <Database className="w-4 h-4 cyber-orange" />
      <ErrorBoundary
        fallback={<span className="font-bold cyber-orange text-lg">--</span>}
      >
        <Suspense
          fallback={<Loader2 className="w-4 h-4 cyber-orange animate-spin" />}
        >
          <div className="flex items-center space-x-1">
            <Balance account={account} />
            <span className="text-xs cyber-yellow">USDC</span>
          </div>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

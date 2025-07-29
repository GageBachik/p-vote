"use client"

import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';
import { ReactNode, useContext, useMemo } from 'react';
import { createSolanaClient } from 'gill';

import { ChainContext } from './ChainContext';
import { RpcContext } from './RpcContext';

type Props = Readonly<{
    children: ReactNode;
}>;

export function RpcContextProvider({ children }: Props) {
    const { solanaRpcSubscriptionsUrl, solanaRpcUrl } = useContext(ChainContext);
    
    const contextValue = useMemo(() => {
        // Create gill client which provides sendAndConfirmTransaction
        const { rpc: gillRpc, rpcSubscriptions: gillRpcSubscriptions, sendAndConfirmTransaction } = createSolanaClient({
            urlOrMoniker: solanaRpcUrl
        });
        
        return {
            rpc: gillRpc,
            rpcSubscriptions: gillRpcSubscriptions,
            sendAndConfirmTransaction
        };
    }, [solanaRpcUrl]);
    
    return (
        <RpcContext.Provider value={contextValue}>
            {children}
        </RpcContext.Provider>
    );
}
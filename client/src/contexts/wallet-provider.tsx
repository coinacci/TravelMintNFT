import { ReactNode, useEffect } from "react";
import { WagmiProvider } from "wagmi";
import { config } from "@/lib/wagmi";

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  useEffect(() => {
    // Handle wallet-related unhandled rejections that can crash the app
    const handleWalletRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      
      // Check if it's a wallet authorization error
      if (reason?.message?.includes('not been authorized yet') ||
          reason?.message?.includes('replit.dev') ||
          reason?.code === -32603) {
        console.warn('🔑 Wallet authorization error (handled):', reason.message);
        event.preventDefault(); // Prevent app crash
        return false;
      }
    };

    window.addEventListener('unhandledrejection', handleWalletRejection);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleWalletRejection);
    };
  }, []);

  return (
    <WagmiProvider config={config}>
      {children}
    </WagmiProvider>
  );
}
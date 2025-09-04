import { ReactNode, useEffect } from "react";
import { WagmiProvider } from "wagmi";
import { config } from "@/lib/wagmi";

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  useEffect(() => {
    // Enhanced wallet error handler to prevent app crashes
    const handleWalletRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      
      // Comprehensive wallet error patterns that can crash app
      if (reason?.message?.includes('not been authorized yet') ||
          reason?.message?.includes('replit.dev') ||
          reason?.message?.includes('unauthorized') ||
          reason?.code === -32603 ||
          reason?.code === -32002 ||
          reason?.errorClass === 'Transaction') {
        console.warn('🔑 Wallet error (app crash prevented):', reason.message || reason);
        event.preventDefault();
        return false;
      }
      
      // Also handle wallet connection failures
      if (typeof reason === 'string' && 
          (reason.includes('wallet') || reason.includes('connector'))) {
        console.warn('🔌 Wallet connector error (handled):', reason);
        event.preventDefault();
        return false;
      }
    };

    // Enhanced error handling for React component errors
    const handleComponentError = (event: ErrorEvent) => {
      if (event.error?.message?.includes('replit.dev') ||
          event.error?.message?.includes('unauthorized') ||
          event.filename?.includes('wagmi')) {
        console.warn('⚛️ Component wallet error (handled):', event.error.message);
        event.preventDefault();
        return false;
      }
    };

    window.addEventListener('unhandledrejection', handleWalletRejection);
    window.addEventListener('error', handleComponentError);
    
    console.log('🛡️ Enhanced wallet error protection active');
    
    return () => {
      window.removeEventListener('unhandledrejection', handleWalletRejection);
      window.removeEventListener('error', handleComponentError);
    };
  }, []);

  return (
    <WagmiProvider config={config}>
      {children}
    </WagmiProvider>
  );
}
import { ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { config } from "@/lib/wagmi";

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  // Minimal wallet provider - no automatic connections to prevent crashes
  // All wallet interactions will be manual and user-initiated
  return (
    <WagmiProvider config={config}>
      {children}
    </WagmiProvider>
  );
}
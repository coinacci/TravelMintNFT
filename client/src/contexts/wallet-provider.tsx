import { ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { config } from "@/lib/wagmi";

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  return (
    <WagmiProvider config={config}>
      {children}
    </WagmiProvider>
  );
}
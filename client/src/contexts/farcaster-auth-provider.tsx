import { ReactNode } from "react";
import { AuthKitProvider } from "@farcaster/auth-kit";
import "@farcaster/auth-kit/styles.css";

const config = {
  rpcUrl: "https://mainnet.optimism.io",
  domain: "travelnft.replit.app",
  siweUri: "https://travelnft.replit.app",
  relay: "https://relay.farcaster.xyz",
};

interface FarcasterAuthProviderProps {
  children: ReactNode;
}

export function FarcasterAuthProvider({ children }: FarcasterAuthProviderProps) {
  return (
    <AuthKitProvider config={config}>
      {children}
    </AuthKitProvider>
  );
}

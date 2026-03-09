import { ReactNode } from "react";
import { AuthKitProvider } from "@farcaster/auth-kit";
import "@farcaster/auth-kit/styles.css";

const config = {
  rpcUrl: "https://mainnet.optimism.io",
  domain: "travelmintnft.vercel.app",
  siweUri: "https://travelmintnft.vercel.app",
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

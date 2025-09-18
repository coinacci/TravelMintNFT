import { createConfig, http } from 'wagmi'
import { base, mainnet, baseSepolia } from 'wagmi/chains'
import { coinbaseWallet } from 'wagmi/connectors'
import { farcasterMiniApp as miniAppConnector } from '@farcaster/miniapp-wagmi-connector'

// Get the correct app URL for wallet authorization
const getAppUrl = () => {
  // Use current origin in development, production domain for production
  if (typeof window !== 'undefined') {
    // Development: use current origin to fix CORS issues
    if (window.location.hostname.includes('replit.dev') || window.location.hostname.includes('replit.co')) {
      return window.location.origin;
    }
  }
  // Production: use production domain
  return 'https://travelnft.replit.app';
};

// Manual connection config - no auto-connect to prevent Farcaster crashes
export const config = createConfig({
  chains: [base, mainnet, baseSepolia],
  connectors: [
    miniAppConnector(), // Native Farcaster Mini App connector
    coinbaseWallet({
      appName: 'TravelMint',
      appLogoUrl: `${getAppUrl()}/icon-192x192.png`,
      preference: 'all', // Support both smart wallet and EOA
      version: '4',
    }),
  ],
  transports: {
    [base.id]: http('https://mainnet.base.org', {
      timeout: 10000, // 10 second timeout
    }),
    [mainnet.id]: http('https://cloudflare-eth.com', {
      timeout: 10000, // 10 second timeout
    }),
    [baseSepolia.id]: http('https://sepolia.base.org', {
      timeout: 10000, // 10 second timeout
    }),
  },
  // Disable auto-connect to prevent crashes in iframe environments
  multiInjectedProviderDiscovery: false,
  syncConnectedChain: false,
  ssr: false,
})


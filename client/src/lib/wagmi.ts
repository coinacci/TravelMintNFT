import { createConfig, http } from 'wagmi'
import { base, mainnet, baseSepolia } from 'wagmi/chains'
import { coinbaseWallet } from 'wagmi/connectors'
import frameConnector from '@farcaster/frame-wagmi-connector'

// Configure wagmi
export const config = createConfig({
  chains: [base, mainnet, baseSepolia],
  connectors: [
    frameConnector(),
    coinbaseWallet({
      appName: 'TravelMint',
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
  ssr: false,
})
import { createConfig, http } from 'wagmi'
import { base, mainnet } from 'wagmi/chains'
import { coinbaseWallet } from 'wagmi/connectors'
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector'

// Configure wagmi
export const config = createConfig({
  chains: [base, mainnet],
  connectors: [
    coinbaseWallet({
      appName: 'TravelNFT',
      appLogoUrl: '/logo.png',
      preference: 'all', // Supports both Smart Wallet and EOA
    }),
    farcasterMiniApp(),
  ],
  transports: {
    [base.id]: http(),
    [mainnet.id]: http(),
  },
  ssr: false,
})
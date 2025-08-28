import { createConfig, http } from 'wagmi'
import { base, mainnet } from 'wagmi/chains'
import { coinbaseWallet } from 'wagmi/connectors'
import frameConnector from '@farcaster/frame-wagmi-connector'

// Configure wagmi
export const config = createConfig({
  chains: [base, mainnet],
  connectors: [
    frameConnector(),
    coinbaseWallet({
      appName: 'TravelNFT',
      appLogoUrl: 'https://travelnft.vercel.app/logo.png',
      preference: 'all', // Supports both Smart Wallet and EOA
    }),
  ],
  transports: {
    [base.id]: http('https://mainnet.base.org'),
    [mainnet.id]: http('https://cloudflare-eth.com'),
  },
  ssr: false,
})
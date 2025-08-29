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
      appName: 'TravelMint',
      preference: 'smartWalletOnly', // Use smart wallet for better UX
      version: '4',
    }),
  ],
  transports: {
    [base.id]: http('https://mainnet.base.org'),
    [mainnet.id]: http('https://cloudflare-eth.com'),
  },
  ssr: false,
})
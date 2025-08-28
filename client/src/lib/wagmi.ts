import { createConfig, http } from 'wagmi'
import { base, mainnet } from 'wagmi/chains'
import { coinbaseWallet } from 'wagmi/connectors'
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector'

// Browser polyfills for Farcaster connector
if (typeof global === 'undefined') {
  (globalThis as any).global = globalThis;
}

// Buffer polyfill - try to load synchronously
try {
  if (typeof (globalThis as any).Buffer === 'undefined') {
    const bufferModule = require('buffer');
    (globalThis as any).Buffer = bufferModule.Buffer;
  }
} catch (error) {
  // If require fails, create a minimal buffer polyfill
  if (typeof (globalThis as any).Buffer === 'undefined') {
    (globalThis as any).Buffer = {
      from: (data: any) => new Uint8Array(data),
      isBuffer: (obj: any) => obj instanceof Uint8Array,
    };
  }
}

// Configure wagmi
export const config = createConfig({
  chains: [base, mainnet],
  connectors: [
    coinbaseWallet({
      appName: 'TravelNFT',
      appLogoUrl: 'https://travelnft.vercel.app/logo.png',
      preference: 'all', // Supports both Smart Wallet and EOA
    }),
    farcasterMiniApp(),
  ],
  transports: {
    [base.id]: http('https://mainnet.base.org'),
    [mainnet.id]: http('https://cloudflare-eth.com'),
  },
  ssr: false,
})
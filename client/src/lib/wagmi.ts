import { createConfig, http } from 'wagmi'
import { base, mainnet } from 'wagmi/chains'
import { coinbaseWallet } from 'wagmi/connectors'
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector'

// Browser polyfills for Farcaster connector
if (typeof global === 'undefined') {
  (globalThis as any).global = globalThis;
}

// Buffer polyfill for browser compatibility
if (typeof (globalThis as any).Buffer === 'undefined') {
  (globalThis as any).Buffer = {
    from: (data: any, encoding?: string) => {
      if (typeof data === 'string') {
        return new TextEncoder().encode(data);
      }
      return new Uint8Array(data);
    },
    isBuffer: (obj: any) => obj instanceof Uint8Array,
    alloc: (size: number) => new Uint8Array(size),
    allocUnsafe: (size: number) => new Uint8Array(size),
    concat: (buffers: Uint8Array[]) => {
      const totalLength = buffers.reduce((acc, buf) => acc + buf.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const buf of buffers) {
        result.set(buf, offset);
        offset += buf.length;
      }
      return result;
    }
  };
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
# TravelMint NFT - Vercel Deployment Guide

## Environment Variables Required for Vercel

The following environment variables need to be set in your Vercel dashboard:

### Database
- `DATABASE_URL` - PostgreSQL connection string (from Neon or other provider)

### API Keys
- `BASESCAN_API_KEY` - For blockchain verification
- `MORALIS_API_KEY` - For NFT data
- `OPENSEA_API_KEY` - For marketplace integration (optional)

### Pinata IPFS
- `PINATA_JWT` - Pinata API key for IPFS storage
- `PINATA_GATEWAY_URL` - Pinata gateway URL

### Application
- `NODE_ENV=production`

## Deployment Files Added

- `vercel.json` - Vercel configuration
- `api/index.ts` - Serverless function entry point

## How to Deploy

1. Connect your GitHub repository to Vercel
2. Set the environment variables in Vercel dashboard
3. Deploy

The application will be available at your Vercel domain.
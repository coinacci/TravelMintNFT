# TravelMint Vercel Deployment Guide

## 🚀 Deploy to Vercel Instructions

### Step 1: GitHub Repository Setup
1. Ensure your code is pushed to GitHub
2. Go to [Vercel](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository

### Step 2: Environment Variables
Set these environment variables in Vercel dashboard:

#### Required Environment Variables:
```
NODE_ENV=production
DATABASE_URL=your_neon_database_url
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_KEY=your_pinata_secret_key
COINBASE_API_KEY=your_coinbase_api_key (if using)
```

#### Base Blockchain Variables:
```
NEXT_PUBLIC_CHAIN_ID=8453
NEXT_PUBLIC_RPC_URL=https://base.llamarpc.com
CONTRACT_ADDRESS=0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f
```

### Step 3: Custom Domain Setup
1. In Vercel dashboard, go to your project
2. Navigate to "Settings" → "Domains"
3. Add `travelnft.vercel.app` domain
4. Or set up your custom domain

### Step 4: Build Configuration
Vercel will automatically detect:
- ✅ Frontend: Vite React app
- ✅ Backend: Serverless functions in /api
- ✅ Build command: `npm run build`
- ✅ Output directory: `dist/public`

### Step 5: Database Connection
Ensure your Neon database is properly configured:
- Database should allow connections from any IP (0.0.0.0/0)
- Connection string should be in `DATABASE_URL` environment variable

## 🔧 Files Created for Vercel:
- ✅ `vercel.json` - Vercel configuration
- ✅ `api/index.ts` - Serverless function entry point
- ✅ `.vercelignore` - Files to ignore during deployment
- ✅ Updated HTML with correct domain references

## 🌍 Expected Result:
After successful deployment, TravelMint will be available at:
`https://travelnft.vercel.app`

## 🛠 Troubleshooting:
- Check Vercel build logs for any errors
- Verify all environment variables are set correctly
- Ensure database connection string is valid
- Check API endpoints are working: `/api/health`
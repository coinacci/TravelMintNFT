import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";

export function createApp() {
  const app = express();

  // Body parsers
  app.use(express.json({ limit: '50mb' })); // Increased limit for image uploads
  app.use(express.urlencoded({ extended: false, limit: '50mb' }));

  // HIGH PRIORITY: Farcaster manifest route MUST be first to avoid Vite/static interception
  app.get("/.well-known/farcaster.json", (req, res) => {
    console.log("🎯 HIGH PRIORITY FARCASTER ROUTE HIT!", Date.now());
    const currentTimestamp = Date.now();
    const cacheBuster = `?v=${currentTimestamp}&force=${Math.random().toString(36).substring(7)}`;
    const farcasterConfig = {
      "accountAssociation": {
        "header": "eyJmaWQiOjI5MDY3MywidHlwZSI6ImF1dGgiLCJrZXkiOiIweGUwMkUyNTU3YkI4MDdDZjdFMzBDZUY4YzMxNDY5NjNhOGExZDQ0OTYifQ",
        "payload": "eyJkb21haW4iOiJ0cmF2ZWxuZnQucmVwbGl0LmFwcCJ9",
        "signature": "kg4rxkbZvopVgro4b/DUJA+wA26XlSBNv/GaAT6X0DcB5ZRqpJFIvWbA5EJ8jQZ5y+oM3JaWfjLqY9qDqSTKFxs="
      },
      "miniapp": {
        "version": "1",
        "name": "TravelMint",
        "author": "coinacci",
        "authorUrl": "https://warpcast.com/coinacci",
        "description": "Mint, buy, and sell location-based travel photo NFTs. Create unique travel memories on the blockchain with GPS coordinates and discover NFTs on an interactive map.",
        "iconUrl": `https://travelnft.replit.app/logo.jpeg${cacheBuster}`,
        "homeUrl": "https://travelnft.replit.app/",
        "imageUrl": `https://travelnft.replit.app/logo.jpeg${cacheBuster}`,
        "splashImageUrl": `https://travelnft.replit.app/logo.jpeg${cacheBuster}`,
        "splashBackgroundColor": "#0f172a",
        "subtitle": "Travel Photo NFT Marketplace",
        "heroImageUrl": `https://travelnft.replit.app/logo.jpeg${cacheBuster}`,
        "tagline": "Turn travel into NFTs",
        "ogTitle": "TravelMint NFT App",
        "ogDescription": "Mint, buy, and sell location-based travel photo NFTs on Base blockchain",
        "ogImageUrl": `https://travelnft.replit.app/logo.jpeg${cacheBuster}`,
        "castShareUrl": `https://travelnft.replit.app/share${cacheBuster}`,
        "webhookUrl": "https://api.neynar.com/f/app/968f2785-2da9-451a-a984-d753e739713c/event",
        "license": "MIT",
        "privacyPolicyUrl": "https://travelnft.replit.app/privacy",
        "tags": ["travel", "nft", "blockchain", "photography", "base"],
        "screenshotUrls": [
          `https://travelnft.replit.app/logo.jpeg${cacheBuster}`,
          `https://travelnft.replit.app/logo.jpeg${cacheBuster}`
        ],
        "noindex": false,
        "primaryCategory": "productivity"
      },
      "baseBuilder": {
        "allowedAddresses": ["0x7F397c837b9B67559E3cFfaEceA4a2151c05b548"]
      }
    };

    // Extreme cache invalidation headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('ETag', `"v${currentTimestamp}"`);
    res.setHeader('Last-Modified', new Date().toUTCString());
    res.setHeader('X-Timestamp', currentTimestamp.toString());
    res.setHeader('X-Cache-Buster', cacheBuster);
    res.setHeader('X-Farcaster-Version', `3.${currentTimestamp}`);
    res.setHeader('X-Debug', 'HIGH-PRIORITY-ROUTE');
    res.send(JSON.stringify(farcasterConfig, null, 2));
  });

  // Enhanced CORS setup for browser extension compatibility
  app.use((req, res, next) => {
    // Allow all origins for development (browser extensions need this)
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
    res.header('Access-Control-Allow-Credentials', 'false'); // Set to false when using wildcard origin
    
    // Security headers - Allow Farcaster embedding while maintaining security
    // X-Frame-Options removed to allow Farcaster iframe embedding
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Content Security Policy - ALLOW ALL ORIGINS for Farcaster embedding + Google Fonts CORS fix
    res.header('Content-Security-Policy', [
      "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' chrome-extension: moz-extension: safari-extension: https: data: blob:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https: data:",
      "font-src 'self' https://fonts.gstatic.com https: data:",
      "img-src 'self' data: https: http: chrome-extension: moz-extension: safari-extension: blob:",
      "connect-src 'self' https: http: wss: ws: chrome-extension: moz-extension: safari-extension: data: blob:",
      "frame-src 'self' chrome-extension: moz-extension: safari-extension: https: data:",
      "frame-ancestors *",
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https:"
    ].join('; '));
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    
    next();
  });

  // Important: Block server.listen in serverless environment
  if (process.env.VERCEL) {
    console.log('🔧 Running in Vercel serverless mode - skipping server setup');
    // Just register routes for serverless
    registerRoutes(app);
  }

  return app;
}
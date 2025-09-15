import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// HIGH PRIORITY: Farcaster manifest route MUST be first to avoid Vite/static interception
app.get("/.well-known/farcaster.json", (req, res) => {
  console.log("🎯 HIGH PRIORITY FARCASTER ROUTE HIT!", Date.now());
  const currentTimestamp = Date.now();
  const cacheBuster = `?v=${currentTimestamp}`;
  const farcasterConfig = {
    "accountAssociation": {
      "header": "eyJmaWQiOjI5MDY3MywidHlwZSI6ImF1dGgiLCJrZXkiOiIweGUwMkUyNTU3YkI4MDdDZjdFMzBDZUY4YzMxNDY5NjNhOGExZDQ0OTYifQ",
      "payload": "eyJkb21haW4iOiJ0cmF2ZWxuZnQucmVwbGl0LmFwcCJ9",
      "signature": "kg4rxkbZvopVgro4b/DUJA+wA26XlSBNv/GaAT6X0DcB5ZRqpJFIvWbA5EJ8jQZ5y+oM3JaWfjLqY9qDqSTKFxs="
    },
    "miniapp": {
      "version": `3.${currentTimestamp}`,
      "name": "TravelMint",
      "description": "Mint, buy, and sell location-based travel photo NFTs. Create unique travel memories on the blockchain with GPS coordinates and discover NFTs on an interactive map.",
      "iconUrl": `https://travelnft.replit.app/icon.png${cacheBuster}`,
      "homeUrl": `https://travelnft.replit.app/${cacheBuster}`,
      "imageUrl": `https://travelnft.replit.app/image.png${cacheBuster}`,
      "splashImageUrl": `https://travelnft.replit.app/splash.png${cacheBuster}`,
      "splashBackgroundColor": "#0f172a",
      "subtitle": "Travel Photo NFT Marketplace",
      "heroImageUrl": `https://travelnft.replit.app/image.png${cacheBuster}`,
      "tagline": "Turn travel into NFTs",
      "ogTitle": "TravelMint NFT App",
      "ogDescription": "Mint, buy, and sell location-based travel photo NFTs on Base blockchain",
      "ogImageUrl": `https://travelnft.replit.app/image.png${cacheBuster}`,
      "castShareUrl": `https://travelnft.replit.app/share${cacheBuster}`,
      "webhookUrl": "https://travelnft.replit.app/api/webhook",
      "tags": ["travel", "nft", "blockchain", "photography", "base"],
      "screenshotUrls": [
        `https://travelnft.replit.app/image.png${cacheBuster}`,
        `https://travelnft.replit.app/splash.png${cacheBuster}`
      ],
      "noindex": false,
      "primaryCategory": "social"
    },
    "frame": {
      "version": `3.${currentTimestamp}`,
      "name": "TravelMint",
      "subtitle": "Travel Photo NFT Marketplace",
      "description": "Mint, buy, and sell location-based travel photo NFTs. Create unique travel memories on the blockchain with GPS coordinates and discover NFTs on an interactive map.",
      "iconUrl": `https://travelnft.replit.app/icon.png${cacheBuster}`,
      "homeUrl": `https://travelnft.replit.app${cacheBuster}`,
      "imageUrl": `https://travelnft.replit.app/image.png${cacheBuster}`,
      "heroImageUrl": `https://travelnft.replit.app/image.png${cacheBuster}`,
      "splashImageUrl": `https://travelnft.replit.app/splash.png${cacheBuster}`,
      "splashBackgroundColor": "#0f172a",
      "webhookUrl": "https://travelnft.replit.app/api/webhook",
      "tagline": "Turn travel into NFTs",
      "screenshotUrls": [
        `https://travelnft.replit.app/image.png${cacheBuster}`,
        `https://travelnft.replit.app/splash.png${cacheBuster}`
      ],
      "ogTitle": "TravelMint NFT App",
      "ogDescription": "Mint, buy, and sell location-based travel photo NFTs on Base blockchain",
      "ogImageUrl": `https://travelnft.replit.app/image.png${cacheBuster}`,
      "castShareUrl": `https://travelnft.replit.app/share${cacheBuster}`,
      "tags": ["travel", "nft", "blockchain", "photography", "base"],
      "noindex": false,
      "primaryCategory": "social"
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
  
  // Content Security Policy - ALLOW ALL ORIGINS for Farcaster embedding
  res.header('Content-Security-Policy', [
    "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' chrome-extension: moz-extension: safari-extension: https: data: blob:",
    "style-src 'self' 'unsafe-inline' https: data:",
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

app.use(express.json({ limit: '50mb' })); // Increased limit for image uploads
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Serve attached assets statically with optimized headers
app.use('/attached_assets', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
}, express.static('attached_assets', {
  maxAge: '1d', // Cache for 1 day
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.jpeg') || path.endsWith('.jpg') || path.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable'); // Aggressive caching
      res.setHeader('Accept-Ranges', 'bytes'); // Enable partial content for faster loading
    }
  }
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();

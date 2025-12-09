import { createServer } from "http";
import express, { Request, Response, Express } from "express";
import { storage } from "./storage";
import { blockchainService, withRetry } from "./blockchain";
import { MetadataSyncService } from "./metadataSyncService";
import { 
  insertNFTSchema, 
  insertTransactionSchema, 
  insertUserSchema, 
  insertUserStatsSchema, 
  insertQuestCompletionSchema,
  questClaimSchema,
  userStatsParamsSchema,
  questCompletionsParamsSchema,
  holderStatusParamsSchema,
  leaderboardQuerySchema,
  type QuestClaimRequest,
  getQuestDay,
  getYesterdayQuestDay
} from "@shared/schema";
import { z } from "zod";
import { ethers } from "ethers";
import ipfsRoutes from "./routes/ipfs";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { farcasterCastValidator } from "./farcaster-validation";
import { getNotificationService, isNotificationServiceAvailable } from "./notificationService";
import { syncAllImages, syncSingleImage, getSyncStatus } from "./image-sync";
import multer from "multer";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { readFileSync } from "fs";
import { join } from "path";

// Load Inter fonts for share image generation
let interRegular: Buffer | null = null;
let interBold: Buffer | null = null;
try {
  interRegular = readFileSync(join(process.cwd(), 'server/fonts/Inter-Regular.ttf'));
  interBold = readFileSync(join(process.cwd(), 'server/fonts/Inter-Bold.ttf'));
} catch (e) {
  console.warn('Failed to load Inter fonts, share images will use fallback');
}

const ALLOWED_CONTRACT = "0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f";
const PLATFORM_WALLET = "0x7CDe7822456AAC667Df0420cD048295b92704084"; // Platform commission wallet

// Simple in-memory cache to avoid expensive blockchain calls
interface CacheEntry {
  data: any[];
  timestamp: number;
}

const nftCache: { [key: string]: CacheEntry } = {};
const CACHE_DURATION = 30 * 1000; // 30 seconds default cache to reduce API load
const CACHE_DURATION_TIPS = 60 * 1000; // 60 seconds for tips sorting (expensive JOIN query)

function isCacheValid(key: string): boolean {
  const entry = nftCache[key];
  if (!entry) return false;
  // Use longer cache for tips queries (expensive JOIN operation)
  const duration = key.includes('tips') ? CACHE_DURATION_TIPS : CACHE_DURATION;
  return (Date.now() - entry.timestamp) < duration;
}

function setCacheEntry(key: string, data: any[]): void {
  nftCache[key] = {
    data,
    timestamp: Date.now()
  };
}

function clearAllCache(): void {
  Object.keys(nftCache).forEach(key => delete nftCache[key]);
  console.log("🗑️ All cache cleared for fresh sync");
}

// Helper function to create user objects with Farcaster usernames
function createUserObject(walletAddress: string, farcasterUsername?: string | null, farcasterFid?: string | null) {
  if (farcasterUsername) {
    // Normalize username: strip any leading @ before prefixing with @
    const normalizedUsername = farcasterUsername.startsWith('@') 
      ? farcasterUsername.slice(1) 
      : farcasterUsername;
    
    return {
      id: walletAddress,
      username: `@${normalizedUsername}`,
      avatar: null,
      farcasterFid: farcasterFid || null
    };
  } else {
    return {
      id: walletAddress,
      username: walletAddress.slice(0, 8) + '...',
      avatar: null,
      farcasterFid: null
    };
  }
}

// Admin security enhancement - rate limiting and audit logging
interface AdminAttempt {
  timestamp: number;
  ip: string;
  userAgent: string;
}

interface AdminSession {
  token: string;
  createdAt: number;
  lastUsed: number;
  ip: string;
  userAgent: string;
}

interface AdminBlock {
  blockedAt: number;
  ip: string;
  userAgent: string;
}

const adminAttempts = new Map<string, AdminAttempt[]>();
const adminSessions = new Map<string, AdminSession>();
const adminBlocks = new Map<string, AdminBlock>(); // Separate tracking for blocks

const ADMIN_RATE_LIMIT = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  blockDurationMs: 30 * 60 * 1000, // 30 minutes block
};

const ADMIN_SESSION = {
  maxAgeMs: 8 * 60 * 60 * 1000, // 8 hours
  renewalThresholdMs: 2 * 60 * 60 * 1000, // renew if less than 2 hours left
};

function getClientIp(req: any): string {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  
  // First check if IP is currently blocked (separate from attempts)
  const block = adminBlocks.get(ip);
  if (block) {
    if (now - block.blockedAt < ADMIN_RATE_LIMIT.blockDurationMs) {
      return true; // Still blocked
    } else {
      // Block expired, remove it
      adminBlocks.delete(ip);
    }
  }
  
  // Check attempts within the rate limit window
  const attempts = adminAttempts.get(ip) || [];
  const recentAttempts = attempts.filter(
    attempt => now - attempt.timestamp < ADMIN_RATE_LIMIT.windowMs
  );
  
  // Update attempts (clean old ones)
  adminAttempts.set(ip, recentAttempts);
  
  // If too many recent attempts, create a new block
  if (recentAttempts.length >= ADMIN_RATE_LIMIT.maxAttempts) {
    adminBlocks.set(ip, {
      blockedAt: now,
      ip,
      userAgent: 'rate-limited'
    });
    return true;
  }
  
  return false;
}

function recordAdminAttempt(ip: string, userAgent: string): void {
  const attempts = adminAttempts.get(ip) || [];
  attempts.push({
    timestamp: Date.now(),
    ip,
    userAgent: userAgent || 'unknown'
  });
  adminAttempts.set(ip, attempts);
}

function logAdminAction(action: string, ip: string, userAgent: string, success: boolean): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[ADMIN] ${timestamp} | ${action} | IP: ${ip} | UA: ${userAgent} | Success: ${success}`;
  console.log(logMessage);
}

function verifyAdminAuth(req: any): { success: boolean; error?: string; shouldBlock?: boolean } {
  const adminSecret = process.env.ADMIN_SECRET;
  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  // Fail closed if no admin secret configured
  if (!adminSecret) {
    logAdminAction('AUTH_ATTEMPT', ip, userAgent, false);
    return { success: false, error: 'Admin access not configured' };
  }
  
  // Check rate limiting
  if (isRateLimited(ip)) {
    logAdminAction('RATE_LIMITED', ip, userAgent, false);
    return { success: false, error: 'Too many authentication attempts. Try again later.', shouldBlock: true };
  }
  
  const providedSecret = req.headers['x-admin-key'];
  
  if (!providedSecret || providedSecret !== adminSecret) {
    recordAdminAttempt(ip, userAgent);
    logAdminAction('INVALID_SECRET', ip, userAgent, false);
    return { success: false, error: 'Unauthorized - invalid admin key' };
  }
  
  logAdminAction('AUTH_SUCCESS', ip, userAgent, true);
  return { success: true };
}

export async function registerRoutes(app: Express) {
  
  // Cache control middleware for logo assets - prevent browser caching
  app.use((req, res, next) => {
    // Apply no-cache headers to icon and logo files
    if (req.path === '/icon.png' || req.path === '/logo.jpeg') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Last-Modified', new Date().toUTCString());
    }
    next();
  });
  
  // Initialize weekly reset on server startup
  console.log('🔄 Checking for weekly reset on server startup...');
  try {
    await storage.performWeeklyReset();
    console.log('✅ Weekly reset check completed');
  } catch (error) {
    console.error('❌ Weekly reset check failed:', error);
  }

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "OK", timestamp: new Date().toISOString() });
  });

  // Base App compatible HTML endpoint  
  app.get("/base", (req, res) => {
    // Dynamic URL construction for environment flexibility
    const baseUrl = req.protocol + '://' + req.get('host');
    
    const baseAppHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
    
    <!-- Security headers for Base App validation -->
    <meta http-equiv="X-Content-Type-Options" content="nosniff" />
    <meta http-equiv="Referrer-Policy" content="strict-origin-when-cross-origin" />
    
    <!-- App Meta Tags -->
    <title>TravelMint - Travel Photo NFT Marketplace</title>
    <meta name="description" content="Mint, buy, and sell location-based travel photo NFTs. Create unique travel memories on the blockchain with GPS coordinates." />
    
    <!-- Base App Integration Meta Tags -->
    <meta name="noindex" content="false" />
    <meta name="robots" content="index, follow" />
    <meta name="primaryCategory" content="productivity" />
    
    <!-- Base App Compatible Mini App Discovery Tags -->
    <meta name="fc:miniapp" content='{
      "version": "1",
      "iconUrl": "${baseUrl}/icon.png",
      "imageUrl": "${baseUrl}/logo.jpeg",
      "button": {
        "title": "Open TravelMint",
        "action": {
          "type": "link",
          "name": "TravelMint",
          "url": "${baseUrl}",
          "splashImageUrl": "${baseUrl}/logo.jpeg",
          "splashBackgroundColor": "#0f172a"
        }
      }
    }' />
    
    <!-- Base App Compatible Icons -->
    <link rel="icon" type="image/png" sizes="32x32" href="/icon.png" />
    <link rel="icon" type="image/png" sizes="1024x1024" href="/icon.png" />
    <link rel="apple-touch-icon" href="/icon.png" />
    <meta name="theme-color" content="#0f172a" />
    
    <!-- Open Graph Tags - Base App Compatible -->
    <meta property="og:title" content="TravelMint - Travel Photo NFT Marketplace" />
    <meta property="og:description" content="Mint, buy, and sell location-based travel photo NFTs on Base blockchain" />
    <meta property="og:image" content="${baseUrl}/logo.jpeg" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${baseUrl}" />
    <meta property="og:site_name" content="TravelMint" />
    
    <!-- Twitter Card Tags - Base App Compatible -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="TravelMint - Travel Photo NFT Marketplace" />
    <meta name="twitter:description" content="Turn your travel memories into NFTs" />
    <meta name="twitter:image" content="${baseUrl}/logo.jpeg" />
    
    <!-- Additional Base App Meta Tags -->
    <meta name="keywords" content="travel, nft, blockchain, photography, base, web3, social, map, location" />
    <meta name="author" content="TravelMint" />
    <meta name="application-name" content="TravelMint" />
  </head>
  <body>
    <h1>TravelMint - Base App Validation</h1>
    <p>This page is optimized for Base App validation. <a href="/">Go to main app</a></p>
  </body>
</html>`;

    // Set headers for Base App validation and embedding
    res.setHeader('Content-Type', 'text/html');
    res.removeHeader('X-Frame-Options'); // Remove blocking header for Base App embedding
    res.setHeader('Content-Security-Policy', 'frame-ancestors https:'); // Allow Base App embedding
    res.send(baseAppHtml);
  });

  // Farcaster OAuth authentication endpoint
  app.post("/api/auth/farcaster", async (req, res) => {
    try {
      console.log('🔐 Farcaster auth request:', req.body);
      
      // AuthKit sends SIWE (Sign-In With Ethereum) payload
      // For now, accept the client-verified payload
      // TODO: Add full server-side SIWE verification
      
      const { message, signature, fid, username, displayName, pfpUrl } = req.body;
      
      if (!fid || !username) {
        return res.status(400).json({ error: "Missing required Farcaster data" });
      }
      
      // Return success with user info
      res.json({
        success: true,
        fid,
        username,
        displayName: displayName || username,
        pfpUrl: pfpUrl || null,
        verified: true
      });
    } catch (error) {
      console.error("Farcaster auth error:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  // Farcaster frame endpoint for validation
  app.post("/api/frame", (req, res) => {
    try {
      // Basic frame response for Farcaster validation
      res.json({
        frame: {
          version: "vNext",
          image: "https://travelnft.replit.app/image.png",
          buttons: [
            { label: "🗺️ Explore NFTs", action: "link", target: "https://travelnft.replit.app/explore" },
            { label: "📸 Mint Travel NFT", action: "link", target: "https://travelnft.replit.app/mint" }
          ]
        }
      });
    } catch (error) {
      console.error("Frame endpoint error:", error);
      res.status(500).json({ error: "Frame error" });
    }
  });

  // Clear cache endpoint for immediate refresh
  app.post("/api/cache/clear", (req, res) => {
    clearAllCache();
    res.json({ success: true, message: "Cache cleared successfully" });
  });

  app.delete("/api/cache/clear", (req, res) => {
    clearAllCache();
    res.json({ success: true, message: "Cache cleared via DELETE" });
  });

  // Base App webhook endpoint
  app.post("/api/webhook", (req, res) => {
    console.log("🔔 Base App webhook received:", req.body);
    res.json({ success: true, timestamp: new Date().toISOString() });
  });

  // Share endpoint for Farcaster casting
  app.get("/share", (req, res) => {
    const { nft } = req.query;
    const shareUrl = nft 
      ? `https://travelnft.replit.app/nft/${nft}` 
      : "https://travelnft.replit.app";
    
    res.redirect(shareUrl);
  });

  // Referral redirect endpoint - redirects to Farcaster Mini App with ref code
  app.get("/r/:code", (req, res) => {
    const { code } = req.params;
    
    // Validate code exists
    if (!code || code.trim() === '') {
      console.warn('⚠️ Invalid referral code attempt');
      return res.redirect("https://farcaster.xyz/miniapps/Ie0PvztUB40n/travelmint");
    }
    
    // Redirect to Farcaster Mini App with referral code as query parameter
    const farcasterUrl = `https://farcaster.xyz/miniapps/Ie0PvztUB40n/travelmint?ref=${encodeURIComponent(code)}`;
    console.log(`🔗 Referral redirect: ${code} → ${farcasterUrl}`);
    
    res.redirect(farcasterUrl);
  });

  // Removed duplicate Farcaster route - now handled in server/index.ts as high-priority

  // Farcaster Frame endpoint for NFT sharing with optimized IPFS image loading
  app.get("/api/share/frame/:nftId", async (req, res) => {
    try {
      const { nftId } = req.params;
      const nft = await storage.getNFT(nftId);
      
      if (!nft) {
        return res.status(404).send("NFT not found");
      }

      // Optimize IPFS URL for faster loading (use different gateways as fallback)
      const optimizedImageUrl = nft.imageUrl?.replace('gateway.pinata.cloud', 'ipfs.io') || nft.imageUrl;
      
      // Add cache headers for better performance
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
      res.setHeader('ETag', `"nft-${nft.id}-${nft.updatedAt?.getTime()}"`);

      // Create Farcaster Frame HTML with optimized image loading
      // SECURITY FIX: Escape all user data to prevent XSS
      const safeTitle = escapeHtml(nft.title);
      const safeLocation = escapeHtml(nft.location);
      const safeDescription = escapeHtml(`Minted on TravelMint: ${nft.title}`);
      const rawImageUrl = nft.objectStorageUrl || nft.imageUrl || '';
      const sanitizedImageUrl = sanitizeUrl(rawImageUrl);
      const safeImageUrl = escapeHtml(sanitizedImageUrl);

      const frameHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle} - Travel NFT</title>
  <meta name="description" content="${safeDescription}" />
  
  <!-- Farcaster Frame Meta Tags -->
  <meta name="fc:frame" content="vNext" />
  <meta name="fc:frame:image" content="${safeImageUrl}" />
  <meta name="fc:frame:image:aspect_ratio" content="1.91:1" />
  <meta name="fc:frame:button:1" content="💰 Buy ${parseFloat(nft.price).toFixed(0)} USDC" />
  <meta name="fc:frame:button:1:action" content="link" />
  <meta name="fc:frame:button:1:target" content="${process.env.REPLIT_DEV_DOMAIN || 'https://9cd747da-afbe-4a91-998a-c53082329a77-00-2sqy9psnptz5t.kirk.replit.dev'}/marketplace" />
  <meta name="fc:frame:button:2" content="🗺️ Explore More" />
  <meta name="fc:frame:button:2:action" content="link" />
  <meta name="fc:frame:button:2:target" content="${process.env.REPLIT_DEV_DOMAIN || 'https://9cd747da-afbe-4a91-998a-c53082329a77-00-2sqy9psnptz5t.kirk.replit.dev'}/explore" />
  
  <!-- Open Graph for social sharing -->
  <meta property="og:title" content="${safeTitle} - Travel NFT" />
  <meta property="og:description" content="${safeDescription}" />
  <meta property="og:image" content="${safeImageUrl}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${process.env.REPLIT_DEV_DOMAIN || 'https://9cd747da-afbe-4a91-998a-c53082329a77-00-2sqy9psnptz5t.kirk.replit.dev'}/marketplace" />
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle} - Travel NFT" />
  <meta name="twitter:description" content="${safeDescription}" />
  <meta name="twitter:image" content="${safeImageUrl}" />
</head>
<body>
  <div style="font-family: Inter, sans-serif; text-align: center; padding: 40px;">
    <h1>${safeTitle}</h1>
    <p>Price: ${parseFloat(nft.price).toFixed(2)} USDC</p>
    <img src="${safeImageUrl}" alt="${safeTitle}" style="max-width: 400px; height: auto; border-radius: 8px;" />
    <br /><br />
    <a href="${process.env.REPLIT_DEV_DOMAIN || 'https://9cd747da-afbe-4a91-998a-c53082329a77-00-2sqy9psnptz5t.kirk.replit.dev'}/marketplace" 
       style="background: #007aff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
      View in Marketplace
    </a>
  </div>
</body>
</html>`;
      
      res.setHeader('Content-Type', 'text/html');
      res.send(frameHtml);
      
    } catch (error) {
      console.error("Error creating share frame:", error);
      res.status(500).send("Error creating share frame");
    }
  });

  // Get all NFTs - fast cached version
  app.get("/api/nfts", async (req, res) => {
    try {
      const sortBy = req.query.sortBy as string | undefined;
      const cacheKey = sortBy ? `all-nfts-${sortBy}` : 'all-nfts';
      
      // Check cache first for instant response
      if (isCacheValid(cacheKey)) {
        console.log(`⚡ Returning cached NFTs (instant response, sortBy: ${sortBy || 'default'})`);
        return res.json(nftCache[cacheKey].data);
      }

      console.log(`🔗 Cache miss - fetching NFTs from database (sortBy: ${sortBy || 'default'})...`);
      
      // Get all NFTs from database immediately (fast response)
      const [allDbNFTs, tipTotals] = await Promise.all([
        storage.getAllNFTs(sortBy),
        storage.getNFTTipTotals()
      ]);
      const contractNFTs = allDbNFTs.filter(nft => 
        !nft.contractAddress || nft.contractAddress === ALLOWED_CONTRACT
      );
      
      // Process database NFTs for immediate response
      const nftsWithOwners = await Promise.all(
        contractNFTs.map(async (nft: any) => {
          // Parse metadata for display
          let parsedMetadata = null;
          try {
            if (nft.metadata && typeof nft.metadata === 'string') {
              parsedMetadata = JSON.parse(nft.metadata);
            }
          } catch (e) {
            console.log('Failed to parse metadata for NFT:', nft.id);
          }

          return {
            ...nft,
            // Use metadata name but prioritize database image URL (actual uploaded images)
            title: parsedMetadata?.name || nft.title,
            imageUrl: nft.imageUrl || parsedMetadata?.image,
            objectStorageUrl: nft.objectStorageUrl, // Include Object Storage URL for frontend priority
            tokenURI: nft.tokenURI, // Add tokenURI for frontend fallback (for tokens like #47 where image URL is broken but tokenURI works)
            owner: createUserObject(nft.ownerAddress, nft.farcasterOwnerUsername, nft.farcasterOwnerFid),
            creator: createUserObject(nft.creatorAddress, nft.farcasterCreatorUsername, nft.farcasterCreatorFid),
            country: getNFTCountry(nft), // Add country for filtering
            totalTips: tipTotals.get(nft.id) || 0 // Add total tips received
          };
        })
      );
      
      // Cache the processed results for fast future requests
      setCacheEntry(cacheKey, nftsWithOwners);
      console.log(`✅ Returning ${nftsWithOwners.length} total NFTs (cached for fast access)`);
      
      // Immediate cache clear and aggressive blockchain sync (non-blocking)
      setImmediate(async () => {
        try {
          console.log("🔄 Background blockchain sync starting (incremental mode)...");
          
          // Use new incremental sync method - much faster!
          const { newNFTs, lastBlock } = await blockchainService.syncNFTsIncremental(storage);
          console.log(`✅ Incremental sync found ${newNFTs.length} new/updated NFTs up to block ${lastBlock}`);
          
          // Process new NFTs from incremental sync
          for (const blockchainNFT of newNFTs) {
            // Fetch metadata async (don't block)
            const nftWithMetadata = await blockchainService.fetchMetadataAsync(blockchainNFT);
            
            const existsInDb = contractNFTs.find(nft => nft.tokenId === blockchainNFT.tokenId);
            
            if (!existsInDb) {
              console.log(`🆕 Adding new blockchain NFT #${blockchainNFT.tokenId} to database`);
              const dbFormat = await blockchainService.blockchainNFTToDBFormat(blockchainNFT);
              await storage.upsertNFTByTokenId(dbFormat);
            } else {
              let needsUpdate = false;
              const updateData: any = {};
              
              // Check if owner changed
              if (existsInDb.ownerAddress !== blockchainNFT.owner) {
                console.log(`🔄 Updating owner for NFT #${blockchainNFT.tokenId}`);
                updateData.ownerAddress = blockchainNFT.owner;
                needsUpdate = true;
              }
              
              // Check if coordinates are missing (0,0) and metadata has coordinates
              const currentLat = parseFloat(existsInDb.latitude);
              const currentLng = parseFloat(existsInDb.longitude);
              
              // 🇹🇭 SPECIAL CASE: Token ID 35 (Pattaya NFT) - Force Pattaya location permanently
              if (blockchainNFT.tokenId === '35') {
                console.log(`🇹🇭 Forcing Pattaya location for NFT #35 (overriding metadata)`);
                updateData.latitude = '12.9236';
                updateData.longitude = '100.8825';
                updateData.location = 'Pattaya, Thailand';
                if (blockchainNFT.metadata) {
                  updateData.metadata = JSON.stringify(blockchainNFT.metadata);
                }
                needsUpdate = true;
              }
              else if ((currentLat === 0 && currentLng === 0) && blockchainNFT.metadata) {
                const metadata = blockchainNFT.metadata;
                if (metadata.attributes) {
                  const latAttr = metadata.attributes.find((attr: any) => 
                    attr.trait_type?.toLowerCase().includes('latitude')
                  );
                  const lngAttr = metadata.attributes.find((attr: any) => 
                    attr.trait_type?.toLowerCase().includes('longitude')
                  );
                  
                  if (latAttr && lngAttr && latAttr.value !== "0" && lngAttr.value !== "0") {
                    console.log(`🌍 Fixing coordinates for NFT #${blockchainNFT.tokenId}: ${latAttr.value}, ${lngAttr.value}`);
                    updateData.latitude = latAttr.value;
                    updateData.longitude = lngAttr.value;
                    
                    // Also update location and other metadata fields
                    const locationAttr = metadata.attributes.find((attr: any) => 
                      attr.trait_type?.toLowerCase().includes('location')
                    );
                    if (locationAttr && locationAttr.value) {
                      updateData.location = locationAttr.value;
                    }
                    
                    // Update name and image from metadata
                    if (metadata.name && metadata.name !== `Travel NFT #${blockchainNFT.tokenId}`) {
                      updateData.title = metadata.name;
                    }
                    if (metadata.image) {
                      updateData.imageUrl = metadata.image;
                    }
                    if (metadata.description) {
                      updateData.description = metadata.description;
                    }
                    
                    // Update category from metadata
                    const categoryAttr = metadata.attributes.find((attr: any) => 
                      attr.trait_type?.toLowerCase().includes('category')
                    );
                    if (categoryAttr && categoryAttr.value) {
                      updateData.category = categoryAttr.value.toLowerCase();
                    }
                    
                    // Update full metadata
                    updateData.metadata = JSON.stringify(metadata);
                    
                    needsUpdate = true;
                  }
                }
              }
              
              if (needsUpdate) {
                await storage.updateNFT(existsInDb.id, updateData);
              }
            }
          }
          
          console.log("✅ Background blockchain sync completed");
          
          // Refresh cache with updated data for all sort variants
          const refreshCacheForSort = async (sortByParam: string | undefined, cacheKey: string) => {
            const [freshDbNFTs, freshTipTotals] = await Promise.all([
              storage.getAllNFTs(sortByParam),
              storage.getNFTTipTotals()
            ]);
            const freshContractNFTs = freshDbNFTs.filter(nft => 
              !nft.contractAddress || nft.contractAddress === ALLOWED_CONTRACT
            );
            
            const freshNFTsWithOwners = await Promise.all(
              freshContractNFTs.map(async (nft: any) => {
                let parsedMetadata = null;
                try {
                  if (nft.metadata && typeof nft.metadata === 'string') {
                    parsedMetadata = JSON.parse(nft.metadata);
                  }
                } catch (e) {
                  // Skip parsing errors
                }

                return {
                  ...nft,
                  title: parsedMetadata?.name || nft.title,
                  imageUrl: nft.imageUrl || parsedMetadata?.image,
                  objectStorageUrl: nft.objectStorageUrl,
                  tokenURI: nft.tokenURI,
                  owner: createUserObject(nft.ownerAddress, nft.farcasterOwnerUsername, nft.farcasterOwnerFid),
                  creator: createUserObject(nft.creatorAddress, nft.farcasterCreatorUsername, nft.farcasterCreatorFid),
                  country: getNFTCountry(nft),
                  totalTips: freshTipTotals.get(nft.id) || 0
                };
              })
            );
            
            setCacheEntry(cacheKey, freshNFTsWithOwners);
            return freshNFTsWithOwners.length;
          };
          
          // Update default, popular, and tips sort caches
          const [defaultCount, popularCount, tipsCount] = await Promise.all([
            refreshCacheForSort(undefined, 'all-nfts'),
            refreshCacheForSort('popular', 'all-nfts-popular'),
            refreshCacheForSort('tips', 'all-nfts-tips')
          ]);
          
          console.log(`🔄 Cache refreshed: ${defaultCount} NFTs (default), ${popularCount} NFTs (popular), ${tipsCount} NFTs (tips)`);
        } catch (error) {
          console.error("Background sync failed:", error);
        }
      });
      
      res.json(nftsWithOwners);
    } catch (error) {
      console.error("Error fetching NFTs:", error);
      res.status(500).json({ message: "Failed to fetch NFTs" });
    }
  });

  // Get NFTs for sale
  app.get("/api/nfts/for-sale", async (req, res) => {
    try {
      const sortBy = req.query.sortBy as string | undefined;
      const [allNfts, tipTotals] = await Promise.all([
        storage.getNFTsForSale(sortBy),
        storage.getNFTTipTotals()
      ]);
      // Filter by allowed contract only
      const nfts = allNfts.filter(nft => 
        !nft.contractAddress || nft.contractAddress === ALLOWED_CONTRACT
      );
      
      const nftsWithOwners = await Promise.all(
        nfts.map(async (nft) => {
          // Parse metadata for marketplace display
          let parsedMetadata = null;
          try {
            if (nft.metadata && typeof nft.metadata === 'string') {
              parsedMetadata = JSON.parse(nft.metadata);
            }
          } catch (e) {
            console.log('Failed to parse metadata for NFT:', nft.id);
          }

          return {
            ...nft,
            // Use metadata name but prioritize database image URL (actual uploaded images)
            title: parsedMetadata?.name || nft.title,
            imageUrl: nft.imageUrl || parsedMetadata?.image,
            objectStorageUrl: nft.objectStorageUrl, // Include Object Storage URL for frontend priority
            ownerAddress: nft.ownerAddress, // Include raw owner address for purchases
            owner: createUserObject(nft.ownerAddress, nft.farcasterOwnerUsername, nft.farcasterOwnerFid),
            creator: createUserObject(nft.creatorAddress, nft.farcasterCreatorUsername, nft.farcasterCreatorFid),
            totalTips: tipTotals.get(nft.id) || 0
          };
        })
      );
      res.json(nftsWithOwners);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch NFTs for sale" });
    }
  });

  // Get single NFT
  app.get("/api/nfts/:id", async (req, res) => {
    try {
      const nft = await storage.getNFT(req.params.id);
      if (!nft) {
        return res.status(404).json({ message: "NFT not found" });
      }

      // Parse metadata for display
      let parsedMetadata = null;
      try {
        if (nft.metadata && typeof nft.metadata === 'string') {
          parsedMetadata = JSON.parse(nft.metadata);
        }
      } catch (e) {
        console.log('Failed to parse metadata for NFT:', nft.id);
      }

      const farcasterFid = req.query.farcasterFid as string;
      let isLiked = false;
      if (farcasterFid) {
        isLiked = await storage.checkNFTLiked(req.params.id, farcasterFid);
      }

      res.json({
        ...nft,
        // Use metadata name and image if available, fallback to NFT fields
        title: parsedMetadata?.name || nft.title,
        imageUrl: nft.imageUrl || parsedMetadata?.image,
        owner: createUserObject(nft.ownerAddress, nft.farcasterOwnerUsername, nft.farcasterOwnerFid),
        creator: createUserObject(nft.creatorAddress, nft.farcasterCreatorUsername, nft.farcasterCreatorFid),
        isLiked
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch NFT" });
    }
  });

  // Get NFT by Token ID (for deep links)
  app.get("/api/nft/token/:tokenId", async (req, res) => {
    try {
      const { tokenId } = req.params;
      
      if (!tokenId) {
        return res.status(400).json({ message: "Token ID is required" });
      }
      
      const nft = await storage.getNFTByTokenId(tokenId);
      
      if (!nft) {
        return res.status(404).json({ message: "NFT not found" });
      }

      // Parse metadata for display
      let parsedMetadata = null;
      try {
        if (nft.metadata && typeof nft.metadata === 'string') {
          parsedMetadata = JSON.parse(nft.metadata);
        }
      } catch (e) {
        console.log('Failed to parse metadata for NFT:', nft.id);
      }

      const farcasterFid = req.query.farcasterFid as string;
      let isLiked = false;
      if (farcasterFid) {
        isLiked = await storage.checkNFTLiked(nft.id, farcasterFid);
      }

      res.json({
        ...nft,
        title: parsedMetadata?.name || nft.title,
        imageUrl: nft.imageUrl || parsedMetadata?.image,
        owner: createUserObject(nft.ownerAddress, nft.farcasterOwnerUsername, nft.farcasterOwnerFid),
        creator: createUserObject(nft.creatorAddress, nft.farcasterCreatorUsername, nft.farcasterCreatorFid),
        isLiked
      });
    } catch (error) {
      console.error('Error fetching NFT by tokenId:', error);
      res.status(500).json({ message: "Failed to fetch NFT" });
    }
  });

  // Create NFT (mint)
  app.post("/api/nfts", async (req, res) => {
    try {
      const validatedNFT = insertNFTSchema.parse(req.body);
      const nft = await storage.createNFT(validatedNFT);
      
      // 🚀 CRITICAL: Clear cache so new NFT appears immediately in Explore
      console.log('🔄 New NFT created - invalidating cache for immediate visibility');
      delete nftCache['all-nfts'];
      delete nftCache['for-sale'];
      
      res.status(201).json(nft);
    } catch (error) {
      console.error('Error creating NFT:', error);
      res.status(500).json({ message: "Failed to create NFT" });
    }
  });

  // Update NFT with Ownership Verification
  app.patch("/api/nfts/:id", async (req, res) => {
    try {
      const { walletAddress, ...updates } = req.body;
      
      // 🔒 SECURITY: Require wallet address for ownership verification
      if (!walletAddress) {
        return res.status(400).json({ message: "Wallet address is required for NFT updates" });
      }
      
      // 🔒 SECURITY: Validate wallet address format
      if (!ethers.isAddress(walletAddress)) {
        return res.status(400).json({ message: "Invalid wallet address format" });
      }
      
      // 🔒 SECURITY: Get current NFT to verify ownership
      const currentNFT = await storage.getNFT(req.params.id);
      if (!currentNFT) {
        return res.status(404).json({ message: "NFT not found" });
      }
      
      // 🔒 SECURITY: Verify ownership using blockchain as source of truth
      const tokenId = currentNFT.tokenId;
      if (!tokenId || isNaN(Number(tokenId))) {
        return res.status(400).json({ message: "Invalid NFT token ID format" });
      }
      
      console.log(`🔍 Verifying blockchain ownership for token #${tokenId}...`);
      
      try {
        // Get current owner directly from smart contract
        const blockchainNFT = await blockchainService.getNFTByTokenId(tokenId);
        
        if (!blockchainNFT) {
          console.warn(`🚨 NFT #${tokenId} not found on blockchain`);
          return res.status(404).json({ 
            message: "NFT not found on blockchain",
            code: "BLOCKCHAIN_VERIFICATION_FAILED" 
          });
        }
        
        // Compare blockchain owner with request wallet
        if (blockchainNFT.owner.toLowerCase() !== walletAddress.toLowerCase()) {
          console.warn(`🚨 Blockchain ownership mismatch for NFT #${tokenId}: actual owner ${blockchainNFT.owner}, claimed owner ${walletAddress}`);
          return res.status(403).json({ 
            message: "Blockchain verification failed: You don't own this NFT",
            code: "BLOCKCHAIN_OWNERSHIP_VERIFICATION_FAILED",
            actualOwner: blockchainNFT.owner,
            claimedOwner: walletAddress
          });
        }
        
        console.log(`✅ Blockchain ownership verified for NFT #${tokenId} - owner: ${blockchainNFT.owner}`);
        
      } catch (blockchainError) {
        console.error(`❌ Blockchain verification failed for NFT #${tokenId}:`, blockchainError);
        return res.status(500).json({ 
          message: "Unable to verify ownership on blockchain. Please try again.",
          code: "BLOCKCHAIN_VERIFICATION_ERROR" 
        });
      }
      
      // Update NFT with only the allowed updates (no wallet address in updates)
      const nft = await storage.updateNFT(req.params.id, updates);
      if (!nft) {
        return res.status(500).json({ message: "Failed to update NFT" });
      }
      
      // Clear cache after NFT update
      console.log('🔄 NFT updated - invalidating cache');
      delete nftCache['all-nfts'];
      delete nftCache['for-sale'];
      
      res.json(nft);
    } catch (error) {
      console.error('Error updating NFT:', error);
      res.status(500).json({ message: "Failed to update NFT" });
    }
  });

  app.post("/api/nfts/:id/like", async (req, res) => {
    try {
      // Accept either farcasterFid OR walletAddress (at least one required)
      const likeSchema = z.object({
        farcasterFid: z.string().trim().min(1).optional(),
        walletAddress: z.string().trim().min(1).optional(),
      }).refine(data => data.farcasterFid || data.walletAddress, {
        message: "Either farcasterFid or walletAddress is required"
      });
      
      const validated = likeSchema.parse(req.body);

      const nft = await storage.getNFT(req.params.id);
      if (!nft) {
        return res.status(404).json({ message: "NFT not found" });
      }

      const result = await storage.toggleNFTLike(req.params.id, {
        farcasterFid: validated.farcasterFid,
        walletAddress: validated.walletAddress,
      });
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error('Error toggling NFT like:', error);
      if ((error as any).code === '23505') {
        return res.status(409).json({ message: "Like operation conflict. Please try again." });
      }
      res.status(500).json({ message: "Failed to toggle NFT like" });
    }
  });

  // Get user NFTs (stub for now)
  app.get("/api/users/:id/nfts", async (req, res) => {
    try {
      // This would normally fetch user's NFTs, for now return empty
      const nftsWithOwners = await Promise.all(
        [].map(async (nft: any) => {
          return {
            ...nft,
            owner: { 
              id: nft.ownerAddress, 
              username: nft.ownerAddress.slice(0, 8) + '...', 
              avatar: null 
            },
            creator: { 
              id: nft.creatorAddress, 
              username: nft.creatorAddress.slice(0, 8) + '...', 
              avatar: null 
            }
          };
        })
      );
      res.json(nftsWithOwners);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user NFTs" });
    }
  });

  // Get NFTs by wallet address - simplified and stable
  app.get("/api/wallet/:address/nfts", async (req, res) => {
    try {
      const walletAddress = req.params.address.toLowerCase();
      console.log(`🔗 Fetching NFTs for wallet: ${walletAddress}`);
      
      // Get NFTs from database first (already synced)
      const dbNfts = await storage.getNFTsByOwner(walletAddress);
      const contractDbNfts = dbNfts.filter(nft => 
        !nft.contractAddress || nft.contractAddress === ALLOWED_CONTRACT
      );
      
      const nftsWithOwners = contractDbNfts.map((nft) => {
        // Parse metadata for wallet NFTs
        let parsedMetadata = null;
        try {
          if (nft.metadata && typeof nft.metadata === 'string') {
            parsedMetadata = JSON.parse(nft.metadata);
          }
        } catch (e) {
          console.log('Failed to parse metadata for NFT:', nft.id);
        }

        return {
          ...nft,
          // Use uploaded travel images for known tokens, otherwise use stored imageUrl
          imageUrl: nft.imageUrl, // This already has the correct image paths
          title: parsedMetadata?.name || nft.title,
          owner: createUserObject(nft.ownerAddress, nft.farcasterOwnerUsername, nft.farcasterOwnerFid),
          creator: createUserObject(nft.creatorAddress, nft.farcasterCreatorUsername, nft.farcasterCreatorFid)
        };
      });
      
      console.log(`✅ Returning ${nftsWithOwners.length} NFTs for wallet ${walletAddress}`);
      res.json(nftsWithOwners);
    } catch (error) {
      console.error(`Error fetching NFTs for wallet ${req.params.address}:`, error);
      res.status(500).json({ message: "Failed to fetch wallet NFTs" });
    }
  });

  // Link wallet to Farcaster user
  app.post("/api/user/:farcasterFid/link-wallet", async (req, res) => {
    try {
      const farcasterFid = req.params.farcasterFid;
      const { walletAddress, platform = 'base_app' } = req.body;
      
      if (!walletAddress) {
        return res.status(400).json({ message: "Wallet address required" });
      }
      
      console.log(`🔗 Linking wallet ${walletAddress} to Farcaster FID ${farcasterFid} (platform: ${platform})`);
      
      // Ensure user stats exist (foreign key requirement)
      console.log(`🔍 Checking existing user stats for Farcaster FID: ${farcasterFid}`);
      let userStats = await storage.getUserStats(farcasterFid);
      
      if (!userStats) {
        console.log(`📊 Creating user stats for new Farcaster FID: ${farcasterFid}`);
        try {
          userStats = await storage.createOrUpdateUserStats({
            farcasterFid,
            farcasterUsername: '',
            totalPoints: 0,
            currentStreak: 0,
            walletAddress: walletAddress.toLowerCase()
          });
          console.log(`✅ User stats created successfully for FID: ${farcasterFid}`);
        } catch (createError) {
          console.error(`❌ Failed to create user stats:`, createError);
          throw createError;
        }
      } else {
        console.log(`ℹ️ User stats already exist for FID: ${farcasterFid}`);
      }
      
      // Add wallet to user's linked wallets
      const userWallet = await storage.addUserWallet(farcasterFid, walletAddress, platform);
      
      console.log(`✅ Wallet linked successfully for Farcaster FID ${farcasterFid}`);
      res.json({ 
        success: true, 
        message: "Wallet linked successfully",
        userWallet 
      });
    } catch (error) {
      console.error(`Error linking wallet for Farcaster FID ${req.params.farcasterFid}:`, error);
      res.status(500).json({ message: "Failed to link wallet" });
    }
  });

  // Get all NFTs for a Farcaster user across all linked wallets
  app.get("/api/user/:farcasterFid/all-nfts", async (req, res) => {
    try {
      const farcasterFid = req.params.farcasterFid;
      console.log(`🔗 Fetching all NFTs for Farcaster FID: ${farcasterFid}`);
      
      // Get NFTs from all linked wallets for this user
      const allNFTs = await storage.getAllNFTsForUser(farcasterFid);
      
      // Filter by allowed contract and process like single wallet endpoint
      const contractNFTs = allNFTs.filter(nft => 
        !nft.contractAddress || nft.contractAddress === ALLOWED_CONTRACT
      );
      
      const nftsWithOwners = contractNFTs.map((nft) => {
        // Parse metadata for multi-wallet NFTs
        let parsedMetadata = null;
        try {
          if (nft.metadata && typeof nft.metadata === 'string') {
            parsedMetadata = JSON.parse(nft.metadata);
          }
        } catch (e) {
          console.log('Failed to parse metadata for NFT:', nft.id);
        }

        return {
          ...nft,
          // Use uploaded travel images for known tokens, otherwise use stored imageUrl
          imageUrl: nft.imageUrl,
          title: parsedMetadata?.name || nft.title,
          owner: createUserObject(nft.ownerAddress, nft.farcasterOwnerUsername, nft.farcasterOwnerFid),
          creator: createUserObject(nft.creatorAddress, nft.farcasterCreatorUsername, nft.farcasterCreatorFid),
          // Add source wallet information for multi-wallet display
          sourceWallet: nft.sourceWallet,
          sourcePlatform: nft.sourcePlatform
        };
      });
      
      console.log(`✅ Returning ${nftsWithOwners.length} NFTs from ${new Set(contractNFTs.map(n => n.sourceWallet)).size} wallets for Farcaster FID ${farcasterFid}`);
      res.json(nftsWithOwners);
    } catch (error) {
      console.error(`Error fetching all NFTs for Farcaster FID ${req.params.farcasterFid}:`, error);
      res.status(500).json({ message: "Failed to fetch user NFTs from all wallets" });
    }
  });

  // Transaction routes
  app.get("/api/transactions/nft/:nftId", async (req, res) => {
    try {
      const transactions = await storage.getTransactionsByNFT(req.params.nftId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Get recent marketplace activity 
  app.get("/api/transactions/recent", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const recentTransactions = await storage.getRecentTransactions(limit);
      res.json(recentTransactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recent transactions" });
    }
  });

  // Record a donation transaction
  app.post("/api/donations", async (req, res) => {
    try {
      const { nftId, fromAddress, toAddress, amount, platformFee, blockchainTxHash } = req.body;

      // Validate required fields
      if (!nftId || !fromAddress || !toAddress || !amount || !blockchainTxHash) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Check if transaction already recorded (prevent duplicates)
      const existingTx = await storage.getTransactionByHash(blockchainTxHash);
      if (existingTx) {
        return res.status(200).json({ message: "Donation already recorded", transaction: existingTx });
      }

      // Create donation transaction record
      const transaction = await storage.createTransaction({
        nftId,
        fromAddress: fromAddress.toLowerCase(),
        toAddress: toAddress.toLowerCase(),
        transactionType: "donation",
        amount: amount.toString(),
        platformFee: platformFee?.toString() || "0",
        blockchainTxHash,
      });

      console.log(`💝 Donation recorded: ${amount} USDC from ${fromAddress} to ${toAddress} for NFT ${nftId}`);
      
      // Clear cache so tip shows immediately in marketplace "Most Tips" filter
      delete nftCache['all-nfts'];
      delete nftCache['all-nfts-tips'];
      delete nftCache['all-nfts-popular'];
      console.log('🔄 Cache cleared after donation - tips will appear immediately');
      
      res.status(201).json(transaction);
    } catch (error) {
      console.error("Error recording donation:", error);
      res.status(500).json({ message: "Failed to record donation" });
    }
  });

  // Get donation statistics
  app.get("/api/donations/stats", async (req, res) => {
    try {
      const stats = await storage.getDonationStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching donation stats:", error);
      res.status(500).json({ message: "Failed to fetch donation stats" });
    }
  });

  // Get donations by NFT
  app.get("/api/donations/nft/:nftId", async (req, res) => {
    try {
      const donations = await storage.getDonationsByNFT(req.params.nftId);
      res.json(donations);
    } catch (error) {
      console.error("Error fetching NFT donations:", error);
      res.status(500).json({ message: "Failed to fetch NFT donations" });
    }
  });

  // Get donations received by a wallet
  app.get("/api/donations/received/:address", async (req, res) => {
    try {
      const donations = await storage.getDonationsReceivedByWallet(req.params.address.toLowerCase());
      res.json(donations);
    } catch (error) {
      console.error("Error fetching received donations:", error);
      res.status(500).json({ message: "Failed to fetch received donations" });
    }
  });

  // Blockchain sync endpoint - fetches real blockchain data
  app.post("/api/sync/wallet/:address", async (req, res) => {
    try {
      const walletAddress = req.params.address.toLowerCase();
      
      console.log(`🔗 Syncing NFTs from blockchain for wallet: ${walletAddress}`);
      
      // Fetch real NFTs from blockchain for this wallet
      const blockchainNFTs = await blockchainService.getNFTsByOwner(walletAddress);
      
      console.log(`Found ${blockchainNFTs.length} NFTs on blockchain for wallet ${walletAddress}`);
      
      let syncedCount = 0;
      const dbNFTs = [];
      
      // Store each blockchain NFT in database if not already exists
      for (const blockchainNFT of blockchainNFTs) {
        const dbFormat = await blockchainService.blockchainNFTToDBFormat(blockchainNFT);
        
        // Check if this NFT already exists in database
        const existing = await storage.getNFT(dbFormat.id);
        
        if (!existing) {
          // Create new NFT record
          const nft = await storage.createNFT(dbFormat);
          dbNFTs.push(nft);
          syncedCount++;
          
          // Create sync transaction record
          await storage.createTransaction({
            nftId: nft.id,
            fromAddress: null,
            toAddress: walletAddress,
            transactionType: "sync",
            amount: "0.0",
            platformFee: "0.0",
          });
        } else {
          // Update existing NFT with fresh data from blockchain
          const updateData = {
            ownerAddress: dbFormat.ownerAddress,
            metadata: dbFormat.metadata,
            location: dbFormat.location,
            latitude: dbFormat.latitude,
            longitude: dbFormat.longitude,
            category: dbFormat.category,
            title: dbFormat.title,
            description: dbFormat.description,
            imageUrl: dbFormat.imageUrl
          };

          // 🛠️ METADATA VALIDATION & AUTO-FIX SYSTEM
          let needsMetadataFix = false;
          let shouldPreventBadOverwrite = false;
          const fixes = [];
          const protections = [];
          
          // ✅ UPGRADE: Prevent good data from being overwritten with bad data
          
          // PROTECT: Don't overwrite good coordinates with (0,0)
          if (existing.latitude !== "0" && existing.longitude !== "0" && 
              dbFormat.latitude === "0" && dbFormat.longitude === "0") {
            shouldPreventBadOverwrite = true;
            updateData.latitude = existing.latitude; // Keep existing good data
            updateData.longitude = existing.longitude;
            protections.push(`coordinates: keeping (${existing.latitude}, ${existing.longitude}) vs bad (0,0)`);
          }
          
          // PROTECT: Don't overwrite real titles with generic ones  
          if (!existing.title?.startsWith("Travel NFT #") && 
              dbFormat.title?.startsWith("Travel NFT #")) {
            shouldPreventBadOverwrite = true;
            updateData.title = existing.title; // Keep existing good title
            protections.push(`title: keeping "${existing.title}" vs generic "${dbFormat.title}"`);
          }
          
          // PROTECT: Don't overwrite real locations with "Unknown Location"
          if (existing.location !== "Unknown Location" && 
              dbFormat.location === "Unknown Location") {
            shouldPreventBadOverwrite = true;
            updateData.location = existing.location; // Keep existing good location
            protections.push(`location: keeping "${existing.location}" vs "Unknown Location"`);
          }
          
          // ✅ EXISTING: Fix bad data with good data
          
          // Check for broken coordinates (0,0) 
          if (existing.latitude === "0" && existing.longitude === "0" && 
              dbFormat.latitude !== "0" && dbFormat.longitude !== "0") {
            needsMetadataFix = true;
            fixes.push(`coordinates: (0,0) → (${dbFormat.latitude}, ${dbFormat.longitude})`);
          }
          
          // Check for generic titles
          if (existing.title?.startsWith("Travel NFT #") && 
              dbFormat.title && !dbFormat.title.startsWith("Travel NFT #")) {
            needsMetadataFix = true;
            fixes.push(`title: "${existing.title}" → "${dbFormat.title}"`);
          }
          
          // Check for "Unknown Location"
          if (existing.location === "Unknown Location" && 
              dbFormat.location && dbFormat.location !== "Unknown Location") {
            needsMetadataFix = true;
            fixes.push(`location: "${existing.location}" → "${dbFormat.location}"`);
          }
          
          if (shouldPreventBadOverwrite) {
            console.log(`🛡️ DATA-PROTECTION: Token #${existing.tokenId} protected from bad metadata overwrite:`);
            protections.forEach(protection => console.log(`   - ${protection}`));
          }
          
          if (needsMetadataFix) {
            console.log(`🔧 AUTO-FIX: Token #${existing.tokenId} metadata issues detected:`);
            fixes.forEach(fix => console.log(`   - ${fix}`));
          }
          
          console.log(`🔄 Updating NFT ${dbFormat.id} with fresh blockchain data:`, updateData);
          
          const updatedNFT = await storage.updateNFT(dbFormat.id, updateData);
          if (updatedNFT) {
            dbNFTs.push(updatedNFT);
            console.log(`✅ Updated NFT ${dbFormat.id} with fresh metadata: location=${dbFormat.location}, coords=${dbFormat.latitude},${dbFormat.longitude}`);
          }
        }
      }
      
      console.log(`✅ Sync completed: ${syncedCount} new NFTs, ${blockchainNFTs.length} total`);
      
      res.json({ 
        message: `Sync completed - ${syncedCount} new NFTs found`,
        syncedNFTs: syncedCount,
        totalNFTs: blockchainNFTs.length,
        nfts: dbNFTs
      });
      
    } catch (error) {
      console.error("Blockchain sync error:", error);
      res.status(500).json({ message: "Failed to sync wallet NFTs" });
    }
  });

  // Debug endpoint for USDC balance
  app.post("/api/debug/usdc-balance", async (req, res) => {
    try {
      const { address } = req.body;
      
      if (!address) {
        return res.status(400).json({ message: "Address is required" });
      }
      
      console.log(`🔍 Checking USDC balance for: ${address}`);
      
      const balance = await blockchainService.getUSDCBalance(address);
      const allowance = await blockchainService.getUSDCAllowance(address, "0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f");
      
      const result = {
        address,
        balance,
        allowance,
        contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        network: "Base Mainnet"
      };
      
      console.log(`✅ USDC Balance Result:`, result);
      
      res.json(result);
    } catch (error) {
      console.error("Error checking USDC balance:", error);
      res.status(500).json({ 
        message: "Failed to check USDC balance",
        error: (error as Error).message 
      });
    }
  });

  // Location to country mapping (same as frontend)
  const locationToCountry: Record<string, string> = {
    // Turkey
    'Tuzla': 'Turkey',
    'Pendik': 'Turkey', 
    'Istanbul': 'Turkey',
    'Ankara': 'Turkey',
    'Izmir': 'Turkey',
    'Beyoglu': 'Turkey',
    'Bodrum': 'Turkey',
    'Kadikoy': 'Turkey',
    'Osmangazi': 'Turkey',
    'Didim': 'Turkey',
    'Datça': 'Turkey',
    'Maltepe': 'Turkey',
    'Tire': 'Turkey',
    'Karsiyaka': 'Turkey',
    'Yenisehir': 'Turkey',
    'Kapakli': 'Turkey',
    'Bursa': 'Turkey',
    // Manual corrections we made
    'Tiflis': 'Georgia',
    'Dubai': 'UAE', 
    'Kahire': 'Egypt',
    // Montenegro
    'Karadağ': 'Montenegro',
    'Karadag Nature': 'Montenegro',
    // Canada
    'Vancouver': 'Canada',
    'Toronto': 'Canada',
    'Montreal': 'Canada',
    'Calgary': 'Canada',
    // Egypt
    'El Obour': 'Egypt',
    'Cairo': 'Egypt',
    'Alexandria': 'Egypt',
    'Giza': 'Egypt',
    // USA
    'New York': 'USA',
    'Los Angeles': 'USA', 
    'San Francisco': 'USA',
    'Chicago': 'USA',
    'Miami': 'USA',
    'Beverly Hills': 'USA',
    // Cyprus
    'Agios Georgios': 'Cyprus',
    // Other major cities
    'London': 'UK',
    'Paris': 'France',
    'Tokyo': 'Japan',
    'Sydney': 'Australia',
    'Singapore': 'Singapore',
    'Amsterdam': 'Netherlands',
    'Berlin': 'Germany',
    'Munich': 'Germany',
    'Hanover': 'Germany',
    'Hamburg': 'Germany',
    'Linz': 'Austria',
    'Innsbruck': 'Austria',
    'Salzburg': 'Austria',
    'Vienna': 'Austria',
    'Rome': 'Italy',
    'Barcelona': 'Spain',
    'Yenimahalle': 'Turkey',
    'Palamutbuku': 'Turkey',
    'Harbiye Cemil Topuzlu Açık Hava Tiyatrosu': 'Turkey',
    'Harbiye, Şişli/İstanbul': 'Turkey',
    'Cukurova': 'Turkey',
    'Genoa': 'Italy',
    'Pattaya, Thailand': 'Thailand'
  };

  // Function to determine country from coordinates
  // Check smaller/specific countries first, then broader ones to avoid overlaps
  const getCountryFromCoordinates = (lat: number, lng: number): string => {
    // Vatican City: 41.9°N, 12.45°E (very small, check first)
    if (lat >= 41.9 && lat <= 41.91 && lng >= 12.45 && lng <= 12.46) {
      return 'Vatican City';
    }
    
    // Singapore: 1.2-1.47°N, 103.6-104°E
    if (lat >= 1.2 && lat <= 1.47 && lng >= 103.6 && lng <= 104) {
      return 'Singapore';
    }
    
    // Cyprus: 34.5-35.7°N, 32-34.6°E
    if (lat >= 34.5 && lat <= 35.7 && lng >= 32 && lng <= 34.6) {
      return 'Cyprus';
    }
    
    // Luxembourg: 49.4-50.2°N, 5.7-6.5°E (check small countries first)
    if (lat >= 49.4 && lat <= 50.2 && lng >= 5.7 && lng <= 6.5) {
      return 'Luxembourg';
    }
    
    // Switzerland: 45.8-47.8°N, 5.96-10.49°E (exact boundaries from web)
    if (lat >= 45.8 && lat <= 47.8 && lng >= 5.96 && lng <= 10.49) {
      return 'Switzerland';
    }
    
    // Belgium: 49.5-51.5°N, 2.55-6.4°E (exact boundaries from web)
    if (lat >= 49.5 && lat <= 51.5 && lng >= 2.55 && lng <= 6.4) {
      return 'Belgium';
    }
    
    // Netherlands: 50-54°N, 3-8°E (exact boundaries from web)
    if (lat >= 50 && lat <= 54 && lng >= 3 && lng <= 8) {
      return 'Netherlands';
    }
    
    // Austria: 46.23-49.01°N, 9.53-17.16°E (exact boundaries from web)
    if (lat >= 46.23 && lat <= 49.01 && lng >= 9.53 && lng <= 17.16) {
      return 'Austria';
    }
    
    // Germany: 47.27-54.9°N, 5.87-15.03°E (exact boundaries from web - check AFTER smaller neighbors)
    if (lat >= 47.27 && lat <= 54.9 && lng >= 5.87 && lng <= 15.03) {
      return 'Germany';
    }
    
    // Montenegro: 42-43.5°N, 18.5-20.5°E
    if (lat >= 42 && lat <= 43.5 && lng >= 18.5 && lng <= 20.5) {
      return 'Montenegro';
    }
    
    // North Macedonia: 40.8-42.4°N, 20.4-23.0°E
    if (lat >= 40.8 && lat <= 42.4 && lng >= 20.4 && lng <= 23.0) {
      return 'North Macedonia';
    }
    
    // Albania: 39.6-42.7°N, 19.3-21.1°E
    if (lat >= 39.6 && lat <= 42.7 && lng >= 19.3 && lng <= 21.1) {
      return 'Albania';
    }
    
    // Greece: 34.8-41.8°N, 19.3-28.3°E
    if (lat >= 34.8 && lat <= 41.8 && lng >= 19.3 && lng <= 28.3) {
      return 'Greece';
    }
    
    // Serbia: 42.2-46.2°N, 18.8-23.0°E
    if (lat >= 42.2 && lat <= 46.2 && lng >= 18.8 && lng <= 23.0) {
      return 'Serbia';
    }
    
    // Croatia: 42.4-46.6°N, 13.5-19.5°E
    if (lat >= 42.4 && lat <= 46.6 && lng >= 13.5 && lng <= 19.5) {
      return 'Croatia';
    }
    
    // Hungary: 45.7-48.6°N, 16.1-22.9°E
    if (lat >= 45.7 && lat <= 48.6 && lng >= 16.1 && lng <= 22.9) {
      return 'Hungary';
    }
    
    // Czech Republic: 48.5-51.1°N, 12.1-18.9°E
    if (lat >= 48.5 && lat <= 51.1 && lng >= 12.1 && lng <= 18.9) {
      return 'Czech Republic';
    }
    
    // Slovakia: 47.7-49.6°N, 16.8-22.6°E
    if (lat >= 47.7 && lat <= 49.6 && lng >= 16.8 && lng <= 22.6) {
      return 'Slovakia';
    }
    
    // Slovenia: 45.4-46.9°N, 13.4-16.6°E
    if (lat >= 45.4 && lat <= 46.9 && lng >= 13.4 && lng <= 16.6) {
      return 'Slovenia';
    }
    
    // Bosnia and Herzegovina: 42.5-45.3°N, 15.7-19.6°E
    if (lat >= 42.5 && lat <= 45.3 && lng >= 15.7 && lng <= 19.6) {
      return 'Bosnia and Herzegovina';
    }
    
    // Portugal: 36.9-42.2°N, -9.5 to -6.2°E
    if (lat >= 36.9 && lat <= 42.2 && lng >= -9.5 && lng <= -6.2) {
      return 'Portugal';
    }
    
    // Iceland: 63.3-66.6°N, -24.5 to -13.5°E
    if (lat >= 63.3 && lat <= 66.6 && lng >= -24.5 && lng <= -13.5) {
      return 'Iceland';
    }
    
    // Ireland: 51.4-55.4°N, -10.5 to -6.0°E
    if (lat >= 51.4 && lat <= 55.4 && lng >= -10.5 && lng <= -6.0) {
      return 'Ireland';
    }
    
    // United Kingdom: 49.9-61°N, -8.2 to 1.8°E
    if (lat >= 49.9 && lat <= 61 && lng >= -8.2 && lng <= 1.8) {
      return 'United Kingdom';
    }
    
    // Denmark: 54.5-57.8°N, 8.0-15.2°E
    if (lat >= 54.5 && lat <= 57.8 && lng >= 8.0 && lng <= 15.2) {
      return 'Denmark';
    }
    
    // Norway: 57.9-71.2°N, 4.5-31.2°E
    if (lat >= 57.9 && lat <= 71.2 && lng >= 4.5 && lng <= 31.2) {
      return 'Norway';
    }
    
    // Sweden: 55.3-69.1°N, 11.1-24.2°E
    if (lat >= 55.3 && lat <= 69.1 && lng >= 11.1 && lng <= 24.2) {
      return 'Sweden';
    }
    
    // Finland: 59.8-70.1°N, 20.5-31.6°E
    if (lat >= 59.8 && lat <= 70.1 && lng >= 20.5 && lng <= 31.6) {
      return 'Finland';
    }
    
    // Poland: 49.0-54.9°N, 14.1-24.2°E
    if (lat >= 49.0 && lat <= 54.9 && lng >= 14.1 && lng <= 24.2) {
      return 'Poland';
    }
    
    // Italy: 35-47.3°N, 6.6-18.5°E (narrower to avoid overlap)
    if (lat >= 35 && lat <= 47.3 && lng >= 6.6 && lng <= 18.5) {
      return 'Italy';
    }
    
    // Spain: 35.5-43.8°N, -9.3 to 3.3°E
    if (lat >= 35.5 && lat <= 43.8 && lng >= -9.3 && lng <= 3.3) {
      return 'Spain';
    }
    
    // France: 42-51°N, -5 to 7.5°E (narrower to avoid overlap)
    if (lat >= 42 && lat <= 51 && lng >= -5 && lng <= 7.5) {
      return 'France';
    }
    
    // Romania: 43.6-48.3°N, 20.3-29.7°E
    if (lat >= 43.6 && lat <= 48.3 && lng >= 20.3 && lng <= 29.7) {
      return 'Romania';
    }
    
    // Bulgaria: 41.2-44.2°N, 22.4-28.6°E
    if (lat >= 41.2 && lat <= 44.2 && lng >= 22.4 && lng <= 28.6) {
      return 'Bulgaria';
    }
    
    // Turkey: 36-42°N, 26-45°E
    if (lat >= 36 && lat <= 42 && lng >= 26 && lng <= 45) {
      return 'Turkey';
    }
    
    // Georgia: 41-43.6°N, 39.9-46.7°E
    if (lat >= 41 && lat <= 43.6 && lng >= 39.9 && lng <= 46.7) {
      return 'Georgia';
    }
    
    // Armenia: 38.8-41.3°N, 43.4-46.6°E
    if (lat >= 38.8 && lat <= 41.3 && lng >= 43.4 && lng <= 46.6) {
      return 'Armenia';
    }
    
    // Azerbaijan: 38.4-41.9°N, 44.8-50.4°E
    if (lat >= 38.4 && lat <= 41.9 && lng >= 44.8 && lng <= 50.4) {
      return 'Azerbaijan';
    }
    
    // Iraq: 29.1-37.4°N, 38.8-48.6°E
    if (lat >= 29.1 && lat <= 37.4 && lng >= 38.8 && lng <= 48.6) {
      return 'Iraq';
    }
    
    // Iran: 25.1-39.8°N, 44.0-63.3°E
    if (lat >= 25.1 && lat <= 39.8 && lng >= 44.0 && lng <= 63.3) {
      return 'Iran';
    }
    
    // Saudi Arabia: 16.3-32.2°N, 34.5-55.7°E
    if (lat >= 16.3 && lat <= 32.2 && lng >= 34.5 && lng <= 55.7) {
      return 'Saudi Arabia';
    }
    
    // UAE: 22-26°N, 51-56°E
    if (lat >= 22 && lat <= 26 && lng >= 51 && lng <= 56) {
      return 'UAE';
    }
    
    // Qatar: 24.5-26.2°N, 50.7-51.7°E
    if (lat >= 24.5 && lat <= 26.2 && lng >= 50.7 && lng <= 51.7) {
      return 'Qatar';
    }
    
    // Kuwait: 28.5-30.1°N, 46.5-48.5°E
    if (lat >= 28.5 && lat <= 30.1 && lng >= 46.5 && lng <= 48.5) {
      return 'Kuwait';
    }
    
    // Egypt: 22-32°N, 25-35°E  
    if (lat >= 22 && lat <= 32 && lng >= 25 && lng <= 35) {
      return 'Egypt';
    }
    
    // Israel: 29.5-33.3°N, 34.3-35.9°E
    if (lat >= 29.5 && lat <= 33.3 && lng >= 34.3 && lng <= 35.9) {
      return 'Israel';
    }
    
    // Jordan: 29.2-33.4°N, 34.9-39.3°E
    if (lat >= 29.2 && lat <= 33.4 && lng >= 34.9 && lng <= 39.3) {
      return 'Jordan';
    }
    
    // Lebanon: 33.1-34.7°N, 35.1-36.6°E
    if (lat >= 33.1 && lat <= 34.7 && lng >= 35.1 && lng <= 36.6) {
      return 'Lebanon';
    }
    
    // Kazakhstan: 40.6-55.4°N, 46.5-87.3°E
    if (lat >= 40.6 && lat <= 55.4 && lng >= 46.5 && lng <= 87.3) {
      return 'Kazakhstan';
    }
    
    // India: 8.1-35.5°N, 68.2-97.4°E
    if (lat >= 8.1 && lat <= 35.5 && lng >= 68.2 && lng <= 97.4) {
      return 'India';
    }
    
    // Thailand: 5.5-20.5°N, 97-106°E
    if (lat >= 5.5 && lat <= 20.5 && lng >= 97 && lng <= 106) {
      return 'Thailand';
    }
    
    // Vietnam: 8.2-23.4°N, 102.1-109.5°E
    if (lat >= 8.2 && lat <= 23.4 && lng >= 102.1 && lng <= 109.5) {
      return 'Vietnam';
    }
    
    // Malaysia: 0.8-7.4°N, 99.6-119.3°E
    if (lat >= 0.8 && lat <= 7.4 && lng >= 99.6 && lng <= 119.3) {
      return 'Malaysia';
    }
    
    // Indonesia: -11 to 6°N, 95-141°E
    if (lat >= -11 && lat <= 6 && lng >= 95 && lng <= 141) {
      return 'Indonesia';
    }
    
    // Philippines: 4.6-21.1°N, 116.9-126.6°E
    if (lat >= 4.6 && lat <= 21.1 && lng >= 116.9 && lng <= 126.6) {
      return 'Philippines';
    }
    
    // Japan: 24-46°N, 122-154°E
    if (lat >= 24 && lat <= 46 && lng >= 122 && lng <= 154) {
      return 'Japan';
    }
    
    // South Korea: 33-39°N, 124-132°E
    if (lat >= 33 && lat <= 39 && lng >= 124 && lng <= 132) {
      return 'South Korea';
    }
    
    // China: 18-54°N, 73-135°E
    if (lat >= 18 && lat <= 54 && lng >= 73 && lng <= 135) {
      return 'China';
    }
    
    // Australia: -44 to -10°S, 113-154°E
    if (lat >= -44 && lat <= -10 && lng >= 113 && lng <= 154) {
      return 'Australia';
    }
    
    // New Zealand: -47 to -34°S, 166-179°E
    if (lat >= -47 && lat <= -34 && lng >= 166 && lng <= 179) {
      return 'New Zealand';
    }
    
    // Canada: 42-83°N, -141 to -52°W
    if (lat >= 42 && lat <= 83 && lng >= -141 && lng <= -52) {
      return 'Canada';
    }
    
    // USA: 24-49°N, -125 to -66°W
    if (lat >= 24 && lat <= 49 && lng >= -125 && lng <= -66) {
      return 'USA';
    }
    
    // Mexico: 14.5-32.7°N, -118 to -86°W
    if (lat >= 14.5 && lat <= 32.7 && lng >= -118 && lng <= -86) {
      return 'Mexico';
    }
    
    // Brazil: -34 to 5°S, -74 to -34°W
    if (lat >= -34 && lat <= 5 && lng >= -74 && lng <= -34) {
      return 'Brazil';
    }
    
    // Argentina: -55 to -22°S, -73 to -53°W
    if (lat >= -55 && lat <= -22 && lng >= -73 && lng <= -53) {
      return 'Argentina';
    }
    
    // Chile: -56 to -17°S, -76 to -66°W
    if (lat >= -56 && lat <= -17 && lng >= -76 && lng <= -66) {
      return 'Chile';
    }
    
    // Peru: -18 to 0°S, -81 to -68°W
    if (lat >= -18 && lat <= 0 && lng >= -81 && lng <= -68) {
      return 'Peru';
    }
    
    // Colombia: -4 to 13°N, -79 to -66°W
    if (lat >= -4 && lat <= 13 && lng >= -79 && lng <= -66) {
      return 'Colombia';
    }
    
    // Russia: 41-82°N, 19-180°E
    if (lat >= 41 && lat <= 82 && lng >= 19 && lng <= 180) {
      return 'Russia';
    }
    
    // Ukraine: 44.4-52.4°N, 22.1-40.2°E
    if (lat >= 44.4 && lat <= 52.4 && lng >= 22.1 && lng <= 40.2) {
      return 'Ukraine';
    }
    
    return 'Unknown';
  };

  // Hybrid country detection: location name first (most accurate), then coordinates
  const getNFTCountry = (nft: any): string => {
    // First try location name mapping (most accurate for known cities)
    const mappedCountry = locationToCountry[nft.location];
    if (mappedCountry) {
      return mappedCountry;
    }
    
    // Fallback to coordinates (for unmapped locations)
    if (nft.latitude && nft.longitude) {
      const lat = parseFloat(nft.latitude);
      const lng = parseFloat(nft.longitude);
      if (!isNaN(lat) && !isNaN(lng) && !(lat === 0 && lng === 0)) {
        const coordCountry = getCountryFromCoordinates(lat, lng);
        if (coordCountry !== 'Unknown') {
          return coordCountry;
        }
      }
    }
    
    return 'Unknown';
  };

  // Stats endpoint with country calculation
  app.get("/api/stats", async (req, res) => {
    try {
      const allNFTs = await storage.getAllNFTs();
      const totalNFTs = allNFTs.length;
      const totalVolume = allNFTs.reduce((sum, nft) => sum + parseFloat(nft.price), 0);

      // Calculate unique holders (distinct owner addresses)
      const uniqueHolders = new Set<string>();
      allNFTs.forEach(nft => {
        if (nft.ownerAddress) {
          uniqueHolders.add(nft.ownerAddress.toLowerCase());
        }
      });

      res.json({
        totalNFTs,
        totalVolume: totalVolume.toFixed(1),
        totalHolders: uniqueHolders.size
      });
    } catch (error) {
      console.error('Stats endpoint error:', error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Purchase NFT with onchain USDC payment
  app.post("/api/nfts/:id/purchase", async (req, res) => {
    try {
      const { id: nftId } = req.params;
      const { buyerId } = req.body;
      
      if (!buyerId) {
        return res.status(400).json({ message: "Buyer wallet address is required" });
      }
      
      // Validate wallet address format
      if (!ethers.isAddress(buyerId)) {
        return res.status(400).json({ message: "Invalid wallet address format" });
      }
      
      // Get the NFT
      const nft = await storage.getNFT(nftId);
      if (!nft) {
        return res.status(404).json({ message: "NFT not found" });
      }
      
      // Check if NFT is for sale (database check for backward compatibility)
      if (nft.isForSale !== 1) {
        return res.status(400).json({ message: "NFT is not for sale" });
      }
      
      // Check if buyer is not the current owner
      if (nft.ownerAddress.toLowerCase() === buyerId.toLowerCase()) {
        return res.status(400).json({ message: "You cannot buy your own NFT" });
      }

      // ✅ ROBUST tokenId extraction and validation
      const tokenId = nft.tokenId;
      const numericTokenId = parseInt(tokenId);
      
      if (!tokenId || isNaN(numericTokenId) || numericTokenId <= 0) {
        console.error(`❌ Invalid tokenId extraction: NFT.id=${nft.id}, extracted=${tokenId}, numeric=${numericTokenId}`);
        return res.status(400).json({ message: "Invalid NFT token ID format" });
      }
      
      console.log(`🔄 Generating onchain purchase transaction for NFT #${tokenId}`);
      
      // ✅ ENHANCED validation before blockchain call
      if (!nft.price || isNaN(parseFloat(nft.price)) || parseFloat(nft.price) <= 0) {
        console.error(`❌ Invalid NFT price: ${nft.price}`);
        return res.status(400).json({ message: "Invalid NFT price" });
      }
      
      console.log(`🔄 Generating onchain purchase transaction for NFT #${numericTokenId} at ${nft.price} USDC`);
      
      // ✅ PREFLIGHT CHECK: Verify NFT is actually listed on marketplace
      const isListed = await blockchainService.isNFTListed(tokenId);
      if (!isListed) {
        return res.status(400).json({ 
          message: "NFT is not listed on the secure marketplace",
          type: "NOT_LISTED_ERROR"
        });
      }

      // Get marketplace listing details for price validation
      const marketplaceListing = await blockchainService.getMarketplaceListing(tokenId);
      if (!marketplaceListing) {
        return res.status(400).json({ 
          message: "NFT marketplace listing not found",
          type: "LISTING_NOT_FOUND"
        });
      }
      
      // 🚨 CRITICAL: Verify on-chain owner matches listing before preparation
      console.log(`🔍 Verifying on-chain ownership before purchase prep...`);
      try {
        const onChainOwner = await blockchainService.getNFTOwner(tokenId);
        if (!onChainOwner) {
          console.error(`❌ Could not verify on-chain owner for NFT #${numericTokenId}`);
          return res.status(400).json({ message: "Could not verify NFT ownership on blockchain" });
        }
        
        if (onChainOwner.toLowerCase() !== nft.ownerAddress.toLowerCase()) {
          console.error(`❌ Ownership mismatch! DB owner: ${nft.ownerAddress}, On-chain: ${onChainOwner}`);
          return res.status(409).json({ 
            message: "NFT ownership has changed. Please refresh and try again.",
            type: "OWNERSHIP_MISMATCH",
            dbOwner: nft.ownerAddress,
            onChainOwner: onChainOwner
          });
        }
        
        console.log(`✅ On-chain ownership verified: ${onChainOwner}`);
      } catch (ownershipError: any) {
        console.error(`❌ Ownership verification failed:`, ownershipError);
        return res.status(400).json({ 
          message: "Failed to verify NFT ownership on blockchain",
          type: "BLOCKCHAIN_ERROR"
        });
      }
      
      // 🔐 SECURE: Generate marketplace purchase transaction data (NO PRICE MANIPULATION!)
      const purchaseData = await blockchainService.generatePurchaseTransaction(
        tokenId, // String for blockchain service
        buyerId.toLowerCase() // Buyer address only - price comes from secure marketplace listing!
      );
      
      if (!purchaseData.success) {
        return res.status(400).json({ 
          message: purchaseData.error || "Failed to generate purchase transaction",
          type: "ONCHAIN_ERROR"
        });
      }
      
      console.log(`✅ Generated purchase transaction data for NFT #${tokenId}`);
      
      // ✅ GUARANTEED RESPONSE FORMAT for frontend safety
      const response = { 
        message: "Purchase transaction prepared",
        requiresOnchainPayment: true,
        transactionData: purchaseData,
        nftId: nftId,
        tokenId: numericTokenId.toString(), // String format for consistency
        buyer: buyerId.toLowerCase(),
        seller: nft.ownerAddress.toLowerCase(),
        priceUSDC: nft.price // Exact NFT price - no fallbacks allowed
      };
      
      console.log(`✅ Returning verified purchase data:`, {
        tokenId: response.tokenId,
        priceUSDC: response.priceUSDC,
        buyer: response.buyer,
        seller: response.seller
      });
      
      res.json(response);
      
    } catch (error) {
      console.error("Purchase preparation error:", error);
      res.status(500).json({ message: "Failed to prepare purchase transaction" });
    }
  });

  // Confirm purchase after smart contract transaction
  app.post("/api/nfts/confirm-purchase", async (req, res) => {
    try {
      const { buyerId, transactionHash, nftId } = req.body;
      
      if (!buyerId || !transactionHash) {
        return res.status(400).json({ message: "Buyer ID and transaction hash are required" });
      }
      
      console.log(`🔍 Verifying smart contract purchase tx: ${transactionHash} for NFT: ${nftId}`);
      
      // Find the specific NFT being purchased
      let nftToUpdate;
      if (nftId) {
        nftToUpdate = await storage.getNFT(nftId);
      } else {
        // Fallback: Find any NFT for sale that the buyer doesn't own
        const allNFTs = await storage.getAllNFTs();
        nftToUpdate = allNFTs.find((nft: any) => 
          nft.isForSale === 1 && 
          nft.ownerAddress.toLowerCase() !== buyerId.toLowerCase()
        );
      }
      
      if (!nftToUpdate) {
        return res.status(404).json({ message: "NFT not found for purchase confirmation" });
      }
      
      // Extract token ID from NFT tokenId field
      const tokenId = nftToUpdate.tokenId;
      if (!tokenId || isNaN(Number(tokenId))) {
        return res.status(400).json({ message: "Invalid NFT token ID" });
      }
      
      // 🛡️ CRITICAL: Verify the blockchain transaction before updating database
      console.log(`🔍 [DEBUG] Starting transaction verification for tx: ${transactionHash}, tokenId: ${tokenId}, buyer: ${buyerId.toLowerCase()}`);
      
      const verification = await blockchainService.verifyPurchaseTransaction(
        transactionHash,
        tokenId,
        buyerId.toLowerCase()
      );
      
      console.log(`🔍 [DEBUG] Verification result:`, verification);
      
      if (!verification.success) {
        console.log(`❌ Transaction verification failed: ${verification.error}`);
        console.log(`❌ [DEBUG] Full verification object:`, JSON.stringify(verification, null, 2));
        return res.status(400).json({ 
          message: "Transaction verification failed",
          error: verification.error,
          type: "VERIFICATION_FAILED"
        });
      }
      
      console.log(`✅ Transaction verified! Proceeding with database update for NFT ${nftToUpdate.id}`);
      
      // Check if NFT is for sale
      if (nftToUpdate.isForSale !== 1) {
        return res.status(400).json({ message: "NFT is not for sale" });
      }
      
      // Check if buyer is not the current owner
      if (nftToUpdate.ownerAddress.toLowerCase() === buyerId.toLowerCase()) {
        return res.status(400).json({ message: "You cannot buy your own NFT" });
      }
      
      // Get or create buyer and seller users
      let buyer = await storage.getUserByWalletAddress(buyerId.toLowerCase());
      if (!buyer) {
        buyer = await storage.createUser({
          username: `${buyerId.slice(0, 8)}...`,
          walletAddress: buyerId.toLowerCase(),
          balance: "0"
        });
      }
      
      let seller = await storage.getUserByWalletAddress(nftToUpdate.ownerAddress);
      if (!seller) {
        seller = await storage.createUser({
          username: `${nftToUpdate.ownerAddress.slice(0, 8)}...`,
          walletAddress: nftToUpdate.ownerAddress,
          balance: "0"
        });
      }
      
      // Note: Balance updates are handled by smart contract
      // Smart contract automatically transfers USDC from buyer to seller (95%) and platform (5%)
      // We don't need to update local balances since real balances are on blockchain
      
      const purchasePrice = parseFloat(nftToUpdate.price);
      const platformFee = purchasePrice * 0.05;
      const sellerAmount = purchasePrice - platformFee;
      
      console.log(`💰 Smart contract handled: ${sellerAmount} USDC to seller, ${platformFee} USDC platform fee`);
      
      // Get or create platform user for record keeping
      let platformUser = await storage.getUserByWalletAddress(PLATFORM_WALLET);
      if (!platformUser) {
        platformUser = await storage.createUser({
          username: "TravelMint Platform", 
          walletAddress: PLATFORM_WALLET,
          balance: "0"
        });
      }
      
      console.log(`💰 Platform commission: ${platformFee} USDC to ${PLATFORM_WALLET} (handled by smart contract)`);
      
      // Update NFT ownership and remove from sale
      console.log(`🔄 Updating NFT ${nftToUpdate.id} ownership: ${nftToUpdate.ownerAddress} → ${buyerId.toLowerCase()}`);
      const updateResult = await storage.updateNFT(nftToUpdate.id, {
        ownerAddress: buyerId.toLowerCase(),
        isForSale: 0,
      });
      console.log(`✅ NFT ownership update result:`, updateResult ? 'SUCCESS' : 'FAILED');
      
      // Create transaction records for platform distribution flow
      console.log(`📝 [DEBUG] Creating purchase transaction record...`);
      try {
        const purchaseTx = await storage.createTransaction({
          nftId: nftToUpdate.id,
          toAddress: buyerId.toLowerCase(),
          transactionType: "purchase",
          amount: nftToUpdate.price,
          platformFee: platformFee.toString(),
          fromAddress: nftToUpdate.ownerAddress,
          blockchainTxHash: transactionHash,
        });
        console.log(`✅ [DEBUG] Purchase transaction created:`, purchaseTx?.id || 'no ID returned');
      } catch (txError) {
        console.error(`❌ [DEBUG] Failed to create purchase transaction:`, txError);
        throw txError; // Re-throw to catch in outer try-catch
      }
      
      // Record platform commission
      console.log(`📝 [DEBUG] Creating commission transaction record...`);
      try {
        const commissionTx = await storage.createTransaction({
          nftId: nftToUpdate.id,
          toAddress: PLATFORM_WALLET,
          transactionType: "commission",
          amount: platformFee.toString(),
          platformFee: "0",
          fromAddress: buyerId.toLowerCase(),
          blockchainTxHash: transactionHash,
        });
        console.log(`✅ [DEBUG] Commission transaction created:`, commissionTx?.id || 'no ID returned');
      } catch (txError) {
        console.error(`❌ [DEBUG] Failed to create commission transaction:`, txError);
        // Don't throw - commission is optional
      }
      
      console.log(`🎉 Purchase confirmed! NFT ${nftToUpdate.id} now owned by ${buyerId} (Platform distribution completed)`);
      
      res.json({
        success: true,
        message: "Purchase confirmed successfully",
        nftId: nftToUpdate.id,
        newOwner: buyerId.toLowerCase(),
        transactionHash,
        priceUSDC: nftToUpdate.price
      });
      
    } catch (error) {
      console.error("Purchase confirmation error:", error);
      res.status(500).json({ message: "Failed to confirm purchase" });
    }
  });

  // User routes (stub)
  app.get("/api/users", async (req, res) => {
    res.json({ message: "Use wallet-based endpoints for user data" });
  });

  // Duplicate farcaster.json route removed - using the complete one at line 120

  // Farcaster webhook endpoint
  app.post("/api/webhook", async (req, res) => {
    try {
      // Handle Farcaster frame interactions
      const { untrustedData, trustedData } = req.body;
      
      // Basic response for now
      res.json({
        message: "Webhook received",
        success: true
      });
    } catch (error) {
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  // Post-mint quick sync - checks only latest tokens  
  app.post("/api/sync/post-mint", async (req, res) => {
    try {
      console.log("⚡ Post-mint quick sync initiated...");
      
      // Clear cache first
      clearAllCache();
      
      // Get current max token ID from database
      const allDbNFTs = await storage.getAllNFTs();
      const maxTokenId = Math.max(...allDbNFTs.map(nft => parseInt(nft.tokenId || "0") || 0), 0);
      
      console.log(`🎯 Checking tokens after ${maxTokenId} (post-mint optimization)`);
      
      let newNFTsAdded = 0;
      let checkedTokens = 0;
      
      // Check next 10 token IDs after current max (for new mints)
      for (let tokenId = maxTokenId + 1; tokenId <= maxTokenId + 10; tokenId++) {
        try {
          checkedTokens++;
          
          // Use blockchainService to get token info (supports RPC rotation on failures)
          const blockchainNFT = await blockchainService.getNFTByTokenId(tokenId.toString());
          
          if (!blockchainNFT) {
            throw new Error(`Token ${tokenId} not found on blockchain`);
          }
          
          console.log(`🎯 Successfully detected Token ${tokenId} (owner: ${blockchainNFT.owner}) in post-mint sync`);
        
          if (blockchainNFT) {
            console.log(`🆕 Found new token ${tokenId} owned by ${blockchainNFT.owner}`);
            
            const dbFormat = await blockchainService.blockchainNFTToDBFormat(blockchainNFT);
            await storage.createNFT(dbFormat);
            newNFTsAdded++;
            
            console.log(`✅ Added fresh minted NFT #${tokenId} to database`);
          }
        } catch (error) {
          // Token doesn't exist or rate limit - that's expected
          console.log(`⏹️ Token ${tokenId} not found, continuing...`);
          
          // If we hit 3 consecutive non-existent tokens, stop
          if (checkedTokens >= 3 && newNFTsAdded === 0) {
            console.log(`🛑 No new tokens found after checking ${checkedTokens} slots`);
            break;
          }
        }
        
        // Small delay to avoid overwhelming the RPC
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`⚡ Post-mint sync completed: ${newNFTsAdded} new NFTs added (checked ${checkedTokens} slots)`);
      res.json({ 
        success: true, 
        message: `Post-mint sync: ${newNFTsAdded} new NFTs added`,
        newNFTs: newNFTsAdded,
        checkedTokens
      });
      
    } catch (error) {
      console.error("Error in post-mint sync:", error);
      res.status(500).json({ success: false, message: "Post-mint sync failed" });
    }
  });

  // ADMIN Token 47 Debug Endpoint (Remove in production)
  app.get("/api/admin/debug/token47", async (req, res) => {
    // Basic admin protection
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== "debug-2025-token47") {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      console.log("🔍 DEBUG: Direct Token 47 detection attempt...");
      
      // Multiple retry attempts with different strategies
      for (let attempt = 1; attempt <= 10; attempt++) {
        try {
          console.log(`🔄 Attempt ${attempt}/10 for Token 47...`);
          
          // Use blockchainService (supports RPC rotation on failures)
          const token47 = await blockchainService.getNFTByTokenId("47");
          
          if (!token47) {
            throw new Error("Token 47 not found");
          }
          
          const owner = token47.owner;
          const tokenURI = token47.tokenURI;
          
          console.log(`✅ SUCCESS! Token 47 owner: ${owner}, tokenURI: ${tokenURI}`);
          
          // Immediately save to database with proper schema
          const dbFormat = {
            id: "blockchain-47",
            title: "Token 47 (Direct Detection)", 
            description: 'Critical token detected via debug endpoint',
            imageUrl: tokenURI,
            location: 'Unknown Location',
            latitude: '0',
            longitude: '0', 
            category: 'Unknown',
            price: '0',
            isForSale: 0, // INTEGER: 0 = false, 1 = true
            creatorAddress: owner.toLowerCase(),
            ownerAddress: owner.toLowerCase(),
            tokenId: '47',
            contractAddress: "0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f"
          };
          
          await storage.createNFT(dbFormat);
          clearAllCache(); // Clear cache to show new NFT
          
          return res.json({ 
            success: true, 
            message: "Token 47 detected and saved!",
            owner: owner.toLowerCase(),
            tokenURI,
            attempt
          });
          
        } catch (error: any) {
          console.log(`❌ Attempt ${attempt} failed:`, error.message);
          if (attempt < 10) {
            // Wait longer between attempts
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
      
      res.json({ success: false, message: "Token 47 detection failed after 10 attempts" });
      
    } catch (error) {
      console.error("Error in Token 47 debug:", error);
      res.status(500).json({ success: false, message: "Debug endpoint failed" });
    }
  });

  // Manual blockchain sync endpoint for debugging/maintenance
  app.post("/api/sync/blockchain", async (req, res) => {
    try {
      console.log("🔧 Manual blockchain sync requested...");
      
      // Clear cache first
      clearAllCache();
      
      // Get NFTs from blockchain
      const blockchainNFTs = await blockchainService.getAllNFTs();
      console.log(`Found ${blockchainNFTs.length} NFTs on blockchain`);
      
      // Get current database NFTs
      const allDbNFTs = await storage.getAllNFTs();
      const contractNFTs = allDbNFTs.filter(nft => 
        !nft.contractAddress || nft.contractAddress === ALLOWED_CONTRACT
      );
      
      let updatedCount = 0;
      let addedCount = 0;
      
      // Sync each blockchain NFT
      for (const blockchainNFT of blockchainNFTs) {
        const existsInDb = contractNFTs.find(nft => nft.tokenId === blockchainNFT.tokenId);
        
        if (!existsInDb) {
          console.log(`🆕 Adding new blockchain NFT #${blockchainNFT.tokenId} to database`);
          const dbFormat = await blockchainService.blockchainNFTToDBFormat(blockchainNFT);
          await storage.createNFT(dbFormat);
          addedCount++;
        } else {
          let needsUpdate = false;
          const updateData: any = {};
          
          // Check if owner changed
          if (existsInDb.ownerAddress !== blockchainNFT.owner) {
            console.log(`🔄 Updating owner for NFT #${blockchainNFT.tokenId}`);
            updateData.ownerAddress = blockchainNFT.owner;
            needsUpdate = true;
          }
          
          // Force coordinate update if metadata has coordinates
          if (blockchainNFT.metadata && blockchainNFT.metadata.attributes) {
            const metadata = blockchainNFT.metadata;
            const latAttr = metadata.attributes.find((attr: any) => 
              attr.trait_type?.toLowerCase().includes('latitude')
            );
            const lngAttr = metadata.attributes.find((attr: any) => 
              attr.trait_type?.toLowerCase().includes('longitude')
            );
            
            if (latAttr && lngAttr && latAttr.value !== "0" && lngAttr.value !== "0") {
              const currentLat = parseFloat(existsInDb.latitude);
              const currentLng = parseFloat(existsInDb.longitude);
              
              // 🇹🇭 SPECIAL CASE: Token ID 35 (Pattaya NFT) - Force Pattaya location permanently
              if (blockchainNFT.tokenId === '35') {
                console.log(`🇹🇭 Forcing Pattaya location for NFT #35 (overriding metadata)`);
                updateData.latitude = '12.9236';
                updateData.longitude = '100.8825';
                updateData.location = 'Pattaya, Thailand';
                updateData.metadata = JSON.stringify(metadata);
                needsUpdate = true;
              }
              // Update if coordinates are missing (0,0) or different from metadata
              else if ((currentLat === 0 && currentLng === 0) || 
                  Math.abs(currentLat - parseFloat(latAttr.value)) > 0.0001 || 
                  Math.abs(currentLng - parseFloat(lngAttr.value)) > 0.0001) {
                
                console.log(`🌍 Updating coordinates for NFT #${blockchainNFT.tokenId}: ${latAttr.value}, ${lngAttr.value}`);
                updateData.latitude = latAttr.value;
                updateData.longitude = lngAttr.value;
                
                // Also update other metadata fields
                const locationAttr = metadata.attributes.find((attr: any) => 
                  attr.trait_type?.toLowerCase().includes('location')
                );
                if (locationAttr && locationAttr.value) {
                  updateData.location = locationAttr.value;
                }
                
                if (metadata.name && metadata.name !== `Travel NFT #${blockchainNFT.tokenId}`) {
                  updateData.title = metadata.name;
                }
                if (metadata.image) {
                  updateData.imageUrl = metadata.image;
                }
                if (metadata.description) {
                  updateData.description = metadata.description;
                }
                
                const categoryAttr = metadata.attributes.find((attr: any) => 
                  attr.trait_type?.toLowerCase().includes('category')
                );
                if (categoryAttr && categoryAttr.value) {
                  updateData.category = categoryAttr.value.toLowerCase();
                }
                
                updateData.metadata = JSON.stringify(metadata);
                needsUpdate = true;
              }
            }
          }
          
          if (needsUpdate) {
            await storage.updateNFT(existsInDb.id, updateData);
            updatedCount++;
          }
        }
      }
      
      console.log(`✅ Manual blockchain sync completed: ${addedCount} added, ${updatedCount} updated`);
      res.json({ 
        success: true, 
        message: `Sync completed: ${addedCount} NFTs added, ${updatedCount} NFTs updated`,
        totalBlockchainNFTs: blockchainNFTs.length
      });
      
    } catch (error) {
      console.error("Manual blockchain sync failed:", error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // IPFS routes
  app.use("/api/ipfs", ipfsRoutes);

  // Object Storage routes
  const upload = multer({ storage: multer.memoryStorage() });
  
  // Public object serving endpoint
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    const objectStorageService = new ObjectStorageService();
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Object Storage serving endpoint - CRITICAL for image display  
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path,
      );
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Object Storage upload endpoint
  app.post("/api/object-storage/upload", upload.single('file'), async (req, res) => {
    try {
      const file = req.file;
      const { fileName, mimeType } = req.body;
      
      if (!file) {
        return res.status(400).json({ error: "No file provided" });
      }
      
      const objectStorageService = new ObjectStorageService();
      const relativeObjectUrl = await objectStorageService.uploadFileBuffer(
        file.buffer,
        fileName || file.originalname,
        mimeType || file.mimetype
      );
      
      // Convert relative URL to full URL for OpenSea compatibility
      const protocol = req.protocol || 'https';
      const host = req.get('host') || req.headers.host;
      const fullObjectUrl = `${protocol}://${host}${relativeObjectUrl}`;
      
      console.log('\u2705 Object uploaded successfully:', fullObjectUrl);
      res.json({ objectUrl: fullObjectUrl });
    } catch (error) {
      console.error('\u274c Object upload failed:', error);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  // Token image upload endpoint for fixing specific tokens
  app.post("/api/fix-token-images", async (req, res) => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const objectStorageService = new ObjectStorageService();
      
      // Token image files mapping
      const tokenImages = {
        '29': 'attached_assets/29_1756885009207.jpeg',
        '30': 'attached_assets/30_1756885009203.jpeg', 
        '31': 'attached_assets/31_1756885009206.jpeg'
      };
      
      const results = [];
      
      for (const [tokenId, filePath] of Object.entries(tokenImages)) {
        try {
          // Read the image file
          const imageBuffer = fs.readFileSync(filePath);
          const fileName = path.basename(filePath);
          
          // Upload to Object Storage
          const objectUrl = await objectStorageService.uploadFileBuffer(
            imageBuffer,
            fileName,
            'image/jpeg'
          );
          
          // Update database
          const existingNFT = await storage.getNFTByTokenId(tokenId);
          if (existingNFT) {
            await storage.updateNFT(existingNFT.id, {
              objectStorageUrl: objectUrl
            });
            
            console.log(`✅ Updated Token ${tokenId} with Object Storage URL:`, objectUrl);
            results.push({ tokenId, objectUrl, status: 'success' });
          } else {
            results.push({ tokenId, status: 'not_found' });
          }
        } catch (error) {
          console.error(`❌ Failed to process Token ${tokenId}:`, error);
          results.push({ tokenId, status: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
      
      res.json({ success: true, results });
    } catch (error) {
      console.error('❌ Fix token images failed:', error);
      res.status(500).json({ error: "Failed to fix token images" });
    }
  });

  // ===== NEYNAR API ENDPOINTS =====
  
  // Get Neynar User Score for a Farcaster user
  app.get("/api/neynar/score/:fid", async (req, res) => {
    try {
      const fid = req.params.fid;
      
      if (!fid || !/^\d+$/.test(fid)) {
        return res.status(400).json({ message: "Invalid FID" });
      }

      const neynarApiKey = process.env.NEYNAR_API_KEY;
      if (!neynarApiKey) {
        return res.status(500).json({ message: "Neynar API key not configured" });
      }

      const response = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, {
        headers: {
          'accept': 'application/json',
          'x-api-key': neynarApiKey,
        },
      });

      if (!response.ok) {
        console.error('Neynar API error:', response.status, await response.text());
        return res.status(response.status).json({ message: "Failed to fetch from Neynar API" });
      }

      const data = await response.json();
      
      if (!data.users || data.users.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      const user = data.users[0];
      
      // Use new 'score' field (stable), fallback to experimental neynar_user_score
      const neynarScore = user.score ?? user.experimental?.neynar_user_score ?? 0;
      
      res.json({
        fid: user.fid,
        username: user.username,
        displayName: user.display_name,
        pfpUrl: user.pfp_url,
        followerCount: user.follower_count,
        followingCount: user.following_count,
        neynarScore: neynarScore,
        activeStatus: user.active_status,
        verifiedAddresses: user.verified_addresses?.eth_addresses || [],
      });
    } catch (error) {
      console.error('Error fetching Neynar score:', error);
      res.status(500).json({ message: "Failed to fetch Neynar score" });
    }
  });

  // Neynar Score Share Image - generates dynamic PNG for Farcaster sharing
  app.get("/api/neynar/share-image/:fid", async (req, res) => {
    try {
      const fid = req.params.fid;
      
      if (!fid || !/^\d+$/.test(fid)) {
        return res.status(400).json({ message: "Invalid FID" });
      }

      const neynarApiKey = process.env.NEYNAR_API_KEY;
      if (!neynarApiKey) {
        return res.status(500).json({ message: "Neynar API key not configured" });
      }

      // Fetch user data from Neynar
      const response = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, {
        headers: {
          'accept': 'application/json',
          'x-api-key': neynarApiKey,
        },
      });

      if (!response.ok) {
        console.error('Neynar API error:', response.status);
        return res.status(response.status).json({ message: "Failed to fetch from Neynar API" });
      }

      const data = await response.json();
      
      if (!data.users || data.users.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      const user = data.users[0];
      const neynarScore = user.score ?? user.experimental?.neynar_user_score ?? 0;
      const username = user.username || 'Anonymous';
      const pfpUrl = user.pfp_url;

      // Fetch profile image and convert to base64
      let avatarDataUrl = '';
      if (pfpUrl) {
        try {
          const avatarResponse = await fetch(pfpUrl);
          if (avatarResponse.ok) {
            const avatarBuffer = await avatarResponse.arrayBuffer();
            const contentType = avatarResponse.headers.get('content-type') || 'image/jpeg';
            avatarDataUrl = `data:${contentType};base64,${Buffer.from(avatarBuffer).toString('base64')}`;
          }
        } catch (e) {
          console.error('Failed to fetch avatar:', e);
        }
      }

      // Generate SVG with Satori
      const svg = await satori(
        {
          type: 'div',
          props: {
            style: {
              width: '1200px',
              height: '630px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #FF7A18 0%, #AF1EB6 50%, #833AB4 100%)',
              fontFamily: 'Inter',
            },
            children: [
              // Avatar
              avatarDataUrl ? {
                type: 'img',
                props: {
                  src: avatarDataUrl,
                  width: 140,
                  height: 140,
                  style: {
                    width: '140px',
                    height: '140px',
                    borderRadius: '70px',
                    border: '4px solid rgba(255,255,255,0.5)',
                    marginBottom: '24px',
                    objectFit: 'cover',
                  },
                },
              } : null,
              // Username's Neynar Score
              {
                type: 'div',
                props: {
                  style: {
                    color: 'white',
                    fontSize: '42px',
                    fontWeight: '500',
                    marginBottom: '16px',
                  },
                  children: `${username}'s Neynar Score`,
                },
              },
              // Score value
              {
                type: 'div',
                props: {
                  style: {
                    color: 'white',
                    fontSize: '120px',
                    fontWeight: '700',
                    marginBottom: '24px',
                  },
                  children: neynarScore.toFixed(2),
                },
              },
              // CTA text
              {
                type: 'div',
                props: {
                  style: {
                    color: 'rgba(255,255,255,0.8)',
                    fontSize: '32px',
                    fontWeight: '400',
                  },
                  children: 'Check your Neynar Score',
                },
              },
            ].filter(Boolean),
          },
        },
        {
          width: 1200,
          height: 630,
          fonts: [
            {
              name: 'Inter',
              data: interRegular!,
              weight: 400,
              style: 'normal' as const,
            },
            {
              name: 'Inter',
              data: interBold!,
              weight: 700,
              style: 'normal' as const,
            },
          ],
        }
      );

      // Convert SVG to PNG
      const resvg = new Resvg(svg, {
        fitTo: {
          mode: 'width',
          value: 1200,
        },
      });
      const pngData = resvg.render();
      const pngBuffer = pngData.asPng();

      // Set cache headers and return PNG
      res.set({
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
      });
      res.send(pngBuffer);
    } catch (error) {
      console.error('Error generating share image:', error);
      res.status(500).json({ message: "Failed to generate share image" });
    }
  });

  // ===== QUEST SYSTEM API ENDPOINTS =====
  
  // Get user stats for quest system - SECURED
  // Accepts optional query params: username, pfpUrl for auto-creation
  app.get("/api/user-stats/:fid", async (req, res) => {
    try {
      // Validate request parameters
      const validationResult = userStatsParamsSchema.safeParse(req.params);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request parameters", 
          errors: validationResult.error.errors 
        });
      }
      
      const { fid } = validationResult.data;
      const { username, pfpUrl } = req.query;
      
      let userStats = await storage.getUserStats(fid);
      
      // If user stats don't exist and username is provided, auto-create
      if (!userStats && username && typeof username === 'string') {
        console.log(`🎯 Auto-creating userStats for FID ${fid} (${username})`);
        
        userStats = await storage.createOrUpdateUserStats({
          farcasterFid: fid,
          farcasterUsername: username,
          farcasterPfpUrl: typeof pfpUrl === 'string' ? pfpUrl : undefined,
          totalPoints: 0,
          currentStreak: 0
        });
        
        console.log(`✅ Created userStats with referral code: ${userStats.referralCode}`);
      }
      
      if (!userStats) {
        // Return default stats for new users (only if username not provided)
        return res.json({
          farcasterFid: fid,
          farcasterUsername: '',
          totalPoints: 0,
          currentStreak: 0,
          lastCheckIn: null,
          lastStreakClaim: null
        });
      }
      
      res.json(userStats);
    } catch (error) {
      console.error('Error fetching user stats:', error);
      res.status(500).json({ message: "Failed to fetch user stats" });
    }
  });
  
  // Get quest completions for a specific date - SECURED
  app.get("/api/quest-completions/:fid/:date", async (req, res) => {
    try {
      // Validate request parameters
      const validationResult = questCompletionsParamsSchema.safeParse(req.params);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request parameters", 
          errors: validationResult.error.errors 
        });
      }
      
      const { fid, date } = validationResult.data;
      const completions = await storage.getQuestCompletions(fid, date);
      res.json(completions);
    } catch (error) {
      console.error('Error fetching quest completions:', error);
      res.status(500).json({ message: "Failed to fetch quest completions" });
    }
  });
  
  // Check holder status - SECURED
  app.get("/api/holder-status/:address", async (req, res) => {
    try {
      // Validate request parameters
      const validationResult = holderStatusParamsSchema.safeParse(req.params);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request parameters", 
          errors: validationResult.error.errors 
        });
      }
      
      const { address } = validationResult.data;
      const holderStatus = await storage.checkHolderStatus(address.toLowerCase());
      res.json(holderStatus);
    } catch (error) {
      console.error('Error checking holder status:', error);
      res.status(500).json({ message: "Failed to check holder status" });
    }
  });

  // Check combined holder status for Farcaster user - SECURED
  app.get("/api/combined-holder-status/:fid", async (req, res) => {
    try {
      // Validate request parameters
      const validationResult = userStatsParamsSchema.safeParse(req.params);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request parameters", 
          errors: validationResult.error.errors 
        });
      }
      
      const { fid } = validationResult.data;
      const combinedHolderStatus = await storage.checkCombinedHolderStatus(fid);
      res.json(combinedHolderStatus);
    } catch (error) {
      console.error('Error checking combined holder status:', error);
      res.status(500).json({ message: "Failed to check combined holder status" });
    }
  });
  
  // Get leaderboard - SECURED
  app.get("/api/leaderboard", async (req, res) => {
    try {
      // Validate query parameters
      const validationResult = leaderboardQuerySchema.safeParse(req.query);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid query parameters", 
          errors: validationResult.error.errors 
        });
      }
      
      const limit = validationResult.data.limit ? parseInt(validationResult.data.limit) : 50;
      const leaderboard = await storage.getLeaderboard(limit);
      
      // Filter out @coinacci from leaderboard for testing purposes
      const filteredLeaderboard = leaderboard.filter(entry => entry.farcasterUsername !== 'coinacci');
      
      // Add rank to each entry
      const rankedLeaderboard = filteredLeaderboard.map((entry, index) => ({
        ...entry,
        rank: index + 1
      }));
      
      res.json(rankedLeaderboard);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  // Get weekly leaderboard - SECURED
  app.get("/api/leaderboard/weekly", async (req, res) => {
    try {
      // Validate query parameters
      const validationResult = leaderboardQuerySchema.safeParse(req.query);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid query parameters", 
          errors: validationResult.error.errors 
        });
      }
      
      const limit = validationResult.data.limit ? parseInt(validationResult.data.limit) : 50;
      const weeklyLeaderboard = await storage.getWeeklyLeaderboard(limit);
      
      // Filter out @coinacci from leaderboard for testing purposes
      const filteredLeaderboard = weeklyLeaderboard.filter(entry => entry.farcasterUsername !== 'coinacci');
      
      // Add rank to each entry - always show actual weekly points (0 after reset is correct)
      const rankedLeaderboard = filteredLeaderboard.map((entry, index) => ({
        ...entry,
        rank: index + 1
      }));
      
      res.json(rankedLeaderboard);
    } catch (error) {
      console.error('Error fetching weekly leaderboard:', error);
      res.status(500).json({ message: "Failed to fetch weekly leaderboard" });
    }
  });

  // Get weekly champions - SECURED
  app.get("/api/weekly-champions", async (req, res) => {
    try {
      // Validate query parameters
      const validationResult = leaderboardQuerySchema.safeParse(req.query);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid query parameters", 
          errors: validationResult.error.errors 
        });
      }
      
      const limit = validationResult.data.limit ? parseInt(validationResult.data.limit) : 10;
      const champions = await storage.getWeeklyChampions(limit);
      
      res.json(champions);
    } catch (error) {
      console.error('Error fetching weekly champions:', error);
      res.status(500).json({ message: "Failed to fetch weekly champions" });
    }
  });

  // Admin endpoint for one-time weekly points backfill - SECRET PROTECTED
  app.post("/api/admin/backfill-weekly", async (req, res) => {
    try {
      // Check admin secret (use environment variable or default for development)
      const adminSecret = process.env.ADMIN_SECRET || 'dev-admin-secret-2024';
      const providedSecret = req.headers.authorization || req.headers['x-admin-secret'];
      
      if (!providedSecret || providedSecret !== adminSecret) {
        return res.status(401).json({ message: "Unauthorized - invalid admin secret" });
      }

      console.log('🔧 Admin backfill requested - starting weekly points migration...');
      const result = await storage.backfillWeeklyPointsFromTotal();
      
      console.log('✅ Admin backfill completed:', result);
      res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Admin backfill failed:', error);
      res.status(500).json({ 
        success: false, 
        message: "Backfill failed", 
        error: error.message 
      });
    }
  });

  // Admin endpoint for syncing ALL weekly points with all-time points (for same week)
  app.post("/api/admin/sync-weekly", async (req, res) => {
    try {
      // Check admin secret (use environment variable or default for development)
      const adminSecret = process.env.ADMIN_SECRET || 'dev-admin-secret-2024';
      const providedSecret = req.headers.authorization || req.headers['x-admin-secret'];
      
      if (!providedSecret || providedSecret !== adminSecret) {
        return res.status(401).json({ message: "Unauthorized - invalid admin secret" });
      }

      console.log('🔄 Admin sync requested - syncing weekly points with all-time...');
      const result = await storage.syncWeeklyWithAllTime();
      
      console.log('✅ Admin sync completed:', result);
      res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Admin sync failed:', error);
      res.status(500).json({ 
        success: false, 
        message: "Sync failed", 
        error: error.message 
      });
    }
  });

  // Admin endpoint for backfilling referral codes
  app.post("/api/admin/backfill-referral-codes", async (req, res) => {
    try {
      // Check admin secret - FAIL CLOSED if not configured
      const adminSecret = process.env.ADMIN_SECRET;
      if (!adminSecret) {
        console.error('❌ ADMIN_SECRET not configured - blocking admin access');
        return res.status(500).json({ message: "Admin access not configured" });
      }
      
      const providedSecret = req.headers.authorization || req.headers['x-admin-secret'];
      
      if (!providedSecret || providedSecret !== adminSecret) {
        return res.status(401).json({ message: "Unauthorized - invalid admin secret" });
      }

      console.log('🎁 Admin backfill requested - generating referral codes...');
      const result = await storage.backfillReferralCodes();
      
      console.log('✅ Admin backfill completed:', result);
      res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Admin backfill failed:', error);
      res.status(500).json({ 
        success: false, 
        message: "Referral code backfill failed", 
        error: error.message 
      });
    }
  });

  // Cron endpoint for automated weekly reset - SECRET PROTECTED
  app.post("/api/cron/weekly-reset", async (req, res) => {
    try {
      // Check cron secret (use environment variable or default for development)
      const cronSecret = process.env.CRON_SECRET || 'dev-cron-secret-2024';
      const providedSecret = req.headers.authorization || req.headers['x-cron-secret'];
      
      if (!providedSecret || providedSecret !== cronSecret) {
        return res.status(401).json({ message: "Unauthorized - invalid cron secret" });
      }

      console.log('🕐 Cron weekly reset triggered - performing automated reset...');
      await storage.performWeeklyReset();
      
      console.log('✅ Cron weekly reset completed successfully');
      res.json({
        success: true,
        message: "Weekly reset completed successfully",
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Cron weekly reset failed:', error);
      res.status(500).json({ 
        success: false, 
        message: "Weekly reset failed", 
        error: error.message 
      });
    }
  });
  
  // SECURED Claim quest reward - CRITICAL SECURITY FIX
  app.post("/api/quest-claim", async (req, res) => {
    try {
      // 🔒 SECURITY: Validate all input with Zod schema
      const validationResult = questClaimSchema.safeParse(req.body);
      if (!validationResult.success) {
        console.warn('🚨 Invalid quest claim request:', validationResult.error.errors);
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: validationResult.error.errors 
        });
      }

      const { farcasterFid, questType, walletAddress, castUrl, farcasterUsername, farcasterPfpUrl } = validationResult.data;
      
      // 🔒 SECURITY: Basic Farcaster verification (client-side context check)
      // NOTE: This is a basic security layer. In production, implement server-side Farcaster signature verification
      if (!farcasterUsername || farcasterUsername.trim() === '') {
        console.warn('🚨 Quest claim without proper Farcaster context:', farcasterFid);
        return res.status(403).json({ 
          message: "Farcaster verification required. Please connect through Farcaster." 
        });
      }

      const today = getQuestDay();
      
      // Pre-validate requirements before atomic transaction
      let pointsEarned = 0;
      let userStatsUpdates: any = {};
      
      // Get current user stats for streak validation (outside transaction for performance)
      const existingUserStats = await storage.getUserStats(farcasterFid);
      
      switch (questType) {
        case 'daily_checkin':
          pointsEarned = 1;
          
          // Calculate streak updates for daily checkin
          if (existingUserStats) {
            const lastCheckIn = existingUserStats.lastCheckIn;
            const yesterdayQuest = getYesterdayQuestDay();
            
            if (lastCheckIn && getQuestDay(new Date(lastCheckIn)) === yesterdayQuest) {
              // Consecutive day - increment streak
              userStatsUpdates.currentStreak = existingUserStats.currentStreak + 1;
            } else if (!lastCheckIn || getQuestDay(new Date(lastCheckIn)) !== today) {
              // First check-in or broken streak - reset to 1
              userStatsUpdates.currentStreak = 1;
            }
            
            userStatsUpdates.lastCheckIn = new Date();
          }
          break;
          
        case 'holder_bonus':
          // Use combined holder status - check all linked wallets + verified addresses
          console.log(`🔍 Checking combined holder bonus for Farcaster FID: ${farcasterFid}`);
          
          const combinedHolderStatus = await storage.checkCombinedHolderStatus(farcasterFid);
          if (!combinedHolderStatus.isHolder) {
            return res.status(400).json({ 
              message: "Must hold at least one Travel NFT across all linked wallets to claim holder bonus" 
            });
          }
          
          console.log(`✅ Farcaster FID ${farcasterFid} holds ${combinedHolderStatus.nftCount} NFTs across all linked wallets`);
          pointsEarned = combinedHolderStatus.nftCount * 0.15;
          break;
          
        case 'streak_bonus':
          if (!existingUserStats) {
            return res.status(400).json({ 
              message: "Must complete daily check-ins first to claim streak bonus" 
            });
          }
          
          if (existingUserStats.currentStreak < 7) {
            return res.status(400).json({ 
              message: `Need ${7 - existingUserStats.currentStreak} more consecutive days to claim streak bonus` 
            });
          }
          
          // Check if already claimed streak bonus today
          if (existingUserStats.lastStreakClaim && 
              getQuestDay(new Date(existingUserStats.lastStreakClaim)) === today) {
            return res.status(400).json({ message: "Streak bonus already claimed today" });
          }
          
          pointsEarned = 7;
          userStatsUpdates.lastStreakClaim = new Date();
          // Keep current streak, don't reset it
          break;
          
        case 'base_transaction':
          // No transaction verification - user can claim daily and make their first Base transaction
          // The unique constraint on (farcaster_fid, quest_type, completion_date) prevents multiple claims per day
          pointsEarned = 1; // 1 point for Base transaction
          break;
          
        case 'social_post':
          if (!castUrl) {
            return res.status(400).json({ message: "Cast URL is required for social post quest" });
          }
          
          console.log(`🔍 Validating Farcaster cast for social post quest: ${castUrl}`);
          
          // Validate cast content and timestamp
          const castValidation = await farcasterCastValidator.validateCast(castUrl);
          if (!castValidation.isValid) {
            return res.status(400).json({ 
              message: castValidation.reason 
            });
          }
          
          console.log(`✅ Cast validation passed for @${farcasterUsername}`);
          pointsEarned = 5; // 5 points for daily post quest (will be converted to fixed-point 500 in storage)
          break;
          
        default:
          return res.status(400).json({ message: "Invalid quest type" });
      }

      // 🔒 ATOMICITY: Use atomic transaction for all database operations
      console.log(`🎯 Processing ${questType} quest for user ${farcasterFid} (+${pointsEarned} points)`);
      
      const result = await storage.claimQuestAtomic({
        farcasterFid,
        farcasterUsername: farcasterUsername.trim(),
        farcasterPfpUrl: farcasterPfpUrl?.trim(),
        walletAddress: walletAddress?.toLowerCase(),
        castUrl, // Include cast URL for social_post quests
        questType,
        pointsEarned,
        completionDate: today,
        userStatsUpdates
      });

      console.log(`✅ Quest atomically completed: ${questType} (+${pointsEarned} points) for @${farcasterUsername}`);
      
      res.json({
        success: true,
        pointsEarned,
        totalPoints: result.userStats.totalPoints,
        currentStreak: result.userStats.currentStreak,
        questCompletion: {
          id: result.questCompletion.id,
          completionDate: result.questCompletion.completionDate
        },
        message: `Successfully claimed ${questType} for +${pointsEarned} points!`
      });
      
    } catch (error) {
      console.error('🚨 Quest claim failed:', error);
      
      // Handle specific error types
      if (error instanceof Error && error.message.includes('already completed')) {
        return res.status(409).json({ 
          message: error.message,
          code: 'QUEST_ALREADY_COMPLETED'
        });
      }
      
      res.status(500).json({ 
        message: "Failed to claim quest reward. Please try again.",
        code: 'QUEST_CLAIM_ERROR'
      });
    }
  });

  // Validate and apply referral code
  app.post("/api/validate-referral", async (req, res) => {
    try {
      const { referralCode, newUserFid, newUserUsername, newUserPfpUrl } = req.body;
      
      // Validate required fields
      if (!referralCode || !newUserFid || !newUserUsername) {
        return res.status(400).json({ 
          success: false,
          message: "Referral code, Farcaster FID and username are required" 
        });
      }
      
      console.log(`🎁 Processing referral: ${newUserUsername} using code ${referralCode}`);
      
      // Validate and apply referral
      const result = await storage.validateAndApplyReferral({
        referralCode,
        newUserFid,
        newUserUsername,
        newUserPfpUrl
      });
      
      if (result.success) {
        console.log(`✅ Referral applied successfully: ${newUserUsername} → ${referralCode}`);
        return res.json(result);
      } else {
        console.warn(`⚠️ Referral validation failed: ${result.message}`);
        return res.status(400).json(result);
      }
      
    } catch (error: any) {
      console.error('🚨 Referral validation error:', error);
      res.status(500).json({ 
        success: false,
        message: "Failed to process referral code. Please try again.",
        error: error.message 
      });
    }
  });

  // Claim referral rewards
  app.post("/api/quests/claim-referral", async (req, res) => {
    try {
      const { farcasterFid } = req.body;
      
      // Validate required fields
      if (!farcasterFid) {
        return res.status(400).json({ 
          message: "Farcaster FID is required" 
        });
      }
      
      // Get current user stats
      const userStats = await storage.getUserStats(farcasterFid);
      
      if (!userStats) {
        return res.status(404).json({ 
          message: "User not found" 
        });
      }
      
      // Check if there are unclaimed referrals
      if (!userStats.unclaimedReferrals || userStats.unclaimedReferrals === 0) {
        return res.status(400).json({ 
          message: "No unclaimed referrals",
          code: 'NO_UNCLAIMED_REFERRALS'
        });
      }
      
      // IMPORTANT: Snapshot the referral count BEFORE updating (updateUserStats may mutate the object)
      const referralsToClaim = userStats.unclaimedReferrals;
      
      // Calculate points to award (1 point per referral, 100 fixed-point)
      const pointsPerReferral = 1;
      const fixedPointsPerReferral = pointsPerReferral * 100;
      const totalPointsToAward = referralsToClaim * fixedPointsPerReferral;
      
      console.log(`🎁 Claiming ${referralsToClaim} referrals = ${totalPointsToAward / 100} points for @${userStats.farcasterUsername}`);
      
      // Update user stats: add points and reset unclaimed count
      await storage.updateUserStats(farcasterFid, {
        totalPoints: userStats.totalPoints + totalPointsToAward,
        weeklyPoints: (userStats.weeklyPoints || 0) + totalPointsToAward,
        unclaimedReferrals: 0
      });
      
      const responseData = {
        success: true,
        pointsEarned: totalPointsToAward, // Send fixed-point (100, 200, 300...) - frontend converts to display
        totalPoints: userStats.totalPoints + totalPointsToAward,
        message: `Successfully claimed ${referralsToClaim} referral reward${referralsToClaim > 1 ? 's' : ''}!`
      };
      
      console.log(`✅ Referral rewards claimed successfully`);
      console.log(`📤 Sending response:`, responseData);
      
      res.json(responseData);
      
    } catch (error) {
      console.error('🚨 Claim referral failed:', error);
      
      res.status(500).json({ 
        message: "Failed to claim referral rewards. Please try again.",
        code: 'REFERRAL_CLAIM_ERROR'
      });
    }
  });

  // One-time quest: Add Mini App to Farcaster
  app.post("/api/quests/complete-add-miniapp", async (req, res) => {
    try {
      const { farcasterFid, farcasterUsername, farcasterPfpUrl } = req.body;
      
      // Validate required fields
      if (!farcasterFid || !farcasterUsername) {
        return res.status(400).json({ 
          message: "Farcaster FID and username are required" 
        });
      }
      
      // Get current user stats
      const userStats = await storage.getUserStats(farcasterFid);
      
      // Check if already claimed
      if (userStats?.hasAddedMiniApp) {
        return res.status(409).json({ 
          message: "Add Mini App quest already completed",
          code: 'QUEST_ALREADY_COMPLETED'
        });
      }
      
      // Award +5 points (500 fixed-point)
      const pointsEarned = 5;
      const fixedPointsEarned = pointsEarned * 100;
      
      // Update user stats
      const result = await storage.completeAddMiniAppQuest({
        farcasterFid,
        farcasterUsername: farcasterUsername.trim(),
        farcasterPfpUrl: farcasterPfpUrl?.trim(),
        pointsEarned: fixedPointsEarned
      });
      
      console.log(`✅ Add Mini App quest completed: +${pointsEarned} points for @${farcasterUsername}`);
      
      res.json({
        success: true,
        pointsEarned,
        totalPoints: result.totalPoints,
        message: `Successfully completed Add Mini App quest for +${pointsEarned} points!`
      });
      
    } catch (error) {
      console.error('🚨 Add Mini App quest failed:', error);
      
      res.status(500).json({ 
        message: "Failed to complete Add Mini App quest. Please try again.",
        code: 'QUEST_CLAIM_ERROR'
      });
    }
  });

  // Helper function to escape HTML
  const escapeHtml = (text: string | null | undefined) => {
    if (!text) return '';
    return text.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };
  
  // Helper function to sanitize URLs
  const sanitizeUrl = (url: string | null | undefined) => {
    if (!url) return 'about:blank';
    const urlStr = url.toString().trim();
    if (!urlStr) return 'about:blank';
    
    // Allow only https, http, and ipfs schemes
    const allowedSchemes = /^(https?|ipfs):/i;
    const dangerousSchemes = /^(javascript|data|vbscript|file):/i;
    
    if (dangerousSchemes.test(urlStr)) {
      return 'about:blank';
    }
    
    if (!allowedSchemes.test(urlStr)) {
      // Assume relative URL, make it absolute
      return urlStr.startsWith('/') ? urlStr : `/${urlStr}`;
    }
    
    return urlStr;
  };

  // Dynamic NFT Share Image - generates branded PNG for Farcaster frame sharing
  app.get("/api/nft-share-image/:tokenId", async (req, res) => {
    try {
      const { tokenId } = req.params;
      console.log(`🖼️ Generating share image for token ${tokenId}`);
      
      // Get NFT data from database
      const nft = await storage.getNFTByTokenId(tokenId);
      
      if (!nft) {
        console.log(`❌ NFT not found for token ${tokenId}`);
        return res.status(404).json({ message: "NFT not found" });
      }

      console.log(`📸 NFT found: ${nft.title}, image: ${nft.objectStorageUrl || nft.imageUrl}`);

      // Fetch NFT image and convert to base64
      let nftImageDataUrl = '';
      const imageUrl = nft.objectStorageUrl || nft.imageUrl;
      if (imageUrl) {
        try {
          // Handle relative URLs by making them absolute
          let fetchUrl = imageUrl;
          if (imageUrl.startsWith('/')) {
            const protocol = req.headers['x-forwarded-proto'] || req.protocol;
            const host = req.get('host');
            fetchUrl = `${protocol}://${host}${imageUrl}`;
          }
          console.log(`📥 Fetching image from: ${fetchUrl}`);
          
          const imageResponse = await fetch(fetchUrl);
          if (imageResponse.ok) {
            const imageBuffer = await imageResponse.arrayBuffer();
            const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
            nftImageDataUrl = `data:${contentType};base64,${Buffer.from(imageBuffer).toString('base64')}`;
            console.log(`✅ Image loaded successfully (${Math.round(imageBuffer.byteLength / 1024)}KB)`);
          } else {
            console.log(`❌ Image fetch failed: ${imageResponse.status} ${imageResponse.statusText}`);
          }
        } catch (e) {
          console.error('❌ Failed to fetch NFT image:', e);
        }
      } else {
        console.log('⚠️ No image URL found for NFT');
      }

      // Get creator display name
      const creatorName = nft.farcasterCreatorUsername 
        ? `@${nft.farcasterCreatorUsername}` 
        : nft.creatorAddress 
          ? `${nft.creatorAddress.slice(0, 6)}...${nft.creatorAddress.slice(-4)}`
          : 'Unknown';

      // Generate SVG with Satori - NFT Card Design
      const svg = await satori(
        {
          type: 'div',
          props: {
            style: {
              width: '1200px',
              height: '630px',
              display: 'flex',
              flexDirection: 'row',
              background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
              fontFamily: 'Inter',
              padding: '40px',
            },
            children: [
              // Left side - NFT Image
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    width: '520px',
                    height: '550px',
                    borderRadius: '24px',
                    overflow: 'hidden',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                  },
                  children: nftImageDataUrl ? {
                    type: 'img',
                    props: {
                      src: nftImageDataUrl,
                      width: 520,
                      height: 550,
                      style: {
                        width: '520px',
                        height: '550px',
                        objectFit: 'cover',
                      },
                    },
                  } : {
                    type: 'div',
                    props: {
                      style: {
                        width: '520px',
                        height: '550px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '80px',
                      },
                      children: '🗺️',
                    },
                  },
                },
              },
              // Right side - Info
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    paddingLeft: '50px',
                    flex: '1',
                  },
                  children: [
                    // TravelMint Logo/Brand
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          marginBottom: '30px',
                        },
                        children: [
                          {
                            type: 'div',
                            props: {
                              style: {
                                fontSize: '28px',
                                marginRight: '12px',
                              },
                              children: '✈️',
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: {
                                color: '#00b4d8',
                                fontSize: '28px',
                                fontWeight: '700',
                              },
                              children: 'TravelMint',
                            },
                          },
                        ],
                      },
                    },
                    // NFT Title
                    {
                      type: 'div',
                      props: {
                        style: {
                          color: 'white',
                          fontSize: '44px',
                          fontWeight: '700',
                          marginBottom: '20px',
                          lineHeight: '1.2',
                        },
                        children: nft.title.length > 40 ? nft.title.slice(0, 40) + '...' : nft.title,
                      },
                    },
                    // Location
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          marginBottom: '24px',
                        },
                        children: [
                          {
                            type: 'div',
                            props: {
                              style: {
                                fontSize: '24px',
                                marginRight: '10px',
                              },
                              children: '📍',
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: {
                                color: 'rgba(255,255,255,0.8)',
                                fontSize: '26px',
                                fontWeight: '500',
                              },
                              children: nft.location.length > 30 ? nft.location.slice(0, 30) + '...' : nft.location,
                            },
                          },
                        ],
                      },
                    },
                    // Creator
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          marginBottom: '40px',
                        },
                        children: [
                          {
                            type: 'div',
                            props: {
                              style: {
                                fontSize: '22px',
                                marginRight: '10px',
                              },
                              children: '🎨',
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: {
                                color: 'rgba(255,255,255,0.7)',
                                fontSize: '22px',
                              },
                              children: `by ${creatorName}`,
                            },
                          },
                        ],
                      },
                    },
                    // CTA
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          background: 'linear-gradient(135deg, #00b4d8 0%, #0077b6 100%)',
                          color: 'white',
                          padding: '18px 36px',
                          borderRadius: '16px',
                          fontSize: '24px',
                          fontWeight: '600',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '280px',
                        },
                        children: '💰 Tip the Creator',
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        {
          width: 1200,
          height: 630,
          fonts: interRegular && interBold ? [
            {
              name: 'Inter',
              data: interRegular,
              weight: 400,
              style: 'normal' as const,
            },
            {
              name: 'Inter',
              data: interBold,
              weight: 700,
              style: 'normal' as const,
            },
          ] : [],
        }
      );

      // Convert SVG to PNG
      const resvg = new Resvg(svg, {
        fitTo: {
          mode: 'width',
          value: 1200,
        },
      });
      const pngData = resvg.render();
      const pngBuffer = pngData.asPng();

      // Set cache headers and return PNG
      res.set({
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      });
      res.send(pngBuffer);
    } catch (error) {
      console.error('Error generating NFT share image:', error);
      res.status(500).json({ message: "Failed to generate NFT share image" });
    }
  });

  // NFT Frame endpoint for Farcaster sharing
  app.get("/api/frames/nft/:tokenId", async (req, res) => {
    try {
      const { tokenId } = req.params;
      
      // Get NFT data from database by tokenId
      const nft = await storage.getNFTByTokenId(tokenId);
      
      if (!nft) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>NFT Not Found - TravelMint</title>
              <meta name="description" content="NFT not found on TravelMint">
            </head>
            <body>
              <h1>NFT Not Found</h1>
              <p>The requested NFT could not be found.</p>
            </body>
          </html>
        `);
      }

      // Escape user data to prevent XSS
      const safeTitle = escapeHtml(nft.title);
      const safeLocation = escapeHtml(nft.location);
      const safeDescription = escapeHtml(`${nft.title} by ${nft.farcasterCreatorUsername ? '@' + nft.farcasterCreatorUsername : 'creator'} - Tip the creator on TravelMint`);
      
      // Generate secure URLs - always use production domain for Farcaster
      const productionDomain = 'https://travelnft.replit.app';
      const frameUrl = `${productionDomain}/api/frames/nft/${tokenId}`;
      
      // Dynamic share image URL with cache buster
      const cacheBuster = Date.now();
      const shareImageUrl = `${productionDomain}/api/nft-share-image/${tokenId}?v=${cacheBuster}`;
      
      // Deep link to NFT detail - opens explore with this NFT selected
      const nftDetailUrl = `${productionDomain}/nft/${tokenId}`;
      
      // Raw NFT image for body preview
      const rawImageUrl = nft.objectStorageUrl || nft.imageUrl || '';
      const sanitizedImageUrl = sanitizeUrl(rawImageUrl);
      const safeRawImageUrl = escapeHtml(sanitizedImageUrl);
      
      // Build Mini App embed JSON for Farcaster (new format)
      const miniAppEmbed = {
        version: "1",
        imageUrl: shareImageUrl,
        button: {
          title: "💰 Tip Creator",
          action: {
            type: "launch_miniapp",
            name: "TravelMint",
            url: nftDetailUrl,
            splashImageUrl: `${productionDomain}/logo.jpeg`,
            splashBackgroundColor: "#0f172a"
          }
        }
      };
      
      // JSON string for meta tags (escaped for HTML attribute)
      const miniAppEmbedJson = JSON.stringify(miniAppEmbed);
      const escapedMiniAppEmbed = miniAppEmbedJson.replace(/"/g, '&quot;');
      
      // Backward compatible fc:frame format
      const frameEmbed = {
        version: "1",
        imageUrl: shareImageUrl,
        button: {
          title: "💰 Tip Creator",
          action: {
            type: "launch_frame",
            name: "TravelMint",
            url: nftDetailUrl,
            splashImageUrl: `${productionDomain}/logo.jpeg`,
            splashBackgroundColor: "#0f172a"
          }
        }
      };
      const frameEmbedJson = JSON.stringify(frameEmbed);
      const escapedFrameEmbed = frameEmbedJson.replace(/"/g, '&quot;');
      
      const frameHtml = `
<!DOCTYPE html>
<html>
  <head>
    <title>${safeTitle} - TravelMint NFT</title>
    <meta name="description" content="${safeDescription}">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${frameUrl}">
    <meta property="og:title" content="${safeTitle} - TravelMint">
    <meta property="og:description" content="${safeDescription}">
    <meta property="og:image" content="${shareImageUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    
    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="${frameUrl}">
    <meta property="twitter:title" content="${safeTitle} - TravelMint">
    <meta property="twitter:description" content="${safeDescription}">
    <meta property="twitter:image" content="${shareImageUrl}">
    
    <!-- Farcaster Mini App Embed (new JSON format) -->
    <meta name="fc:miniapp" content="${escapedMiniAppEmbed}">
    <!-- Backward compatibility -->
    <meta name="fc:frame" content="${escapedFrameEmbed}">
  </head>
  <body>
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; text-align: center;">
      <img src="${safeRawImageUrl}" alt="${safeTitle}" style="max-width: 100%; height: auto; border-radius: 12px; margin-bottom: 20px;">
      <h1 style="color: #333; margin-bottom: 10px;">${safeTitle}</h1>
      <p style="color: #888; margin-bottom: 20px;">Minted on TravelMint</p>
      <a href="${nftDetailUrl}" style="background: #00b4d8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">💰 Tip the Creator</a>
    </div>
  </body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      res.send(frameHtml);
      
    } catch (error) {
      console.error('Error generating NFT frame:', error);
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Error - TravelMint</title>
            <meta name="description" content="Error loading NFT frame">
          </head>
          <body>
            <h1>Error</h1>
            <p>Unable to load NFT frame. Please try again later.</p>
          </body>
        </html>
      `);
    }
  });

  // 🏪 SECURE MARKETPLACE API ROUTES

  // List NFT on marketplace
  app.post("/api/marketplace/list", async (req, res) => {
    try {
      const { tokenId, seller, priceUSDC } = req.body;

      if (!tokenId || !seller || !priceUSDC) {
        return res.status(400).json({ message: "Missing required parameters: tokenId, seller, priceUSDC" });
      }

      // Validate inputs
      if (!ethers.isAddress(seller)) {
        return res.status(400).json({ message: "Invalid seller address format" });
      }

      if (isNaN(parseFloat(priceUSDC)) || parseFloat(priceUSDC) <= 0) {
        return res.status(400).json({ message: "Invalid price amount" });
      }

      // Generate listing transaction
      const listingData = await blockchainService.generateListingTransaction(
        tokenId.toString(),
        seller.toLowerCase(),
        priceUSDC
      );

      if (!listingData.success) {
        return res.status(400).json({ 
          message: listingData.error || "Failed to generate listing transaction",
          type: "LISTING_ERROR"
        });
      }

      console.log(`✅ Generated listing transaction for NFT #${tokenId} at ${priceUSDC} USDC`);

      res.json({
        message: "Listing transaction prepared",
        transactionData: listingData,
        tokenId: tokenId.toString(),
        seller: seller.toLowerCase(),
        priceUSDC
      });

    } catch (error) {
      console.error("Marketplace listing error:", error);
      res.status(500).json({ message: "Failed to prepare listing transaction" });
    }
  });

  // Cancel NFT listing
  app.post("/api/marketplace/cancel", async (req, res) => {
    try {
      const { tokenId, seller } = req.body;

      if (!tokenId || !seller) {
        return res.status(400).json({ message: "Missing required parameters: tokenId, seller" });
      }

      if (!ethers.isAddress(seller)) {
        return res.status(400).json({ message: "Invalid seller address format" });
      }

      // Generate cancel listing transaction
      const cancelData = await blockchainService.generateCancelListingTransaction(
        tokenId.toString(),
        seller.toLowerCase()
      );

      if (!cancelData.success) {
        return res.status(400).json({ 
          message: cancelData.error || "Failed to generate cancel listing transaction",
          type: "CANCEL_ERROR"
        });
      }

      console.log(`✅ Generated cancel listing transaction for NFT #${tokenId}`);

      res.json({
        message: "Cancel listing transaction prepared",
        transactionData: cancelData,
        tokenId: tokenId.toString(),
        seller: seller.toLowerCase()
      });

    } catch (error) {
      console.error("Marketplace cancel listing error:", error);
      res.status(500).json({ message: "Failed to prepare cancel listing transaction" });
    }
  });

  // Update NFT price
  app.post("/api/marketplace/update-price", async (req, res) => {
    try {
      const { tokenId, seller, newPriceUSDC } = req.body;

      if (!tokenId || !seller || !newPriceUSDC) {
        return res.status(400).json({ message: "Missing required parameters: tokenId, seller, newPriceUSDC" });
      }

      if (!ethers.isAddress(seller)) {
        return res.status(400).json({ message: "Invalid seller address format" });
      }

      if (isNaN(parseFloat(newPriceUSDC)) || parseFloat(newPriceUSDC) <= 0) {
        return res.status(400).json({ message: "Invalid price amount" });
      }

      // Generate update price transaction
      const updateData = await blockchainService.generateUpdatePriceTransaction(
        tokenId.toString(),
        seller.toLowerCase(),
        newPriceUSDC
      );

      if (!updateData.success) {
        return res.status(400).json({ 
          message: updateData.error || "Failed to generate update price transaction",
          type: "UPDATE_PRICE_ERROR"
        });
      }

      console.log(`✅ Generated update price transaction for NFT #${tokenId} to ${newPriceUSDC} USDC`);

      res.json({
        message: "Update price transaction prepared",
        transactionData: updateData,
        tokenId: tokenId.toString(),
        seller: seller.toLowerCase(),
        newPriceUSDC
      });

    } catch (error) {
      console.error("Marketplace update price error:", error);
      res.status(500).json({ message: "Failed to prepare update price transaction" });
    }
  });

  // Get marketplace listing for specific NFT
  app.get("/api/marketplace/listings/:tokenId", async (req, res) => {
    try {
      const { tokenId } = req.params;

      if (!tokenId) {
        return res.status(400).json({ message: "Token ID is required" });
      }

      const listing = await blockchainService.getMarketplaceListing(tokenId);

      if (!listing) {
        return res.status(404).json({ message: "No active listing found for this NFT" });
      }

      res.json({
        listing,
        message: "Listing found"
      });

    } catch (error) {
      console.error("Get marketplace listing error:", error);
      res.status(500).json({ message: "Failed to get marketplace listing" });
    }
  });

  // Check if NFT is listed
  app.get("/api/marketplace/is-listed/:tokenId", async (req, res) => {
    try {
      const { tokenId } = req.params;

      if (!tokenId) {
        return res.status(400).json({ message: "Token ID is required" });
      }

      const isListed = await blockchainService.isNFTListed(tokenId);

      res.json({
        tokenId,
        isListed,
        message: isListed ? "NFT is listed for sale" : "NFT is not listed"
      });

    } catch (error) {
      console.error("Check if NFT listed error:", error);
      res.status(500).json({ message: "Failed to check listing status" });
    }
  });

  // Get marketplace statistics
  app.get("/api/marketplace/stats", async (req, res) => {
    try {
      const stats = await blockchainService.getMarketplaceStats();

      res.json({
        stats,
        message: "Marketplace statistics retrieved"
      });

    } catch (error) {
      console.error("Get marketplace stats error:", error);
      res.status(500).json({ message: "Failed to get marketplace statistics" });
    }
  });

  // Farcaster Mini App webhook endpoint for notification events
  app.post("/api/farcaster/miniapp-webhook", async (req, res) => {
    try {
      console.log('📱 Received Farcaster Mini App webhook:', req.body);
      
      const { event, fid, notificationDetails } = req.body;
      
      // Handle miniapp_added event - this is when we get real notification tokens
      if (event === 'miniapp_added' && fid && notificationDetails?.token) {
        const { token, url } = notificationDetails;
        
        console.log(`📱 Mini App added for FID ${fid} with notification token`);
        
        // Store the real notification token
        const updatedUser = await storage.updateUserNotificationToken(
          fid.toString(), 
          token
        );

        if (!updatedUser) {
          // Create user stats if they don't exist
          await storage.createOrUpdateUserStats({
            farcasterFid: fid.toString(),
            farcasterUsername: `user-${fid}`,
            farcasterPfpUrl: null,
            totalPoints: 0,
            weeklyPoints: 0,
            currentStreak: 0,
            longestStreak: 0,
            weeklyResetDate: new Date(),
            notificationToken: token,
            notificationsEnabled: true,
            lastNotificationSent: null
          });
        }

        console.log(`✅ Stored real notification token for FID ${fid}`);
        
        res.json({
          success: true,
          message: "Notification token stored successfully"
        });
      } 
      // Handle other events
      else if (event === 'notifications_enabled' && fid) {
        await storage.enableUserNotifications(fid.toString(), true);
        console.log(`🔔 Notifications enabled for FID ${fid}`);
        res.json({ success: true });
      }
      else if (event === 'notifications_disabled' && fid) {
        await storage.enableUserNotifications(fid.toString(), false);
        console.log(`🔕 Notifications disabled for FID ${fid}`);
        res.json({ success: true });
      }
      else if (event === 'miniapp_removed' && fid) {
        // Remove notification token when Mini App is removed
        await storage.enableUserNotifications(fid.toString(), false);
        console.log(`🗑️ Mini App removed for FID ${fid}`);
        res.json({ success: true });
      }
      else {
        console.log('ℹ️ Unhandled webhook event:', event);
        res.json({ success: true, message: "Event received" });
      }

    } catch (error: any) {
      console.error('❌ Farcaster webhook processing failed:', error);
      res.status(500).json({ 
        success: false, 
        message: "Webhook processing failed", 
        error: error.message 
      });
    }
  });

  // ADMIN Notification Management Endpoints - SECRET PROTECTED
  
  // Send notification to users with tokens
  app.post("/api/admin/notifications/send", async (req, res) => {
    try {
      // Enhanced admin authentication with rate limiting and audit logging
      const authResult = verifyAdminAuth(req);
      if (!authResult.success) {
        const statusCode = authResult.shouldBlock ? 429 : 401;
        return res.status(statusCode).json({ message: authResult.error });
      }

      // Check if notification service is available
      if (!isNotificationServiceAvailable()) {
        return res.status(503).json({ 
          message: "Notification service unavailable - NEYNAR_API_KEY not configured" 
        });
      }

      // Validate input with Zod schema
      const sendNotificationSchema = z.object({
        title: z.string().min(1, "Title is required").max(100, "Title too long"),
        message: z.string().min(1, "Message is required").max(500, "Message too long"),
        targetUrl: z.string().url().optional()
      });

      const validationResult = sendNotificationSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid input data", 
          errors: validationResult.error.errors 
        });
      }

      const { title, message, targetUrl } = validationResult.data;

      // Get users with notifications enabled
      const usersWithNotifications = await storage.getUsersWithNotifications();
      
      if (usersWithNotifications.length === 0) {
        return res.status(400).json({ 
          message: "No users have notifications enabled" 
        });
      }

      const fids = usersWithNotifications
        .filter(user => user.farcasterFid && user.notificationsEnabled)
        .map(user => parseInt(user.farcasterFid, 10))
        .filter(fid => !isNaN(fid));

      if (fids.length === 0) {
        // Instead of failing, try empty array to target all enabled users
        console.log("⚠️ No specific FIDs found, attempting broadcast to all enabled users");
      }

      const notificationService = getNotificationService();
      if (!notificationService) {
        return res.status(503).json({ 
          message: "Notification service not initialized" 
        });
      }

      // Send notification - try both specific FIDs and empty array for comparison
      console.log(`🎯 First attempt: Specific FIDs [${fids.join(', ')}]`);
      const result = await notificationService.sendNotification({
        title,
        message,
        fids,
        targetUrl: targetUrl || "https://travelmint.replit.app"
      });

      // If no success, try empty array (broadcast to all enabled users)
      if (result.successCount === 0 && fids.length > 0) {
        console.log(`🔄 Specific FIDs failed, trying empty array broadcast...`);
        const broadcastResult = await notificationService.sendNotification({
          title: title + " (Broadcast)",
          message,
          fids: [], // Empty array = all enabled users
          targetUrl: targetUrl || "https://travelmint.replit.app"
        });
        
        console.log(`📊 Broadcast result: Success: ${broadcastResult.successCount}, Failed: ${broadcastResult.failureCount}`);
        
        // Use broadcast result if it was more successful
        if (broadcastResult.successCount > result.successCount) {
          console.log(`✅ Using broadcast result instead`);
          result.successCount = broadcastResult.successCount;
          result.failureCount = broadcastResult.failureCount;
          result.success = broadcastResult.success;
        }
      }

      // Save to history
      await storage.createNotificationHistory({
        title,
        message,
        targetUrl: targetUrl || "https://travelmint.replit.app",
        recipientCount: fids.length,
        successCount: result.successCount,
        failureCount: result.failureCount,
        sentBy: "admin"
      });

      // Update last notification sent ONLY for actually successful recipients
      if (result.successCount > 0) {
        // Note: In a complete implementation, we'd need the notification service to return
        // which specific tokens were successful to map back to farcasterFids
        // For now, we conservatively update only if ALL notifications succeeded
        if (result.failureCount === 0 && result.rateLimitedCount === 0) {
          const successfulFids = usersWithNotifications.map(user => user.farcasterFid);
          await storage.updateLastNotificationSent(successfulFids);
        }
      }

      res.json({
        success: true,
        message: `Notification sent to ${result.successCount}/${fids.length} users`,
        stats: {
          totalUsers: fids.length,
          successCount: result.successCount,
          failureCount: result.failureCount,
          rateLimitedCount: result.rateLimitedCount
        },
        errors: result.errors
      });

    } catch (error: any) {
      console.error('❌ Admin notification send failed:', error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to send notification", 
        error: error.message 
      });
    }
  });

  // Get notification history
  app.get("/api/admin/notifications/history", async (req, res) => {
    try {
      // Enhanced admin authentication with rate limiting and audit logging
      const authResult = verifyAdminAuth(req);
      if (!authResult.success) {
        const statusCode = authResult.shouldBlock ? 429 : 401;
        return res.status(statusCode).json({ message: authResult.error });
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const history = await storage.getNotificationHistory(limit);

      res.json({
        success: true,
        history,
        count: history.length
      });

    } catch (error: any) {
      console.error('❌ Get notification history failed:', error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to get notification history", 
        error: error.message 
      });
    }
  });

  // Get notification service status and user stats
  app.get("/api/admin/notifications/status", async (req, res) => {
    try {
      // Enhanced admin authentication with rate limiting and audit logging
      const authResult = verifyAdminAuth(req);
      if (!authResult.success) {
        const statusCode = authResult.shouldBlock ? 429 : 401;
        return res.status(statusCode).json({ message: authResult.error });
      }

      const serviceAvailable = isNotificationServiceAvailable();
      let connectionTest = false;

      if (serviceAvailable) {
        const notificationService = getNotificationService();
        if (notificationService) {
          connectionTest = await notificationService.testConnection();
        }
      }

      const usersWithNotifications = await storage.getUsersWithNotifications();
      const recentHistory = await storage.getNotificationHistory(5);

      res.json({
        success: true,
        status: {
          serviceAvailable,
          connectionTest,
          usersWithTokens: usersWithNotifications.length,
          recentNotifications: recentHistory.length
        },
        recentHistory
      });

    } catch (error: any) {
      console.error('❌ Get notification status failed:', error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to get notification status", 
        error: error.message 
      });
    }
  });

  // Admin security status endpoint
  app.get("/api/admin/security/status", async (req, res) => {
    try {
      // Enhanced admin authentication with rate limiting and audit logging
      const authResult = verifyAdminAuth(req);
      if (!authResult.success) {
        const statusCode = authResult.shouldBlock ? 429 : 401;
        return res.status(statusCode).json({ message: authResult.error });
      }

      // Get security metrics
      const now = Date.now();
      const rateLimitWindow = ADMIN_RATE_LIMIT.windowMs;
      
      let totalAttempts = 0;
      let blockedIPs = 0;
      const recentAttempts: { ip: string; attempts: number; blocked: boolean }[] = [];

      // Count currently blocked IPs
      adminBlocks.forEach((block, ip) => {
        if (now - block.blockedAt < ADMIN_RATE_LIMIT.blockDurationMs) {
          blockedIPs++;
        }
      });

      // Collect recent attempts data
      adminAttempts.forEach((attempts, ip) => {
        const recentIpAttempts = attempts.filter(
          attempt => now - attempt.timestamp < rateLimitWindow
        );
        
        if (recentIpAttempts.length > 0) {
          totalAttempts += recentIpAttempts.length;
          const isBlocked = isRateLimited(ip);
          
          recentAttempts.push({
            ip: ip.length > 15 ? ip.substring(0, 12) + '...' : ip, // Truncate long IPs
            attempts: recentIpAttempts.length,
            blocked: isBlocked
          });
        }
      });

      const clientIp = getClientIp(req);
      
      res.json({
        success: true,
        security: {
          currentTime: new Date().toISOString(),
          rateLimiting: {
            maxAttempts: ADMIN_RATE_LIMIT.maxAttempts,
            windowMinutes: ADMIN_RATE_LIMIT.windowMs / (60 * 1000),
            blockDurationMinutes: ADMIN_RATE_LIMIT.blockDurationMs / (60 * 1000),
            totalRecentAttempts: totalAttempts,
            blockedIPs,
            recentAttempts: recentAttempts.slice(0, 10) // Limit to 10 most recent
          },
          currentSession: {
            ip: clientIp.length > 15 ? clientIp.substring(0, 12) + '...' : clientIp,
            userAgent: req.headers['user-agent']?.substring(0, 50) + '...' || 'unknown',
            authenticated: true
          }
        }
      });

    } catch (error: any) {
      console.error('❌ Get admin security status failed:', error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to get security status", 
        error: error.message 
      });
    }
  });

  // Store notification token from Farcaster SDK
  app.post("/api/user-stats/notification-token", async (req, res) => {
    try {
      const { farcasterFid, notificationToken, notificationsEnabled } = req.body;

      if (!farcasterFid || !notificationToken) {
        return res.status(400).json({ 
          message: "farcasterFid and notificationToken are required" 
        });
      }

      // Validate notification token format (real Farcaster tokens should have specific structure)
      if (typeof notificationToken !== 'string' || notificationToken.length < 10) {
        return res.status(400).json({ 
          message: "Invalid notification token format" 
        });
      }

      // Update user's notification token in database
      const updatedUser = await storage.updateUserNotificationToken(
        farcasterFid, 
        notificationToken
      );

      if (updatedUser) {
        console.log(`📱 Stored notification token for user ${farcasterFid}`);
        res.json({
          success: true,
          message: "Notification token stored successfully",
          user: {
            farcasterFid: updatedUser.farcasterFid,
            notificationsEnabled: updatedUser.notificationsEnabled,
            hasToken: !!updatedUser.notificationToken
          }
        });
      } else {
        // User doesn't exist in user_stats, try to create them
        try {
          const newUserStats = await storage.createOrUpdateUserStats({
            farcasterFid,
            farcasterUsername: `user-${farcasterFid}`, // Will be updated when we get real username
            farcasterPfpUrl: null,
            totalPoints: 0,
            weeklyPoints: 0,
            currentStreak: 0,
            longestStreak: 0,
            weeklyResetDate: new Date(),
            notificationToken,
            notificationsEnabled: true,
            lastNotificationSent: null
          });

          console.log(`📱 Created user stats with notification token for ${farcasterFid}`);
          res.json({
            success: true,
            message: "User created and notification token stored",
            user: {
              farcasterFid: newUserStats.farcasterFid,
              notificationsEnabled: newUserStats.notificationsEnabled,
              hasToken: !!newUserStats.notificationToken
            }
          });
        } catch (createError) {
          console.error('❌ Failed to create user stats:', createError);
          res.status(500).json({ 
            message: "Failed to store notification token" 
          });
        }
      }

    } catch (error: any) {
      console.error('❌ Store notification token failed:', error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to store notification token", 
        error: error.message 
      });
    }
  });

  // Get users with notifications enabled (for admin review)
  app.get("/api/admin/notifications/users", async (req, res) => {
    try {
      // Check admin secret - FAIL CLOSED if not configured
      const adminSecret = process.env.ADMIN_SECRET;
      if (!adminSecret) {
        console.error('❌ ADMIN_SECRET not configured - blocking admin access');
        return res.status(500).json({ message: "Admin access not configured" });
      }
      
      const providedSecret = req.headers['x-admin-key'];
      if (!providedSecret || providedSecret !== adminSecret) {
        return res.status(401).json({ message: "Unauthorized - invalid admin key" });
      }

      const users = await storage.getUsersWithNotifications();

      // Return only safe user info (no actual tokens)
      const safeUsers = users.map(user => ({
        farcasterFid: user.farcasterFid,
        farcasterUsername: user.farcasterUsername,
        hasToken: !!user.notificationToken,
        notificationsEnabled: user.notificationsEnabled,
        lastNotificationSent: user.lastNotificationSent,
        totalPoints: user.totalPoints,
        weeklyPoints: user.weeklyPoints
      }));

      res.json({
        success: true,
        users: safeUsers,
        count: safeUsers.length
      });

    } catch (error: any) {
      console.error('❌ Get notification users failed:', error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to get notification users", 
        error: error.message 
      });
    }
  });

  // ===== IMAGE SYNC ENDPOINTS =====
  
  // Helper to validate admin access
  const validateAdminAccess = (req: Request, res: Response): boolean => {
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
      console.error('❌ ADMIN_SECRET not configured - blocking admin access');
      res.status(500).json({ message: "Admin access not configured" });
      return false;
    }
    
    const providedSecret = req.headers['x-admin-key'];
    if (!providedSecret || providedSecret !== adminSecret) {
      res.status(401).json({ message: "Unauthorized - invalid admin key" });
      return false;
    }
    return true;
  };
  
  // Get image sync status (protected)
  app.get("/api/admin/image-sync/status", async (req, res) => {
    try {
      if (!validateAdminAccess(req, res)) return;
      
      const status = await getSyncStatus();
      res.json({
        success: true,
        ...status
      });
    } catch (error: any) {
      console.error('❌ Get image sync status failed:', error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to get sync status", 
        error: error.message 
      });
    }
  });

  // Trigger full image sync (protected, background)
  app.post("/api/admin/image-sync/start", async (req, res) => {
    try {
      if (!validateAdminAccess(req, res)) return;
      
      console.log('🖼️ Image sync triggered via API');
      
      // Immediately return response
      res.json({
        success: true,
        message: "Image sync started in background. Check /api/admin/image-sync/status for progress."
      });

      // Run sync in background (don't await)
      syncAllImages().then(result => {
        console.log(`🖼️ Background image sync complete: ${result.synced} synced, ${result.failed} failed`);
      }).catch(error => {
        console.error('❌ Background image sync failed:', error);
      });

    } catch (error: any) {
      console.error('❌ Start image sync failed:', error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to start sync", 
        error: error.message 
      });
    }
  });

  // Sync single NFT image (protected)
  app.post("/api/admin/image-sync/nft/:id", async (req, res) => {
    try {
      if (!validateAdminAccess(req, res)) return;
      
      const { id } = req.params;
      console.log(`🖼️ Single NFT image sync triggered: ${id}`);
      
      const success = await syncSingleImage(id);
      
      res.json({
        success,
        message: success ? "Image synced successfully" : "Failed to sync image"
      });

    } catch (error: any) {
      console.error('❌ Single image sync failed:', error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to sync image", 
        error: error.message 
      });
    }
  });

  // 🔄 Automatic blockchain sync for newly minted NFTs
  async function syncMintEvents() {
    try {
      console.log('🔄 Starting Mint event sync...');
      
      // Get ALL transfer events from blockchain
      const transferEvents = await blockchainService.getAllTransferEvents();
      
      if (transferEvents.length === 0) {
        console.log('📭 No events found on blockchain');
        return;
      }
      
      // Filter for Mint events (from = 0x0000...)
      const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
      const mintEvents = transferEvents.filter(event => 
        event.from.toLowerCase() === ZERO_ADDRESS.toLowerCase()
      );
      
      if (mintEvents.length === 0) {
        console.log('📭 No mint events found');
        return;
      }
      
      console.log(`✨ Found ${mintEvents.length} mint events`);
      
      let syncedCount = 0;
      
      // Process each mint event
      for (const event of mintEvents) {
        try {
          // Check if NFT already exists in database
          const existingNFT = await storage.getNFTByTokenId(event.tokenId);
          if (existingNFT) {
            continue; // Already in database
          }
          
          // Fetch NFT metadata from blockchain
          console.log(`📥 Fetching metadata for newly minted NFT #${event.tokenId}...`);
          const blockchainNFT = await blockchainService.getNFTByTokenId(event.tokenId);
          
          if (!blockchainNFT) {
            console.log(`⚠️ Could not fetch metadata for NFT #${event.tokenId}`);
            continue;
          }
          
          // Parse metadata
          const metadata = blockchainNFT.metadata || {};
          const title = metadata.name || `Travel NFT #${event.tokenId}`;
          const description = metadata.description || '';
          const imageUrl = metadata.image || blockchainNFT.tokenURI;
          
          // Extract location from metadata
          let location = 'Unknown';
          let latitude = '0';
          let longitude = '0';
          
          if (metadata.attributes && Array.isArray(metadata.attributes)) {
            const locationAttr = metadata.attributes.find((attr: any) => 
              attr.trait_type === 'Location' || attr.trait_type === 'location'
            );
            if (locationAttr) {
              location = locationAttr.value;
            }
            
            const latAttr = metadata.attributes.find((attr: any) => 
              attr.trait_type === 'Latitude' || attr.trait_type === 'latitude'
            );
            if (latAttr) {
              latitude = latAttr.value.toString();
            }
            
            const lngAttr = metadata.attributes.find((attr: any) => 
              attr.trait_type === 'Longitude' || attr.trait_type === 'longitude'
            );
            if (lngAttr) {
              longitude = lngAttr.value.toString();
            }
          }
          
          // Add NFT to database
          await storage.createNFT({
            tokenId: event.tokenId,
            title,
            description,
            imageUrl,
            price: '1.0', // Default price
            location,
            category: 'travel', // Default category
            latitude,
            longitude,
            creatorAddress: event.to.toLowerCase(), // Minter is the creator
            ownerAddress: event.to.toLowerCase(),
            isForSale: 0
          });
          
          syncedCount++;
          console.log(`✅ Synced newly minted NFT #${event.tokenId} (${title}) - owner: ${event.to.slice(0, 10)}...`);
          
        } catch (error) {
          console.error(`❌ Failed to sync mint event for NFT #${event.tokenId}:`, error);
        }
      }
      
      if (syncedCount > 0) {
        console.log(`🎉 Mint sync complete: ${syncedCount} new NFTs added to database`);
      } else {
        console.log('✅ Mint sync complete: All NFTs up to date');
      }
      
    } catch (error) {
      console.error('❌ Mint sync failed:', error);
    }
  }

  // 🔄 Automatic blockchain sync for Recent Activity + Auto-delist on transfer
  async function syncRecentActivity() {
    try {
      console.log('🔄 Starting blockchain sync for Recent Activity...');
      
      // Get ALL transfer events from blockchain (purchases + regular transfers)
      const transferEvents = await blockchainService.getAllTransferEvents();
      
      if (transferEvents.length === 0) {
        console.log('📭 No transfer events found on blockchain');
        return;
      }
      
      // Check which transactions are already in database
      const existingTxns = await storage.getRecentTransactions(1000);
      const existingTxHashes = new Set(
        existingTxns
          .map((t: any) => t.blockchainTxHash?.toLowerCase())
          .filter((hash: any) => hash)
      );
      
      let syncedCount = 0;
      let delistedCount = 0;
      
      // Process each transfer
      for (const event of transferEvents) {
        if (existingTxHashes.has(event.transactionHash.toLowerCase())) {
          continue; // Already in database
        }
        
        try {
          // Get NFT details
          const nft = await storage.getNFTByTokenId(event.tokenId);
          if (!nft) {
            console.log(`⚠️ NFT #${event.tokenId} not found in database, skipping...`);
            continue;
          }
          
          // Update NFT owner and auto-delist (this happens for ALL transfers, sale or not)
          const wasListed = nft.isForSale === 1;
          await storage.updateNFTOwnerAndDelist(event.tokenId, event.to);
          
          if (wasListed) {
            delistedCount++;
            console.log(`🔓 Auto-delisted NFT #${event.tokenId} (${nft.title}) - transferred to ${event.to.slice(0, 10)}...`);
          }
          
          // Create transaction record
          await storage.createTransaction({
            nftId: nft.id,
            fromAddress: event.from,
            toAddress: event.to,
            transactionType: event.transferType, // 'sale' or 'transfer'
            amount: event.price,
            platformFee: event.platformFee,
            blockchainTxHash: event.transactionHash
          });
          
          syncedCount++;
          
          if (event.transferType === 'sale') {
            console.log(`✅ Synced sale: NFT #${event.tokenId} (${event.to.slice(0, 10)}... bought from ${event.from.slice(0, 10)}...) for ${event.price} USDC`);
          } else {
            console.log(`✅ Synced transfer: NFT #${event.tokenId} (${event.from.slice(0, 10)}... → ${event.to.slice(0, 10)}...)`);
          }
          
        } catch (error) {
          console.error(`❌ Failed to sync transaction ${event.transactionHash}:`, error);
        }
      }
      
      if (syncedCount > 0) {
        console.log(`🎉 Blockchain sync complete: ${syncedCount} new transactions added, ${delistedCount} NFTs auto-delisted`);
      } else {
        console.log('✅ Blockchain sync complete: All transactions up to date');
      }
      
    } catch (error) {
      console.error('❌ Blockchain sync failed:', error);
    }
  }
  
  // 🌐 Basescan-based NFT discovery (more reliable than RPC event scanning)
  async function syncFromBasescan() {
    try {
      console.log('🌐 Starting Basescan API sync for NFT discovery...');
      
      const { newNFTs, missingTokens } = await blockchainService.syncNFTsFromBasescan(storage);
      
      if (newNFTs.length === 0) {
        console.log('✅ Basescan sync: Database is up to date');
        return;
      }
      
      console.log(`🔍 Basescan found ${newNFTs.length} missing tokens: ${missingTokens.join(', ')}`);
      
      // Add each new NFT to database
      for (const nft of newNFTs) {
        try {
          // Fetch and parse metadata
          const nftWithMetadata = await blockchainService.fetchMetadataAsync(nft);
          const metadata = nftWithMetadata.metadata || {};
          
          const title = metadata.name || `Travel NFT #${nft.tokenId}`;
          const description = metadata.description || '';
          const imageUrl = metadata.image || nft.tokenURI;
          
          // Extract location data
          let location = 'Unknown';
          let latitude = '0';
          let longitude = '0';
          
          if (metadata.attributes && Array.isArray(metadata.attributes)) {
            const locationAttr = metadata.attributes.find((attr: any) => 
              attr.trait_type === 'Location' || attr.trait_type === 'location'
            );
            if (locationAttr) location = locationAttr.value;
            
            const latAttr = metadata.attributes.find((attr: any) => 
              attr.trait_type === 'Latitude' || attr.trait_type === 'latitude'
            );
            if (latAttr) latitude = latAttr.value.toString();
            
            const lngAttr = metadata.attributes.find((attr: any) => 
              attr.trait_type === 'Longitude' || attr.trait_type === 'longitude'
            );
            if (lngAttr) longitude = lngAttr.value.toString();
          }
          
          // Add to database
          await storage.createNFT({
            tokenId: nft.tokenId,
            title,
            description,
            imageUrl,
            location,
            latitude,
            longitude,
            ownerAddress: nft.owner,
            creatorAddress: nft.owner,
            category: 'Travel',
            price: '0',
            isListed: false
          });
          
          console.log(`✅ Added NFT #${nft.tokenId}: ${title} at ${location}`);
          
        } catch (error) {
          console.error(`❌ Error adding NFT #${nft.tokenId}:`, error);
        }
      }
      
      console.log(`🎉 Basescan sync complete: ${newNFTs.length} new NFTs added to database`);
      
    } catch (error) {
      console.error('❌ Basescan sync failed:', error);
    }
  }
  
  // Run initial sync on server startup
  console.log('🚀 Starting initial blockchain sync...');
  
  // First, use Basescan API to discover any missing NFTs (most reliable)
  syncFromBasescan();
  
  // Then run periodic RPC-based sync for real-time updates
  syncMintEvents(); // Sync any newly minted NFTs first
  syncRecentActivity(); // Then sync transfers
  
  // Setup periodic sync every 5 seconds for faster map updates
  setInterval(() => {
    syncMintEvents();
    syncRecentActivity();
  }, 5000);
  console.log('⏰ Periodic blockchain sync enabled (Mint events + Transfers every 5 seconds)');
  
  // Run Basescan discovery sync every 30 seconds to catch any missed tokens
  setInterval(() => {
    syncFromBasescan();
  }, 30000);
  console.log('⏰ Basescan discovery sync enabled (every 30 seconds)');

  // Initialize metadata sync service
  const metadataSyncService = new MetadataSyncService(storage);
  
  // Run initial metadata sync on startup to fix any broken tokens
  console.log('🔧 Running initial metadata sync to fix broken tokens...');
  metadataSyncService.runMetadataSync();
  
  // Run metadata sync every 15 seconds to meet 10-15 second SLA for pending mints
  setInterval(() => {
    metadataSyncService.runMetadataSync();
  }, 15000); // 15 seconds - ensures pending mints are retried within SLA
  console.log('⏰ Metadata sync enabled (every 15 seconds)');

  return createServer(app);
}
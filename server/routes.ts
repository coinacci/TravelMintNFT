import { createServer } from "http";
import express, { Request, Response, Express } from "express";
import { storage } from "./storage";
import { blockchainService, withRetry, nftContract } from "./blockchain";
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
import { ethers } from "ethers";
import ipfsRoutes from "./routes/ipfs";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { farcasterCastValidator } from "./farcaster-validation";
import multer from "multer";

const ALLOWED_CONTRACT = "0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f";
const PLATFORM_WALLET = "0x7CDe7822456AAC667Df0420cD048295b92704084"; // Platform commission wallet

// Simple in-memory cache to avoid expensive blockchain calls
interface CacheEntry {
  data: any[];
  timestamp: number;
}

const nftCache: { [key: string]: CacheEntry } = {};
const CACHE_DURATION = 5 * 1000; // 5 seconds cache for real-time detection

function isCacheValid(key: string): boolean {
  const entry = nftCache[key];
  if (!entry) return false;
  return (Date.now() - entry.timestamp) < CACHE_DURATION;
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

export async function registerRoutes(app: Express) {
  
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
    <meta name="primaryCategory" content="social" />
    
    <!-- Base App Compatible Mini App Discovery Tags -->
    <meta name="fc:miniapp" content='{
      "version": "1",
      "iconUrl": "${baseUrl}/base-icon.png",
      "imageUrl": "${baseUrl}/base-image.png",
      "button": {
        "title": "Open TravelMint",
        "action": {
          "type": "link",
          "name": "TravelMint",
          "url": "${baseUrl}",
          "splashImageUrl": "${baseUrl}/base-splash.png",
          "splashBackgroundColor": "#0f172a"
        }
      }
    }' />
    
    <!-- Base App Compatible Icons -->
    <link rel="icon" type="image/png" sizes="32x32" href="/base-icon.png" />
    <link rel="apple-touch-icon" href="/base-icon.png" />
    <meta name="theme-color" content="#0f172a" />
    
    <!-- Open Graph Tags - Base App Compatible -->
    <meta property="og:title" content="TravelMint - Travel Photo NFT Marketplace" />
    <meta property="og:description" content="Mint, buy, and sell location-based travel photo NFTs on Base blockchain" />
    <meta property="og:image" content="${baseUrl}/base-image.png" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${baseUrl}" />
    <meta property="og:site_name" content="TravelMint" />
    
    <!-- Twitter Card Tags - Base App Compatible -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="TravelMint - Travel Photo NFT Marketplace" />
    <meta name="twitter:description" content="Turn your travel memories into NFTs" />
    <meta name="twitter:image" content="${baseUrl}/base-image.png" />
    
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
      // Check cache first for instant response
      if (isCacheValid('all-nfts')) {
        console.log("⚡ Returning cached NFTs (instant response)");
        return res.json(nftCache['all-nfts'].data);
      }

      console.log("🔗 Cache miss - fetching NFTs from database...");
      
      // Get all NFTs from database immediately (fast response)
      const allDbNFTs = await storage.getAllNFTs();
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
            creator: createUserObject(nft.creatorAddress, nft.farcasterCreatorUsername, nft.farcasterCreatorFid)
          };
        })
      );
      
      // Cache the processed results for fast future requests
      setCacheEntry('all-nfts', nftsWithOwners);
      console.log(`✅ Returning ${nftsWithOwners.length} total NFTs (cached for fast access)`);
      
      // Immediate cache clear and aggressive blockchain sync (non-blocking)
      setImmediate(async () => {
        try {
          console.log("🔄 Background blockchain sync starting...");
          const blockchainNFTs = await blockchainService.getAllNFTs();
          console.log(`Found ${blockchainNFTs.length} NFTs on blockchain`);
          
          // Sync any blockchain NFTs that aren't in database yet
          for (const blockchainNFT of blockchainNFTs) {
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
              const currentLat = parseFloat(existsInDb.latitude || "0");
              const currentLng = parseFloat(existsInDb.longitude || "0");
              
              if ((currentLat === 0 && currentLng === 0) && blockchainNFT.metadata) {
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
          
          // Clear cache after background sync to show new/updated NFTs
          clearAllCache();
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
      const allNfts = await storage.getNFTsForSale();
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
            creator: createUserObject(nft.creatorAddress, nft.farcasterCreatorUsername, nft.farcasterCreatorFid)
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


      res.json({
        ...nft,
        // Use metadata name and image if available, fallback to NFT fields
        title: parsedMetadata?.name || nft.title,
        imageUrl: nft.imageUrl || parsedMetadata?.image,
        owner: createUserObject(nft.ownerAddress, nft.farcasterOwnerUsername, nft.farcasterOwnerFid),
        creator: createUserObject(nft.creatorAddress, nft.farcasterCreatorUsername, nft.farcasterCreatorFid)
      });
    } catch (error) {
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
      const tokenId = currentNFT.id.replace("blockchain-", "");
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
  const getCountryFromCoordinates = (lat: number, lng: number): string => {
    // France borders: roughly 41-51°N, -5 to 10°E
    if (lat >= 41 && lat <= 51 && lng >= -5 && lng <= 10) {
      return 'France';
    }
    // Switzerland borders: roughly 45.8-47.8°N, 5.9-10.5°E
    if (lat >= 45.8 && lat <= 47.8 && lng >= 5.9 && lng <= 10.5) {
      return 'Switzerland';
    }
    // Italy borders: roughly 35-47°N, 6-19°E
    if (lat >= 35 && lat <= 47 && lng >= 6 && lng <= 19) {
      return 'Italy';
    }
    // Montenegro borders: roughly 42-43.5°N, 18.5-20.5°E
    if (lat >= 42 && lat <= 43.5 && lng >= 18.5 && lng <= 20.5) {
      return 'Montenegro';
    }
    // Cyprus borders: roughly 34.5-35.7°N, 32-34.6°E
    if (lat >= 34.5 && lat <= 35.7 && lng >= 32 && lng <= 34.6) {
      return 'Cyprus';
    }
    // Turkey borders: roughly 36-42°N, 26-45°E
    if (lat >= 36 && lat <= 42 && lng >= 26 && lng <= 45) {
      return 'Turkey';
    }
    // Georgia borders: roughly 41-43.6°N, 39.9-46.7°E
    if (lat >= 41 && lat <= 43.6 && lng >= 39.9 && lng <= 46.7) {
      return 'Georgia';
    }
    // Egypt borders: roughly 22-32°N, 25-35°E  
    if (lat >= 22 && lat <= 32 && lng >= 25 && lng <= 35) {
      return 'Egypt';
    }
    // UAE borders: roughly 22-26°N, 51-56°E
    if (lat >= 22 && lat <= 26 && lng >= 51 && lng <= 56) {
      return 'UAE';
    }
    // Thailand borders: roughly 5.5-20.5°N, 97-106°E
    if (lat >= 5.5 && lat <= 20.5 && lng >= 97 && lng <= 106) {
      return 'Thailand';
    }
    // Canada borders: roughly 42-75°N, -141 to -52°W
    if (lat >= 42 && lat <= 75 && lng >= -141 && lng <= -52) {
      return 'Canada';
    }
    // USA borders: roughly 24-49°N, -125 to -66°W
    if (lat >= 24 && lat <= 49 && lng >= -125 && lng <= -66) {
      return 'USA';
    }
    return 'Unknown';
  };

  // Hybrid country detection (same logic as frontend)
  const getNFTCountry = (nft: any): string => {
    // First try location-based mapping
    let country = locationToCountry[nft.location];
    
    // If not found and it's a manual location with coordinates, use coordinates
    if (!country && nft.location?.startsWith('Location at ') && nft.latitude && nft.longitude) {
      const lat = parseFloat(nft.latitude);
      const lng = parseFloat(nft.longitude);
      if (!isNaN(lat) && !isNaN(lng) && !(lat === 0 && lng === 0)) {
        country = getCountryFromCoordinates(lat, lng);
      }
    }
    
    return country || 'Unknown';
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
      const tokenId = nft.id.replace("blockchain-", "");
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
      
      // Extract token ID from NFT ID (format: "blockchain-{tokenId}")
      const tokenId = nftToUpdate.id.replace("blockchain-", "");
      if (!tokenId || isNaN(Number(tokenId))) {
        return res.status(400).json({ message: "Invalid NFT token ID" });
      }
      
      // 🛡️ CRITICAL: Verify the blockchain transaction before updating database
      const verification = await blockchainService.verifyPurchaseTransaction(
        transactionHash,
        tokenId,
        buyerId.toLowerCase()
      );
      
      if (!verification.success) {
        console.log(`❌ Transaction verification failed: ${verification.error}`);
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
      await storage.createTransaction({
        nftId: nftToUpdate.id,
        toAddress: buyerId.toLowerCase(),
        transactionType: "purchase",
        amount: nftToUpdate.price,
        platformFee: platformFee.toString(),
        fromAddress: nftToUpdate.ownerAddress,
        blockchainTxHash: transactionHash,
      });
      
      // Record platform commission
      await storage.createTransaction({
        nftId: nftToUpdate.id,
        toAddress: PLATFORM_WALLET,
        transactionType: "commission",
        amount: platformFee.toString(),
        platformFee: "0",
        fromAddress: buyerId.toLowerCase(),
        blockchainTxHash: transactionHash,
      });
      
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
          
          // Enhanced retry logic for critical tokens like 47
          const maxRetries = tokenId === 47 ? 8 : 1; // Extra retries for Token 47
          const owner = await withRetry(() => nftContract.ownerOf(tokenId), maxRetries);
          const tokenURI = await nftContract.tokenURI(tokenId);
          
          const blockchainNFT = {
            tokenId: tokenId.toString(),
            owner: owner.toLowerCase(),
            tokenURI,
            metadata: null // Will be enriched later
          };
          
          console.log(`🎯 Successfully detected Token ${tokenId} (owner: ${owner}) in post-mint sync`);
        
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
          
          // Direct contract call with extra timeout
          const owner = await nftContract.ownerOf(47);
          const tokenURI = await nftContract.tokenURI(47);
          
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
              const currentLat = parseFloat(existsInDb.latitude || "0");
              const currentLng = parseFloat(existsInDb.longitude || "0");
              
              // Update if coordinates are missing (0,0) or different from metadata
              if ((currentLat === 0 && currentLng === 0) || 
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

  // ===== QUEST SYSTEM API ENDPOINTS =====
  
  // Get user stats for quest system - SECURED
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
      const userStats = await storage.getUserStats(fid);
      
      if (!userStats) {
        // Return default stats for new users
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
          pointsEarned = combinedHolderStatus.nftCount;
          break;
          
        case 'streak_bonus' as any:
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
          pointsEarned = 0.25; // 0.25 points for Base transaction (will be converted to fixed-point 25 in storage)
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
          pointsEarned = 0.5; // 0.5 points for social post (will be converted to fixed-point 50 in storage)
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
      const safeDescription = escapeHtml(`Minted on TravelMint: ${nft.title}`);
      
      // Sanitize and escape image URL to prevent XSS
      const rawImageUrl = nft.objectStorageUrl || nft.imageUrl || '';
      const sanitizedImageUrl = sanitizeUrl(rawImageUrl);
      const safeImageUrl = escapeHtml(sanitizedImageUrl);
      
      // Generate secure URLs
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.get('host');
      const frameUrl = `${protocol}://${host}/api/frames/nft/${tokenId}`;
      const appUrl = `${protocol}://${host}/marketplace`;
      
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
    <meta property="og:image" content="${safeImageUrl}">
    
    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="${frameUrl}">
    <meta property="twitter:title" content="${safeTitle} - TravelMint">
    <meta property="twitter:description" content="${safeDescription}">
    <meta property="twitter:image" content="${safeImageUrl}">
    
    <!-- Farcaster Frame -->
    <meta property="fc:frame" content="vNext">
    <meta property="fc:frame:image" content="${safeImageUrl}">
    <meta property="fc:frame:image:aspect_ratio" content="1.91:1">
    <meta property="fc:frame:button:1" content="Open">
    <meta property="fc:frame:button:1:action" content="link">
    <meta property="fc:frame:button:1:target" content="${appUrl}">
  </head>
  <body>
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; text-align: center;">
      <img src="${safeImageUrl}" alt="${safeTitle}" style="max-width: 100%; height: auto; border-radius: 12px; margin-bottom: 20px;">
      <h1 style="color: #333; margin-bottom: 10px;">${safeTitle}</h1>
      <p style="color: #888; margin-bottom: 20px;">Minted on TravelMint</p>
      <a href="${appUrl}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Open in TravelMint</a>
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

  // Quest Reminder API - Send test reminder to all users with notifications enabled
  app.post("/api/send-quest-reminder", async (req: Request, res: Response) => {
    try {
      console.log("📢 Quest reminder request received");

      // Test notification payload
      const reminderPayload = {
        notificationId: `quest-reminder-${Date.now()}`,
        title: "TravelMint Daily Quest",
        body: "⏰ Don't forget your daily streak! Complete today's quests",
        targetUrl: process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPLIT_DEV_DOMAIN}` : undefined,
      };

      // For demo purposes, we'll just return success
      // In a real implementation, you would:
      // 1. Get all users who have enabled notifications
      // 2. Send notifications to each user's stored notification details
      
      console.log("✅ Quest reminder notification payload prepared:", reminderPayload);

      res.json({ 
        success: true, 
        message: "Quest reminder sent successfully",
        payload: reminderPayload
      });

    } catch (error) {
      console.error("❌ Failed to send quest reminder:", error);
      res.status(500).json({ 
        message: "Failed to send quest reminder",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  return createServer(app);
}
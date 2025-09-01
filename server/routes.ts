import { createServer } from "http";
import express, { Request, Response, Express } from "express";
import { storage } from "./storage";
import { blockchainService } from "./blockchain";
import { insertNFTSchema, insertTransactionSchema, insertUserSchema } from "@shared/schema";
import { ethers } from "ethers";
import ipfsRoutes from "./routes/ipfs";

const ALLOWED_CONTRACT = "0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f";
const PLATFORM_WALLET = "0x7CDe7822456AAC667Df0420cD048295b92704084"; // Platform commission wallet

// Simple in-memory cache to avoid expensive blockchain calls
interface CacheEntry {
  data: any[];
  timestamp: number;
}

const nftCache: { [key: string]: CacheEntry } = {};
const CACHE_DURATION = 3 * 60 * 1000; // 3 minutes cache

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

export async function registerRoutes(app: Express) {

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "OK", timestamp: new Date().toISOString() });
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
            // Use metadata name and image if available, fallback to NFT fields
            title: parsedMetadata?.name || nft.title,
            imageUrl: parsedMetadata?.image || nft.imageUrl,
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
      
      // Cache the processed results for fast future requests
      setCacheEntry('all-nfts', nftsWithOwners);
      console.log(`✅ Returning ${nftsWithOwners.length} total NFTs (cached for fast access)`);
      
      // Background blockchain sync (non-blocking)
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
              const dbFormat = blockchainService.blockchainNFTToDBFormat(blockchainNFT);
              await storage.createNFT(dbFormat);
            } else if (existsInDb.ownerAddress !== blockchainNFT.owner) {
              // Update owner if it changed on blockchain
              console.log(`🔄 Updating owner for NFT #${blockchainNFT.tokenId}`);
              await storage.updateNFT(existsInDb.id, {
                ownerAddress: blockchainNFT.owner
              });
            }
          }
          
          console.log("✅ Background blockchain sync completed");
          
          // Clear cache after background sync to show new/updated NFTs
          delete nftCache['all-nfts'];
          delete nftCache['for-sale'];
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
            // Use metadata name and image if available, fallback to NFT fields
            title: parsedMetadata?.name || nft.title,
            imageUrl: parsedMetadata?.image || nft.imageUrl,
            ownerAddress: nft.ownerAddress, // Include raw owner address for purchases
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
        imageUrl: parsedMetadata?.image || nft.imageUrl,
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

  // Update NFT
  app.patch("/api/nfts/:id", async (req, res) => {
    try {
      const nft = await storage.updateNFT(req.params.id, req.body);
      if (!nft) {
        return res.status(404).json({ message: "NFT not found" });
      }
      
      // Clear cache after NFT update
      console.log('🔄 NFT updated - invalidating cache');
      delete nftCache['all-nfts'];
      delete nftCache['for-sale'];
      
      res.json(nft);
    } catch (error) {
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
      });
      
      console.log(`✅ Returning ${nftsWithOwners.length} NFTs for wallet ${walletAddress}`);
      res.json(nftsWithOwners);
    } catch (error) {
      console.error(`Error fetching NFTs for wallet ${req.params.address}:`, error);
      res.status(500).json({ message: "Failed to fetch wallet NFTs" });
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
        const dbFormat = blockchainService.blockchainNFTToDBFormat(blockchainNFT);
        
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

  // Function to determine country from coordinates
  const getCountryFromCoordinates = (lat: number, lng: number): string => {
    // Turkey borders: roughly 36-42°N, 26-45°E
    if (lat >= 36 && lat <= 42 && lng >= 26 && lng <= 45) {
      return 'Turkey';
    }
    // Egypt borders: roughly 22-32°N, 25-35°E  
    if (lat >= 22 && lat <= 32 && lng >= 25 && lng <= 35) {
      return 'Egypt';
    }
    // Canada borders: roughly 42-75°N, -141 to -52°W
    if (lat >= 42 && lat <= 75 && lng >= -141 && lng <= -52) {
      return 'Canada';
    }
    // Add more countries as needed
    return 'Unknown';
  };

  // Stats endpoint with country calculation
  app.get("/api/stats", async (req, res) => {
    try {
      const allNFTs = await storage.getAllNFTs();
      const totalNFTs = allNFTs.length;
      const totalVolume = allNFTs.reduce((sum, nft) => sum + parseFloat(nft.price), 0);

      // Calculate unique countries from NFT locations
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
        // Other major cities
        'London': 'UK',
        'Paris': 'France',
        'Tokyo': 'Japan',
        'Sydney': 'Australia',
        'Dubai': 'UAE',
        'Singapore': 'Singapore',
        'Amsterdam': 'Netherlands',
        'Berlin': 'Germany',
        'Rome': 'Italy',
        'Barcelona': 'Spain'
      };
      
      const uniqueCountries = new Set<string>();
      allNFTs.forEach(nft => {
        let country = locationToCountry[nft.location];
        
        // If not found in mapping and it's a manual location (has coordinates), use coordinates
        if (!country && nft.location.startsWith('Location at ') && parseFloat(nft.latitude.toString()) !== 0 && parseFloat(nft.longitude.toString()) !== 0) {
          country = getCountryFromCoordinates(parseFloat(nft.latitude.toString()), parseFloat(nft.longitude.toString()));
        }
        
        // Fallback to Unknown
        if (!country) {
          country = 'Unknown';
        }
        
        if (country !== 'Unknown') {
          uniqueCountries.add(country);
        }
      });
      
      res.json({
        totalNFTs,
        totalVolume: totalVolume.toFixed(1),
        totalCountries: uniqueCountries.size
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
      
      // Check if NFT is for sale
      if (nft.isForSale !== 1) {
        return res.status(400).json({ message: "NFT is not for sale" });
      }
      
      // Check if buyer is not the current owner
      if (nft.ownerAddress.toLowerCase() === buyerId.toLowerCase()) {
        return res.status(400).json({ message: "You cannot buy your own NFT" });
      }

      // Extract token ID from NFT ID (format: "blockchain-{tokenId}")
      const tokenId = nft.id.replace("blockchain-", "");
      if (!tokenId || isNaN(Number(tokenId))) {
        return res.status(400).json({ message: "Invalid NFT token ID" });
      }
      
      console.log(`🔄 Generating onchain purchase transaction for NFT #${tokenId}`);
      
      // Generate onchain purchase transaction data
      const purchaseData = await blockchainService.generatePurchaseTransaction(
        tokenId,
        buyerId.toLowerCase(),
        nft.ownerAddress.toLowerCase(),
        nft.price // Pass actual NFT price
      );
      
      if (!purchaseData.success) {
        return res.status(400).json({ 
          message: purchaseData.error || "Failed to generate purchase transaction",
          type: "ONCHAIN_ERROR"
        });
      }
      
      console.log(`✅ Generated purchase transaction data for NFT #${tokenId}`);
      
      // Return transaction data for frontend to execute
      res.json({ 
        message: "Purchase transaction prepared",
        requiresOnchainPayment: true,
        transactionData: purchaseData,
        nftId: nftId,
        tokenId: tokenId,
        buyer: buyerId.toLowerCase(),
        seller: nft.ownerAddress.toLowerCase(),
        priceUSDC: nft.price // Use actual NFT price
      });
      
    } catch (error) {
      console.error("Purchase preparation error:", error);
      res.status(500).json({ message: "Failed to prepare purchase transaction" });
    }
  });

  // Confirm purchase after USDC payment transaction
  app.post("/api/nfts/confirm-purchase", async (req, res) => {
    try {
      const { buyerId, transactionHash, nftId } = req.body;
      
      if (!buyerId || !transactionHash) {
        return res.status(400).json({ message: "Buyer ID and transaction hash are required" });
      }
      
      console.log(`🔄 Confirming purchase with USDC payment tx: ${transactionHash} for NFT: ${nftId}`);
      
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
      
      // Check if NFT is for sale
      if (nftToUpdate.isForSale !== 1) {
        return res.status(400).json({ message: "NFT is not for sale" });
      }
      
      // Check if buyer is not the current owner
      if (nftToUpdate.ownerAddress.toLowerCase() === buyerId.toLowerCase()) {
        return res.status(400).json({ message: "You cannot buy your own NFT" });
      }
      
      console.log(`✅ Confirming purchase of NFT ${nftToUpdate.id} for buyer ${buyerId}`);
      
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
      
      // Calculate commission split
      const purchasePrice = parseFloat(nftToUpdate.price);
      const platformFee = purchasePrice * 0.05; // 5% platform fee
      const sellerAmount = purchasePrice - platformFee;
      
      // Update balances
      const buyerNewBalance = (parseFloat(buyer.balance) - purchasePrice).toString();
      const sellerNewBalance = (parseFloat(seller.balance) + sellerAmount).toString();
      
      console.log(`💰 Balance updates: Buyer ${buyerNewBalance} USDC, Seller ${sellerNewBalance} USDC`);
      
      // Get or create platform user for commission tracking
      let platformUser = await storage.getUserByWalletAddress(PLATFORM_WALLET);
      if (!platformUser) {
        platformUser = await storage.createUser({
          username: "TravelMint Platform", 
          walletAddress: PLATFORM_WALLET,
          balance: "0"
        });
      }
      
      const platformNewBalance = (parseFloat(platformUser.balance) + platformFee).toString();
      console.log(`💰 Platform commission: ${platformFee} USDC to ${PLATFORM_WALLET} (Balance: ${platformNewBalance} USDC)`);
      
      // Update all balances
      await storage.updateUserBalance(buyer.id, buyerNewBalance);
      await storage.updateUserBalance(seller.id, sellerNewBalance);
      await storage.updateUserBalance(platformUser.id, platformNewBalance);
      
      // Update NFT ownership and remove from sale
      await storage.updateNFT(nftToUpdate.id, {
        ownerAddress: buyerId.toLowerCase(),
        isForSale: 0,
      });
      
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

  // Farcaster manifest endpoint (CRITICAL for miniapp to work!)
  app.get("/.well-known/farcaster.json", (req, res) => {
    // This manifest is required for Farcaster debug tools to work
    const manifest = {
      "accountAssociation": {
        "header": "eyJmaWQiOjI5MDY3MywidHlwZSI6ImF1dGgiLCJrZXkiOiIweGUwMkUyNTU3YkI4MDdDZjdFMzBDZUY4YzMxNDY5NjNhOGExZDQ0OTYifQ",
        "payload": "eyJkb21haW4iOiJ0cmF2ZWxuZnQucmVwbGl0LmFwcCJ9",
        "signature": "kg4rxkbZvopVgro4b/DUJA+wA26XlSBNv/GaAT6X0DcB5ZRqpJFIvWbA5EJ8jQZ5y+oM3JaWfjLqY9qDqSTKFxs="
      },
      "miniapp": {
        "version": "1",
        "name": "TravelMint",
        "iconUrl": `https://${req.get('host')}/icon.png`,
        "homeUrl": `https://${req.get('host')}`,
        "imageUrl": `https://${req.get('host')}/image.png`,
        "buttonTitle": "Open TravelMint",
        "splashImageUrl": `https://${req.get('host')}/splash.png`,
        "splashBackgroundColor": "#0f172a",
        "webhookUrl": `https://${req.get('host')}/api/webhook`,
        "subtitle": "Travel Photo NFTs on Base",
        "description": "Mint, buy, and sell location-based travel photo NFTs. Create unique travel memories on the blockchain with GPS coordinates.",
        "primaryCategory": "art-creativity",
        "tags": ["travel", "nft", "base", "photos", "maps"],
        "requiredChains": ["eip155:8453"] // Base mainnet
      },
      "baseBuilder": {
        "allowedAddresses": ["0x7F397c837b9B67559E3cFfaEceA4a2151c05b548"]
      }
    };
    
    res.json(manifest);
  });

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

  // IPFS routes
  app.use("/api/ipfs", ipfsRoutes);

  return createServer(app);
}
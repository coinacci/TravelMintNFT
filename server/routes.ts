import { createServer } from "http";
import express, { Request, Response, Express } from "express";
import { storage } from "./storage";
import { blockchainService } from "./blockchain";
import { insertNFTSchema, insertTransactionSchema, insertUserSchema } from "@shared/schema";
import ipfsRoutes from "./routes/ipfs";

const ALLOWED_CONTRACT = "0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f";

export async function registerRoutes(app: Express) {

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "OK", timestamp: new Date().toISOString() });
  });

  // Get all NFTs - combine database and blockchain data
  app.get("/api/nfts", async (req, res) => {
    try {
      console.log("🔗 Fetching all NFTs from blockchain...");
      
      // First get all NFTs from blockchain
      const blockchainNFTs = await blockchainService.getAllNFTs();
      console.log(`Found ${blockchainNFTs.length} NFTs on blockchain`);
      
      // Sync any new NFTs to database
      const allDbNFTs = await storage.getAllNFTs();
      const contractNFTs = allDbNFTs.filter(nft => 
        !nft.contractAddress || nft.contractAddress === ALLOWED_CONTRACT
      );
      
      // Merge blockchain and database data
      const mergedNFTs = [];
      
      for (const blockchainNFT of blockchainNFTs) {
        const dbFormat = blockchainService.blockchainNFTToDBFormat(blockchainNFT);
        
        // Check if this NFT exists in database
        let dbNFT = contractNFTs.find(nft => nft.tokenId === blockchainNFT.tokenId);
        
        if (!dbNFT) {
          // Create new NFT record if not exists
          dbNFT = await storage.createNFT(dbFormat);
        } else if (dbNFT.ownerAddress !== blockchainNFT.owner) {
          // Update owner if it changed on blockchain
          dbNFT = await storage.updateNFT(dbNFT.id, {
            ownerAddress: blockchainNFT.owner
          });
        }
        
        if (dbNFT) {
          mergedNFTs.push(dbNFT);
        }
      }
      
      const nftsWithOwners = await Promise.all(
        mergedNFTs.map(async (nft) => {
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
      
      console.log(`✅ Returning ${nftsWithOwners.length} total NFTs`);
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
      res.status(201).json(nft);
    } catch (error) {
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

  // Stats endpoint
  app.get("/api/stats", async (req, res) => {
    try {
      const allNFTs = await storage.getAllNFTs();
      const totalNFTs = allNFTs.length;
      const totalVolume = allNFTs.reduce((sum, nft) => sum + parseFloat(nft.price), 0);
      
      res.json({
        totalNFTs,
        totalVolume: totalVolume.toFixed(1),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // User routes (stub)
  app.get("/api/users", async (req, res) => {
    res.json({ message: "Use wallet-based endpoints for user data" });
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
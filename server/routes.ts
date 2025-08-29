import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertNFTSchema, insertTransactionSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // NFT routes
  app.get("/api/nfts", async (req, res) => {
    try {
      const nfts = await storage.getAllNFTs();
      // Add owner and creator information for each NFT and parse metadata
      const nftsWithOwners = nfts.map(nft => {
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
      });
      res.json(nftsWithOwners);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch NFTs" });
    }
  });

  app.get("/api/nfts/for-sale", async (req, res) => {
    try {
      const nfts = await storage.getNFTsForSale();
      // Add owner and creator information for each NFT and parse metadata
      const nftsWithOwners = nfts.map(nft => {
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
      });
      res.json(nftsWithOwners);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch NFTs for sale" });
    }
  });

  app.get("/api/nfts/:id", async (req, res) => {
    try {
      const nft = await storage.getNFT(req.params.id);
      if (!nft) {
        return res.status(404).json({ message: "NFT not found" });
      }
      
      const transactions = await storage.getTransactionsByNFT(nft.id);
      
      // Parse metadata for individual NFT
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
        },
        transactions,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch NFT" });
    }
  });

  // Contract address filter
  const ALLOWED_CONTRACT = "0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f";

  app.post("/api/nfts", async (req, res) => {
    try {
      const { walletAddress, ...nftData } = req.body;
      
      if (!walletAddress) {
        return res.status(400).json({ message: "Wallet address is required" });
      }
      
      // Only allow NFTs from specified contract
      if (nftData.contractAddress && nftData.contractAddress !== ALLOWED_CONTRACT) {
        return res.status(400).json({ 
          message: `Only NFTs from contract ${ALLOWED_CONTRACT} are allowed` 
        });
      }
      
      const validatedData = insertNFTSchema.parse({
        ...nftData,
        creatorAddress: walletAddress,
        ownerAddress: walletAddress,
        contractAddress: nftData.contractAddress || ALLOWED_CONTRACT
      });
      
      const nft = await storage.createNFT(validatedData);
      
      // Create mint transaction
      await storage.createTransaction({
        nftId: nft.id,
        fromAddress: null,
        toAddress: walletAddress,
        transactionType: "mint",
        amount: nft.mintPrice,
        platformFee: "0.000000",
      });
      
      res.json(nft);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid NFT data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create NFT" });
    }
  });

  // Purchase NFT
  app.post("/api/nfts/:id/purchase", async (req, res) => {
    try {
      const { buyerAddress, transactionHash } = req.body;
      
      if (!buyerAddress) {
        return res.status(400).json({ message: "Buyer wallet address is required" });
      }
      
      if (!transactionHash) {
        return res.status(400).json({ message: "Transaction hash is required" });
      }

      const nft = await storage.getNFT(req.params.id);
      if (!nft) {
        return res.status(404).json({ message: "NFT not found" });
      }

      if (nft.isForSale !== 1) {
        return res.status(400).json({ message: "NFT is not for sale" });
      }

      if (nft.ownerAddress.toLowerCase() === buyerAddress.toLowerCase()) {
        return res.status(400).json({ message: "Cannot purchase your own NFT" });
      }

      const nftPrice = parseFloat(nft.price);
      const platformFeeRate = 0.05; // 5%
      const platformFee = nftPrice * platformFeeRate;

      // Transfer NFT ownership
      await storage.updateNFT(nft.id, {
        ownerAddress: buyerAddress,
        isForSale: 0,
      });

      // Create transaction record
      await storage.createTransaction({
        nftId: nft.id,
        fromAddress: nft.ownerAddress,
        toAddress: buyerAddress,
        transactionType: "sale",
        amount: nftPrice.toFixed(6),
        platformFee: platformFee.toFixed(6),
        blockchainTxHash: transactionHash,
      });

      res.json({ message: "Purchase successful" });
    } catch (error) {
      res.status(500).json({ message: "Purchase failed" });
    }
  });

  // Update NFT (for listing/unlisting)
  app.patch("/api/nfts/:id", async (req, res) => {
    try {
      const updates = req.body;
      const updatedNFT = await storage.updateNFT(req.params.id, updates);
      
      if (!updatedNFT) {
        return res.status(404).json({ message: "NFT not found" });
      }
      
      res.json(updatedNFT);
    } catch (error) {
      res.status(500).json({ message: "Failed to update NFT" });
    }
  });

  // User routes
  app.post("/api/users", async (req, res) => {
    try {
      const { username, walletAddress, avatar } = req.body;
      
      // Check if user already exists by wallet address
      if (walletAddress) {
        // First try to get user by wallet address logic (no direct method available)
        // For now, just create user - duplicate prevention can be added later
      }
      
      const newUser = await storage.createUser({
        username: username || "Traveler",
        balance: "10.000000", // Give new users some starting balance
        avatar: avatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
        walletAddress,
      });
      
      res.json(newUser);
    } catch (error) {
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get("/api/users", async (req, res) => {
    try {
      // Since we're using wallet-based authentication, this endpoint is deprecated
      // Return empty array or basic info
      res.json({ message: "Use wallet-based endpoints for user data" });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch current user" });
    }
  });

  // Get NFTs by owner (legacy route)
  app.get("/api/users/:id/nfts", async (req, res) => {
    try {
      const nfts = await storage.getNFTsByOwner(req.params.id);
      const nftsWithOwners = await Promise.all(
        nfts.map(async (nft) => {
          // Use wallet addresses instead of user IDs
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

  // Get NFTs by wallet address
  app.get("/api/wallet/:address/nfts", async (req, res) => {
    try {
      // Filter NFTs by allowed contract with case-insensitive address matching
      const walletAddress = req.params.address.toLowerCase();
      const allNfts = await storage.getNFTsByOwner(walletAddress);
      const nfts = allNfts.filter(nft => 
        !nft.contractAddress || nft.contractAddress === ALLOWED_CONTRACT
      );
      
      const nftsWithOwners = await Promise.all(
        nfts.map(async (nft) => {
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

  // Blockchain sync endpoint
  app.post("/api/sync/wallet/:address", async (req, res) => {
    try {
      const walletAddress = req.params.address.toLowerCase();
      
      // Simple simulation - in production you'd read from blockchain
      console.log(`Syncing NFTs for wallet: ${walletAddress}`);
      
      // Check if user already has NFTs from this contract to avoid duplicates
      // Use a more specific check for wallet + contract + tokenId combination
      const existingNFTs = await storage.getNFTsByOwner(walletAddress);
      const hasContractNFT = existingNFTs.some(nft => 
        nft.contractAddress === ALLOWED_CONTRACT && 
        nft.tokenId === "1" && 
        nft.ownerAddress.toLowerCase() === walletAddress
      );
      
      if (hasContractNFT) {
        return res.json({ 
          message: "NFTs already synced for this wallet",
          syncedNFTs: 0,
          nfts: existingNFTs.filter(nft => nft.contractAddress === ALLOWED_CONTRACT)
        });
      }
      
      // Create a proper NFT from contract with better metadata
      const betterImageSvg = `<svg width="400" height="400" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
<defs>
<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
<stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
<stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
</linearGradient>
</defs>
<rect width="400" height="400" fill="url(#bg)"/>
<circle cx="200" cy="150" r="60" fill="#ffffff" opacity="0.9"/>
<path d="M200 110 L220 140 L180 140 Z" fill="#667eea"/>
<rect x="50" y="250" width="300" height="100" rx="10" fill="#ffffff" opacity="0.1"/>
<text x="200" y="280" text-anchor="middle" fill="white" font-size="16" font-family="Arial">Istanbul Travel Memory</text>
<text x="200" y="300" text-anchor="middle" fill="white" font-size="12" opacity="0.8">41.0082°N, 28.9784°E</text>
<text x="200" y="320" text-anchor="middle" fill="white" font-size="10" opacity="0.6">Contract: 0x8c12...558f</text>
</svg>`;
      
      const testNFT = {
        id: `sync-${Date.now()}`,
        title: "Istanbul Travel Memory",
        description: "A beautiful travel memory captured in Istanbul, Turkey. This NFT represents a unique location-based travel experience on the Bosphorus.",
        imageUrl: `data:image/svg+xml;base64,${Buffer.from(betterImageSvg).toString('base64')}`,
        location: "Istanbul, Turkey",
        latitude: "41.0082",
        longitude: "28.9784",
        category: "travel",
        price: "1.0",
        isForSale: 0,
        creatorAddress: walletAddress,
        ownerAddress: walletAddress,
        contractAddress: ALLOWED_CONTRACT,
        mintPrice: "1.0",
        royaltyPercentage: "5.0",
        tokenId: "1",
        transactionHash: "0x8c12c9ebf7db0a6370361ce9225e3b77d22a558f001",
        metadata: JSON.stringify({
          name: "Istanbul Travel Memory",
          description: "A beautiful travel memory captured in Istanbul, Turkey. This NFT represents a unique location-based travel experience on the Bosphorus, featuring stunning views and cultural richness.",
          image: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDMwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjNEY0NkU1Ii8+Cjx0ZXh0IHg9IjE1MCIgeT0iMTUwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSIxOCI+VHJhdmVsIE5GVDwvdGV4dD4KPC9zdmc+",
          attributes: [
            { trait_type: "Location", value: "Istanbul, Turkey" },
            { trait_type: "Country", value: "Turkey" },
            { trait_type: "Coordinates", value: "41.0082°N, 28.9784°E" },
            { trait_type: "Category", value: "Travel" },
            { trait_type: "Landmark", value: "Bosphorus" },
            { trait_type: "Network", value: "Base" },
            { trait_type: "Contract", value: "0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f" },
            { trait_type: "Source", value: "Blockchain Sync" },
            { trait_type: "Rarity", value: "Common" }
          ]
        })
      };
      
      const nft = await storage.createNFT(testNFT);
      
      // Create sync transaction record
      await storage.createTransaction({
        nftId: nft.id,
        fromAddress: null,
        toAddress: walletAddress,
        transactionType: "sync",
        amount: "0.0",
        platformFee: "0.0",
      });
      
      res.json({ 
        message: "Sync completed successfully",
        syncedNFTs: 1,
        nfts: [nft]
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

  const httpServer = createServer(app);
  return httpServer;
}

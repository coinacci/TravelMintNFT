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
      const nftsWithOwners = await Promise.all(
        nfts.map(async (nft) => {
          const owner = await storage.getUser(nft.ownerId);
          const creator = await storage.getUser(nft.creatorId);
          return {
            ...nft,
            owner: owner ? { id: owner.id, username: owner.username, avatar: owner.avatar } : null,
            creator: creator ? { id: creator.id, username: creator.username, avatar: creator.avatar } : null,
          };
        })
      );
      res.json(nftsWithOwners);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch NFTs" });
    }
  });

  app.get("/api/nfts/for-sale", async (req, res) => {
    try {
      const nfts = await storage.getNFTsForSale();
      const nftsWithOwners = await Promise.all(
        nfts.map(async (nft) => {
          const owner = await storage.getUser(nft.ownerId);
          const creator = await storage.getUser(nft.creatorId);
          return {
            ...nft,
            owner: owner ? { id: owner.id, username: owner.username, avatar: owner.avatar } : null,
            creator: creator ? { id: creator.id, username: creator.username, avatar: creator.avatar } : null,
          };
        })
      );
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
      
      const owner = await storage.getUser(nft.ownerId);
      const creator = await storage.getUser(nft.creatorId);
      const transactions = await storage.getTransactionsByNFT(nft.id);
      
      res.json({
        ...nft,
        owner: owner ? { id: owner.id, username: owner.username, avatar: owner.avatar } : null,
        creator: creator ? { id: creator.id, username: creator.username, avatar: creator.avatar } : null,
        transactions,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch NFT" });
    }
  });

  app.post("/api/nfts", async (req, res) => {
    try {
      const validatedData = insertNFTSchema.parse(req.body);
      const nft = await storage.createNFT(validatedData);
      
      // Create mint transaction
      await storage.createTransaction({
        nftId: nft.id,
        fromUserId: null,
        toUserId: nft.ownerId,
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
      const { buyerId } = req.body;
      
      if (!buyerId) {
        return res.status(400).json({ message: "Buyer ID is required" });
      }

      const nft = await storage.getNFT(req.params.id);
      if (!nft) {
        return res.status(404).json({ message: "NFT not found" });
      }

      if (nft.isForSale !== 1) {
        return res.status(400).json({ message: "NFT is not for sale" });
      }

      const buyer = await storage.getUser(buyerId);
      if (!buyer) {
        return res.status(404).json({ message: "Buyer not found" });
      }

      const buyerBalance = parseFloat(buyer.balance);
      const nftPrice = parseFloat(nft.price);
      const platformFeeRate = 0.05; // 5%
      const platformFee = nftPrice * platformFeeRate;
      const totalCost = nftPrice;

      if (buyerBalance < totalCost) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      // Update buyer balance
      const newBuyerBalance = buyerBalance - totalCost;
      await storage.updateUserBalance(buyerId, newBuyerBalance.toFixed(6));

      // Update seller balance (minus platform fee)
      const seller = await storage.getUser(nft.ownerId);
      if (seller) {
        const sellerBalance = parseFloat(seller.balance);
        const sellerAmount = nftPrice - platformFee;
        const newSellerBalance = sellerBalance + sellerAmount;
        await storage.updateUserBalance(seller.id, newSellerBalance.toFixed(6));
      }

      // Transfer NFT ownership
      await storage.updateNFT(nft.id, {
        ownerId: buyerId,
        isForSale: 0,
      });

      // Create transaction record
      await storage.createTransaction({
        nftId: nft.id,
        fromUserId: nft.ownerId,
        toUserId: buyerId,
        transactionType: "sale",
        amount: nftPrice.toFixed(6),
        platformFee: platformFee.toFixed(6),
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
      
      // Check if user already exists (for wallet-based creation)
      if (walletAddress) {
        const users = Array.from((storage as any).users.values());
        const existingUser = users.find((user: any) => user.walletAddress === walletAddress);
        if (existingUser) {
          return res.json(existingUser);
        }
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
      // For demo purposes, return first user as current user
      const users = Array.from((storage as any).users.values());
      let currentUser = users[0];
      
      // If no users exist, create a demo user
      if (!currentUser) {
        currentUser = await storage.createUser({
          username: "Demo User",
          balance: "10.000000", // Give demo user some balance
          avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
        });
      }
      
      res.json(currentUser);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch current user" });
    }
  });

  // Get NFTs by owner
  app.get("/api/users/:id/nfts", async (req, res) => {
    try {
      const nfts = await storage.getNFTsByOwner(req.params.id);
      const nftsWithOwners = await Promise.all(
        nfts.map(async (nft) => {
          const owner = await storage.getUser(nft.ownerId);
          const creator = await storage.getUser(nft.creatorId);
          return {
            ...nft,
            owner: owner ? { id: owner.id, username: owner.username, avatar: owner.avatar } : null,
            creator: creator ? { id: creator.id, username: creator.username, avatar: creator.avatar } : null,
          };
        })
      );
      res.json(nftsWithOwners);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user NFTs" });
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

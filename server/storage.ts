import { type User, type InsertUser, type NFT, type InsertNFT, type Transaction, type InsertTransaction } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserBalance(id: string, balance: string): Promise<User | undefined>;

  // NFT operations
  getNFT(id: string): Promise<NFT | undefined>;
  getAllNFTs(): Promise<NFT[]>;
  getNFTsByLocation(lat: number, lng: number, radius: number): Promise<NFT[]>;
  getNFTsByOwner(ownerId: string): Promise<NFT[]>;
  getNFTsForSale(): Promise<NFT[]>;
  createNFT(nft: InsertNFT): Promise<NFT>;
  updateNFT(id: string, updates: Partial<NFT>): Promise<NFT | undefined>;

  // Transaction operations
  getTransaction(id: string): Promise<Transaction | undefined>;
  getTransactionsByNFT(nftId: string): Promise<Transaction[]>;
  getTransactionsByUser(userId: string): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private nfts: Map<string, NFT>;
  private transactions: Map<string, Transaction>;

  constructor() {
    this.users = new Map();
    this.nfts = new Map();
    this.transactions = new Map();

    // Initialize with sample data
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Create sample users
    const sampleUsers = [
      { username: "alpineexplorer", balance: "1250.000000", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face" },
      { username: "japanwanderer", balance: "850.000000", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face" },
      { username: "arcticphotog", balance: "2100.000000", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face" },
    ];

    sampleUsers.forEach(userData => {
      const id = randomUUID();
      const user: User = {
        id,
        ...userData,
        walletAddress: `0x${Math.random().toString(16).substr(2, 40)}`,
        createdAt: new Date(),
      };
      this.users.set(id, user);
    });

    // Create sample NFTs
    const userIds = Array.from(this.users.keys());
    const sampleNFTs = [
      {
        title: "Alpine Paradise",
        description: "A breathtaking view captured during early morning light in the Swiss Alps.",
        imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop",
        location: "Zermatt, Switzerland",
        latitude: "46.94790000",
        longitude: "7.44740000",
        category: "Landscape",
        price: "25.000000",
        isForSale: 1,
        creatorId: userIds[0],
        ownerId: userIds[0],
      },
      {
        title: "Sakura Temple",
        description: "Traditional Japanese temple surrounded by cherry blossoms in full bloom.",
        imageUrl: "https://images.unsplash.com/photo-1528164344705-47542687000d?w=600&h=400&fit=crop",
        location: "Kyoto, Japan",
        latitude: "35.01160000",
        longitude: "135.76810000",
        category: "Cultural",
        price: "18.000000",
        isForSale: 1,
        creatorId: userIds[1],
        ownerId: userIds[1],
      },
      {
        title: "Aurora Dreams",
        description: "Stunning aurora borealis dancing across the Arctic sky.",
        imageUrl: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=600&h=400&fit=crop",
        location: "Tromsø, Norway",
        latitude: "69.64920000",
        longitude: "18.95530000",
        category: "Landscape",
        price: "42.000000",
        isForSale: 1,
        creatorId: userIds[2],
        ownerId: userIds[2],
      },
    ];

    sampleNFTs.forEach(nftData => {
      const id = randomUUID();
      const nft: NFT = {
        id,
        ...nftData,
        mintPrice: "1.000000",
        royaltyPercentage: "5.00",
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.nfts.set(id, nft);
    });
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserBalance(id: string, balance: string): Promise<User | undefined> {
    const user = this.users.get(id);
    if (user) {
      const updatedUser = { ...user, balance };
      this.users.set(id, updatedUser);
      return updatedUser;
    }
    return undefined;
  }

  // NFT operations
  async getNFT(id: string): Promise<NFT | undefined> {
    return this.nfts.get(id);
  }

  async getAllNFTs(): Promise<NFT[]> {
    return Array.from(this.nfts.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getNFTsByLocation(lat: number, lng: number, radius: number): Promise<NFT[]> {
    return Array.from(this.nfts.values()).filter(nft => {
      const nftLat = parseFloat(nft.latitude);
      const nftLng = parseFloat(nft.longitude);
      const distance = Math.sqrt(Math.pow(nftLat - lat, 2) + Math.pow(nftLng - lng, 2));
      return distance <= radius;
    });
  }

  async getNFTsByOwner(ownerId: string): Promise<NFT[]> {
    return Array.from(this.nfts.values()).filter(nft => nft.ownerId === ownerId);
  }

  async getNFTsForSale(): Promise<NFT[]> {
    return Array.from(this.nfts.values()).filter(nft => nft.isForSale === 1);
  }

  async createNFT(insertNFT: InsertNFT): Promise<NFT> {
    const id = randomUUID();
    const now = new Date();
    const nft: NFT = {
      ...insertNFT,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.nfts.set(id, nft);
    return nft;
  }

  async updateNFT(id: string, updates: Partial<NFT>): Promise<NFT | undefined> {
    const nft = this.nfts.get(id);
    if (nft) {
      const updatedNFT = { ...nft, ...updates, updatedAt: new Date() };
      this.nfts.set(id, updatedNFT);
      return updatedNFT;
    }
    return undefined;
  }

  // Transaction operations
  async getTransaction(id: string): Promise<Transaction | undefined> {
    return this.transactions.get(id);
  }

  async getTransactionsByNFT(nftId: string): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter(tx => tx.nftId === nftId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getTransactionsByUser(userId: string): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter(tx => tx.fromUserId === userId || tx.toUserId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const id = randomUUID();
    const transaction: Transaction = {
      ...insertTransaction,
      id,
      createdAt: new Date(),
    };
    this.transactions.set(id, transaction);
    return transaction;
  }
}

export const storage = new MemStorage();

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
  getNFTsByOwner(ownerAddress: string): Promise<NFT[]>;
  getNFTsForSale(): Promise<NFT[]>;
  createNFT(nft: InsertNFT): Promise<NFT>;
  updateNFT(id: string, updates: Partial<NFT>): Promise<NFT | undefined>;

  // Transaction operations
  getTransaction(id: string): Promise<Transaction | undefined>;
  getTransactionsByNFT(nftId: string): Promise<Transaction[]>;
  getTransactionsByUser(userAddress: string): Promise<Transaction[]>;
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

    // Sample data initialization removed - app starts with empty storage
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
      walletAddress: insertUser.walletAddress ?? null,
      balance: insertUser.balance ?? "0",
      avatar: insertUser.avatar ?? null,
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

  async getNFTsByOwner(ownerAddress: string): Promise<NFT[]> {
    return Array.from(this.nfts.values()).filter(nft => nft.ownerAddress === ownerAddress);
  }

  async getNFTsForSale(): Promise<NFT[]> {
    return Array.from(this.nfts.values()).filter(nft => nft.isForSale === 1);
  }

  async createNFT(insertNFT: InsertNFT): Promise<NFT> {
    const id = randomUUID();
    const now = new Date();
    const nft: NFT = {
      ...insertNFT,
      description: insertNFT.description ?? null,
      tokenId: insertNFT.tokenId ?? null,
      contractAddress: insertNFT.contractAddress ?? null,
      transactionHash: insertNFT.transactionHash ?? null,
      metadata: insertNFT.metadata ?? null,
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

  async getTransactionsByUser(userAddress: string): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter(tx => tx.fromAddress === userAddress || tx.toAddress === userAddress)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const id = randomUUID();
    const transaction: Transaction = {
      ...insertTransaction,
      fromAddress: insertTransaction.fromAddress ?? null,
      platformFee: insertTransaction.platformFee ?? "0",
      blockchainTxHash: insertTransaction.blockchainTxHash ?? null,
      id,
      createdAt: new Date(),
    };
    this.transactions.set(id, transaction);
    return transaction;
  }
}

export const storage = new MemStorage();

import { users, nfts, transactions, userStats, questCompletions, type User, type InsertUser, type NFT, type InsertNFT, type Transaction, type InsertTransaction, type UserStats, type InsertUserStats, type QuestCompletion, type InsertQuestCompletion } from "@shared/schema";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByWalletAddress(walletAddress: string): Promise<User | undefined>;
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
  updateNFTCoordinates(tokenId: string, latitude: number, longitude: number): Promise<NFT | undefined>;
  getNFTByTokenId(tokenId: string): Promise<NFT | undefined>;

  // Transaction operations
  getTransaction(id: string): Promise<Transaction | undefined>;
  getTransactionsByNFT(nftId: string): Promise<Transaction[]>;
  getTransactionsByUser(userAddress: string): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;

  // Quest system operations
  getUserStats(farcasterFid: string): Promise<UserStats | undefined>;
  createOrUpdateUserStats(stats: InsertUserStats): Promise<UserStats>;
  updateUserStats(farcasterFid: string, updates: Partial<UserStats>): Promise<UserStats | undefined>;
  getQuestCompletions(farcasterFid: string, date?: string): Promise<QuestCompletion[]>;
  createQuestCompletion(completion: InsertQuestCompletion): Promise<QuestCompletion>;
  getLeaderboard(limit?: number): Promise<UserStats[]>;
  checkHolderStatus(walletAddress: string): Promise<{ isHolder: boolean; nftCount: number }>;
  
  // Atomic quest claiming operation
  claimQuestAtomic(data: {
    farcasterFid: string;
    farcasterUsername: string;
    walletAddress?: string;
    questType: 'daily_checkin' | 'holder_bonus' | 'streak_bonus';
    pointsEarned: number;
    completionDate: string;
    userStatsUpdates?: Partial<UserStats>;
  }): Promise<{ userStats: UserStats; questCompletion: QuestCompletion }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByWalletAddress(walletAddress: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(sql`LOWER(${users.walletAddress}) = LOWER(${walletAddress})`);
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUserBalance(id: string, balance: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ balance })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  // NFT operations
  async getNFT(id: string): Promise<NFT | undefined> {
    const [nft] = await db.select().from(nfts).where(eq(nfts.id, id));
    return nft || undefined;
  }

  async getAllNFTs(): Promise<NFT[]> {
    return await db
      .select()
      .from(nfts)
      .orderBy(sql`${nfts.createdAt} DESC`);
  }

  async getNFTsByLocation(lat: number, lng: number, radius: number): Promise<NFT[]> {
    return await db
      .select()
      .from(nfts)
      .where(sql`
        sqrt(power(cast(${nfts.latitude} as decimal) - ${lat}, 2) + 
             power(cast(${nfts.longitude} as decimal) - ${lng}, 2)) <= ${radius}
      `);
  }

  async getNFTsByOwner(ownerAddress: string): Promise<NFT[]> {
    return await db
      .select()
      .from(nfts)
      .where(sql`LOWER(${nfts.ownerAddress}) = LOWER(${ownerAddress})`)
      .orderBy(sql`${nfts.createdAt} DESC`);
  }

  async getNFTsForSale(): Promise<NFT[]> {
    return await db
      .select()
      .from(nfts)
      .where(eq(nfts.isForSale, 1))
      .orderBy(sql`${nfts.createdAt} DESC`);
  }

  async createNFT(insertNFT: InsertNFT): Promise<NFT> {
    const [nft] = await db
      .insert(nfts)
      .values(insertNFT)
      .returning();
    return nft;
  }

  async updateNFT(id: string, updates: Partial<NFT>): Promise<NFT | undefined> {
    const [nft] = await db
      .update(nfts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(nfts.id, id))
      .returning();
    return nft || undefined;
  }

  async updateNFTCoordinates(tokenId: string, latitude: number, longitude: number): Promise<NFT | undefined> {
    const [nft] = await db
      .update(nfts)
      .set({ 
        latitude: latitude.toFixed(8), 
        longitude: longitude.toFixed(8),
        updatedAt: new Date() 
      })
      .where(eq(nfts.tokenId, tokenId))
      .returning();
    return nft || undefined;
  }

  async getNFTByTokenId(tokenId: string): Promise<NFT | undefined> {
    const [nft] = await db.select().from(nfts).where(eq(nfts.tokenId, tokenId));
    return nft || undefined;
  }

  // Transaction operations
  async getTransaction(id: string): Promise<Transaction | undefined> {
    const [transaction] = await db.select().from(transactions).where(eq(transactions.id, id));
    return transaction || undefined;
  }

  async getTransactionsByNFT(nftId: string): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.nftId, nftId))
      .orderBy(sql`${transactions.createdAt} DESC`);
  }

  async getTransactionsByUser(userAddress: string): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(sql`${transactions.fromAddress} = ${userAddress} OR ${transactions.toAddress} = ${userAddress}`)
      .orderBy(sql`${transactions.createdAt} DESC`);
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db
      .insert(transactions)
      .values(insertTransaction)
      .returning();
    return transaction;
  }

  // Quest system operations
  async getUserStats(farcasterFid: string): Promise<UserStats | undefined> {
    const [stats] = await db.select().from(userStats).where(eq(userStats.farcasterFid, farcasterFid));
    return stats || undefined;
  }

  async createOrUpdateUserStats(insertStats: InsertUserStats): Promise<UserStats> {
    // Try to find existing user stats
    const existing = await this.getUserStats(insertStats.farcasterFid);
    
    if (existing) {
      // Update existing
      const [updated] = await db
        .update(userStats)
        .set({ 
          ...insertStats, 
          updatedAt: new Date()
        })
        .where(eq(userStats.farcasterFid, insertStats.farcasterFid))
        .returning();
      return updated;
    } else {
      // Create new
      const [created] = await db
        .insert(userStats)
        .values(insertStats)
        .returning();
      return created;
    }
  }

  async updateUserStats(farcasterFid: string, updates: Partial<UserStats>): Promise<UserStats | undefined> {
    const [updated] = await db
      .update(userStats)
      .set({ 
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(userStats.farcasterFid, farcasterFid))
      .returning();
    return updated || undefined;
  }

  async getQuestCompletions(farcasterFid: string, date?: string): Promise<QuestCompletion[]> {
    if (date) {
      return await db
        .select()
        .from(questCompletions)
        .where(
          and(
            eq(questCompletions.farcasterFid, farcasterFid),
            eq(questCompletions.completionDate, date)
          )
        );
    } else {
      return await db
        .select()
        .from(questCompletions)
        .where(eq(questCompletions.farcasterFid, farcasterFid));
    }
  }

  async createQuestCompletion(insertCompletion: InsertQuestCompletion): Promise<QuestCompletion> {
    const [completion] = await db
      .insert(questCompletions)
      .values(insertCompletion)
      .returning();
    return completion;
  }

  async getLeaderboard(limit: number = 50): Promise<UserStats[]> {
    return await db
      .select()
      .from(userStats)
      .orderBy(sql`${userStats.totalPoints} DESC`)
      .limit(limit);
  }

  async checkHolderStatus(walletAddress: string): Promise<{ isHolder: boolean; nftCount: number }> {
    if (!walletAddress) {
      return { isHolder: false, nftCount: 0 };
    }
    
    const userNFTs = await db
      .select()
      .from(nfts)
      .where(sql`LOWER(${nfts.ownerAddress}) = LOWER(${walletAddress})`);
    
    return {
      isHolder: userNFTs.length > 0,
      nftCount: userNFTs.length
    };
  }

  // Atomic quest claiming operation
  async claimQuestAtomic(data: {
    farcasterFid: string;
    farcasterUsername: string;
    walletAddress?: string;
    questType: 'daily_checkin' | 'holder_bonus' | 'streak_bonus';
    pointsEarned: number;
    completionDate: string;
    userStatsUpdates?: Partial<UserStats>;
  }): Promise<{ userStats: UserStats; questCompletion: QuestCompletion }> {
    // Start transaction
    return await db.transaction(async (tx) => {
      // First check if quest already completed today (within transaction for consistency)
      const existingCompletions = await tx
        .select()
        .from(questCompletions)
        .where(
          and(
            eq(questCompletions.farcasterFid, data.farcasterFid),
            eq(questCompletions.questType, data.questType),
            eq(questCompletions.completionDate, data.completionDate)
          )
        );

      if (existingCompletions.length > 0) {
        throw new Error(`Quest ${data.questType} already completed today`);
      }

      // Get or create user stats within transaction  
      const existingUserStats = await tx
        .select()
        .from(userStats)
        .where(eq(userStats.farcasterFid, data.farcasterFid));

      if (existingUserStats.length === 0) {
        // Create new user stats
        const [newUserStats] = await tx
          .insert(userStats)
          .values({
            farcasterFid: data.farcasterFid,
            farcasterUsername: data.farcasterUsername,
            walletAddress: data.walletAddress || null,
            totalPoints: data.pointsEarned,
            currentStreak: data.questType === 'daily_checkin' ? 1 : 0,
            lastCheckIn: data.questType === 'daily_checkin' ? new Date() : null,
            lastStreakClaim: data.questType === 'streak_bonus' ? new Date() : null,
          })
          .returning();
        
        // Create quest completion
        const [questCompletion] = await tx
          .insert(questCompletions)
          .values({
            farcasterFid: data.farcasterFid,
            questType: data.questType,
            pointsEarned: data.pointsEarned,
            completionDate: data.completionDate,
          })
          .returning();

        return { userStats: newUserStats, questCompletion };
      } else {
        // Update existing user stats
        const currentStats = existingUserStats[0];
        const updates = {
          totalPoints: currentStats.totalPoints + data.pointsEarned,
          updatedAt: new Date(),
          ...data.userStatsUpdates,
        };

        const [updatedStats] = await tx
          .update(userStats)
          .set(updates)
          .where(eq(userStats.farcasterFid, data.farcasterFid))
          .returning();

        // Create quest completion
        const [questCompletion] = await tx
          .insert(questCompletions)
          .values({
            farcasterFid: data.farcasterFid,
            questType: data.questType,
            pointsEarned: data.pointsEarned,
            completionDate: data.completionDate,
          })
          .returning();

        return { userStats: updatedStats, questCompletion };
      }
    });
  }
}

export const storage = new DatabaseStorage();

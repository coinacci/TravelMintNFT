import { users, nfts, transactions, userStats, questCompletions, userWallets, weeklyChampions, type User, type InsertUser, type NFT, type InsertNFT, type Transaction, type InsertTransaction, type UserStats, type InsertUserStats, type QuestCompletion, type InsertQuestCompletion, type UserWallet, type InsertUserWallet, type WeeklyChampion, type InsertWeeklyChampion, getCurrentWeekStart, getWeekEnd, getWeekNumber } from "@shared/schema";
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
  getWeeklyLeaderboard(limit?: number): Promise<UserStats[]>;
  checkHolderStatus(walletAddress: string): Promise<{ isHolder: boolean; nftCount: number }>;
  
  // Weekly reset and champion tracking
  performWeeklyReset(): Promise<void>;
  getWeeklyChampions(limit?: number): Promise<WeeklyChampion[]>;
  getCurrentWeekChampion(): Promise<WeeklyChampion | null>;
  backfillWeeklyPointsFromTotal(): Promise<{ updated: number; message: string }>;
  
  // Multi-wallet operations
  addUserWallet(farcasterFid: string, walletAddress: string, platform: string): Promise<UserWallet>;
  getUserWallets(farcasterFid: string): Promise<UserWallet[]>;
  checkCombinedHolderStatus(farcasterFid: string): Promise<{ isHolder: boolean; nftCount: number }>;
  
  // Atomic quest claiming operation
  claimQuestAtomic(data: {
    farcasterFid: string;
    farcasterUsername: string;
    walletAddress?: string;
    questType: 'daily_checkin' | 'holder_bonus' | 'streak_bonus' | 'base_transaction';
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

  async getWeeklyLeaderboard(limit: number = 50): Promise<UserStats[]> {
    return await db
      .select()
      .from(userStats)
      .where(sql`${userStats.weeklyPoints} > 0`)
      .orderBy(sql`${userStats.weeklyPoints} DESC`)
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

  // Multi-wallet operations
  async addUserWallet(farcasterFid: string, walletAddress: string, platform: string): Promise<UserWallet> {
    const [userWallet] = await db
      .insert(userWallets)
      .values({
        farcasterFid,
        walletAddress: walletAddress.toLowerCase(),
        platform
      })
      .onConflictDoNothing()
      .returning();
    
    if (!userWallet) {
      // If conflict, return the existing one
      const [existing] = await db
        .select()
        .from(userWallets)
        .where(sql`${userWallets.farcasterFid} = ${farcasterFid} AND ${userWallets.walletAddress} = ${walletAddress.toLowerCase()} AND ${userWallets.platform} = ${platform}`);
      return existing;
    }
    
    return userWallet;
  }

  async getUserWallets(farcasterFid: string): Promise<UserWallet[]> {
    return await db
      .select()
      .from(userWallets)
      .where(eq(userWallets.farcasterFid, farcasterFid));
  }

  async getAllNFTsForUser(farcasterFid: string): Promise<(NFT & { sourceWallet: string; sourcePlatform: string })[]> {
    // Get all wallets for this Farcaster user
    const walletList = await this.getUserWallets(farcasterFid);
    
    if (walletList.length === 0) {
      return [];
    }
    
    // SECURITY FIX: Deduplicate wallets by address to prevent duplicates
    const uniqueWallets = new Map<string, UserWallet>();
    walletList.forEach(wallet => {
      const address = wallet.walletAddress.toLowerCase();
      if (!uniqueWallets.has(address)) {
        uniqueWallets.set(address, wallet);
      }
    });
    
    console.log(`🔍 Fetching NFTs for Farcaster FID ${farcasterFid}: ${walletList.length} wallet entries → ${uniqueWallets.size} unique addresses`);
    
    const allNFTs: (NFT & { sourceWallet: string; sourcePlatform: string })[] = [];
    
    // Get NFTs from each unique wallet address
    for (const [walletAddress, walletInfo] of Array.from(uniqueWallets.entries())) {
      const nfts = await this.getNFTsByOwner(walletAddress);
      const nftsWithSource = nfts.map(nft => ({
        ...nft,
        sourceWallet: walletAddress,
        sourcePlatform: walletInfo.platform
      }));
      allNFTs.push(...nftsWithSource);
      
      if (nfts.length > 0) {
        console.log(`  ✅ Wallet ${walletAddress} (${walletInfo.platform}): ${nfts.length} NFTs`);
      }
    }
    
    return allNFTs;
  }

  async checkCombinedHolderStatus(farcasterFid: string): Promise<{ isHolder: boolean; nftCount: number }> {
    // Get all wallets for this Farcaster user
    const walletList = await this.getUserWallets(farcasterFid);
    
    if (walletList.length === 0) {
      return { isHolder: false, nftCount: 0 };
    }
    
    // SECURITY FIX: Deduplicate wallets by address to prevent double-counting
    // Same wallet recorded under different platforms should only be counted once
    const uniqueWalletAddresses = Array.from(
      new Set(walletList.map(wallet => wallet.walletAddress.toLowerCase()))
    );
    
    console.log(`🔍 Checking holder status for Farcaster FID ${farcasterFid}: ${walletList.length} wallet entries → ${uniqueWalletAddresses.length} unique addresses`);
    
    let totalNFTCount = 0;
    
    // Check NFT count for each unique wallet address
    for (const walletAddress of uniqueWalletAddresses) {
      const holderStatus = await this.checkHolderStatus(walletAddress);
      totalNFTCount += holderStatus.nftCount;
      if (holderStatus.nftCount > 0) {
        console.log(`  ✅ Wallet ${walletAddress}: ${holderStatus.nftCount} NFTs`);
      }
    }
    
    return {
      isHolder: totalNFTCount > 0,
      nftCount: totalNFTCount
    };
  }

  // Atomic quest claiming operation
  async claimQuestAtomic(data: {
    farcasterFid: string;
    farcasterUsername: string;
    farcasterPfpUrl?: string;
    walletAddress?: string;
    questType: 'daily_checkin' | 'holder_bonus' | 'streak_bonus' | 'base_transaction';
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
        const currentWeekStart = getCurrentWeekStart();
        const [newUserStats] = await tx
          .insert(userStats)
          .values({
            farcasterFid: data.farcasterFid,
            farcasterUsername: data.farcasterUsername,
            farcasterPfpUrl: data.farcasterPfpUrl || null,
            walletAddress: data.walletAddress || null,
            totalPoints: Math.round(data.pointsEarned * 100), // Convert to fixed-point
            weeklyPoints: Math.round(data.pointsEarned * 100), // Same as totalPoints for new users
            currentStreak: data.questType === 'daily_checkin' ? 1 : 0,
            lastCheckIn: data.questType === 'daily_checkin' ? new Date() : null,
            lastStreakClaim: data.questType === 'streak_bonus' ? new Date() : null,
            weeklyResetDate: currentWeekStart, // Track current week
          })
          .returning();
        
        // Create quest completion
        const [questCompletion] = await tx
          .insert(questCompletions)
          .values({
            farcasterFid: data.farcasterFid,
            questType: data.questType,
            pointsEarned: Math.round(data.pointsEarned * 100), // Convert to fixed-point
            completionDate: data.completionDate,
          })
          .returning();

        return { userStats: newUserStats, questCompletion };
      } else {
        // Update existing user stats
        const currentStats = existingUserStats[0];
        const currentWeekStart = getCurrentWeekStart();
        
        // Check if weekly reset is needed
        const needsWeeklyReset = !currentStats.weeklyResetDate || currentStats.weeklyResetDate !== currentWeekStart;
        
        const updates = {
          totalPoints: currentStats.totalPoints + Math.round(data.pointsEarned * 100), // Add fixed-point values
          weeklyPoints: needsWeeklyReset ? Math.round(data.pointsEarned * 100) : (currentStats.weeklyPoints || 0) + Math.round(data.pointsEarned * 100),
          weeklyResetDate: currentWeekStart, // Update to current week
          farcasterPfpUrl: data.farcasterPfpUrl || currentStats.farcasterPfpUrl, // Update profile picture if provided
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
            pointsEarned: Math.round(data.pointsEarned * 100), // Convert to fixed-point
            completionDate: data.completionDate,
          })
          .returning();

        return { userStats: updatedStats, questCompletion };
      }
    });
  }

  // Weekly reset and champion tracking
  async performWeeklyReset(): Promise<void> {
    await db.transaction(async (tx) => {
      const currentWeekStart = getCurrentWeekStart();
      const weekEnd = getWeekEnd(currentWeekStart);
      const currentYear = new Date().getFullYear();
      const weekNumber = getWeekNumber();

      // Check if any user needs weekly reset (i.e., week has actually changed)
      const [sampleUser] = await tx
        .select()
        .from(userStats)
        .where(sql`${userStats.weeklyResetDate} IS NOT NULL`)
        .limit(1);

      // If no users exist or weekly reset date matches current week, no reset needed
      if (sampleUser && sampleUser.weeklyResetDate === currentWeekStart) {
        console.log(`ℹ️ Weekly reset not needed - still in week starting ${currentWeekStart}`);
        return;
      }

      console.log(`🔄 Performing weekly reset for week starting ${currentWeekStart}`);

      // Get current weekly champion before reset
      const [currentChampion] = await tx
        .select()
        .from(userStats)
        .where(sql`${userStats.weeklyPoints} > 0`)
        .orderBy(sql`${userStats.weeklyPoints} DESC`)
        .limit(1);

      // Record weekly champion if exists
      if (currentChampion && currentChampion.weeklyPoints > 0) {
        await tx
          .insert(weeklyChampions)
          .values({
            farcasterFid: currentChampion.farcasterFid,
            farcasterUsername: currentChampion.farcasterUsername,
            weekStartDate: currentChampion.weeklyResetDate || currentWeekStart,
            weekEndDate: weekEnd,
            weeklyPoints: currentChampion.weeklyPoints,
            weekNumber,
            year: currentYear,
          })
          .onConflictDoNothing(); // Prevent duplicate champions for same week
      }

      // Reset all weekly points and update reset date
      await tx
        .update(userStats)
        .set({
          weeklyPoints: 0,
          weeklyResetDate: currentWeekStart,
          updatedAt: new Date(),
        });
      
      console.log(`✅ Weekly reset completed for week starting ${currentWeekStart}`);
    });
  }

  async getWeeklyChampions(limit: number = 10): Promise<WeeklyChampion[]> {
    return await db
      .select()
      .from(weeklyChampions)
      .where(sql`${weeklyChampions.farcasterUsername} != 'coinacci'`)
      .orderBy(sql`${weeklyChampions.year} DESC, ${weeklyChampions.weekNumber} DESC`)
      .limit(limit);
  }

  async getCurrentWeekChampion(): Promise<WeeklyChampion | null> {
    const currentWeekStart = getCurrentWeekStart();
    const [champion] = await db
      .select()
      .from(weeklyChampions)
      .where(eq(weeklyChampions.weekStartDate, currentWeekStart))
      .limit(1);
    
    return champion || null;
  }

  async backfillWeeklyPointsFromTotal(): Promise<{ updated: number; message: string }> {
    return await db.transaction(async (tx) => {
      const currentWeekStart = getCurrentWeekStart();
      
      // First check how many users need backfill
      const usersNeedingBackfill = await tx
        .select()
        .from(userStats)
        .where(sql`${userStats.weeklyPoints} = 0 AND ${userStats.totalPoints} > 0`);
      
      console.log(`🔍 Found ${usersNeedingBackfill.length} users needing weekly points backfill`);
      
      if (usersNeedingBackfill.length === 0) {
        console.log('📋 No users needed weekly points backfill (all already migrated)');
        return {
          updated: 0,
          message: 'No users needed backfill - all users already have weekly points initialized'
        };
      }
      
      // Update users who have 0 weekly points but positive total points
      const result = await tx
        .update(userStats)
        .set({
          weeklyPoints: sql`${userStats.totalPoints}`, // Copy totalPoints to weeklyPoints
          weeklyResetDate: currentWeekStart, // Mark as migrated to current week
          updatedAt: new Date(),
        })
        .where(sql`${userStats.weeklyPoints} = 0 AND ${userStats.totalPoints} > 0`);

      const updatedCount = result.rowCount || 0;
      
      console.log(`✅ Backfilled weekly points for ${updatedCount} users`);
      return {
        updated: updatedCount,
        message: `Successfully backfilled weekly points for ${updatedCount} users from their total points`
      };
    });
  }
}

export const storage = new DatabaseStorage();

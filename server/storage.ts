import { users, nfts, transactions, nftLikes, userStats, questCompletions, userWallets, weeklyChampions, notificationHistory, syncState, pendingMints, badges, userBadges, type User, type InsertUser, type NFT, type InsertNFT, type Transaction, type InsertTransaction, type NFTLike, type InsertNFTLike, type UserStats, type InsertUserStats, type QuestCompletion, type InsertQuestCompletion, type UserWallet, type InsertUserWallet, type WeeklyChampion, type InsertWeeklyChampion, type NotificationHistory, type InsertNotificationHistory, type SyncState, type InsertSyncState, type PendingMint, type InsertPendingMint, type Badge, type InsertBadge, type UserBadge, type InsertUserBadge, getCurrentWeekStart, getWeekEnd, getWeekNumber, getQuestDay } from "@shared/schema";
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
  getAllNFTs(sortBy?: string): Promise<NFT[]>;
  getNFTsByLocation(lat: number, lng: number, radius: number): Promise<NFT[]>;
  getNFTsByOwner(ownerAddress: string): Promise<NFT[]>;
  getNFTsForSale(sortBy?: string): Promise<NFT[]>;
  createNFT(nft: InsertNFT): Promise<NFT>;
  upsertNFTByTokenId(nft: InsertNFT): Promise<NFT>;
  updateNFT(id: string, updates: Partial<NFT>): Promise<NFT | undefined>;
  updateNFTCoordinates(tokenId: string, latitude: number, longitude: number): Promise<NFT | undefined>;
  getNFTByTokenId(tokenId: string): Promise<NFT | undefined>;
  
  // NFT Like operations
  toggleNFTLike(nftId: string, identifier: { farcasterFid?: string; walletAddress?: string }): Promise<{ liked: boolean; likeCount: number }>;
  checkNFTLiked(nftId: string, identifier: { farcasterFid?: string; walletAddress?: string }): Promise<boolean>;
  getUserLikedNFTIds(farcasterFid: string): Promise<string[]>;

  // Transaction operations
  getTransaction(id: string): Promise<Transaction | undefined>;
  getTransactionsByNFT(nftId: string): Promise<Transaction[]>;
  getTransactionsByUser(userAddress: string): Promise<Transaction[]>;
  getRecentTransactions(limit?: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactionByHash(blockchainTxHash: string): Promise<Transaction | undefined>;
  
  // Donation operations
  getDonationStats(): Promise<{
    totalDonations: number;
    totalAmount: string;
    uniqueDonors: number;
    uniqueRecipients: number;
    topRecipients: Array<{ address: string; totalReceived: string; donationCount: number }>;
    topNFTs: Array<{ nftId: string; title: string; totalReceived: string; donationCount: number }>;
  }>;
  getDonationsByNFT(nftId: string): Promise<Transaction[]>;
  getDonationsReceivedByWallet(walletAddress: string): Promise<Transaction[]>;
  getNFTTipTotals(): Promise<Map<string, number>>;

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
  syncWeeklyWithAllTime(): Promise<{ updated: number; message: string }>;
  backfillReferralCodes(): Promise<{ updated: number; message: string }>;
  
  // Multi-wallet operations
  addUserWallet(farcasterFid: string, walletAddress: string, platform: string): Promise<UserWallet>;
  getUserWallets(farcasterFid: string): Promise<UserWallet[]>;
  getLinkedWallets(walletAddress: string): Promise<UserWallet[]>;
  checkCombinedHolderStatus(farcasterFid: string): Promise<{ isHolder: boolean; nftCount: number }>;
  getFarcasterInfoFromWallet(walletAddress: string): Promise<{ fid: string; username: string } | null>;
  
  // Quest helper methods
  getQuestCompletion(farcasterFid: string, questType: string, day: number): Promise<QuestCompletion | undefined>;
  addQuestCompletion(data: { farcasterFid: string; questType: string; completionDate: string; pointsEarned: number; day: number }): Promise<QuestCompletion>;
  
  // Referral operations
  validateAndApplyReferral(data: {
    referralCode: string;
    newUserFid: string;
    newUserUsername: string;
    newUserPfpUrl?: string;
  }): Promise<{ success: boolean; message: string; referrerPoints?: number }>;
  
  // Atomic quest claiming operation
  claimQuestAtomic(data: {
    farcasterFid: string;
    farcasterUsername: string;
    walletAddress?: string;
    castUrl?: string;
    questType: 'daily_checkin' | 'holder_bonus' | 'streak_bonus' | 'base_transaction' | 'social_post';
    pointsEarned: number;
    completionDate: string;
    userStatsUpdates?: Partial<UserStats>;
  }): Promise<{ userStats: UserStats; questCompletion: QuestCompletion }>;
  
  // One-time quest: Add Mini App
  completeAddMiniAppQuest(data: {
    farcasterFid: string;
    farcasterUsername: string;
    farcasterPfpUrl?: string;
    pointsEarned: number;
  }): Promise<{ totalPoints: number }>;

  // Notification operations
  updateUserNotificationToken(farcasterFid: string, token: string): Promise<UserStats | undefined>;
  enableUserNotifications(farcasterFid: string, enabled: boolean): Promise<UserStats | undefined>;
  getUsersWithNotifications(): Promise<UserStats[]>;
  createNotificationHistory(notification: InsertNotificationHistory): Promise<NotificationHistory>;
  getNotificationHistory(limit?: number): Promise<NotificationHistory[]>;
  updateLastNotificationSent(farcasterFids: string[]): Promise<number>;

  // Blockchain sync operations
  getSyncState(contractAddress: string): Promise<SyncState | undefined>;
  updateSyncState(contractAddress: string, lastProcessedBlock: number): Promise<SyncState>;

  // Pending mints operations
  createPendingMint(pendingMint: InsertPendingMint): Promise<PendingMint>;
  getPendingMints(limit?: number): Promise<PendingMint[]>;
  updatePendingMintRetry(id: string, error: string): Promise<PendingMint | undefined>;
  deletePendingMint(id: string): Promise<void>;

  // Badge operations
  getAllBadges(): Promise<Badge[]>;
  getUserBadges(identifier: { farcasterFid?: string; walletAddress?: string }): Promise<string[]>;
  awardBadge(badgeCode: string, identifier: { farcasterFid?: string; walletAddress?: string }): Promise<UserBadge | undefined>;
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

  async getAllNFTs(sortBy?: string): Promise<NFT[]> {
    // Apply sorting based on sortBy parameter
    if (sortBy === 'likeCount' || sortBy === 'popular') {
      return await db
        .select()
        .from(nfts)
        .orderBy(sql`${nfts.likeCount} DESC NULLS LAST, ${nfts.createdAt} DESC`);
    } else if (sortBy === 'tips') {
      // Sort by total tips received (only count donation transactions)
      const result = await db
        .select({
          nft: nfts,
          totalTips: sql<string>`COALESCE(SUM(CAST(${transactions.amount} AS DECIMAL)), 0)`.as('total_tips')
        })
        .from(nfts)
        .leftJoin(transactions, and(
          eq(nfts.id, transactions.nftId),
          eq(transactions.transactionType, 'donation')
        ))
        .groupBy(nfts.id)
        .orderBy(sql`total_tips DESC, ${nfts.createdAt} DESC`);
      
      return result.map(r => r.nft);
    } else {
      // Default: sort by creation date
      return await db
        .select()
        .from(nfts)
        .orderBy(sql`${nfts.createdAt} DESC`);
    }
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

  async getNFTsForSale(sortBy?: string): Promise<NFT[]> {
    // Apply sorting based on sortBy parameter
    if (sortBy === 'likeCount' || sortBy === 'popular') {
      return await db
        .select()
        .from(nfts)
        .where(eq(nfts.isForSale, 1))
        .orderBy(sql`${nfts.likeCount} DESC NULLS LAST, ${nfts.createdAt} DESC`);
    } else if (sortBy === 'tips') {
      // Sort by total tips received (only count donation transactions)
      const result = await db
        .select({
          nft: nfts,
          totalTips: sql<string>`COALESCE(SUM(CAST(${transactions.amount} AS DECIMAL)), 0)`.as('total_tips')
        })
        .from(nfts)
        .leftJoin(transactions, and(
          eq(nfts.id, transactions.nftId),
          eq(transactions.transactionType, 'donation')
        ))
        .where(eq(nfts.isForSale, 1))
        .groupBy(nfts.id)
        .orderBy(sql`total_tips DESC, ${nfts.createdAt} DESC`);
      
      return result.map(r => r.nft);
    } else {
      // Default: sort by creation date
      return await db
        .select()
        .from(nfts)
        .where(eq(nfts.isForSale, 1))
        .orderBy(sql`${nfts.createdAt} DESC`);
    }
  }

  async createNFT(insertNFT: InsertNFT): Promise<NFT> {
    const [nft] = await db
      .insert(nfts)
      .values(insertNFT)
      .returning();
    return nft;
  }

  async upsertNFTByTokenId(insertNFT: InsertNFT): Promise<NFT> {
    // Protected NFTs with fixed override locations - NEVER update their locations
    const protectedTokenIds = ['106', '89', '48', '44', '41'];
    const isProtected = insertNFT.tokenId && protectedTokenIds.includes(insertNFT.tokenId);
    
    // Fetch Farcaster info for owner (always update on sync)
    const ownerInfo = await this.getFarcasterInfoFromWallet(insertNFT.ownerAddress);
    
    // Only fetch creator info if creator exists AND creator != owner (to avoid overwriting creator with owner data)
    let creatorInfo = null;
    if (insertNFT.creatorAddress) {
      const isDifferentCreator = insertNFT.creatorAddress.toLowerCase() !== insertNFT.ownerAddress.toLowerCase();
      if (isDifferentCreator) {
        creatorInfo = await this.getFarcasterInfoFromWallet(insertNFT.creatorAddress);
      }
    }
    
    // Prepare insert values with Farcaster fields (used only on initial insert)
    const insertValues = {
      ...insertNFT,
      // Set creator info only if different from owner, otherwise leave null for backend to handle
      farcasterCreatorUsername: creatorInfo?.username || null,
      farcasterCreatorFid: creatorInfo?.fid || null,
      // Always set owner info
      farcasterOwnerUsername: ownerInfo?.username || null,
      farcasterOwnerFid: ownerInfo?.fid || null,
    };
    
    // Base update object - ONLY update owner Farcaster fields, NOT creator fields
    // Creator is set once on mint and should not be overwritten by sync
    const baseUpdateSet = {
      title: insertNFT.title,
      description: insertNFT.description,
      imageUrl: insertNFT.imageUrl,
      category: insertNFT.category,
      price: insertNFT.price,
      ownerAddress: insertNFT.ownerAddress,
      creatorAddress: insertNFT.creatorAddress,
      // Only update owner Farcaster info on sync, preserve creator info
      farcasterOwnerUsername: ownerInfo?.username || null,
      farcasterOwnerFid: ownerInfo?.fid || null,
      metadata: insertNFT.metadata,
      updatedAt: new Date()
    };
    
    // For protected NFTs, exclude location updates to preserve override locations
    const updateSet = isProtected ? baseUpdateSet : {
      ...baseUpdateSet,
      location: insertNFT.location,
      latitude: insertNFT.latitude,
      longitude: insertNFT.longitude
    };
    
    const [nft] = await db
      .insert(nfts)
      .values(insertValues)
      .onConflictDoUpdate({
        target: nfts.tokenId,
        set: updateSet
      })
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

  // 🔄 Update NFT owner and auto-delist if transferred (for blockchain sync)
  async updateNFTOwnerAndDelist(tokenId: string, newOwnerAddress: string): Promise<NFT | undefined> {
    const [nft] = await db
      .update(nfts)
      .set({ 
        ownerAddress: newOwnerAddress,
        isForSale: 0, // Auto-delist on transfer
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

  async toggleNFTLike(nftId: string, identifier: { farcasterFid?: string; walletAddress?: string }): Promise<{ liked: boolean; likeCount: number }> {
    const { farcasterFid, walletAddress } = identifier;
    
    if (!farcasterFid && !walletAddress) {
      throw new Error("Either farcasterFid or walletAddress is required");
    }

    return await db.transaction(async (tx) => {
      // Build the where condition based on available identifier
      const whereCondition = farcasterFid 
        ? and(eq(nftLikes.nftId, nftId), eq(nftLikes.farcasterFid, farcasterFid))
        : and(eq(nftLikes.nftId, nftId), eq(nftLikes.walletAddress, walletAddress!.toLowerCase()));

      const existingLike = await tx
        .select()
        .from(nftLikes)
        .where(whereCondition);

      if (existingLike.length > 0) {
        await tx.delete(nftLikes).where(whereCondition);
        
        const [updatedNFT] = await tx
          .update(nfts)
          .set({ likeCount: sql`GREATEST(0, ${nfts.likeCount} - 1)` })
          .where(eq(nfts.id, nftId))
          .returning();
        
        return { liked: false, likeCount: updatedNFT?.likeCount || 0 };
      } else {
        await tx.insert(nftLikes).values({
          nftId,
          farcasterFid: farcasterFid || null,
          walletAddress: walletAddress?.toLowerCase() || null,
        });
        
        const [updatedNFT] = await tx
          .update(nfts)
          .set({ likeCount: sql`${nfts.likeCount} + 1` })
          .where(eq(nfts.id, nftId))
          .returning();
        
        return { liked: true, likeCount: updatedNFT?.likeCount || 1 };
      }
    });
  }

  async checkNFTLiked(nftId: string, identifier: { farcasterFid?: string; walletAddress?: string }): Promise<boolean> {
    const { farcasterFid, walletAddress } = identifier;
    
    if (!farcasterFid && !walletAddress) {
      return false;
    }

    const whereCondition = farcasterFid 
      ? and(eq(nftLikes.nftId, nftId), eq(nftLikes.farcasterFid, farcasterFid))
      : and(eq(nftLikes.nftId, nftId), eq(nftLikes.walletAddress, walletAddress!.toLowerCase()));

    const [like] = await db
      .select()
      .from(nftLikes)
      .where(whereCondition);
    return !!like;
  }

  async getUserLikedNFTIds(farcasterFid: string): Promise<string[]> {
    if (!farcasterFid) {
      return [];
    }
    
    const likes = await db
      .select({ nftId: nftLikes.nftId })
      .from(nftLikes)
      .where(eq(nftLikes.farcasterFid, farcasterFid));
    
    return likes.map(like => like.nftId);
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

  async getRecentTransactions(limit: number = 20): Promise<Transaction[]> {
    return await db
      .select({
        id: transactions.id,
        nftId: transactions.nftId,
        fromAddress: transactions.fromAddress,
        toAddress: transactions.toAddress,
        transactionType: transactions.transactionType,
        amount: transactions.amount,
        platformFee: transactions.platformFee,
        blockchainTxHash: transactions.blockchainTxHash,
        createdAt: transactions.createdAt,
        // Include NFT details
        nft: {
          id: nfts.id,
          title: nfts.title,
          imageUrl: nfts.imageUrl,
          location: nfts.location,
          price: nfts.price
        }
      })
      .from(transactions)
      .leftJoin(nfts, eq(transactions.nftId, nfts.id))
      .where(sql`${transactions.transactionType} IN ('purchase', 'sale')`) // Show both purchase and sale activities
      .orderBy(sql`${transactions.createdAt} DESC`)
      .limit(limit);
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db
      .insert(transactions)
      .values(insertTransaction)
      .returning();
    return transaction;
  }

  async getTransactionByHash(blockchainTxHash: string): Promise<Transaction | undefined> {
    const [tx] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.blockchainTxHash, blockchainTxHash));
    return tx || undefined;
  }

  // Donation operations
  async getDonationStats(): Promise<{
    totalDonations: number;
    totalAmount: string;
    uniqueDonors: number;
    uniqueRecipients: number;
    topRecipients: Array<{ address: string; totalReceived: string; donationCount: number }>;
    topNFTs: Array<{ nftId: string; title: string; totalReceived: string; donationCount: number }>;
  }> {
    // Get basic stats
    const [basicStats] = await db
      .select({
        totalDonations: sql<number>`COUNT(*)::int`,
        totalAmount: sql<string>`COALESCE(SUM(${transactions.amount}::numeric), 0)::text`,
        uniqueDonors: sql<number>`COUNT(DISTINCT ${transactions.fromAddress})::int`,
        uniqueRecipients: sql<number>`COUNT(DISTINCT ${transactions.toAddress})::int`,
      })
      .from(transactions)
      .where(eq(transactions.transactionType, 'donation'));

    // Get top recipients
    const topRecipients = await db
      .select({
        address: transactions.toAddress,
        totalReceived: sql<string>`SUM(${transactions.amount}::numeric)::text`,
        donationCount: sql<number>`COUNT(*)::int`,
      })
      .from(transactions)
      .where(eq(transactions.transactionType, 'donation'))
      .groupBy(transactions.toAddress)
      .orderBy(sql`SUM(${transactions.amount}::numeric) DESC`)
      .limit(10);

    // Get top NFTs by donation
    const topNFTs = await db
      .select({
        nftId: transactions.nftId,
        title: nfts.title,
        totalReceived: sql<string>`SUM(${transactions.amount}::numeric)::text`,
        donationCount: sql<number>`COUNT(*)::int`,
      })
      .from(transactions)
      .leftJoin(nfts, eq(transactions.nftId, nfts.id))
      .where(eq(transactions.transactionType, 'donation'))
      .groupBy(transactions.nftId, nfts.title)
      .orderBy(sql`SUM(${transactions.amount}::numeric) DESC`)
      .limit(10);

    return {
      totalDonations: basicStats?.totalDonations || 0,
      totalAmount: basicStats?.totalAmount || '0',
      uniqueDonors: basicStats?.uniqueDonors || 0,
      uniqueRecipients: basicStats?.uniqueRecipients || 0,
      topRecipients: topRecipients.map(r => ({
        address: r.address || '',
        totalReceived: r.totalReceived || '0',
        donationCount: r.donationCount || 0,
      })),
      topNFTs: topNFTs.map(n => ({
        nftId: n.nftId || '',
        title: n.title || 'Unknown',
        totalReceived: n.totalReceived || '0',
        donationCount: n.donationCount || 0,
      })),
    };
  }

  async getDonationsByNFT(nftId: string): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(and(
        eq(transactions.nftId, nftId),
        eq(transactions.transactionType, 'donation')
      ))
      .orderBy(sql`${transactions.createdAt} DESC`);
  }

  async getDonationsReceivedByWallet(walletAddress: string): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(and(
        eq(transactions.toAddress, walletAddress),
        eq(transactions.transactionType, 'donation')
      ))
      .orderBy(sql`${transactions.createdAt} DESC`);
  }

  async getNFTTipTotals(): Promise<Map<string, number>> {
    const result = await db
      .select({
        nftId: transactions.nftId,
        totalTips: sql<string>`SUM(CAST(${transactions.amount} AS DECIMAL) + CAST(${transactions.platformFee} AS DECIMAL))`.as('total_tips')
      })
      .from(transactions)
      .where(eq(transactions.transactionType, 'donation'))
      .groupBy(transactions.nftId);
    
    const tipMap = new Map<string, number>();
    for (const row of result) {
      tipMap.set(row.nftId, parseFloat(row.totalTips || '0'));
    }
    return tipMap;
  }

  // Quest system operations
  async getUserStats(farcasterFid: string): Promise<UserStats | undefined> {
    const [stats] = await db.select().from(userStats).where(eq(userStats.farcasterFid, farcasterFid));
    return stats || undefined;
  }

  // Generate unique referral code
  private async generateReferralCode(username: string): Promise<string> {
    const maxAttempts = 10;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Take first 3-4 characters of username, uppercase
      const prefix = username.slice(0, 4).toUpperCase().replace(/[^A-Z]/g, '');
      const finalPrefix = prefix.length >= 3 ? prefix : prefix.padEnd(3, 'X');
      
      // Generate 3 random digits
      const randomDigits = Math.floor(100 + Math.random() * 900);
      const code = `${finalPrefix}${randomDigits}`;
      
      // Check if code already exists
      const existing = await db
        .select()
        .from(userStats)
        .where(eq(userStats.referralCode, code));
      
      if (existing.length === 0) {
        return code;
      }
    }
    
    // Fallback: use timestamp-based code if all attempts fail
    const timestamp = Date.now().toString().slice(-6);
    return `REF${timestamp}`;
  }

  async createOrUpdateUserStats(insertStats: InsertUserStats): Promise<UserStats> {
    // Try to find existing user stats
    const existing = await this.getUserStats(insertStats.farcasterFid);
    
    if (existing) {
      // If existing user doesn't have referralCode, generate one
      const referralCode = existing.referralCode || await this.generateReferralCode(insertStats.farcasterUsername);
      
      // Update existing
      const [updated] = await db
        .update(userStats)
        .set({ 
          ...insertStats,
          referralCode, // Ensure referralCode is set
          updatedAt: new Date()
        })
        .where(eq(userStats.farcasterFid, insertStats.farcasterFid))
        .returning();
      return updated;
    } else {
      // Create new - generate referral code if not provided
      const referralCode = insertStats.referralCode || await this.generateReferralCode(insertStats.farcasterUsername);
      
      const [created] = await db
        .insert(userStats)
        .values({
          ...insertStats,
          referralCode,
          referralCount: 0
        })
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
    // Normalize completionDate to YYYY-MM-DD to ensure consistency across all insert paths
    const normalizedDate = insertCompletion.completionDate.split('T')[0]; // Strip time component
    
    const [completion] = await db
      .insert(questCompletions)
      .values({
        ...insertCompletion,
        completionDate: normalizedDate
      })
      .returning();
    return completion;
  }

  async getQuestCompletion(farcasterFid: string, questType: string, day: number): Promise<QuestCompletion | undefined> {
    // Convert day (Unix days since epoch) to YYYY-MM-DD format
    const date = new Date(day * 24 * 60 * 60 * 1000);
    const completionDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
    
    const [completion] = await db
      .select()
      .from(questCompletions)
      .where(
        and(
          eq(questCompletions.farcasterFid, farcasterFid),
          eq(questCompletions.questType, questType),
          eq(questCompletions.completionDate, completionDate)
        )
      )
      .limit(1);
    
    return completion || undefined;
  }

  async addQuestCompletion(data: { farcasterFid: string; questType: string; completionDate: string; pointsEarned: number; day: number }): Promise<QuestCompletion> {
    // Convert day to YYYY-MM-DD format to ensure consistency
    const date = new Date(data.day * 24 * 60 * 60 * 1000);
    const normalizedDate = date.toISOString().split('T')[0];
    
    return await this.createQuestCompletion({
      farcasterFid: data.farcasterFid,
      questType: data.questType as any,
      completionDate: normalizedDate, // Use normalized date from blockchain day
      pointsEarned: data.pointsEarned
    });
  }

  async getLeaderboard(limit: number = 50): Promise<UserStats[]> {
    return await db
      .select()
      .from(userStats)
      .orderBy(sql`${userStats.totalPoints} DESC`)
      .limit(limit);
  }

  async getWeeklyLeaderboard(limit: number = 50): Promise<UserStats[]> {
    // 🎯 FIXED: Always show actual weekly points, never totalPoints masquerading as weekly
    console.log('📊 Fetching weekly leaderboard with actual weeklyPoints (not totalPoints)');
    
    // Show actual weekly leaderboard - this is the only correct way
    // weeklyPoints is automatically reset during weekly reset process
    return await db
      .select()
      .from(userStats)
      .where(sql`${userStats.farcasterUsername} IS NOT NULL AND ${userStats.farcasterUsername} != ''`)
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
    const lowerAddress = walletAddress.toLowerCase();
    
    // First, try to upsert: update platform if wallet already exists for this FID
    const [updated] = await db
      .update(userWallets)
      .set({ platform })
      .where(sql`${userWallets.farcasterFid} = ${farcasterFid} AND ${userWallets.walletAddress} = ${lowerAddress}`)
      .returning();
    
    if (updated) {
      console.log(`🔄 Updated existing wallet platform: ${lowerAddress} → ${platform}`);
      return updated;
    }
    
    // If no existing wallet found, insert new one
    const [userWallet] = await db
      .insert(userWallets)
      .values({
        farcasterFid,
        walletAddress: lowerAddress,
        platform
      })
      .onConflictDoNothing()
      .returning();
    
    if (!userWallet) {
      // If still conflict (edge case), return the existing one
      const [existing] = await db
        .select()
        .from(userWallets)
        .where(sql`${userWallets.farcasterFid} = ${farcasterFid} AND ${userWallets.walletAddress} = ${lowerAddress}`);
      console.log(`ℹ️ Returning existing wallet: ${lowerAddress} (${existing?.platform})`);
      return existing;
    }
    
    console.log(`✅ Created new wallet link: ${lowerAddress} → ${platform}`);
    return userWallet;
  }

  async getUserWallets(farcasterFid: string): Promise<UserWallet[]> {
    return await db
      .select()
      .from(userWallets)
      .where(eq(userWallets.farcasterFid, farcasterFid));
  }

  async getLinkedWallets(walletAddress: string): Promise<UserWallet[]> {
    return await db
      .select()
      .from(userWallets)
      .where(eq(userWallets.walletAddress, walletAddress.toLowerCase()));
  }

  // Get Farcaster FID and username from wallet address
  async getFarcasterInfoFromWallet(walletAddress: string): Promise<{ fid: string; username: string } | null> {
    try {
      // Step 1: Try local database first (user_wallets + user_stats)
      const [wallet] = await db
        .select()
        .from(userWallets)
        .where(eq(userWallets.walletAddress, walletAddress.toLowerCase()))
        .limit(1);
      
      if (wallet) {
        // Lookup username from userStats
        const stats = await this.getUserStats(wallet.farcasterFid);
        
        if (stats) {
          return {
            fid: wallet.farcasterFid,
            username: stats.farcasterUsername
          };
        }
      }
      
      // Step 2: Fallback to Neynar API for wallets not in our database
      const { getNeynarUserByAddress } = await import('./neynar-api');
      const neynarResult = await getNeynarUserByAddress(walletAddress);
      
      if (neynarResult) {
        console.log(`✅ Found Farcaster user via Neynar: ${neynarResult.username} (${neynarResult.fid})`);
        return neynarResult;
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Error fetching Farcaster info for wallet ${walletAddress}:`, error);
      return null;
    }
  }

  // Fetch verified addresses from Farcaster Hub API
  async getFarcasterVerifiedAddresses(farcasterFid: string): Promise<string[]> {
    try {
      console.log(`🔍 Fetching verified addresses for Farcaster FID ${farcasterFid}`);
      
      // Use Farcaster Hub API with fallback endpoints
      const hubEndpoints = [
        'https://hub.farcaster.xyz',
        'https://hub.pinata.cloud'
      ];
      
      for (const hubUrl of hubEndpoints) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const response = await fetch(
            `${hubUrl}/v1/verificationsByFid?fid=${farcasterFid}`,
            { signal: controller.signal }
          );
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            console.log(`⚠️ Hub ${hubUrl} error: ${response.status} ${response.statusText}`);
            continue;
          }
          
          const data = await response.json();
          const addresses: string[] = [];
          
          if (data.messages && Array.isArray(data.messages)) {
            data.messages.forEach((message: any) => {
              if (message.data?.verificationAddEthAddressBody?.address) {
                const address = message.data.verificationAddEthAddressBody.address;
                if (address.startsWith('0x')) {
                  addresses.push(address.toLowerCase());
                }
              }
            });
          }
          
          // Deduplicate addresses
          const uniqueAddresses = Array.from(new Set(addresses));
          console.log(`✅ Found ${uniqueAddresses.length} verified addresses for FID ${farcasterFid} via ${hubUrl}:`, uniqueAddresses);
          return uniqueAddresses;
          
        } catch (hubError) {
          console.log(`⚠️ Hub ${hubUrl} failed:`, hubError);
          continue;
        }
      }
      
      console.log(`⚠️ All Hub endpoints failed for FID ${farcasterFid}`);
      return [];
      
    } catch (error) {
      console.error(`❌ Error fetching verified addresses for FID ${farcasterFid}:`, error);
      return [];
    }
  }

  async getAllNFTsForUser(farcasterFid: string): Promise<(NFT & { sourceWallet: string; sourcePlatform: string })[]> {
    // Get linked wallets and verified addresses in parallel
    const [linkedWallets, verifiedAddresses] = await Promise.all([
      this.getUserWallets(farcasterFid),
      this.getFarcasterVerifiedAddresses(farcasterFid)
    ]);
    
    // Create wallet map for all addresses (both linked and verified)
    const uniqueWallets = new Map<string, { address: string; platform: string }>();
    
    // Add linked wallets
    linkedWallets.forEach(wallet => {
      const address = wallet.walletAddress.toLowerCase();
      uniqueWallets.set(address, {
        address,
        platform: wallet.platform
      });
    });
    
    // Add verified addresses (mark as 'farcaster' platform if not already linked)
    verifiedAddresses.forEach(address => {
      const lowerAddress = address.toLowerCase();
      if (!uniqueWallets.has(lowerAddress)) {
        uniqueWallets.set(lowerAddress, {
          address: lowerAddress,
          platform: 'farcaster'
        });
      }
    });
    
    console.log(`🔍 Fetching NFTs for Farcaster FID ${farcasterFid}: ${linkedWallets.length} linked + ${verifiedAddresses.length} verified → ${uniqueWallets.size} unique addresses`);
    
    if (uniqueWallets.size === 0) {
      return [];
    }
    
    const allNFTs: (NFT & { sourceWallet: string; sourcePlatform: string })[] = [];
    
    // Get NFTs from each unique wallet address
    for (const [walletAddress, walletInfo] of Array.from(uniqueWallets.entries())) {
      const nfts = await this.getNFTsByOwner(walletInfo.address);
      const nftsWithSource = nfts.map(nft => ({
        ...nft,
        sourceWallet: walletInfo.address,
        sourcePlatform: walletInfo.platform
      }));
      allNFTs.push(...nftsWithSource);
      
      if (nfts.length > 0) {
        console.log(`  ✅ Wallet ${walletInfo.address} (${walletInfo.platform}): ${nfts.length} NFTs`);
      }
    }
    
    return allNFTs;
  }

  async checkCombinedHolderStatus(farcasterFid: string): Promise<{ isHolder: boolean; nftCount: number }> {
    // Get linked wallets and verified addresses in parallel - just like getAllNFTsForUser
    const [linkedWallets, verifiedAddresses] = await Promise.all([
      this.getUserWallets(farcasterFid),
      this.getFarcasterVerifiedAddresses(farcasterFid)
    ]);
    
    // Create wallet map for all addresses (both linked and verified)
    const uniqueWallets = new Map<string, { address: string; platform: string }>();
    
    // Add linked wallets
    linkedWallets.forEach(wallet => {
      const address = wallet.walletAddress.toLowerCase();
      uniqueWallets.set(address, {
        address,
        platform: wallet.platform
      });
    });
    
    // Add Farcaster verified addresses (if not already added)
    verifiedAddresses.forEach(address => {
      const lowerAddress = address.toLowerCase();
      if (!uniqueWallets.has(lowerAddress)) {
        uniqueWallets.set(lowerAddress, {
          address: lowerAddress,
          platform: 'farcaster_verified'
        });
      }
    });
    
    const uniqueWalletAddresses = Array.from(uniqueWallets.keys());
    
    console.log(`🔍 Checking holder status for Farcaster FID ${farcasterFid}: ${linkedWallets.length} linked + ${verifiedAddresses.length} verified → ${uniqueWalletAddresses.length} unique addresses`);
    
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
    castUrl?: string;
    questType: 'daily_checkin' | 'holder_bonus' | 'base_transaction' | 'social_post';
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
            lastStreakClaim: null,
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
            castUrl: data.castUrl, // Include cast URL for social_post quests
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
            castUrl: data.castUrl, // Include cast URL for social_post quests
          })
          .returning();

        return { userStats: updatedStats, questCompletion };
      }
    });
  }

  // One-time quest: Add Mini App to Farcaster
  async completeAddMiniAppQuest(data: {
    farcasterFid: string;
    farcasterUsername: string;
    farcasterPfpUrl?: string;
    pointsEarned: number;
  }): Promise<{ totalPoints: number }> {
    // Generate referral code outside transaction
    const referralCode = await this.generateReferralCode(data.farcasterUsername);
    
    return await db.transaction(async (tx) => {
      // Get or create user stats
      const existingUserStats = await tx
        .select()
        .from(userStats)
        .where(eq(userStats.farcasterFid, data.farcasterFid));

      if (existingUserStats.length === 0) {
        // Create new user stats with hasAddedMiniApp = true
        const currentWeekStart = getCurrentWeekStart();
        
        const [newUserStats] = await tx
          .insert(userStats)
          .values({
            farcasterFid: data.farcasterFid,
            farcasterUsername: data.farcasterUsername,
            farcasterPfpUrl: data.farcasterPfpUrl || null,
            totalPoints: data.pointsEarned,
            weeklyPoints: data.pointsEarned,
            hasAddedMiniApp: true,
            weeklyResetDate: currentWeekStart,
            referralCode,
            referralCount: 0,
          })
          .returning();

        return { totalPoints: newUserStats.totalPoints };
      } else {
        // Update existing user stats
        const currentStats = existingUserStats[0];
        const currentWeekStart = getCurrentWeekStart();
        
        // Check if weekly reset is needed
        const needsWeeklyReset = !currentStats.weeklyResetDate || currentStats.weeklyResetDate !== currentWeekStart;
        
        const [updatedStats] = await tx
          .update(userStats)
          .set({
            totalPoints: currentStats.totalPoints + data.pointsEarned,
            weeklyPoints: needsWeeklyReset ? data.pointsEarned : (currentStats.weeklyPoints || 0) + data.pointsEarned,
            weeklyResetDate: currentWeekStart,
            hasAddedMiniApp: true,
            farcasterPfpUrl: data.farcasterPfpUrl || currentStats.farcasterPfpUrl,
            updatedAt: new Date(),
          })
          .where(eq(userStats.farcasterFid, data.farcasterFid))
          .returning();

        return { totalPoints: updatedStats.totalPoints };
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

      // Get current weekly champion before reset (excluding coinacci and users with empty usernames)
      const [currentChampion] = await tx
        .select()
        .from(userStats)
        .where(sql`${userStats.weeklyPoints} > 0 AND ${userStats.farcasterUsername} != 'coinacci' AND ${userStats.farcasterUsername} IS NOT NULL AND ${userStats.farcasterUsername} != ''`)
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

  // NEW: Sync ALL weekly points with total points (for same week)
  async syncWeeklyWithAllTime(): Promise<{ updated: number; message: string }> {
    return await db.transaction(async (tx) => {
      const currentWeekStart = getCurrentWeekStart();
      
      console.log(`🔄 Syncing ALL weekly points with total points for week starting ${currentWeekStart}`);
      
      // Update ALL users to have weeklyPoints = totalPoints for current week
      const result = await tx
        .update(userStats)
        .set({
          weeklyPoints: sql`${userStats.totalPoints}`, // Copy totalPoints to weeklyPoints
          weeklyResetDate: currentWeekStart, // Mark as current week
          updatedAt: new Date(),
        })
        .where(sql`${userStats.totalPoints} > 0`); // Only users with points

      const updatedCount = result.rowCount || 0;
      
      console.log(`✅ Synced weekly points with all-time for ${updatedCount} users`);
      return {
        updated: updatedCount,
        message: `Successfully synced weekly points with all-time points for ${updatedCount} users`
      };
    });
  }

  // Backfill referral codes for existing users
  async backfillReferralCodes(): Promise<{ updated: number; message: string }> {
    console.log('🔍 Starting referral code backfill...');
    
    // Get all users without referral codes
    const usersNeedingCodes = await db
      .select()
      .from(userStats)
      .where(sql`${userStats.referralCode} IS NULL`);
    
    console.log(`📊 Found ${usersNeedingCodes.length} users without referral codes`);
    
    if (usersNeedingCodes.length === 0) {
      return {
        updated: 0,
        message: 'No users need referral codes - all users already have codes'
      };
    }

    let updatedCount = 0;
    
    // Generate and update referral codes one by one
    for (const user of usersNeedingCodes) {
      try {
        const referralCode = await this.generateReferralCode(user.farcasterUsername);
        
        await db
          .update(userStats)
          .set({ 
            referralCode,
            updatedAt: new Date()
          })
          .where(eq(userStats.farcasterFid, user.farcasterFid));
        
        updatedCount++;
        
        if (updatedCount % 50 === 0) {
          console.log(`⏳ Progress: ${updatedCount}/${usersNeedingCodes.length} users updated`);
        }
      } catch (error) {
        console.error(`❌ Failed to generate referral code for ${user.farcasterUsername}:`, error);
      }
    }
    
    console.log(`✅ Backfilled referral codes for ${updatedCount} users`);
    return {
      updated: updatedCount,
      message: `Successfully generated referral codes for ${updatedCount} users`
    };
  }

  // Notification operations
  async updateUserNotificationToken(farcasterFid: string, token: string): Promise<UserStats | undefined> {
    const [user] = await db
      .update(userStats)
      .set({ 
        notificationToken: token,
        notificationsEnabled: true, // Auto-enable when token is set
        updatedAt: new Date()
      })
      .where(eq(userStats.farcasterFid, farcasterFid))
      .returning();
    
    console.log(`📱 Updated notification token for user ${farcasterFid}`);
    return user || undefined;
  }

  async enableUserNotifications(farcasterFid: string, enabled: boolean): Promise<UserStats | undefined> {
    const [user] = await db
      .update(userStats)
      .set({ 
        notificationsEnabled: enabled,
        updatedAt: new Date()
      })
      .where(eq(userStats.farcasterFid, farcasterFid))
      .returning();
    
    console.log(`🔔 ${enabled ? 'Enabled' : 'Disabled'} notifications for user ${farcasterFid}`);
    return user || undefined;
  }

  async getUsersWithNotifications(): Promise<UserStats[]> {
    return await db
      .select()
      .from(userStats)
      .where(sql`${userStats.notificationsEnabled} = true AND ${userStats.notificationToken} IS NOT NULL`);
  }

  async createNotificationHistory(notification: InsertNotificationHistory): Promise<NotificationHistory> {
    const [history] = await db
      .insert(notificationHistory)
      .values(notification)
      .returning();
    
    console.log(`📋 Created notification history: ${notification.title} to ${notification.recipientCount} users`);
    return history;
  }

  async getNotificationHistory(limit: number = 20): Promise<NotificationHistory[]> {
    return await db
      .select()
      .from(notificationHistory)
      .orderBy(sql`${notificationHistory.sentAt} DESC`)
      .limit(limit);
  }

  async updateLastNotificationSent(farcasterFids: string[]): Promise<number> {
    if (farcasterFids.length === 0) return 0;

    const result = await db
      .update(userStats)
      .set({ lastNotificationSent: new Date() })
      .where(sql`${userStats.farcasterFid} = ANY(${farcasterFids})`);
    
    return result.rowCount || 0;
  }

  // Blockchain sync operations
  async getSyncState(contractAddress: string): Promise<SyncState | undefined> {
    const [state] = await db
      .select()
      .from(syncState)
      .where(eq(syncState.contractAddress, contractAddress.toLowerCase()));
    return state || undefined;
  }

  async updateSyncState(contractAddress: string, lastProcessedBlock: number): Promise<SyncState> {
    const existing = await this.getSyncState(contractAddress);
    
    if (existing) {
      const [updated] = await db
        .update(syncState)
        .set({
          lastProcessedBlock,
          lastSyncAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(syncState.contractAddress, contractAddress.toLowerCase()))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(syncState)
        .values({
          contractAddress: contractAddress.toLowerCase(),
          lastProcessedBlock,
          lastSyncAt: new Date()
        })
        .returning();
      return created;
    }
  }

  // Referral operations
  async validateAndApplyReferral(data: {
    referralCode: string;
    newUserFid: string;
    newUserUsername: string;
    newUserPfpUrl?: string;
  }): Promise<{ success: boolean; message: string; referrerPoints?: number }> {
    // Pre-generate referral code outside transaction
    const newReferralCode = await this.generateReferralCode(data.newUserUsername);
    
    return await db.transaction(async (tx) => {
      // 1. Find referrer by referral code
      const [referrer] = await tx
        .select()
        .from(userStats)
        .where(eq(userStats.referralCode, data.referralCode));

      if (!referrer) {
        return {
          success: false,
          message: 'Invalid referral code'
        };
      }

      // 2. Check if user is trying to refer themselves
      if (referrer.farcasterFid === data.newUserFid) {
        return {
          success: false,
          message: 'Cannot use your own referral code'
        };
      }

      // 3. Check if new user already used a referral code
      const [newUser] = await tx
        .select()
        .from(userStats)
        .where(eq(userStats.farcasterFid, data.newUserFid));

      if (newUser?.referredByFid) {
        return {
          success: false,
          message: 'Referral code already used'
        };
      }

      // 4. Create or update new user with referral
      const currentWeekStart = getCurrentWeekStart();
      
      if (!newUser) {
        // Create new user with referral
        await tx
          .insert(userStats)
          .values({
            farcasterFid: data.newUserFid,
            farcasterUsername: data.newUserUsername,
            farcasterPfpUrl: data.newUserPfpUrl || null,
            totalPoints: 0,
            weeklyPoints: 0,
            referredByFid: referrer.farcasterFid,
            referralCode: newReferralCode,
            referralCount: 0,
            weeklyResetDate: currentWeekStart,
          });
      } else {
        // Update existing user with referral
        await tx
          .update(userStats)
          .set({
            referredByFid: referrer.farcasterFid,
            updatedAt: new Date()
          })
          .where(eq(userStats.farcasterFid, data.newUserFid));
      }

      // 5. Increment referrer's unclaimed referrals (don't add points yet - claim later)
      await tx
        .update(userStats)
        .set({
          referralCount: (referrer.referralCount || 0) + 1,
          unclaimedReferrals: (referrer.unclaimedReferrals || 0) + 1,
          updatedAt: new Date()
        })
        .where(eq(userStats.farcasterFid, referrer.farcasterFid));

      console.log(`🎁 Referral successful: ${data.newUserUsername} referred by ${referrer.farcasterUsername} (unclaimed +1)`);

      return {
        success: true,
        message: `Successfully applied referral code! ${referrer.farcasterUsername} can now claim the reward in Quests.`,
        referrerPoints: referrer.totalPoints
      };
    });
  }

  // Pending mints operations
  async createPendingMint(insertPendingMint: InsertPendingMint): Promise<PendingMint> {
    try {
      const [pendingMint] = await db
        .insert(pendingMints)
        .values(insertPendingMint)
        .returning();
      return pendingMint;
    } catch (error: any) {
      if (error.code === '23505') {
        console.log(`⚠️ Pending mint already exists for token ${insertPendingMint.tokenId}`);
        const [existing] = await db
          .select()
          .from(pendingMints)
          .where(
            and(
              eq(pendingMints.contractAddress, insertPendingMint.contractAddress),
              eq(pendingMints.tokenId, insertPendingMint.tokenId)
            )
          );
        return existing;
      }
      throw error;
    }
  }

  async getPendingMints(limit: number = 100): Promise<PendingMint[]> {
    return await db
      .select()
      .from(pendingMints)
      .orderBy(pendingMints.createdAt)
      .limit(limit);
  }

  async updatePendingMintRetry(id: string, error: string): Promise<PendingMint | undefined> {
    const [updated] = await db
      .update(pendingMints)
      .set({
        retryCount: sql`${pendingMints.retryCount} + 1`,
        lastError: error,
        lastAttemptAt: new Date()
      })
      .where(eq(pendingMints.id, id))
      .returning();
    return updated || undefined;
  }

  async deletePendingMint(id: string): Promise<void> {
    await db.delete(pendingMints).where(eq(pendingMints.id, id));
  }

  // Badge operations
  async getAllBadges(): Promise<Badge[]> {
    return await db.select().from(badges).orderBy(badges.category, badges.requirement);
  }

  async getUserBadges(identifier: { farcasterFid?: string; walletAddress?: string }): Promise<string[]> {
    const { farcasterFid, walletAddress } = identifier;
    
    let userBadgeRecords: UserBadge[] = [];
    
    if (farcasterFid) {
      userBadgeRecords = await db
        .select()
        .from(userBadges)
        .where(eq(userBadges.farcasterFid, farcasterFid));
    } else if (walletAddress) {
      userBadgeRecords = await db
        .select()
        .from(userBadges)
        .where(sql`LOWER(${userBadges.walletAddress}) = LOWER(${walletAddress})`);
    }
    
    // Get badge codes for earned badges
    const badgeIds = userBadgeRecords.map(ub => ub.badgeId);
    if (badgeIds.length === 0) return [];
    
    const earnedBadges = await db
      .select()
      .from(badges)
      .where(sql`${badges.id} IN (${sql.join(badgeIds.map(id => sql`${id}`), sql`, `)})`);
    
    return earnedBadges.map(b => b.code);
  }

  async awardBadge(badgeCode: string, identifier: { farcasterFid?: string; walletAddress?: string }): Promise<UserBadge | undefined> {
    const { farcasterFid, walletAddress } = identifier;
    
    // Get the badge
    const [badge] = await db.select().from(badges).where(eq(badges.code, badgeCode));
    if (!badge) return undefined;
    
    try {
      const [userBadge] = await db
        .insert(userBadges)
        .values({
          farcasterFid: farcasterFid || '',
          walletAddress: walletAddress || null,
          badgeId: badge.id,
        })
        .returning();
      return userBadge;
    } catch (error: any) {
      // Already has badge (unique constraint)
      if (error.code === '23505') {
        return undefined;
      }
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();

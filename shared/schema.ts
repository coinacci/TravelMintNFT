import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, decimal, timestamp, json, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  walletAddress: text("wallet_address"),
  balance: decimal("balance", { precision: 18, scale: 6 }).default("0").notNull(),
  avatar: text("avatar"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const nfts = pgTable("nfts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url").notNull(),
  objectStorageUrl: text("object_storage_url"), // Object storage backup URL
  location: text("location").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  category: text("category").notNull(),
  price: decimal("price", { precision: 18, scale: 6 }).notNull(),
  isForSale: integer("is_for_sale").default(0).notNull(), // 0 = false, 1 = true
  creatorAddress: text("creator_address").notNull(),
  ownerAddress: text("owner_address").notNull(),
  farcasterCreatorUsername: text("farcaster_creator_username"), // Optional Farcaster username
  farcasterOwnerUsername: text("farcaster_owner_username"), // Optional Farcaster username
  farcasterCreatorFid: text("farcaster_creator_fid"), // Optional Farcaster user ID
  farcasterOwnerFid: text("farcaster_owner_fid"), // Optional Farcaster user ID
  mintPrice: decimal("mint_price", { precision: 18, scale: 6 }).default("1").notNull(),
  royaltyPercentage: decimal("royalty_percentage", { precision: 5, scale: 2 }).default("5").notNull(),
  tokenId: text("token_id").unique(), // NFT contract token ID - unique for blockchain NFTs
  contractAddress: text("contract_address"), // NFT contract address
  transactionHash: text("transaction_hash"), // Mint transaction hash
  metadata: json("metadata"),
  likeCount: integer("like_count").default(0).notNull(), // Total number of likes
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nftId: varchar("nft_id").notNull().references(() => nfts.id),
  fromAddress: text("from_address"),
  toAddress: text("to_address").notNull(),
  transactionType: text("transaction_type").notNull(), // 'mint', 'sale', 'transfer'
  amount: decimal("amount", { precision: 18, scale: 6 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 18, scale: 6 }).default("0").notNull(),
  blockchainTxHash: text("blockchain_tx_hash").unique(), // On-chain transaction hash - unique to prevent duplicates
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const nftLikes = pgTable("nft_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nftId: varchar("nft_id").notNull().references(() => nfts.id),
  farcasterFid: text("farcaster_fid"), // Optional - for Farcaster users
  walletAddress: text("wallet_address"), // Optional - for wallet-only users
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  nftFidUnique: uniqueIndex("nft_likes_nft_fid_unique").on(table.nftId, table.farcasterFid),
  nftWalletUnique: uniqueIndex("nft_likes_nft_wallet_unique").on(table.nftId, table.walletAddress),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertNFTSchema = createInsertSchema(nfts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export const insertNFTLikeSchema = createInsertSchema(nftLikes).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertNFT = z.infer<typeof insertNFTSchema>;
export type NFT = typeof nfts.$inferSelect;

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export type InsertNFTLike = z.infer<typeof insertNFTLikeSchema>;
export type NFTLike = typeof nftLikes.$inferSelect;

// Quest System Tables
export const userStats = pgTable("user_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  farcasterFid: text("farcaster_fid").notNull().unique(),
  farcasterUsername: text("farcaster_username").notNull(),
  farcasterPfpUrl: text("farcaster_pfp_url"), // Farcaster profile picture URL
  walletAddress: text("wallet_address"), // Nullable - only required for holder bonus
  totalPoints: integer("total_points").default(0).notNull(), // Stored as fixed-point (points * 100)
  weeklyPoints: integer("weekly_points").default(0).notNull(), // Weekly points - resets every Monday
  currentStreak: integer("current_streak").default(0).notNull(),
  lastCheckIn: timestamp("last_check_in"),
  lastStreakClaim: timestamp("last_streak_claim"),
  weeklyResetDate: text("weekly_reset_date"), // YYYY-MM-DD format - tracks last weekly reset
  // Notification system fields
  notificationToken: text("notification_token"), // Farcaster notification token
  notificationsEnabled: boolean("notifications_enabled").default(false).notNull(), // User opt-in status
  lastNotificationSent: timestamp("last_notification_sent"), // Track when last notification was sent
  hasAddedMiniApp: boolean("has_added_mini_app").default(false).notNull(), // One-time quest: User added app to Farcaster
  // Referral system fields
  referralCode: text("referral_code").unique(), // Unique referral code for inviting friends
  referredByFid: text("referred_by_fid"), // FID of the user who referred this user
  referralCount: integer("referral_count").default(0).notNull(), // Number of users referred by this user
  unclaimedReferrals: integer("unclaimed_referrals").default(0).notNull(), // Number of referrals not yet claimed for points
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const questCompletions = pgTable("quest_completions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  farcasterFid: text("farcaster_fid").notNull().references(() => userStats.farcasterFid),
  questType: text("quest_type").notNull(), // 'daily_checkin', 'holder_bonus', 'base_transaction', 'social_post'
  pointsEarned: integer("points_earned").notNull(), // Stored as fixed-point (points * 100)
  completionDate: text("completion_date").notNull(), // YYYY-MM-DD format for daily uniqueness
  castUrl: text("cast_url"), // Farcaster cast URL for social_post quests
  completedAt: timestamp("completed_at").defaultNow().notNull(),
}, (table) => {
  return {
    // Unique constraint: one quest per type per day per user
    uniqueQuestPerDay: sql`UNIQUE (farcaster_fid, quest_type, completion_date)`,
  };
});

// User-Wallet Relationship Table for multi-wallet support
export const userWallets = pgTable("user_wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  farcasterFid: text("farcaster_fid").notNull().references(() => userStats.farcasterFid),
  walletAddress: text("wallet_address").notNull(),
  platform: text("platform").notNull(), // 'farcaster', 'base_app', 'manual'
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    // Unique constraint: one wallet per user per platform
    uniqueWalletPerUserPlatform: sql`UNIQUE (farcaster_fid, wallet_address, platform)`,
  };
});

// Notification History Table
export const notificationHistory = pgTable("notification_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  message: text("message").notNull(),
  targetUrl: text("target_url"), // Optional URL to navigate to
  recipientCount: integer("recipient_count").notNull(), // How many users received it
  successCount: integer("success_count").notNull(), // How many succeeded
  failureCount: integer("failure_count").notNull(), // How many failed
  sentBy: text("sent_by").notNull(), // Admin who sent it
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});

export const insertUserStatsSchema = createInsertSchema(userStats).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQuestCompletionSchema = createInsertSchema(questCompletions).omit({
  id: true,
  completedAt: true,
});

export const insertUserWalletSchema = createInsertSchema(userWallets).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationHistorySchema = createInsertSchema(notificationHistory).omit({
  id: true,
  sentAt: true,
});

export type InsertUserStats = z.infer<typeof insertUserStatsSchema>;
export type UserStats = typeof userStats.$inferSelect;

export type InsertQuestCompletion = z.infer<typeof insertQuestCompletionSchema>;
export type QuestCompletion = typeof questCompletions.$inferSelect;

export type InsertUserWallet = z.infer<typeof insertUserWalletSchema>;
export type UserWallet = typeof userWallets.$inferSelect;

export type InsertNotificationHistory = z.infer<typeof insertNotificationHistorySchema>;
export type NotificationHistory = typeof notificationHistory.$inferSelect;

// Quest API Validation Schemas
export const questClaimSchema = z.object({
  farcasterFid: z.string().min(1, "Farcaster FID is required"),
  questType: z.enum(['daily_checkin', 'holder_bonus', 'base_transaction', 'social_post'], {
    errorMap: () => ({ message: "Invalid quest type" })
  }),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address").optional(),
  castUrl: z.string().url("Invalid cast URL").optional(), // Farcaster cast URL for social_post quests
  farcasterUsername: z.string().min(1, "Farcaster username is required"),
  farcasterPfpUrl: z.string().url("Invalid profile picture URL").optional(),
  // Server-side verification data - should be included by middleware
  farcasterVerified: z.boolean().default(false).optional()
});

export const userStatsParamsSchema = z.object({
  fid: z.string().min(1, "Farcaster FID is required")
});

export const questCompletionsParamsSchema = z.object({
  fid: z.string().min(1, "Farcaster FID is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
});

export const holderStatusParamsSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address")
});

export const leaderboardQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/, "Limit must be a number").optional()
});

export type QuestClaimRequest = z.infer<typeof questClaimSchema>;
export type UserStatsParams = z.infer<typeof userStatsParamsSchema>;
export type QuestCompletionsParams = z.infer<typeof questCompletionsParamsSchema>;
export type HolderStatusParams = z.infer<typeof holderStatusParamsSchema>;
export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;

// Quest daily cycle utility - day starts at UTC 00:00
export function getQuestDay(date: Date = new Date()): string {
  const questDate = new Date(date);
  
  // Use UTC date for consistent quest day calculation across time zones
  return questDate.toISOString().split('T')[0];
}

// Get yesterday's quest day for streak calculation
export function getYesterdayQuestDay(date: Date = new Date()): string {
  // UTC-safe: subtract 24 hours in milliseconds to avoid DST issues
  const yesterdayDate = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  return getQuestDay(yesterdayDate);
}

// Weekly Champions Badge Table
export const weeklyChampions = pgTable("weekly_champions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  farcasterFid: text("farcaster_fid").notNull().references(() => userStats.farcasterFid),
  farcasterUsername: text("farcaster_username").notNull(),
  weekStartDate: text("week_start_date").notNull(), // YYYY-MM-DD format - Tuesday of the week
  weekEndDate: text("week_end_date").notNull(), // YYYY-MM-DD format - Monday of the week
  weeklyPoints: integer("weekly_points").notNull(), // Final points for that week
  weekNumber: integer("week_number").notNull(), // Week number of the year
  year: integer("year").notNull(), // Year of the championship
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    // Unique constraint: one champion per week
    uniqueChampionPerWeek: sql`UNIQUE (week_start_date, year)`,
  };
});

export const insertWeeklyChampionSchema = createInsertSchema(weeklyChampions).omit({
  id: true,
  createdAt: true,
});

export type InsertWeeklyChampion = z.infer<typeof insertWeeklyChampionSchema>;
export type WeeklyChampion = typeof weeklyChampions.$inferSelect;

// Weekly utilities - FIXED: Now uses UTC for consistent timezone handling
export function getCurrentWeekStart(date: Date = new Date()): string {
  // Use UTC to avoid timezone issues - week starts Tuesday 00:00 UTC
  const current = new Date(date.toISOString()); // Ensure we work with UTC
  const dayOfWeek = current.getUTCDay(); // Use UTC day
  
  let tuesdayOffset;
  if (dayOfWeek === 0) { // Sunday - go back 5 days to Tuesday
    tuesdayOffset = -5;
  } else if (dayOfWeek === 1) { // Monday - go back 6 days to previous Tuesday 
    tuesdayOffset = -6;
  } else if (dayOfWeek === 2) { // Tuesday - stay on Tuesday
    tuesdayOffset = 0;
  } else { // Wed(3), Thu(4), Fri(5), Sat(6) - go back to this week's Tuesday
    tuesdayOffset = 2 - dayOfWeek;
  }
  
  current.setUTCDate(current.getUTCDate() + tuesdayOffset);
  return current.toISOString().split('T')[0];
}

export function getWeekEnd(weekStart: string): string {
  const startDate = new Date(weekStart);
  startDate.setDate(startDate.getDate() + 6); // Monday = Tuesday + 6 days
  return startDate.toISOString().split('T')[0];
}

export function getWeekNumber(date: Date = new Date()): number {
  // Mini app started on Tuesday, September 17, 2025 (Week 1)
  const appStartDate = new Date('2025-09-17T00:00:00.000Z'); // Tuesday, September 17, 2025 00:00 UTC
  const currentDate = new Date(date.toISOString()); // Ensure UTC
  
  // If date is before app start, return 0
  if (currentDate < appStartDate) {
    return 0;
  }
  
  const diffTime = currentDate.getTime() - appStartDate.getTime();
  const diffDays = Math.floor(diffTime / (24 * 60 * 60 * 1000));
  return Math.floor(diffDays / 7) + 1; // Week 1 starts from app launch
}

// Blockchain Sync State Table - tracks incremental sync progress
export const syncState = pgTable("sync_state", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractAddress: text("contract_address").notNull().unique(), // NFT contract address
  lastProcessedBlock: integer("last_processed_block").notNull().default(0), // Last successfully processed block
  lastSyncAt: timestamp("last_sync_at").defaultNow().notNull(), // When sync last ran
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSyncStateSchema = createInsertSchema(syncState).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSyncState = z.infer<typeof insertSyncStateSchema>;
export type SyncState = typeof syncState.$inferSelect;

// Pending Mints Table - stores NFTs with missing metadata for retry
export const pendingMints = pgTable("pending_mints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenId: text("token_id").notNull(), // NFT token ID
  contractAddress: text("contract_address").notNull(), // NFT contract address
  ownerAddress: text("owner_address").notNull(), // Token owner
  transactionHash: text("transaction_hash"), // Mint transaction hash
  retryCount: integer("retry_count").default(0).notNull(), // Number of retry attempts
  lastError: text("last_error"), // Last error message
  lastAttemptAt: timestamp("last_attempt_at"), // When last retry was attempted
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    // Unique constraint: one pending mint per token
    uniqueTokenId: sql`UNIQUE (contract_address, token_id)`,
  };
});

export const insertPendingMintSchema = createInsertSchema(pendingMints).omit({
  id: true,
  createdAt: true,
});

export type InsertPendingMint = z.infer<typeof insertPendingMintSchema>;
export type PendingMint = typeof pendingMints.$inferSelect;

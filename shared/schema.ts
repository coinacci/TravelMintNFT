import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, json } from "drizzle-orm/pg-core";
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
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
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
  tokenId: text("token_id"), // NFT contract token ID
  contractAddress: text("contract_address"), // NFT contract address
  transactionHash: text("transaction_hash"), // Mint transaction hash
  metadata: json("metadata"),
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
  blockchainTxHash: text("blockchain_tx_hash"), // On-chain transaction hash
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertNFT = z.infer<typeof insertNFTSchema>;
export type NFT = typeof nfts.$inferSelect;

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const questCompletions = pgTable("quest_completions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  farcasterFid: text("farcaster_fid").notNull().references(() => userStats.farcasterFid),
  questType: text("quest_type").notNull(), // 'daily_checkin', 'holder_bonus', 'streak_bonus'
  pointsEarned: integer("points_earned").notNull(), // Stored as fixed-point (points * 100)
  completionDate: text("completion_date").notNull(), // YYYY-MM-DD format for daily uniqueness
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

export type InsertUserStats = z.infer<typeof insertUserStatsSchema>;
export type UserStats = typeof userStats.$inferSelect;

export type InsertQuestCompletion = z.infer<typeof insertQuestCompletionSchema>;
export type QuestCompletion = typeof questCompletions.$inferSelect;

export type InsertUserWallet = z.infer<typeof insertUserWalletSchema>;
export type UserWallet = typeof userWallets.$inferSelect;

// Quest API Validation Schemas
export const questClaimSchema = z.object({
  farcasterFid: z.string().min(1, "Farcaster FID is required"),
  questType: z.enum(['daily_checkin', 'holder_bonus', 'streak_bonus', 'base_transaction'], {
    errorMap: () => ({ message: "Invalid quest type" })
  }),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address").optional(),
  farcasterUsername: z.string().min(1, "Farcaster username is required"),
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
  weekStartDate: text("week_start_date").notNull(), // YYYY-MM-DD format - Monday of the week
  weekEndDate: text("week_end_date").notNull(), // YYYY-MM-DD format - Sunday of the week
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

// Weekly utilities
export function getCurrentWeekStart(date: Date = new Date()): string {
  const current = new Date(date);
  // Get Monday of current week (0 = Sunday, 1 = Monday)
  const dayOfWeek = current.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday, go back 6 days to Monday
  current.setDate(current.getDate() + mondayOffset);
  return current.toISOString().split('T')[0];
}

export function getWeekEnd(weekStart: string): string {
  const startDate = new Date(weekStart);
  startDate.setDate(startDate.getDate() + 6); // Sunday = Monday + 6 days
  return startDate.toISOString().split('T')[0];
}

export function getWeekNumber(date: Date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + start.getDay() + 1) / 7);
}

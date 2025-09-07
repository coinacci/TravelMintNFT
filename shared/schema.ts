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

export const insertUserSchema = createInsertSchema(users, {
  id: z.never().optional(),
  createdAt: z.never().optional(),
});

export const insertNFTSchema = createInsertSchema(nfts, {
  id: z.never().optional(),
  createdAt: z.never().optional(),
  updatedAt: z.never().optional(),
});

export const insertTransactionSchema = createInsertSchema(transactions, {
  id: z.never().optional(),
  createdAt: z.never().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertNFT = z.infer<typeof insertNFTSchema>;
export type NFT = typeof nfts.$inferSelect;

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

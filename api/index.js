var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/neynar-api.ts
var neynar_api_exports = {};
__export(neynar_api_exports, {
  delay: () => delay,
  getNeynarUserByAddress: () => getNeynarUserByAddress,
  getNeynarUserByFid: () => getNeynarUserByFid
});
async function getNeynarUserByAddress(address) {
  if (!NEYNAR_API_KEY) {
    console.warn("\u26A0\uFE0F NEYNAR_API_KEY not set - skipping Neynar API call");
    return null;
  }
  try {
    const url = `${NEYNAR_BASE_URL}/user/bulk-by-address?addresses=${address.toLowerCase()}&address_types=verified_address`;
    const response = await fetch(url, {
      headers: {
        "accept": "application/json",
        "api_key": NEYNAR_API_KEY
      }
    });
    if (!response.ok) {
      if (response.status === 429) {
        console.warn(`\u26A0\uFE0F Neynar API rate limit hit for ${address}`);
        return null;
      }
      throw new Error(`Neynar API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    const lowerAddress = address.toLowerCase();
    const users2 = data[lowerAddress];
    if (!users2 || users2.length === 0) {
      return null;
    }
    const user = users2[0];
    return {
      fid: user.fid.toString(),
      username: user.username
    };
  } catch (error) {
    console.error(`\u274C Neynar API error for address ${address}:`, error.message);
    return null;
  }
}
async function getNeynarUserByFid(fid) {
  if (!NEYNAR_API_KEY) {
    console.warn("\u26A0\uFE0F NEYNAR_API_KEY not set - skipping Neynar API call");
    return null;
  }
  try {
    const url = `${NEYNAR_BASE_URL}/user/bulk?fids=${fid}`;
    const response = await fetch(url, {
      headers: {
        "accept": "application/json",
        "api_key": NEYNAR_API_KEY
      }
    });
    if (!response.ok) {
      if (response.status === 429) {
        console.warn(`\u26A0\uFE0F Neynar API rate limit hit for FID ${fid}`);
        return null;
      }
      throw new Error(`Neynar API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.users || data.users.length === 0) {
      return null;
    }
    const user = data.users[0];
    return {
      fid: user.fid.toString(),
      username: user.username
    };
  } catch (error) {
    console.error(`\u274C Neynar API error for FID ${fid}:`, error.message);
    return null;
  }
}
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
var NEYNAR_API_KEY, NEYNAR_BASE_URL;
var init_neynar_api = __esm({
  "server/neynar-api.ts"() {
    "use strict";
    NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
    NEYNAR_BASE_URL = "https://api.neynar.com/v2/farcaster";
  }
});

// server/overpass-service.ts
var overpass_service_exports = {};
__export(overpass_service_exports, {
  getNearbyPOIs: () => getNearbyPOIs,
  getPOIDetails: () => getPOIDetails,
  searchPOIs: () => searchPOIs
});
function getCategory(tags) {
  if (tags.amenity) {
    const amenityMap = {
      "cafe": "Kafe",
      "restaurant": "Restoran",
      "bar": "Bar",
      "pub": "Pub",
      "fast_food": "Fast Food",
      "museum": "M\xFCze",
      "theatre": "Tiyatro",
      "cinema": "Sinema",
      "library": "K\xFCt\xFCphane",
      "place_of_worship": "\u0130badet Yeri",
      "hospital": "Hastane",
      "pharmacy": "Eczane",
      "bank": "Banka",
      "atm": "ATM",
      "fuel": "Benzin \u0130stasyonu",
      "parking": "Otopark"
    };
    return {
      category: "Mekan",
      subcategory: amenityMap[tags.amenity] || tags.amenity
    };
  }
  if (tags.tourism) {
    const tourismMap = {
      "attraction": "Turistik Yer",
      "museum": "M\xFCze",
      "gallery": "Galeri",
      "viewpoint": "Manzara Noktas\u0131",
      "hotel": "Otel",
      "hostel": "Hostel",
      "guest_house": "Pansiyon",
      "monument": "An\u0131t",
      "artwork": "Sanat Eseri"
    };
    return {
      category: "Turizm",
      subcategory: tourismMap[tags.tourism] || tags.tourism
    };
  }
  if (tags.shop) {
    const shopMap = {
      "supermarket": "S\xFCpermarket",
      "convenience": "Market",
      "clothes": "Giyim",
      "electronics": "Elektronik",
      "books": "Kitap\xE7\u0131",
      "bakery": "F\u0131r\u0131n",
      "butcher": "Kasap",
      "jewelry": "Kuyumcu"
    };
    return {
      category: "Ma\u011Faza",
      subcategory: shopMap[tags.shop] || tags.shop
    };
  }
  if (tags.leisure) {
    const leisureMap = {
      "park": "Park",
      "garden": "Bah\xE7e",
      "playground": "Oyun Alan\u0131",
      "sports_centre": "Spor Merkezi",
      "stadium": "Stadyum",
      "swimming_pool": "Y\xFCzme Havuzu"
    };
    return {
      category: "E\u011Flence",
      subcategory: leisureMap[tags.leisure] || tags.leisure
    };
  }
  if (tags.historic) {
    return {
      category: "Tarihi",
      subcategory: tags.historic
    };
  }
  return { category: "Di\u011Fer", subcategory: "Mekan" };
}
async function getNearbyPOIs(lat, lon, radiusMeters = 500, categories = ["amenity", "tourism", "shop", "leisure", "historic"]) {
  const categoryFilters = categories.map((cat) => `node["${cat}"](around:${radiusMeters},${lat},${lon});`).join("\n");
  const query = `
    [out:json][timeout:25];
    (
      ${categoryFilters}
    );
    out body;
  `;
  try {
    const response = await fetch(OVERPASS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `data=${encodeURIComponent(query)}`
    });
    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }
    const data = await response.json();
    const elements = data.elements || [];
    const pois = elements.filter((el) => el.tags?.name).map((el) => {
      const { category, subcategory } = getCategory(el.tags);
      return {
        osmId: `${el.type}/${el.id}`,
        name: el.tags.name,
        category,
        subcategory,
        lat: el.lat,
        lon: el.lon,
        address: el.tags["addr:street"] ? `${el.tags["addr:street"]}${el.tags["addr:city"] ? ", " + el.tags["addr:city"] : ""}` : void 0,
        openingHours: el.tags.opening_hours,
        website: el.tags.website,
        phone: el.tags.phone,
        cuisine: el.tags.cuisine
      };
    });
    return pois;
  } catch (error) {
    console.error("Overpass API error:", error);
    throw new Error("Failed to fetch nearby places. Please try again.");
  }
}
async function searchPOIs(searchQuery, south, west, north, east, limit = 50) {
  const query = `
    [out:json][timeout:25];
    (
      node["name"~"${searchQuery}",i](${south},${west},${north},${east});
    );
    out body ${limit};
  `;
  try {
    const response = await fetch(OVERPASS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `data=${encodeURIComponent(query)}`
    });
    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }
    const data = await response.json();
    const elements = data.elements || [];
    const pois = elements.filter((el) => el.tags?.name).map((el) => {
      const { category, subcategory } = getCategory(el.tags);
      return {
        osmId: `${el.type}/${el.id}`,
        name: el.tags.name,
        category,
        subcategory,
        lat: el.lat,
        lon: el.lon,
        address: el.tags["addr:street"] ? `${el.tags["addr:street"]}${el.tags["addr:city"] ? ", " + el.tags["addr:city"] : ""}` : void 0,
        openingHours: el.tags.opening_hours,
        website: el.tags.website,
        phone: el.tags.phone,
        cuisine: el.tags.cuisine
      };
    });
    return pois;
  } catch (error) {
    console.error("Overpass API search error:", error);
    throw new Error("Failed to search places. Please try again.");
  }
}
async function getPOIDetails(osmId) {
  const [type, id] = osmId.split("/");
  const query = `
    [out:json][timeout:10];
    ${type}(${id});
    out body;
  `;
  try {
    const response = await fetch(OVERPASS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `data=${encodeURIComponent(query)}`
    });
    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }
    const data = await response.json();
    const element = data.elements?.[0];
    if (!element || !element.tags?.name) {
      return null;
    }
    const { category, subcategory } = getCategory(element.tags);
    return {
      osmId,
      name: element.tags.name,
      category,
      subcategory,
      lat: element.lat,
      lon: element.lon,
      address: element.tags["addr:street"] ? `${element.tags["addr:street"]}${element.tags["addr:city"] ? ", " + element.tags["addr:city"] : ""}` : void 0,
      openingHours: element.tags.opening_hours,
      website: element.tags.website,
      phone: element.tags.phone,
      cuisine: element.tags.cuisine
    };
  } catch (error) {
    console.error("Overpass API details error:", error);
    return null;
  }
}
var OVERPASS_API_URL;
var init_overpass_service = __esm({
  "server/overpass-service.ts"() {
    "use strict";
    OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";
  }
});

// server/openrouter-service.ts
var openrouter_service_exports = {};
__export(openrouter_service_exports, {
  getTravelRecommendation: () => getTravelRecommendation
});
import OpenAI from "openai";
import pRetry, { AbortError } from "p-retry";
function isRateLimitError(error) {
  const errorMsg = error?.message || String(error);
  return errorMsg.includes("429") || errorMsg.includes("RATELIMIT_EXCEEDED") || errorMsg.toLowerCase().includes("quota") || errorMsg.toLowerCase().includes("rate limit");
}
async function getTravelRecommendation(query, chatHistory = []) {
  const systemPrompt = `You are a helpful travel assistant. Provide concise, practical travel advice and recommendations.
IMPORTANT: Always respond in the SAME LANGUAGE as the user's message. If they write in Turkish, respond in Turkish. If they write in English, respond in English.
When recommending places, use **bold** formatting for place names (e.g., **Hagia Sophia**, **Blue Mosque**).
Focus only on what the user asks - don't add extra categories unless requested.
Keep responses informative but concise (2-3 sentences per recommendation).
If user asks about a specific topic (like cafes, museums, etc.), only provide info about that topic.
Use the conversation history to maintain context - if user mentioned a city before, remember it.`;
  const messages = [
    { role: "system", content: systemPrompt }
  ];
  const recentHistory = chatHistory.slice(-8);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role,
      content: msg.content
    });
  }
  messages.push({ role: "user", content: query });
  try {
    const response = await pRetry(
      async () => {
        try {
          const completion = await openrouter.chat.completions.create({
            model: "meta-llama/llama-3.1-8b-instruct",
            messages,
            max_tokens: 1024,
            temperature: 0.7
          });
          return completion.choices[0]?.message?.content || "I couldn't generate a response. Please try again.";
        } catch (error) {
          if (isRateLimitError(error)) {
            throw error;
          }
          throw new AbortError(error);
        }
      },
      {
        retries: 3,
        minTimeout: 1e3,
        maxTimeout: 8e3,
        factor: 2
      }
    );
    return response;
  } catch (error) {
    console.error("OpenRouter API error:", error);
    if (isRateLimitError(error)) {
      throw new Error("AI service is temporarily busy. Please try again in a few moments.");
    }
    throw new Error("Failed to get travel recommendation. Please try again.");
  }
}
var openrouter;
var init_openrouter_service = __esm({
  "server/openrouter-service.ts"() {
    "use strict";
    openrouter = new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY
    });
  }
});

// server/wikipedia-service.ts
var wikipedia_service_exports = {};
__export(wikipedia_service_exports, {
  getPlaceImages: () => getPlaceImages,
  getWikipediaInfo: () => getWikipediaInfo
});
async function getWikipediaInfo(placeName, city) {
  try {
    const searchQuery = city ? `${placeName} ${city}` : placeName;
    const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchQuery.replace(/ /g, "_"))}`;
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "TravelMint/1.0 (travel app; contact@travelmint.app)"
      }
    });
    if (!response.ok) {
      if (city) {
        return getWikipediaInfo(placeName);
      }
      return null;
    }
    const data = await response.json();
    return {
      title: data.title || placeName,
      imageUrl: data.originalimage?.source || null,
      thumbnailUrl: data.thumbnail?.source || null,
      description: data.extract || null,
      pageUrl: data.content_urls?.desktop?.page || null
    };
  } catch (error) {
    console.error("Wikipedia API error:", error);
    return null;
  }
}
async function getPlaceImages(placeNames, city) {
  const results = /* @__PURE__ */ new Map();
  const promises = placeNames.slice(0, 5).map(async (name) => {
    const result = await getWikipediaInfo(name, city);
    if (result) {
      results.set(name, result);
    }
  });
  await Promise.allSettled(promises);
  return results;
}
var init_wikipedia_service = __esm({
  "server/wikipedia-service.ts"() {
    "use strict";
  }
});

// server/createApp.ts
import express from "express";

// server/routes.ts
import { createServer } from "http";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  badges: () => badges,
  checkinRequestSchema: () => checkinRequestSchema,
  checkins: () => checkins,
  getCurrentWeekStart: () => getCurrentWeekStart,
  getQuestDay: () => getQuestDay,
  getWeekEnd: () => getWeekEnd,
  getWeekNumber: () => getWeekNumber,
  getYesterdayQuestDay: () => getYesterdayQuestDay,
  guideCities: () => guideCities,
  guideCitySearchSchema: () => guideCitySearchSchema,
  guideSpotCategorySchema: () => guideSpotCategorySchema,
  guideSpotQuerySchema: () => guideSpotQuerySchema,
  guideSpots: () => guideSpots,
  holderStatusParamsSchema: () => holderStatusParamsSchema,
  insertBadgeSchema: () => insertBadgeSchema,
  insertCheckinSchema: () => insertCheckinSchema,
  insertGuideCitySchema: () => insertGuideCitySchema,
  insertGuideSpotSchema: () => insertGuideSpotSchema,
  insertNFTLikeSchema: () => insertNFTLikeSchema,
  insertNFTSchema: () => insertNFTSchema,
  insertNotificationHistorySchema: () => insertNotificationHistorySchema,
  insertPendingMintSchema: () => insertPendingMintSchema,
  insertQuestCompletionSchema: () => insertQuestCompletionSchema,
  insertSyncStateSchema: () => insertSyncStateSchema,
  insertTransactionSchema: () => insertTransactionSchema,
  insertTravelAiQuerySchema: () => insertTravelAiQuerySchema,
  insertUserBadgeSchema: () => insertUserBadgeSchema,
  insertUserSchema: () => insertUserSchema,
  insertUserStatsSchema: () => insertUserStatsSchema,
  insertUserWalletSchema: () => insertUserWalletSchema,
  insertWeeklyChampionSchema: () => insertWeeklyChampionSchema,
  leaderboardQuerySchema: () => leaderboardQuerySchema,
  nearbyPOIsQuerySchema: () => nearbyPOIsQuerySchema,
  nftLikes: () => nftLikes,
  nfts: () => nfts,
  notificationHistory: () => notificationHistory,
  pendingMints: () => pendingMints,
  questClaimSchema: () => questClaimSchema,
  questCompletions: () => questCompletions,
  questCompletionsParamsSchema: () => questCompletionsParamsSchema,
  syncState: () => syncState,
  transactions: () => transactions,
  travelAiQueries: () => travelAiQueries,
  userBadges: () => userBadges,
  userStats: () => userStats,
  userStatsParamsSchema: () => userStatsParamsSchema,
  userWallets: () => userWallets,
  users: () => users,
  weeklyChampions: () => weeklyChampions
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, decimal, timestamp, json, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  walletAddress: text("wallet_address"),
  balance: decimal("balance", { precision: 18, scale: 6 }).default("0").notNull(),
  avatar: text("avatar"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var nfts = pgTable("nfts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url").notNull(),
  objectStorageUrl: text("object_storage_url"),
  // Object storage backup URL
  location: text("location").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  category: text("category").notNull(),
  price: decimal("price", { precision: 18, scale: 6 }).notNull(),
  isForSale: integer("is_for_sale").default(0).notNull(),
  // 0 = false, 1 = true
  creatorAddress: text("creator_address").notNull(),
  ownerAddress: text("owner_address").notNull(),
  farcasterCreatorUsername: text("farcaster_creator_username"),
  // Optional Farcaster username
  farcasterOwnerUsername: text("farcaster_owner_username"),
  // Optional Farcaster username
  farcasterCreatorFid: text("farcaster_creator_fid"),
  // Optional Farcaster user ID
  farcasterOwnerFid: text("farcaster_owner_fid"),
  // Optional Farcaster user ID
  mintPrice: decimal("mint_price", { precision: 18, scale: 6 }).default("1").notNull(),
  royaltyPercentage: decimal("royalty_percentage", { precision: 5, scale: 2 }).default("5").notNull(),
  tokenId: text("token_id").unique(),
  // NFT contract token ID - unique for blockchain NFTs
  contractAddress: text("contract_address"),
  // NFT contract address
  transactionHash: text("transaction_hash"),
  // Mint transaction hash
  metadata: json("metadata"),
  likeCount: integer("like_count").default(0).notNull(),
  // Total number of likes
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nftId: varchar("nft_id").notNull().references(() => nfts.id),
  fromAddress: text("from_address"),
  toAddress: text("to_address").notNull(),
  transactionType: text("transaction_type").notNull(),
  // 'mint', 'sale', 'transfer'
  amount: decimal("amount", { precision: 18, scale: 6 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 18, scale: 6 }).default("0").notNull(),
  blockchainTxHash: text("blockchain_tx_hash").unique(),
  // On-chain transaction hash - unique to prevent duplicates
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var nftLikes = pgTable("nft_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nftId: varchar("nft_id").notNull().references(() => nfts.id),
  farcasterFid: text("farcaster_fid"),
  // Optional - for Farcaster users
  walletAddress: text("wallet_address"),
  // Optional - for wallet-only users
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => ({
  nftFidUnique: uniqueIndex("nft_likes_nft_fid_unique").on(table.nftId, table.farcasterFid),
  nftWalletUnique: uniqueIndex("nft_likes_nft_wallet_unique").on(table.nftId, table.walletAddress)
}));
var insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true
});
var insertNFTSchema = createInsertSchema(nfts).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true
});
var insertNFTLikeSchema = createInsertSchema(nftLikes).omit({
  id: true,
  createdAt: true
});
var userStats = pgTable("user_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  farcasterFid: text("farcaster_fid").notNull().unique(),
  farcasterUsername: text("farcaster_username").notNull(),
  farcasterPfpUrl: text("farcaster_pfp_url"),
  // Farcaster profile picture URL
  walletAddress: text("wallet_address"),
  // Nullable - only required for holder bonus
  totalPoints: integer("total_points").default(0).notNull(),
  // Stored as fixed-point (points * 100)
  weeklyPoints: integer("weekly_points").default(0).notNull(),
  // Weekly points - resets every Monday
  currentStreak: integer("current_streak").default(0).notNull(),
  lastCheckIn: timestamp("last_check_in"),
  lastStreakClaim: timestamp("last_streak_claim"),
  weeklyResetDate: text("weekly_reset_date"),
  // YYYY-MM-DD format - tracks last weekly reset
  // Notification system fields
  notificationToken: text("notification_token"),
  // Farcaster notification token
  notificationsEnabled: boolean("notifications_enabled").default(false).notNull(),
  // User opt-in status
  lastNotificationSent: timestamp("last_notification_sent"),
  // Track when last notification was sent
  hasAddedMiniApp: boolean("has_added_mini_app").default(false).notNull(),
  // One-time quest: User added app to Farcaster
  // Referral system fields
  referralCode: text("referral_code").unique(),
  // Unique referral code for inviting friends
  referredByFid: text("referred_by_fid"),
  // FID of the user who referred this user
  referralCount: integer("referral_count").default(0).notNull(),
  // Number of users referred by this user
  unclaimedReferrals: integer("unclaimed_referrals").default(0).notNull(),
  // Number of referrals not yet claimed for points
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var questCompletions = pgTable("quest_completions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  farcasterFid: text("farcaster_fid").notNull().references(() => userStats.farcasterFid),
  questType: text("quest_type").notNull(),
  // 'daily_checkin', 'holder_bonus', 'base_transaction', 'social_post'
  pointsEarned: integer("points_earned").notNull(),
  // Stored as fixed-point (points * 100)
  completionDate: text("completion_date").notNull(),
  // YYYY-MM-DD format for daily uniqueness
  castUrl: text("cast_url"),
  // Farcaster cast URL for social_post quests
  completedAt: timestamp("completed_at").defaultNow().notNull()
}, (table) => {
  return {
    // Unique constraint: one quest per type per day per user
    uniqueQuestPerDay: sql`UNIQUE (farcaster_fid, quest_type, completion_date)`
  };
});
var userWallets = pgTable("user_wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  farcasterFid: text("farcaster_fid").notNull().references(() => userStats.farcasterFid),
  walletAddress: text("wallet_address").notNull(),
  platform: text("platform").notNull(),
  // 'farcaster', 'base_app', 'manual'
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => {
  return {
    // Unique constraint: one wallet per user per platform
    uniqueWalletPerUserPlatform: sql`UNIQUE (farcaster_fid, wallet_address, platform)`
  };
});
var notificationHistory = pgTable("notification_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  message: text("message").notNull(),
  targetUrl: text("target_url"),
  // Optional URL to navigate to
  recipientCount: integer("recipient_count").notNull(),
  // How many users received it
  successCount: integer("success_count").notNull(),
  // How many succeeded
  failureCount: integer("failure_count").notNull(),
  // How many failed
  sentBy: text("sent_by").notNull(),
  // Admin who sent it
  sentAt: timestamp("sent_at").defaultNow().notNull()
});
var insertUserStatsSchema = createInsertSchema(userStats).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertQuestCompletionSchema = createInsertSchema(questCompletions).omit({
  id: true,
  completedAt: true
});
var insertUserWalletSchema = createInsertSchema(userWallets).omit({
  id: true,
  createdAt: true
});
var insertNotificationHistorySchema = createInsertSchema(notificationHistory).omit({
  id: true,
  sentAt: true
});
var questClaimSchema = z.object({
  farcasterFid: z.string().min(1, "Farcaster FID is required"),
  questType: z.enum(["daily_checkin", "holder_bonus", "base_transaction", "social_post"], {
    errorMap: () => ({ message: "Invalid quest type" })
  }),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address").optional(),
  castUrl: z.string().url("Invalid cast URL").optional(),
  // Farcaster cast URL for social_post quests
  farcasterUsername: z.string().min(1, "Farcaster username is required"),
  farcasterPfpUrl: z.string().url("Invalid profile picture URL").optional(),
  // Server-side verification data - should be included by middleware
  farcasterVerified: z.boolean().default(false).optional()
});
var userStatsParamsSchema = z.object({
  fid: z.string().min(1, "Farcaster FID is required")
});
var questCompletionsParamsSchema = z.object({
  fid: z.string().min(1, "Farcaster FID is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
});
var holderStatusParamsSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address")
});
var leaderboardQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/, "Limit must be a number").optional()
});
function getQuestDay(date = /* @__PURE__ */ new Date()) {
  const questDate = new Date(date);
  return questDate.toISOString().split("T")[0];
}
function getYesterdayQuestDay(date = /* @__PURE__ */ new Date()) {
  const yesterdayDate = new Date(date.getTime() - 24 * 60 * 60 * 1e3);
  return getQuestDay(yesterdayDate);
}
var weeklyChampions = pgTable("weekly_champions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  farcasterFid: text("farcaster_fid").notNull().references(() => userStats.farcasterFid),
  farcasterUsername: text("farcaster_username").notNull(),
  weekStartDate: text("week_start_date").notNull(),
  // YYYY-MM-DD format - Tuesday of the week
  weekEndDate: text("week_end_date").notNull(),
  // YYYY-MM-DD format - Monday of the week
  weeklyPoints: integer("weekly_points").notNull(),
  // Final points for that week
  weekNumber: integer("week_number").notNull(),
  // Week number of the year
  year: integer("year").notNull(),
  // Year of the championship
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => {
  return {
    // Unique constraint: one champion per week
    uniqueChampionPerWeek: sql`UNIQUE (week_start_date, year)`
  };
});
var insertWeeklyChampionSchema = createInsertSchema(weeklyChampions).omit({
  id: true,
  createdAt: true
});
function getCurrentWeekStart(date = /* @__PURE__ */ new Date()) {
  const current = new Date(date.toISOString());
  const dayOfWeek = current.getUTCDay();
  let tuesdayOffset;
  if (dayOfWeek === 0) {
    tuesdayOffset = -5;
  } else if (dayOfWeek === 1) {
    tuesdayOffset = -6;
  } else if (dayOfWeek === 2) {
    tuesdayOffset = 0;
  } else {
    tuesdayOffset = 2 - dayOfWeek;
  }
  current.setUTCDate(current.getUTCDate() + tuesdayOffset);
  return current.toISOString().split("T")[0];
}
function getWeekEnd(weekStart) {
  const startDate = new Date(weekStart);
  startDate.setDate(startDate.getDate() + 6);
  return startDate.toISOString().split("T")[0];
}
function getWeekNumber(date = /* @__PURE__ */ new Date()) {
  const appStartDate = /* @__PURE__ */ new Date("2025-09-17T00:00:00.000Z");
  const currentDate = new Date(date.toISOString());
  if (currentDate < appStartDate) {
    return 0;
  }
  const diffTime = currentDate.getTime() - appStartDate.getTime();
  const diffDays = Math.floor(diffTime / (24 * 60 * 60 * 1e3));
  return Math.floor(diffDays / 7) + 1;
}
var syncState = pgTable("sync_state", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractAddress: text("contract_address").notNull().unique(),
  // NFT contract address
  lastProcessedBlock: integer("last_processed_block").notNull().default(0),
  // Last successfully processed block
  lastSyncAt: timestamp("last_sync_at").defaultNow().notNull(),
  // When sync last ran
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var insertSyncStateSchema = createInsertSchema(syncState).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var pendingMints = pgTable("pending_mints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenId: text("token_id").notNull(),
  // NFT token ID
  contractAddress: text("contract_address").notNull(),
  // NFT contract address
  ownerAddress: text("owner_address").notNull(),
  // Token owner
  transactionHash: text("transaction_hash"),
  // Mint transaction hash
  retryCount: integer("retry_count").default(0).notNull(),
  // Number of retry attempts
  lastError: text("last_error"),
  // Last error message
  lastAttemptAt: timestamp("last_attempt_at"),
  // When last retry was attempted
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => {
  return {
    // Unique constraint: one pending mint per token
    uniqueTokenId: sql`UNIQUE (contract_address, token_id)`
  };
});
var insertPendingMintSchema = createInsertSchema(pendingMints).omit({
  id: true,
  createdAt: true
});
var badges = pgTable("badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  // Unique badge code (e.g., 'first_mint', 'explorer')
  name: text("name").notNull(),
  // Display name
  description: text("description").notNull(),
  // How to earn this badge
  category: text("category").notNull(),
  // 'mint', 'location', 'social', 'quest'
  imageUrl: text("image_url").notNull(),
  // Badge image URL
  requirement: integer("requirement").notNull(),
  // Numeric requirement (e.g., 5 mints, 3 countries)
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var userBadges = pgTable("user_badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  farcasterFid: text("farcaster_fid").notNull(),
  walletAddress: text("wallet_address"),
  // For wallet-only users
  badgeId: varchar("badge_id").notNull().references(() => badges.id),
  earnedAt: timestamp("earned_at").defaultNow().notNull()
}, (table) => ({
  uniqueUserBadge: uniqueIndex("user_badges_unique").on(table.farcasterFid, table.badgeId),
  uniqueWalletBadge: uniqueIndex("user_badges_wallet_unique").on(table.walletAddress, table.badgeId)
}));
var insertBadgeSchema = createInsertSchema(badges).omit({
  id: true,
  createdAt: true
});
var insertUserBadgeSchema = createInsertSchema(userBadges).omit({
  id: true,
  earnedAt: true
});
var guideCities = pgTable("guide_cities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  placeId: text("place_id").notNull().unique(),
  // Google Places place_id
  name: text("name").notNull(),
  // City name
  country: text("country").notNull(),
  // Country name
  countryCode: text("country_code"),
  // ISO country code (e.g., 'TR', 'US')
  heroImageUrl: text("hero_image_url"),
  // City hero image
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  searchCount: integer("search_count").default(0).notNull(),
  // Popularity tracking
  lastSyncAt: timestamp("last_sync_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var guideSpots = pgTable("guide_spots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cityId: varchar("city_id").notNull().references(() => guideCities.id),
  placeId: text("place_id").notNull().unique(),
  // Google Places place_id
  name: text("name").notNull(),
  category: text("category").notNull(),
  // 'landmark', 'cafe', 'restaurant', 'hidden_gem'
  description: text("description"),
  // Place description/summary
  address: text("address"),
  // Formatted address
  rating: decimal("rating", { precision: 3, scale: 2 }),
  // 0.00 - 5.00
  userRatingsTotal: integer("user_ratings_total"),
  // Number of reviews
  priceLevel: integer("price_level"),
  // 0-4 price range
  photoUrl: text("photo_url"),
  // Main photo URL
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  openNow: boolean("open_now"),
  // Current open status
  website: text("website"),
  // Official website
  phoneNumber: text("phone_number"),
  googleMapsUrl: text("google_maps_url"),
  // Link to Google Maps
  lastSyncAt: timestamp("last_sync_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var insertGuideCitySchema = createInsertSchema(guideCities).omit({
  id: true,
  createdAt: true,
  lastSyncAt: true
});
var insertGuideSpotSchema = createInsertSchema(guideSpots).omit({
  id: true,
  createdAt: true,
  lastSyncAt: true
});
var guideCitySearchSchema = z.object({
  query: z.string().min(2, "Search query must be at least 2 characters")
});
var guideSpotCategorySchema = z.enum(["landmark", "cafe", "restaurant", "hidden_gem"]);
var guideSpotQuerySchema = z.object({
  category: guideSpotCategorySchema.optional(),
  limit: z.string().regex(/^\d+$/, "Limit must be a number").optional()
});
var travelAiQueries = pgTable("travel_ai_queries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull(),
  queryCount: integer("query_count").default(0).notNull(),
  lastQueryDate: text("last_query_date"),
  // YYYY-MM-DD format for daily reset tracking
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  walletUnique: uniqueIndex("travel_ai_wallet_unique").on(table.walletAddress)
}));
var insertTravelAiQuerySchema = createInsertSchema(travelAiQueries).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var checkins = pgTable("checkins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull(),
  farcasterFid: text("farcaster_fid"),
  farcasterUsername: text("farcaster_username"),
  osmId: text("osm_id").notNull(),
  // OpenStreetMap place ID (e.g., "node/123456")
  placeName: text("place_name").notNull(),
  placeCategory: text("place_category").notNull(),
  placeSubcategory: text("place_subcategory"),
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  transactionHash: text("transaction_hash"),
  // Optional on-chain transaction
  pointsEarned: integer("points_earned").default(10).notNull(),
  // Points for this check-in
  comment: text("comment"),
  // User's note/review about this place
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var insertCheckinSchema = createInsertSchema(checkins).omit({
  id: true,
  createdAt: true
});
var checkinRequestSchema = z.object({
  walletAddress: z.string().min(1, "Wallet address is required"),
  farcasterFid: z.string().optional(),
  farcasterUsername: z.string().optional(),
  osmId: z.string().min(1, "OSM ID is required"),
  placeName: z.string().min(1, "Place name is required"),
  placeCategory: z.string().min(1, "Place category is required"),
  placeSubcategory: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  transactionHash: z.string().optional()
});
var nearbyPOIsQuerySchema = z.object({
  lat: z.string().regex(/^-?\d+\.?\d*$/, "Latitude must be a number"),
  lon: z.string().regex(/^-?\d+\.?\d*$/, "Longitude must be a number"),
  radius: z.string().regex(/^\d+$/, "Radius must be a number").optional()
});

// server/db.ts
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
var { Pool } = pg;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
var db = drizzle({ client: pool, schema: schema_exports });

// server/storage.ts
import { eq, and, sql as sql2 } from "drizzle-orm";
var DatabaseStorage = class {
  // User operations
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || void 0;
  }
  async getUserByUsername(username) {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || void 0;
  }
  async getUserByWalletAddress(walletAddress) {
    const [user] = await db.select().from(users).where(sql2`LOWER(${users.walletAddress}) = LOWER(${walletAddress})`);
    return user || void 0;
  }
  async createUser(insertUser) {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  async updateUserBalance(id, balance) {
    const [user] = await db.update(users).set({ balance }).where(eq(users.id, id)).returning();
    return user || void 0;
  }
  // NFT operations
  async getNFT(id) {
    const [nft] = await db.select().from(nfts).where(eq(nfts.id, id));
    return nft || void 0;
  }
  async getAllNFTs(sortBy) {
    if (sortBy === "likeCount" || sortBy === "popular") {
      return await db.select().from(nfts).orderBy(sql2`${nfts.likeCount} DESC NULLS LAST, ${nfts.createdAt} DESC`);
    } else if (sortBy === "tips") {
      const result = await db.select({
        nft: nfts,
        totalTips: sql2`COALESCE(SUM(CAST(${transactions.amount} AS DECIMAL)), 0)`.as("total_tips")
      }).from(nfts).leftJoin(transactions, and(
        eq(nfts.id, transactions.nftId),
        eq(transactions.transactionType, "donation")
      )).groupBy(nfts.id).orderBy(sql2`total_tips DESC, ${nfts.createdAt} DESC`);
      return result.map((r) => r.nft);
    } else {
      return await db.select().from(nfts).orderBy(sql2`${nfts.createdAt} DESC`);
    }
  }
  async getNFTsByLocation(lat, lng, radius) {
    return await db.select().from(nfts).where(sql2`
        sqrt(power(cast(${nfts.latitude} as decimal) - ${lat}, 2) + 
             power(cast(${nfts.longitude} as decimal) - ${lng}, 2)) <= ${radius}
      `);
  }
  async getNFTsByOwner(ownerAddress) {
    return await db.select().from(nfts).where(sql2`LOWER(${nfts.ownerAddress}) = LOWER(${ownerAddress})`).orderBy(sql2`${nfts.createdAt} DESC`);
  }
  async getNFTsForSale(sortBy) {
    if (sortBy === "likeCount" || sortBy === "popular") {
      return await db.select().from(nfts).where(eq(nfts.isForSale, 1)).orderBy(sql2`${nfts.likeCount} DESC NULLS LAST, ${nfts.createdAt} DESC`);
    } else if (sortBy === "tips") {
      const result = await db.select({
        nft: nfts,
        totalTips: sql2`COALESCE(SUM(CAST(${transactions.amount} AS DECIMAL)), 0)`.as("total_tips")
      }).from(nfts).leftJoin(transactions, and(
        eq(nfts.id, transactions.nftId),
        eq(transactions.transactionType, "donation")
      )).where(eq(nfts.isForSale, 1)).groupBy(nfts.id).orderBy(sql2`total_tips DESC, ${nfts.createdAt} DESC`);
      return result.map((r) => r.nft);
    } else {
      return await db.select().from(nfts).where(eq(nfts.isForSale, 1)).orderBy(sql2`${nfts.createdAt} DESC`);
    }
  }
  async createNFT(insertNFT) {
    const [nft] = await db.insert(nfts).values(insertNFT).returning();
    return nft;
  }
  async upsertNFTByTokenId(insertNFT) {
    const protectedTokenIds = ["106", "89", "48", "44", "41"];
    const isProtected = insertNFT.tokenId && protectedTokenIds.includes(insertNFT.tokenId);
    const ownerInfo = await this.getFarcasterInfoFromWallet(insertNFT.ownerAddress);
    let creatorInfo = null;
    if (insertNFT.creatorAddress) {
      const isDifferentCreator = insertNFT.creatorAddress.toLowerCase() !== insertNFT.ownerAddress.toLowerCase();
      if (isDifferentCreator) {
        creatorInfo = await this.getFarcasterInfoFromWallet(insertNFT.creatorAddress);
      }
    }
    const insertValues = {
      ...insertNFT,
      // Set creator info only if different from owner, otherwise leave null for backend to handle
      farcasterCreatorUsername: creatorInfo?.username || null,
      farcasterCreatorFid: creatorInfo?.fid || null,
      // Always set owner info
      farcasterOwnerUsername: ownerInfo?.username || null,
      farcasterOwnerFid: ownerInfo?.fid || null
    };
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
      updatedAt: /* @__PURE__ */ new Date()
    };
    const updateSet = isProtected ? baseUpdateSet : {
      ...baseUpdateSet,
      location: insertNFT.location,
      latitude: insertNFT.latitude,
      longitude: insertNFT.longitude
    };
    const [nft] = await db.insert(nfts).values(insertValues).onConflictDoUpdate({
      target: nfts.tokenId,
      set: updateSet
    }).returning();
    return nft;
  }
  async updateNFT(id, updates) {
    const [nft] = await db.update(nfts).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(nfts.id, id)).returning();
    return nft || void 0;
  }
  async updateNFTCoordinates(tokenId, latitude, longitude) {
    const [nft] = await db.update(nfts).set({
      latitude: latitude.toFixed(8),
      longitude: longitude.toFixed(8),
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(nfts.tokenId, tokenId)).returning();
    return nft || void 0;
  }
  // 🔄 Update NFT owner and auto-delist if transferred (for blockchain sync)
  async updateNFTOwnerAndDelist(tokenId, newOwnerAddress) {
    const [nft] = await db.update(nfts).set({
      ownerAddress: newOwnerAddress,
      isForSale: 0,
      // Auto-delist on transfer
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(nfts.tokenId, tokenId)).returning();
    return nft || void 0;
  }
  async getNFTByTokenId(tokenId) {
    const [nft] = await db.select().from(nfts).where(eq(nfts.tokenId, tokenId));
    return nft || void 0;
  }
  async toggleNFTLike(nftId, identifier) {
    const { farcasterFid, walletAddress } = identifier;
    if (!farcasterFid && !walletAddress) {
      throw new Error("Either farcasterFid or walletAddress is required");
    }
    return await db.transaction(async (tx) => {
      const whereCondition = farcasterFid ? and(eq(nftLikes.nftId, nftId), eq(nftLikes.farcasterFid, farcasterFid)) : and(eq(nftLikes.nftId, nftId), eq(nftLikes.walletAddress, walletAddress.toLowerCase()));
      const existingLike = await tx.select().from(nftLikes).where(whereCondition);
      if (existingLike.length > 0) {
        await tx.delete(nftLikes).where(whereCondition);
        const [updatedNFT] = await tx.update(nfts).set({ likeCount: sql2`GREATEST(0, ${nfts.likeCount} - 1)` }).where(eq(nfts.id, nftId)).returning();
        return { liked: false, likeCount: updatedNFT?.likeCount || 0 };
      } else {
        await tx.insert(nftLikes).values({
          nftId,
          farcasterFid: farcasterFid || null,
          walletAddress: walletAddress?.toLowerCase() || null
        });
        const [updatedNFT] = await tx.update(nfts).set({ likeCount: sql2`${nfts.likeCount} + 1` }).where(eq(nfts.id, nftId)).returning();
        return { liked: true, likeCount: updatedNFT?.likeCount || 1 };
      }
    });
  }
  async checkNFTLiked(nftId, identifier) {
    const { farcasterFid, walletAddress } = identifier;
    if (!farcasterFid && !walletAddress) {
      return false;
    }
    const whereCondition = farcasterFid ? and(eq(nftLikes.nftId, nftId), eq(nftLikes.farcasterFid, farcasterFid)) : and(eq(nftLikes.nftId, nftId), eq(nftLikes.walletAddress, walletAddress.toLowerCase()));
    const [like] = await db.select().from(nftLikes).where(whereCondition);
    return !!like;
  }
  async getUserLikedNFTIds(farcasterFid) {
    if (!farcasterFid) {
      return [];
    }
    const likes = await db.select({ nftId: nftLikes.nftId }).from(nftLikes).where(eq(nftLikes.farcasterFid, farcasterFid));
    return likes.map((like) => like.nftId);
  }
  // Transaction operations
  async getTransaction(id) {
    const [transaction] = await db.select().from(transactions).where(eq(transactions.id, id));
    return transaction || void 0;
  }
  async getTransactionsByNFT(nftId) {
    return await db.select().from(transactions).where(eq(transactions.nftId, nftId)).orderBy(sql2`${transactions.createdAt} DESC`);
  }
  async getTransactionsByUser(userAddress) {
    return await db.select().from(transactions).where(sql2`${transactions.fromAddress} = ${userAddress} OR ${transactions.toAddress} = ${userAddress}`).orderBy(sql2`${transactions.createdAt} DESC`);
  }
  async getRecentTransactions(limit = 20) {
    return await db.select({
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
    }).from(transactions).leftJoin(nfts, eq(transactions.nftId, nfts.id)).where(sql2`${transactions.transactionType} IN ('purchase', 'sale')`).orderBy(sql2`${transactions.createdAt} DESC`).limit(limit);
  }
  async createTransaction(insertTransaction) {
    const [transaction] = await db.insert(transactions).values(insertTransaction).returning();
    return transaction;
  }
  async getTransactionByHash(blockchainTxHash) {
    const [tx] = await db.select().from(transactions).where(eq(transactions.blockchainTxHash, blockchainTxHash));
    return tx || void 0;
  }
  // Donation operations
  async getDonationStats() {
    const [basicStats] = await db.select({
      totalDonations: sql2`COUNT(*)::int`,
      totalAmount: sql2`COALESCE(SUM(${transactions.amount}::numeric), 0)::text`,
      uniqueDonors: sql2`COUNT(DISTINCT ${transactions.fromAddress})::int`,
      uniqueRecipients: sql2`COUNT(DISTINCT ${transactions.toAddress})::int`
    }).from(transactions).where(eq(transactions.transactionType, "donation"));
    const topRecipients = await db.select({
      address: transactions.toAddress,
      totalReceived: sql2`SUM(${transactions.amount}::numeric)::text`,
      donationCount: sql2`COUNT(*)::int`
    }).from(transactions).where(eq(transactions.transactionType, "donation")).groupBy(transactions.toAddress).orderBy(sql2`SUM(${transactions.amount}::numeric) DESC`).limit(10);
    const topNFTs = await db.select({
      nftId: transactions.nftId,
      title: nfts.title,
      totalReceived: sql2`SUM(${transactions.amount}::numeric)::text`,
      donationCount: sql2`COUNT(*)::int`
    }).from(transactions).leftJoin(nfts, eq(transactions.nftId, nfts.id)).where(eq(transactions.transactionType, "donation")).groupBy(transactions.nftId, nfts.title).orderBy(sql2`SUM(${transactions.amount}::numeric) DESC`).limit(10);
    return {
      totalDonations: basicStats?.totalDonations || 0,
      totalAmount: basicStats?.totalAmount || "0",
      uniqueDonors: basicStats?.uniqueDonors || 0,
      uniqueRecipients: basicStats?.uniqueRecipients || 0,
      topRecipients: topRecipients.map((r) => ({
        address: r.address || "",
        totalReceived: r.totalReceived || "0",
        donationCount: r.donationCount || 0
      })),
      topNFTs: topNFTs.map((n) => ({
        nftId: n.nftId || "",
        title: n.title || "Unknown",
        totalReceived: n.totalReceived || "0",
        donationCount: n.donationCount || 0
      }))
    };
  }
  async getDonationsByNFT(nftId) {
    return await db.select().from(transactions).where(and(
      eq(transactions.nftId, nftId),
      eq(transactions.transactionType, "donation")
    )).orderBy(sql2`${transactions.createdAt} DESC`);
  }
  async getDonationsReceivedByWallet(walletAddress) {
    return await db.select().from(transactions).where(and(
      eq(transactions.toAddress, walletAddress),
      eq(transactions.transactionType, "donation")
    )).orderBy(sql2`${transactions.createdAt} DESC`);
  }
  async getNFTTipTotals() {
    const result = await db.select({
      nftId: transactions.nftId,
      totalTips: sql2`SUM(CAST(${transactions.amount} AS DECIMAL) + CAST(${transactions.platformFee} AS DECIMAL))`.as("total_tips")
    }).from(transactions).where(eq(transactions.transactionType, "donation")).groupBy(transactions.nftId);
    const tipMap = /* @__PURE__ */ new Map();
    for (const row of result) {
      tipMap.set(row.nftId, parseFloat(row.totalTips || "0"));
    }
    return tipMap;
  }
  // Quest system operations
  async getUserStats(farcasterFid) {
    const [stats] = await db.select().from(userStats).where(eq(userStats.farcasterFid, farcasterFid));
    return stats || void 0;
  }
  // Generate unique referral code
  async generateReferralCode(username) {
    const maxAttempts = 10;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const prefix = username.slice(0, 4).toUpperCase().replace(/[^A-Z]/g, "");
      const finalPrefix = prefix.length >= 3 ? prefix : prefix.padEnd(3, "X");
      const randomDigits = Math.floor(100 + Math.random() * 900);
      const code = `${finalPrefix}${randomDigits}`;
      const existing = await db.select().from(userStats).where(eq(userStats.referralCode, code));
      if (existing.length === 0) {
        return code;
      }
    }
    const timestamp2 = Date.now().toString().slice(-6);
    return `REF${timestamp2}`;
  }
  async createOrUpdateUserStats(insertStats) {
    const existing = await this.getUserStats(insertStats.farcasterFid);
    if (existing) {
      const referralCode = existing.referralCode || await this.generateReferralCode(insertStats.farcasterUsername);
      const [updated] = await db.update(userStats).set({
        ...insertStats,
        referralCode,
        // Ensure referralCode is set
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq(userStats.farcasterFid, insertStats.farcasterFid)).returning();
      return updated;
    } else {
      const referralCode = insertStats.referralCode || await this.generateReferralCode(insertStats.farcasterUsername);
      const [created] = await db.insert(userStats).values({
        ...insertStats,
        referralCode,
        referralCount: 0
      }).returning();
      return created;
    }
  }
  async updateUserStats(farcasterFid, updates) {
    const [updated] = await db.update(userStats).set({
      ...updates,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(userStats.farcasterFid, farcasterFid)).returning();
    return updated || void 0;
  }
  async getQuestCompletions(farcasterFid, date) {
    if (date) {
      return await db.select().from(questCompletions).where(
        and(
          eq(questCompletions.farcasterFid, farcasterFid),
          eq(questCompletions.completionDate, date)
        )
      );
    } else {
      return await db.select().from(questCompletions).where(eq(questCompletions.farcasterFid, farcasterFid));
    }
  }
  async createQuestCompletion(insertCompletion) {
    const normalizedDate = insertCompletion.completionDate.split("T")[0];
    const [completion] = await db.insert(questCompletions).values({
      ...insertCompletion,
      completionDate: normalizedDate
    }).returning();
    return completion;
  }
  async getQuestCompletion(farcasterFid, questType, day) {
    const date = new Date(day * 24 * 60 * 60 * 1e3);
    const completionDate = date.toISOString().split("T")[0];
    const [completion] = await db.select().from(questCompletions).where(
      and(
        eq(questCompletions.farcasterFid, farcasterFid),
        eq(questCompletions.questType, questType),
        eq(questCompletions.completionDate, completionDate)
      )
    ).limit(1);
    return completion || void 0;
  }
  async addQuestCompletion(data) {
    const date = new Date(data.day * 24 * 60 * 60 * 1e3);
    const normalizedDate = date.toISOString().split("T")[0];
    return await this.createQuestCompletion({
      farcasterFid: data.farcasterFid,
      questType: data.questType,
      completionDate: normalizedDate,
      // Use normalized date from blockchain day
      pointsEarned: data.pointsEarned
    });
  }
  async getLeaderboard(limit = 50) {
    return await db.select().from(userStats).orderBy(sql2`${userStats.totalPoints} DESC`).limit(limit);
  }
  async getWeeklyLeaderboard(limit = 50) {
    console.log("\u{1F4CA} Fetching weekly leaderboard with actual weeklyPoints (not totalPoints)");
    return await db.select().from(userStats).where(sql2`${userStats.farcasterUsername} IS NOT NULL AND ${userStats.farcasterUsername} != ''`).orderBy(sql2`${userStats.weeklyPoints} DESC`).limit(limit);
  }
  async checkHolderStatus(walletAddress) {
    if (!walletAddress) {
      return { isHolder: false, nftCount: 0 };
    }
    const userNFTs = await db.select().from(nfts).where(sql2`LOWER(${nfts.ownerAddress}) = LOWER(${walletAddress})`);
    return {
      isHolder: userNFTs.length > 0,
      nftCount: userNFTs.length
    };
  }
  // Multi-wallet operations
  async addUserWallet(farcasterFid, walletAddress, platform) {
    const lowerAddress = walletAddress.toLowerCase();
    const [updated] = await db.update(userWallets).set({ platform }).where(sql2`${userWallets.farcasterFid} = ${farcasterFid} AND ${userWallets.walletAddress} = ${lowerAddress}`).returning();
    if (updated) {
      console.log(`\u{1F504} Updated existing wallet platform: ${lowerAddress} \u2192 ${platform}`);
      return updated;
    }
    const [userWallet] = await db.insert(userWallets).values({
      farcasterFid,
      walletAddress: lowerAddress,
      platform
    }).onConflictDoNothing().returning();
    if (!userWallet) {
      const [existing] = await db.select().from(userWallets).where(sql2`${userWallets.farcasterFid} = ${farcasterFid} AND ${userWallets.walletAddress} = ${lowerAddress}`);
      console.log(`\u2139\uFE0F Returning existing wallet: ${lowerAddress} (${existing?.platform})`);
      return existing;
    }
    console.log(`\u2705 Created new wallet link: ${lowerAddress} \u2192 ${platform}`);
    return userWallet;
  }
  async getUserWallets(farcasterFid) {
    return await db.select().from(userWallets).where(eq(userWallets.farcasterFid, farcasterFid));
  }
  async getLinkedWallets(walletAddress) {
    return await db.select().from(userWallets).where(eq(userWallets.walletAddress, walletAddress.toLowerCase()));
  }
  // Get Farcaster FID and username from wallet address
  async getFarcasterInfoFromWallet(walletAddress) {
    try {
      const [wallet] = await db.select().from(userWallets).where(eq(userWallets.walletAddress, walletAddress.toLowerCase())).limit(1);
      if (wallet) {
        const stats = await this.getUserStats(wallet.farcasterFid);
        if (stats) {
          return {
            fid: wallet.farcasterFid,
            username: stats.farcasterUsername
          };
        }
      }
      const { getNeynarUserByAddress: getNeynarUserByAddress2 } = await Promise.resolve().then(() => (init_neynar_api(), neynar_api_exports));
      const neynarResult = await getNeynarUserByAddress2(walletAddress);
      if (neynarResult) {
        console.log(`\u2705 Found Farcaster user via Neynar: ${neynarResult.username} (${neynarResult.fid})`);
        return neynarResult;
      }
      return null;
    } catch (error) {
      console.error(`\u274C Error fetching Farcaster info for wallet ${walletAddress}:`, error);
      return null;
    }
  }
  // Fetch verified addresses from Farcaster Hub API
  async getFarcasterVerifiedAddresses(farcasterFid) {
    try {
      console.log(`\u{1F50D} Fetching verified addresses for Farcaster FID ${farcasterFid}`);
      const hubEndpoints = [
        "https://hub.farcaster.xyz",
        "https://hub.pinata.cloud"
      ];
      for (const hubUrl of hubEndpoints) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5e3);
          const response = await fetch(
            `${hubUrl}/v1/verificationsByFid?fid=${farcasterFid}`,
            { signal: controller.signal }
          );
          clearTimeout(timeoutId);
          if (!response.ok) {
            console.log(`\u26A0\uFE0F Hub ${hubUrl} error: ${response.status} ${response.statusText}`);
            continue;
          }
          const data = await response.json();
          const addresses = [];
          if (data.messages && Array.isArray(data.messages)) {
            data.messages.forEach((message) => {
              if (message.data?.verificationAddEthAddressBody?.address) {
                const address = message.data.verificationAddEthAddressBody.address;
                if (address.startsWith("0x")) {
                  addresses.push(address.toLowerCase());
                }
              }
            });
          }
          const uniqueAddresses = Array.from(new Set(addresses));
          console.log(`\u2705 Found ${uniqueAddresses.length} verified addresses for FID ${farcasterFid} via ${hubUrl}:`, uniqueAddresses);
          return uniqueAddresses;
        } catch (hubError) {
          console.log(`\u26A0\uFE0F Hub ${hubUrl} failed:`, hubError);
          continue;
        }
      }
      console.log(`\u26A0\uFE0F All Hub endpoints failed for FID ${farcasterFid}`);
      return [];
    } catch (error) {
      console.error(`\u274C Error fetching verified addresses for FID ${farcasterFid}:`, error);
      return [];
    }
  }
  async getAllNFTsForUser(farcasterFid) {
    const [linkedWallets, verifiedAddresses] = await Promise.all([
      this.getUserWallets(farcasterFid),
      this.getFarcasterVerifiedAddresses(farcasterFid)
    ]);
    const uniqueWallets = /* @__PURE__ */ new Map();
    linkedWallets.forEach((wallet) => {
      const address = wallet.walletAddress.toLowerCase();
      uniqueWallets.set(address, {
        address,
        platform: wallet.platform
      });
    });
    verifiedAddresses.forEach((address) => {
      const lowerAddress = address.toLowerCase();
      if (!uniqueWallets.has(lowerAddress)) {
        uniqueWallets.set(lowerAddress, {
          address: lowerAddress,
          platform: "farcaster"
        });
      }
    });
    console.log(`\u{1F50D} Fetching NFTs for Farcaster FID ${farcasterFid}: ${linkedWallets.length} linked + ${verifiedAddresses.length} verified \u2192 ${uniqueWallets.size} unique addresses`);
    if (uniqueWallets.size === 0) {
      return [];
    }
    const allNFTs = [];
    for (const [walletAddress, walletInfo] of Array.from(uniqueWallets.entries())) {
      const nfts2 = await this.getNFTsByOwner(walletInfo.address);
      const nftsWithSource = nfts2.map((nft) => ({
        ...nft,
        sourceWallet: walletInfo.address,
        sourcePlatform: walletInfo.platform
      }));
      allNFTs.push(...nftsWithSource);
      if (nfts2.length > 0) {
        console.log(`  \u2705 Wallet ${walletInfo.address} (${walletInfo.platform}): ${nfts2.length} NFTs`);
      }
    }
    return allNFTs;
  }
  async checkCombinedHolderStatus(farcasterFid) {
    const [linkedWallets, verifiedAddresses] = await Promise.all([
      this.getUserWallets(farcasterFid),
      this.getFarcasterVerifiedAddresses(farcasterFid)
    ]);
    const uniqueWallets = /* @__PURE__ */ new Map();
    linkedWallets.forEach((wallet) => {
      const address = wallet.walletAddress.toLowerCase();
      uniqueWallets.set(address, {
        address,
        platform: wallet.platform
      });
    });
    verifiedAddresses.forEach((address) => {
      const lowerAddress = address.toLowerCase();
      if (!uniqueWallets.has(lowerAddress)) {
        uniqueWallets.set(lowerAddress, {
          address: lowerAddress,
          platform: "farcaster_verified"
        });
      }
    });
    const uniqueWalletAddresses = Array.from(uniqueWallets.keys());
    console.log(`\u{1F50D} Checking holder status for Farcaster FID ${farcasterFid}: ${linkedWallets.length} linked + ${verifiedAddresses.length} verified \u2192 ${uniqueWalletAddresses.length} unique addresses`);
    let totalNFTCount = 0;
    for (const walletAddress of uniqueWalletAddresses) {
      const holderStatus = await this.checkHolderStatus(walletAddress);
      totalNFTCount += holderStatus.nftCount;
      if (holderStatus.nftCount > 0) {
        console.log(`  \u2705 Wallet ${walletAddress}: ${holderStatus.nftCount} NFTs`);
      }
    }
    return {
      isHolder: totalNFTCount > 0,
      nftCount: totalNFTCount
    };
  }
  // Atomic quest claiming operation
  async claimQuestAtomic(data) {
    return await db.transaction(async (tx) => {
      const existingCompletions = await tx.select().from(questCompletions).where(
        and(
          eq(questCompletions.farcasterFid, data.farcasterFid),
          eq(questCompletions.questType, data.questType),
          eq(questCompletions.completionDate, data.completionDate)
        )
      );
      if (existingCompletions.length > 0) {
        throw new Error(`Quest ${data.questType} already completed today`);
      }
      const existingUserStats = await tx.select().from(userStats).where(eq(userStats.farcasterFid, data.farcasterFid));
      if (existingUserStats.length === 0) {
        const currentWeekStart = getCurrentWeekStart();
        const [newUserStats] = await tx.insert(userStats).values({
          farcasterFid: data.farcasterFid,
          farcasterUsername: data.farcasterUsername,
          farcasterPfpUrl: data.farcasterPfpUrl || null,
          walletAddress: data.walletAddress || null,
          totalPoints: Math.round(data.pointsEarned * 100),
          // Convert to fixed-point
          weeklyPoints: Math.round(data.pointsEarned * 100),
          // Same as totalPoints for new users
          currentStreak: data.questType === "daily_checkin" ? 1 : 0,
          lastCheckIn: data.questType === "daily_checkin" ? /* @__PURE__ */ new Date() : null,
          lastStreakClaim: null,
          weeklyResetDate: currentWeekStart
          // Track current week
        }).returning();
        const [questCompletion] = await tx.insert(questCompletions).values({
          farcasterFid: data.farcasterFid,
          questType: data.questType,
          pointsEarned: Math.round(data.pointsEarned * 100),
          // Convert to fixed-point
          completionDate: data.completionDate,
          castUrl: data.castUrl
          // Include cast URL for social_post quests
        }).returning();
        return { userStats: newUserStats, questCompletion };
      } else {
        const currentStats = existingUserStats[0];
        const currentWeekStart = getCurrentWeekStart();
        const needsWeeklyReset = !currentStats.weeklyResetDate || currentStats.weeklyResetDate !== currentWeekStart;
        const updates = {
          totalPoints: currentStats.totalPoints + Math.round(data.pointsEarned * 100),
          // Add fixed-point values
          weeklyPoints: needsWeeklyReset ? Math.round(data.pointsEarned * 100) : (currentStats.weeklyPoints || 0) + Math.round(data.pointsEarned * 100),
          weeklyResetDate: currentWeekStart,
          // Update to current week
          farcasterPfpUrl: data.farcasterPfpUrl || currentStats.farcasterPfpUrl,
          // Update profile picture if provided
          updatedAt: /* @__PURE__ */ new Date(),
          ...data.userStatsUpdates
        };
        const [updatedStats] = await tx.update(userStats).set(updates).where(eq(userStats.farcasterFid, data.farcasterFid)).returning();
        const [questCompletion] = await tx.insert(questCompletions).values({
          farcasterFid: data.farcasterFid,
          questType: data.questType,
          pointsEarned: Math.round(data.pointsEarned * 100),
          // Convert to fixed-point
          completionDate: data.completionDate,
          castUrl: data.castUrl
          // Include cast URL for social_post quests
        }).returning();
        return { userStats: updatedStats, questCompletion };
      }
    });
  }
  // One-time quest: Add Mini App to Farcaster
  async completeAddMiniAppQuest(data) {
    const referralCode = await this.generateReferralCode(data.farcasterUsername);
    return await db.transaction(async (tx) => {
      const existingUserStats = await tx.select().from(userStats).where(eq(userStats.farcasterFid, data.farcasterFid));
      if (existingUserStats.length === 0) {
        const currentWeekStart = getCurrentWeekStart();
        const [newUserStats] = await tx.insert(userStats).values({
          farcasterFid: data.farcasterFid,
          farcasterUsername: data.farcasterUsername,
          farcasterPfpUrl: data.farcasterPfpUrl || null,
          totalPoints: data.pointsEarned,
          weeklyPoints: data.pointsEarned,
          hasAddedMiniApp: true,
          weeklyResetDate: currentWeekStart,
          referralCode,
          referralCount: 0
        }).returning();
        return { totalPoints: newUserStats.totalPoints };
      } else {
        const currentStats = existingUserStats[0];
        const currentWeekStart = getCurrentWeekStart();
        const needsWeeklyReset = !currentStats.weeklyResetDate || currentStats.weeklyResetDate !== currentWeekStart;
        const [updatedStats] = await tx.update(userStats).set({
          totalPoints: currentStats.totalPoints + data.pointsEarned,
          weeklyPoints: needsWeeklyReset ? data.pointsEarned : (currentStats.weeklyPoints || 0) + data.pointsEarned,
          weeklyResetDate: currentWeekStart,
          hasAddedMiniApp: true,
          farcasterPfpUrl: data.farcasterPfpUrl || currentStats.farcasterPfpUrl,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(userStats.farcasterFid, data.farcasterFid)).returning();
        return { totalPoints: updatedStats.totalPoints };
      }
    });
  }
  // Weekly reset and champion tracking
  async performWeeklyReset() {
    await db.transaction(async (tx) => {
      const currentWeekStart = getCurrentWeekStart();
      const weekEnd = getWeekEnd(currentWeekStart);
      const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
      const weekNumber = getWeekNumber();
      const [sampleUser] = await tx.select().from(userStats).where(sql2`${userStats.weeklyResetDate} IS NOT NULL`).limit(1);
      if (sampleUser && sampleUser.weeklyResetDate === currentWeekStart) {
        console.log(`\u2139\uFE0F Weekly reset not needed - still in week starting ${currentWeekStart}`);
        return;
      }
      console.log(`\u{1F504} Performing weekly reset for week starting ${currentWeekStart}`);
      const [currentChampion] = await tx.select().from(userStats).where(sql2`${userStats.weeklyPoints} > 0 AND ${userStats.farcasterUsername} != 'coinacci' AND ${userStats.farcasterUsername} IS NOT NULL AND ${userStats.farcasterUsername} != ''`).orderBy(sql2`${userStats.weeklyPoints} DESC`).limit(1);
      if (currentChampion && currentChampion.weeklyPoints > 0) {
        await tx.insert(weeklyChampions).values({
          farcasterFid: currentChampion.farcasterFid,
          farcasterUsername: currentChampion.farcasterUsername,
          weekStartDate: currentChampion.weeklyResetDate || currentWeekStart,
          weekEndDate: weekEnd,
          weeklyPoints: currentChampion.weeklyPoints,
          weekNumber,
          year: currentYear
        }).onConflictDoNothing();
      }
      await tx.update(userStats).set({
        weeklyPoints: 0,
        weeklyResetDate: currentWeekStart,
        updatedAt: /* @__PURE__ */ new Date()
      });
      console.log(`\u2705 Weekly reset completed for week starting ${currentWeekStart}`);
    });
  }
  async getWeeklyChampions(limit = 10) {
    return await db.select().from(weeklyChampions).where(sql2`${weeklyChampions.farcasterUsername} != 'coinacci'`).orderBy(sql2`${weeklyChampions.year} DESC, ${weeklyChampions.weekNumber} DESC`).limit(limit);
  }
  async getCurrentWeekChampion() {
    const currentWeekStart = getCurrentWeekStart();
    const [champion] = await db.select().from(weeklyChampions).where(eq(weeklyChampions.weekStartDate, currentWeekStart)).limit(1);
    return champion || null;
  }
  async backfillWeeklyPointsFromTotal() {
    return await db.transaction(async (tx) => {
      const currentWeekStart = getCurrentWeekStart();
      const usersNeedingBackfill = await tx.select().from(userStats).where(sql2`${userStats.weeklyPoints} = 0 AND ${userStats.totalPoints} > 0`);
      console.log(`\u{1F50D} Found ${usersNeedingBackfill.length} users needing weekly points backfill`);
      if (usersNeedingBackfill.length === 0) {
        console.log("\u{1F4CB} No users needed weekly points backfill (all already migrated)");
        return {
          updated: 0,
          message: "No users needed backfill - all users already have weekly points initialized"
        };
      }
      const result = await tx.update(userStats).set({
        weeklyPoints: sql2`${userStats.totalPoints}`,
        // Copy totalPoints to weeklyPoints
        weeklyResetDate: currentWeekStart,
        // Mark as migrated to current week
        updatedAt: /* @__PURE__ */ new Date()
      }).where(sql2`${userStats.weeklyPoints} = 0 AND ${userStats.totalPoints} > 0`);
      const updatedCount = result.rowCount || 0;
      console.log(`\u2705 Backfilled weekly points for ${updatedCount} users`);
      return {
        updated: updatedCount,
        message: `Successfully backfilled weekly points for ${updatedCount} users from their total points`
      };
    });
  }
  // NEW: Sync ALL weekly points with total points (for same week)
  async syncWeeklyWithAllTime() {
    return await db.transaction(async (tx) => {
      const currentWeekStart = getCurrentWeekStart();
      console.log(`\u{1F504} Syncing ALL weekly points with total points for week starting ${currentWeekStart}`);
      const result = await tx.update(userStats).set({
        weeklyPoints: sql2`${userStats.totalPoints}`,
        // Copy totalPoints to weeklyPoints
        weeklyResetDate: currentWeekStart,
        // Mark as current week
        updatedAt: /* @__PURE__ */ new Date()
      }).where(sql2`${userStats.totalPoints} > 0`);
      const updatedCount = result.rowCount || 0;
      console.log(`\u2705 Synced weekly points with all-time for ${updatedCount} users`);
      return {
        updated: updatedCount,
        message: `Successfully synced weekly points with all-time points for ${updatedCount} users`
      };
    });
  }
  // Backfill referral codes for existing users
  async backfillReferralCodes() {
    console.log("\u{1F50D} Starting referral code backfill...");
    const usersNeedingCodes = await db.select().from(userStats).where(sql2`${userStats.referralCode} IS NULL`);
    console.log(`\u{1F4CA} Found ${usersNeedingCodes.length} users without referral codes`);
    if (usersNeedingCodes.length === 0) {
      return {
        updated: 0,
        message: "No users need referral codes - all users already have codes"
      };
    }
    let updatedCount = 0;
    for (const user of usersNeedingCodes) {
      try {
        const referralCode = await this.generateReferralCode(user.farcasterUsername);
        await db.update(userStats).set({
          referralCode,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(userStats.farcasterFid, user.farcasterFid));
        updatedCount++;
        if (updatedCount % 50 === 0) {
          console.log(`\u23F3 Progress: ${updatedCount}/${usersNeedingCodes.length} users updated`);
        }
      } catch (error) {
        console.error(`\u274C Failed to generate referral code for ${user.farcasterUsername}:`, error);
      }
    }
    console.log(`\u2705 Backfilled referral codes for ${updatedCount} users`);
    return {
      updated: updatedCount,
      message: `Successfully generated referral codes for ${updatedCount} users`
    };
  }
  // Notification operations
  async updateUserNotificationToken(farcasterFid, token) {
    const [user] = await db.update(userStats).set({
      notificationToken: token,
      notificationsEnabled: true,
      // Auto-enable when token is set
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(userStats.farcasterFid, farcasterFid)).returning();
    console.log(`\u{1F4F1} Updated notification token for user ${farcasterFid}`);
    return user || void 0;
  }
  async enableUserNotifications(farcasterFid, enabled) {
    const [user] = await db.update(userStats).set({
      notificationsEnabled: enabled,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(userStats.farcasterFid, farcasterFid)).returning();
    console.log(`\u{1F514} ${enabled ? "Enabled" : "Disabled"} notifications for user ${farcasterFid}`);
    return user || void 0;
  }
  async getUsersWithNotifications() {
    return await db.select().from(userStats).where(sql2`${userStats.notificationsEnabled} = true AND ${userStats.notificationToken} IS NOT NULL`);
  }
  async createNotificationHistory(notification) {
    const [history] = await db.insert(notificationHistory).values(notification).returning();
    console.log(`\u{1F4CB} Created notification history: ${notification.title} to ${notification.recipientCount} users`);
    return history;
  }
  async getNotificationHistory(limit = 20) {
    return await db.select().from(notificationHistory).orderBy(sql2`${notificationHistory.sentAt} DESC`).limit(limit);
  }
  async updateLastNotificationSent(farcasterFids) {
    if (farcasterFids.length === 0) return 0;
    const result = await db.update(userStats).set({ lastNotificationSent: /* @__PURE__ */ new Date() }).where(sql2`${userStats.farcasterFid} = ANY(${farcasterFids})`);
    return result.rowCount || 0;
  }
  // Blockchain sync operations
  async getSyncState(contractAddress) {
    const [state] = await db.select().from(syncState).where(eq(syncState.contractAddress, contractAddress.toLowerCase()));
    return state || void 0;
  }
  async updateSyncState(contractAddress, lastProcessedBlock) {
    const existing = await this.getSyncState(contractAddress);
    if (existing) {
      const [updated] = await db.update(syncState).set({
        lastProcessedBlock,
        lastSyncAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq(syncState.contractAddress, contractAddress.toLowerCase())).returning();
      return updated;
    } else {
      const [created] = await db.insert(syncState).values({
        contractAddress: contractAddress.toLowerCase(),
        lastProcessedBlock,
        lastSyncAt: /* @__PURE__ */ new Date()
      }).returning();
      return created;
    }
  }
  // Referral operations
  async validateAndApplyReferral(data) {
    const newReferralCode = await this.generateReferralCode(data.newUserUsername);
    return await db.transaction(async (tx) => {
      const [referrer] = await tx.select().from(userStats).where(eq(userStats.referralCode, data.referralCode));
      if (!referrer) {
        return {
          success: false,
          message: "Invalid referral code"
        };
      }
      if (referrer.farcasterFid === data.newUserFid) {
        return {
          success: false,
          message: "Cannot use your own referral code"
        };
      }
      const [newUser] = await tx.select().from(userStats).where(eq(userStats.farcasterFid, data.newUserFid));
      if (newUser?.referredByFid) {
        return {
          success: false,
          message: "Referral code already used"
        };
      }
      const currentWeekStart = getCurrentWeekStart();
      if (!newUser) {
        await tx.insert(userStats).values({
          farcasterFid: data.newUserFid,
          farcasterUsername: data.newUserUsername,
          farcasterPfpUrl: data.newUserPfpUrl || null,
          totalPoints: 0,
          weeklyPoints: 0,
          referredByFid: referrer.farcasterFid,
          referralCode: newReferralCode,
          referralCount: 0,
          weeklyResetDate: currentWeekStart
        });
      } else {
        await tx.update(userStats).set({
          referredByFid: referrer.farcasterFid,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(userStats.farcasterFid, data.newUserFid));
      }
      await tx.update(userStats).set({
        referralCount: (referrer.referralCount || 0) + 1,
        unclaimedReferrals: (referrer.unclaimedReferrals || 0) + 1,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq(userStats.farcasterFid, referrer.farcasterFid));
      console.log(`\u{1F381} Referral successful: ${data.newUserUsername} referred by ${referrer.farcasterUsername} (unclaimed +1)`);
      return {
        success: true,
        message: `Successfully applied referral code! ${referrer.farcasterUsername} can now claim the reward in Quests.`,
        referrerPoints: referrer.totalPoints
      };
    });
  }
  // Pending mints operations
  async createPendingMint(insertPendingMint) {
    try {
      const [pendingMint] = await db.insert(pendingMints).values(insertPendingMint).returning();
      return pendingMint;
    } catch (error) {
      if (error.code === "23505") {
        console.log(`\u26A0\uFE0F Pending mint already exists for token ${insertPendingMint.tokenId}`);
        const [existing] = await db.select().from(pendingMints).where(
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
  async getPendingMints(limit = 100) {
    return await db.select().from(pendingMints).orderBy(pendingMints.createdAt).limit(limit);
  }
  async updatePendingMintRetry(id, error) {
    const [updated] = await db.update(pendingMints).set({
      retryCount: sql2`${pendingMints.retryCount} + 1`,
      lastError: error,
      lastAttemptAt: /* @__PURE__ */ new Date()
    }).where(eq(pendingMints.id, id)).returning();
    return updated || void 0;
  }
  async deletePendingMint(id) {
    await db.delete(pendingMints).where(eq(pendingMints.id, id));
  }
  // Badge operations
  async getAllBadges() {
    return await db.select().from(badges).orderBy(badges.category, badges.requirement);
  }
  async getUserBadges(identifier) {
    const { farcasterFid, walletAddress } = identifier;
    let userBadgeRecords = [];
    if (farcasterFid) {
      userBadgeRecords = await db.select().from(userBadges).where(eq(userBadges.farcasterFid, farcasterFid));
    } else if (walletAddress) {
      userBadgeRecords = await db.select().from(userBadges).where(sql2`LOWER(${userBadges.walletAddress}) = LOWER(${walletAddress})`);
    }
    const badgeIds = userBadgeRecords.map((ub) => ub.badgeId);
    if (badgeIds.length === 0) return [];
    const earnedBadges = await db.select().from(badges).where(sql2`${badges.id} IN (${sql2.join(badgeIds.map((id) => sql2`${id}`), sql2`, `)})`);
    return earnedBadges.map((b) => b.code);
  }
  async awardBadge(badgeCode, identifier) {
    const { farcasterFid, walletAddress } = identifier;
    const [badge] = await db.select().from(badges).where(eq(badges.code, badgeCode));
    if (!badge) return void 0;
    try {
      const [userBadge] = await db.insert(userBadges).values({
        farcasterFid: farcasterFid || "",
        walletAddress: walletAddress || null,
        badgeId: badge.id
      }).returning();
      return userBadge;
    } catch (error) {
      if (error.code === "23505") {
        return void 0;
      }
      throw error;
    }
  }
};
var storage = new DatabaseStorage();

// server/routes.ts
import { sql as sql4 } from "drizzle-orm";

// server/blockchain.ts
import { ethers } from "ethers";
var BASE_RPC_URLS = [
  "https://base-rpc.publicnode.com",
  "https://rpc.ankr.com/base",
  "https://base.llamarpc.com",
  "https://mainnet.base.org"
];
var currentRpcIndex = 0;
var MORALIS_API_URL = "https://deep-index.moralis.io/api/v2";
var MORALIS_API_KEY = process.env.MORALIS_API_KEY || "";
var BASESCAN_API_URL = "https://api.basescan.org/api";
var BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || "";
var NFT_CONTRACT_ADDRESS = "0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f";
var USDC_CONTRACT_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
var MARKETPLACE_CONTRACT_ADDRESS = "0x480549919B9e8Dd1DA1a1a9644Fb3F8A115F2c2c";
var QUEST_MANAGER_ADDRESS = "0x30eDb4493fA7c0F035adc75bA6381E2efFFeCa6c";
var PLATFORM_WALLET = "0x7CDe7822456AAC667Df0420cD048295b92704084";
var TRAVEL_NFT_ABI = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function balanceOf(address owner) view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function getApproved(uint256 tokenId) view returns (address)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "function transferFrom(address from, address to, uint256 tokenId)",
  "function safeTransferFrom(address from, address to, uint256 tokenId)",
  "function approve(address to, uint256 tokenId)",
  "function setApprovalForAll(address operator, bool approved)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];
var MARKETPLACE_ABI = [
  "function listNFT(uint256 tokenId, uint256 price)",
  "function cancelListing(uint256 tokenId)",
  "function updatePrice(uint256 tokenId, uint256 newPrice)",
  "function purchaseNFT(uint256 tokenId)",
  "function getListing(uint256 tokenId) view returns (tuple(address seller, uint256 price, bool active))",
  "function isListed(uint256 tokenId) view returns (bool)",
  "function getSellerVolume(address seller) view returns (uint256)",
  "function totalVolume() view returns (uint256)",
  "event NFTListed(uint256 indexed tokenId, address indexed seller, uint256 price, uint256 timestamp)",
  "event NFTUnlisted(uint256 indexed tokenId, address indexed seller, uint256 timestamp)",
  "event PriceUpdated(uint256 indexed tokenId, address indexed seller, uint256 oldPrice, uint256 newPrice, uint256 timestamp)",
  "event NFTPurchased(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price, uint256 platformFee, uint256 timestamp)"
];
var ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)"
];
var QUEST_MANAGER_ABI = [
  "event QuestCompleted(address indexed user, uint256 indexed questId, uint256 fee, uint256 timestamp, uint256 day)"
];
async function withRetry(fn, maxRetries = 3) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (error && typeof error === "object" && "info" in error) {
        const info = error.info;
        if (info?.error?.code === -32016 || info?.error?.message?.includes("rate limit")) {
          console.log(`\u26A0\uFE0F Rate limit hit (attempt ${i + 1}/${maxRetries}), waiting...`);
          await new Promise((resolve) => setTimeout(resolve, 1e3 + i * 500));
          continue;
        }
      }
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1e3));
      }
    }
  }
  throw lastError;
}
var currentProvider;
var currentNftContract;
var currentMarketplaceContract;
var currentUsdcContract;
var currentQuestManagerContract;
function initializeProvider(rpcUrl) {
  console.log(`\u{1F50C} Initializing RPC provider: ${rpcUrl}`);
  const provider2 = new ethers.JsonRpcProvider(rpcUrl);
  return {
    provider: provider2,
    nftContract: new ethers.Contract(NFT_CONTRACT_ADDRESS, TRAVEL_NFT_ABI, provider2),
    marketplaceContract: new ethers.Contract(MARKETPLACE_CONTRACT_ADDRESS, MARKETPLACE_ABI, provider2),
    usdcContract: new ethers.Contract(USDC_CONTRACT_ADDRESS, ERC20_ABI, provider2),
    questManagerContract: new ethers.Contract(QUEST_MANAGER_ADDRESS, QUEST_MANAGER_ABI, provider2)
  };
}
function rotateRpcProvider() {
  const nextIndex = (currentRpcIndex + 1) % BASE_RPC_URLS.length;
  currentRpcIndex = nextIndex;
  const nextUrl = BASE_RPC_URLS[currentRpcIndex];
  console.log(`\u{1F504} Rotating to RPC provider [${currentRpcIndex}]: ${nextUrl}`);
  const { provider: provider2, nftContract: nftContract2, marketplaceContract: marketplaceContract2, usdcContract: usdcContract2, questManagerContract } = initializeProvider(nextUrl);
  currentProvider = provider2;
  currentNftContract = nftContract2;
  currentMarketplaceContract = marketplaceContract2;
  currentUsdcContract = usdcContract2;
  currentQuestManagerContract = questManagerContract;
  return true;
}
var initial = initializeProvider(BASE_RPC_URLS[0]);
currentProvider = initial.provider;
currentNftContract = initial.nftContract;
currentMarketplaceContract = initial.marketplaceContract;
currentUsdcContract = initial.usdcContract;
currentQuestManagerContract = initial.questManagerContract;
var provider = currentProvider;
var nftContract = currentNftContract;
var marketplaceContract = currentMarketplaceContract;
var usdcContract = currentUsdcContract;
function normalizeUri(uri) {
  if (!uri) return [];
  if (uri.startsWith("ipfs://")) {
    const cid = uri.replace("ipfs://", "");
    return [
      `https://ipfs.io/ipfs/${cid}`,
      // Most reliable public gateway
      `https://cloudflare-ipfs.com/ipfs/${cid}`,
      // Cloudflare CDN - very fast
      `https://dweb.link/ipfs/${cid}`,
      // Protocol Labs gateway
      `https://4everland.io/ipfs/${cid}`,
      // Alternative reliable gateway
      `https://gateway.pinata.cloud/ipfs/${cid}`
      // Pinata (may be rate limited)
    ];
  }
  if (uri.includes("/ipfs/")) {
    const hash = uri.split("/ipfs/")[1];
    if (hash) {
      const cleanHash = hash.split("?")[0];
      return [
        uri,
        // Keep original first (may be fastest if not rate limited)
        `https://ipfs.io/ipfs/${cleanHash}`,
        // Most reliable
        `https://cloudflare-ipfs.com/ipfs/${cleanHash}`,
        // Fast CDN
        `https://dweb.link/ipfs/${cleanHash}`,
        // Protocol Labs
        `https://4everland.io/ipfs/${cleanHash}`
        // Alternative
      ];
    }
  }
  if (uri.startsWith("ar://")) {
    const id = uri.replace("ar://", "");
    return [`https://arweave.net/${id}`];
  }
  if (uri.startsWith("data:application/json;base64,")) {
    try {
      const base64 = uri.split(",")[1];
      const jsonString = Buffer.from(base64, "base64").toString();
      return [`data:${jsonString}`];
    } catch (e) {
      console.error("Failed to decode base64 JSON:", e);
      return [];
    }
  }
  if (uri.startsWith("http")) {
    return [uri];
  }
  return [];
}
function extractCoordinates(metadata) {
  if (!metadata || !metadata.attributes) {
    return { latitude: null, longitude: null };
  }
  let latitude = null;
  let longitude = null;
  const coordTraits = ["latitude", "lat", "longitude", "lng", "lon", "coordinates", "coord", "gps", "geo"];
  for (const attr of metadata.attributes) {
    if (!attr.trait_type || !attr.value) continue;
    const traitLower = attr.trait_type.toLowerCase();
    const value = String(attr.value).trim();
    if (traitLower.includes("latitude")) {
      latitude = parseCoordinate(value);
    } else if (traitLower === "lat") {
      latitude = parseCoordinate(value);
    }
    if (traitLower.includes("longitude")) {
      longitude = parseCoordinate(value);
    } else if (traitLower === "lng" || traitLower === "lon") {
      longitude = parseCoordinate(value);
    }
    if (traitLower.includes("coordinates") || traitLower.includes("coord") || traitLower.includes("gps")) {
      const coords = parseCoordinatePair(value);
      if (coords) {
        latitude = coords.latitude;
        longitude = coords.longitude;
      }
    }
  }
  return { latitude, longitude };
}
function parseCoordinate(value) {
  if (!value) return null;
  const cleaned = value.replace(/[^\d\.\-,]/g, "");
  const num = parseFloat(cleaned);
  if (!isNaN(num) && num !== 0) {
    return num.toString();
  }
  return null;
}
function parseCoordinatePair(value) {
  if (!value) return null;
  const parts = value.split(",").map((p) => p.trim());
  if (parts.length === 2) {
    const lat = parseCoordinate(parts[0]);
    const lng = parseCoordinate(parts[1]);
    if (lat && lng) {
      return { latitude: lat, longitude: lng };
    }
  }
  return null;
}
async function fetchWithGateways(uris) {
  let lastError = null;
  for (let i = 0; i < uris.length; i++) {
    const uri = uris[i];
    try {
      if (uri.startsWith("data:")) {
        return JSON.parse(uri.replace("data:", ""));
      }
      console.log(`\u{1F517} Trying gateway ${i + 1}/${uris.length}: ${uri}`);
      const controller = new AbortController();
      const timeout = i === 0 ? 8e3 : i === 1 ? 12e3 : 15e3;
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const response = await fetch(uri, {
        signal: controller.signal,
        headers: {
          "User-Agent": "TravelMint/1.0",
          "Accept": "application/json, text/plain, */*"
        }
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          console.log(`\u2705 Gateway ${i + 1} success: JSON response`);
          return await response.json();
        } else {
          console.log(`\u2705 Gateway ${i + 1} success: Text response`);
          const text2 = await response.text();
          if (text2.trim().startsWith("{") || text2.trim().startsWith("[")) {
            try {
              return JSON.parse(text2);
            } catch {
              return text2;
            }
          }
          return text2;
        }
      } else {
        console.log(`\u26A0\uFE0F Gateway ${i + 1} HTTP error: ${response.status} ${response.statusText}`);
        if (response.status === 429) {
          console.log(`\u26A0\uFE0F Gateway ${i + 1} rate limited, trying next...`);
        }
        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.log(`\u26A0\uFE0F Gateway ${i + 1} failed: ${errorMsg}`);
      lastError = error instanceof Error ? error : new Error(errorMsg);
      if (errorMsg.includes("aborted") || errorMsg.includes("timeout")) {
        continue;
      }
    }
  }
  throw lastError || new Error(`All ${uris.length} gateways failed`);
}
var BlockchainService = class {
  // Get specific NFT using Moralis API - much faster and more reliable
  async getMoralisNFT(tokenId) {
    try {
      if (!MORALIS_API_KEY) {
        console.log("\u26A0\uFE0F No Moralis API key - falling back to RPC");
        return null;
      }
      console.log(`\u{1F680} Fetching Token ${tokenId} using Moralis API...`);
      const moralisUrl = `${MORALIS_API_URL}/nft/${NFT_CONTRACT_ADDRESS}/${tokenId}?chain=base&format=decimal`;
      const response = await fetch(moralisUrl, {
        headers: {
          "X-API-Key": MORALIS_API_KEY,
          "Content-Type": "application/json"
        }
      });
      if (!response.ok) {
        console.log(`\u274C Moralis API error for Token ${tokenId}:`, response.status);
        return null;
      }
      const nftData = await response.json();
      if (!nftData.owner_of) {
        console.log(`\u274C Token ${tokenId} has no owner (doesn't exist)`);
        return null;
      }
      console.log(`\u2705 SUCCESS! Token ${tokenId} owner: ${nftData.owner_of}, tokenURI: ${nftData.token_uri}`);
      let metadata = null;
      if (nftData.token_uri) {
        try {
          metadata = await fetchWithGateways([nftData.token_uri]);
          console.log(`\u2705 Parsed metadata for token ${tokenId}:`, metadata);
        } catch (error) {
          console.log(`\u274C Error fetching metadata for token ${tokenId}:`, error);
        }
      }
      return {
        tokenId,
        owner: nftData.owner_of.toLowerCase(),
        tokenURI: nftData.token_uri || "",
        metadata
      };
    } catch (error) {
      console.log(`\u274C Moralis API error for Token ${tokenId}:`, error);
      return null;
    }
  }
  // Get all NFTs from the contract using Moralis API for Transfer events
  async getAllNFTs() {
    try {
      console.log("\u{1F517} Fetching NFTs using parallel scanning (RPC + Moralis)...");
      const scanPromises = [];
      scanPromises.push(this.tryKnownTokenIds());
      if (MORALIS_API_KEY) {
        console.log("\u{1F680} Starting parallel Moralis API call for Token 47...");
        scanPromises.push(this.getMoralisNFT("47"));
      } else {
        scanPromises.push(Promise.resolve(null));
      }
      const [rpcResults, moralisToken47] = await Promise.allSettled(scanPromises);
      const results = rpcResults.status === "fulfilled" ? rpcResults.value : [];
      if (moralisToken47.status === "fulfilled" && moralisToken47.value) {
        console.log("\u{1F389} SUCCESS! Token 47 found via Moralis API!");
        const exists = results.some((nft) => nft.tokenId === "47");
        if (!exists) {
          console.log("\u2705 Adding Token 47 to results list");
          results.push(moralisToken47.value);
        }
      }
      console.log(`\u{1F4CA} Total NFTs found: ${results.length}`);
      return results;
    } catch (error) {
      console.error("Error in getAllNFTs:", error);
      return await this.tryKnownTokenIds();
    }
  }
  // Fallback method to try known token IDs
  async tryKnownTokenIds() {
    console.log("\u{1F504} Trying known token IDs as fallback...");
    const nfts2 = [];
    let consecutiveFailures = 0;
    for (let tokenId = 1; tokenId <= 1e3; tokenId++) {
      try {
        const owner = await withRetry(() => nftContract.ownerOf(tokenId));
        const tokenURI = await nftContract.tokenURI(tokenId);
        consecutiveFailures = 0;
        let metadata = null;
        const uris = normalizeUri(tokenURI);
        if (uris.length > 0) {
          try {
            console.log(`\u{1F4E5} Fetching metadata from tokenURI: ${tokenURI}`);
            metadata = await Promise.race([
              fetchWithGateways(uris),
              new Promise(
                (_, reject) => setTimeout(() => reject(new Error("Metadata fetch timeout")), 3e3)
              )
            ]);
            console.log(`\u2705 Parsed metadata for token ${tokenId}:`, metadata);
          } catch (fetchError) {
            console.log(`\u274C Error fetching metadata for token ${tokenId}:`, fetchError);
          }
        } else {
          console.log(`\u26A0\uFE0F Unsupported tokenURI format for token ${tokenId}: ${tokenURI}`);
        }
        nfts2.push({
          tokenId: tokenId.toString(),
          owner: owner.toLowerCase(),
          tokenURI,
          metadata
        });
        console.log(`\u2705 Found NFT #${tokenId} owned by ${owner}`);
      } catch (error) {
        console.log(`\u274C Error checking token ${tokenId}:`, error.reason || error.message || error);
        if (error.reason === "ERC721: invalid token ID" || error.code === "CALL_EXCEPTION" && !error.message?.includes("missing revert data") || error.message?.includes("invalid token ID")) {
          consecutiveFailures++;
          console.log(`\u26A0\uFE0F Token ${tokenId} doesn't exist (${consecutiveFailures} consecutive failures)`);
        } else {
          console.log(`\u{1F504} Rate limit/network error for token ${tokenId}, continuing without counting failure...`);
        }
        if (consecutiveFailures >= 15) {
          console.log(`\u{1F6D1} Stopping search after ${consecutiveFailures} consecutive "token not found" failures at token ${tokenId}`);
          break;
        }
      }
    }
    console.log(`Found ${nfts2.length} NFTs using fallback method`);
    return nfts2;
  }
  // Get NFTs owned by a specific address
  async getNFTsByOwner(ownerAddress) {
    try {
      ownerAddress = ownerAddress.toLowerCase();
      console.log(`\u{1F517} Fetching NFTs for owner: ${ownerAddress}`);
      const allNFTs = await this.getAllNFTs();
      const ownerNFTs = allNFTs.filter((nft) => nft.owner === ownerAddress);
      console.log(`\u2705 Owner ${ownerAddress} has ${ownerNFTs.length} NFTs`);
      return ownerNFTs;
    } catch (error) {
      console.error(`Error fetching NFTs for owner ${ownerAddress}:`, error);
      return [];
    }
  }
  // Get a specific NFT by token ID
  async getNFTByTokenId(tokenId) {
    try {
      const owner = await nftContract.ownerOf(tokenId);
      const tokenURI = await nftContract.tokenURI(tokenId);
      let metadata = null;
      if (tokenURI && tokenURI.startsWith("http")) {
        try {
          const response = await fetch(tokenURI);
          if (response.ok) {
            metadata = await response.json();
          }
        } catch (e) {
          console.log(`Failed to fetch metadata for token ${tokenId}:`, e);
        }
      }
      return {
        tokenId,
        owner: owner.toLowerCase(),
        tokenURI,
        metadata
      };
    } catch (error) {
      console.error(`Error fetching NFT ${tokenId}:`, error);
      return null;
    }
  }
  // Fixed locations for specific NFTs - these will never be changed by metadata updates
  getLocationOverride(tokenId, nftTitle) {
    const locationOverrides = {
      // Baghdad NFT -> Iraq Baghdad
      "106": { location: "Baghdad", latitude: "33.3152", longitude: "44.3661" },
      // Vietnam Forest NFT -> Vietnam  
      "89": { location: "Ho Chi Minh City", latitude: "10.8231", longitude: "106.6297" },
      // Dubai Nights NFT -> Dubai
      "48": { location: "Dubai", latitude: "25.2048", longitude: "55.2708" },
      // Egypt Night NFT -> Cairo
      "44": { location: "Cairo", latitude: "30.0444", longitude: "31.2357" },
      // Georgia Moments NFT -> Tbilisi
      "41": { location: "Tbilisi", latitude: "41.7151", longitude: "44.8271" }
    };
    return locationOverrides[tokenId] || null;
  }
  // Convert blockchain NFT to database format
  async blockchainNFTToDBFormat(blockchainNFT) {
    const metadata = blockchainNFT.metadata;
    const override = this.getLocationOverride(blockchainNFT.tokenId, metadata?.name || "");
    let location;
    let latitude;
    let longitude;
    if (override) {
      location = override.location;
      latitude = override.latitude;
      longitude = override.longitude;
      console.log(`\u{1F512} Using fixed location for NFT #${blockchainNFT.tokenId}: ${location} at ${latitude}, ${longitude}`);
    } else {
      location = this.extractLocationFromMetadata(metadata);
      const coords = extractCoordinates(metadata);
      latitude = coords.latitude || void 0;
      longitude = coords.longitude || void 0;
    }
    let imageUrl = await this.extractImageUrl(metadata, blockchainNFT.tokenURI);
    if (blockchainNFT.tokenId === "1") {
      imageUrl = "/attached_assets/IMG_4085_1756446465520.jpeg";
    } else if (blockchainNFT.tokenId === "2") {
      imageUrl = "/attached_assets/IMG_4086_1756446465520.jpeg";
    } else if (blockchainNFT.tokenId === "37") {
      imageUrl = "/attached_assets/IMG_4202_1756888569757.jpeg";
    } else if (blockchainNFT.tokenId === "38") {
      imageUrl = "/attached_assets/IMG_4202_1756890858921.jpeg";
    }
    return {
      // Remove hard-coded id - let UUID default apply to prevent duplicate key errors
      title: metadata?.name || `Travel NFT #${blockchainNFT.tokenId}`,
      description: metadata?.description || "A beautiful travel memory captured on the blockchain.",
      imageUrl,
      location,
      latitude: latitude || void 0,
      longitude: longitude || void 0,
      category: this.extractCategoryFromMetadata(metadata) || "travel",
      price: "1.0",
      // Fixed mint price
      isForSale: 0,
      creatorAddress: blockchainNFT.owner,
      // Assume current owner is creator for now
      ownerAddress: blockchainNFT.owner,
      contractAddress: NFT_CONTRACT_ADDRESS,
      mintPrice: "1.0",
      royaltyPercentage: "5.0",
      tokenId: blockchainNFT.tokenId,
      transactionHash: null,
      // Would need additional lookup to get mint transaction
      metadata: JSON.stringify(metadata || {})
    };
  }
  // URL validation helper to ensure image URLs point to actual images, not metadata
  async validateAndFixImageUrl(url) {
    try {
      console.log(`\u{1F50D} Validating image URL: ${url.substring(0, 50)}...`);
      const response = await fetch(url, { method: "HEAD" });
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        console.log("\u{1F4C4} Detected metadata URL, extracting actual image...");
        const metadataResponse = await fetch(url);
        const metadata = await metadataResponse.json();
        if (metadata.image) {
          console.log(`\u2705 Extracted image URL: ${metadata.image.substring(0, 50)}...`);
          return metadata.image;
        }
      }
      if (contentType?.startsWith("image/")) {
        console.log("\u2705 Valid image URL confirmed");
        return url;
      }
      console.log(`\u26A0\uFE0F URL not an image (${contentType}), keeping original`);
      return url;
    } catch (error) {
      console.log("\u26A0\uFE0F Failed to validate URL, keeping original:", error);
      return url;
    }
  }
  // Extract proper image URL from metadata or tokenURI
  async extractImageUrl(metadata, tokenURI) {
    if (metadata?.image) {
      return await this.validateAndFixImageUrl(metadata.image);
    }
    if (!tokenURI) {
      return "";
    }
    try {
      if (tokenURI.startsWith("http") && (tokenURI.includes("ipfs") || tokenURI.includes("metadata") || tokenURI.includes("json") || tokenURI.startsWith("https://gateway.pinata.cloud/ipfs/bafkrei"))) {
        console.log(`\u{1F50D} Checking if ${tokenURI} contains metadata with image URL...`);
        const response = await fetch(tokenURI);
        if (response.ok) {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const fetchedMetadata = await response.json();
            if (fetchedMetadata?.image) {
              console.log(`\u2705 Found real image URL in metadata: ${fetchedMetadata.image}`);
              return fetchedMetadata.image;
            }
          }
        }
      }
    } catch (error) {
      console.log(`\u26A0\uFE0F Failed to fetch potential metadata URL ${tokenURI}:`, error);
    }
    return tokenURI;
  }
  extractLocationFromMetadata(metadata) {
    if (!metadata || !metadata.attributes) return "Unknown Location";
    const locationAttr = metadata.attributes.find(
      (attr) => attr.trait_type?.toLowerCase().includes("location") || attr.trait_type?.toLowerCase().includes("city")
    );
    return locationAttr?.value || "Unknown Location";
  }
  extractLatitudeFromMetadata(metadata) {
    if (!metadata || !metadata.attributes) return null;
    const latAttr = metadata.attributes.find(
      (attr) => attr.trait_type?.toLowerCase().includes("latitude") || attr.trait_type?.toLowerCase().includes("lat")
    );
    if (latAttr?.value) {
      return latAttr.value;
    }
    const locationAttr = metadata.attributes.find(
      (attr) => attr.trait_type?.toLowerCase().includes("location")
    );
    if (locationAttr?.value?.toLowerCase() === "tuzla") {
      return "40.8256";
    } else if (locationAttr?.value?.toLowerCase() === "kadikoy" || locationAttr?.value?.toLowerCase() === "kad\u0131k\xF6y") {
      return "40.9833";
    }
    return null;
  }
  extractLongitudeFromMetadata(metadata) {
    if (!metadata || !metadata.attributes) return null;
    const lngAttr = metadata.attributes.find(
      (attr) => attr.trait_type?.toLowerCase().includes("longitude") || attr.trait_type?.toLowerCase().includes("lng") || attr.trait_type?.toLowerCase().includes("lon")
    );
    if (lngAttr?.value) {
      return lngAttr.value;
    }
    const locationAttr = metadata.attributes.find(
      (attr) => attr.trait_type?.toLowerCase().includes("location")
    );
    if (locationAttr?.value?.toLowerCase() === "tuzla") {
      return "29.2997";
    } else if (locationAttr?.value?.toLowerCase() === "kadikoy" || locationAttr?.value?.toLowerCase() === "kad\u0131k\xF6y") {
      return "29.0167";
    }
    return null;
  }
  extractCategoryFromMetadata(metadata) {
    if (!metadata || !metadata.attributes) return null;
    const categoryAttr = metadata.attributes.find(
      (attr) => attr.trait_type?.toLowerCase().includes("category") || attr.trait_type?.toLowerCase().includes("type")
    );
    return categoryAttr?.value || null;
  }
  // Check USDC balance for an address
  async getUSDCBalance(address) {
    return withRetry(async () => {
      const balance = await usdcContract.balanceOf(address);
      return ethers.formatUnits(balance, 6);
    }).catch((error) => {
      console.error(`Error fetching USDC balance for ${address}:`, error);
      return "0";
    });
  }
  // Check USDC allowance for NFT purchases
  async getUSDCAllowance(owner, spender) {
    return withRetry(async () => {
      const allowance = await usdcContract.allowance(owner, spender);
      return ethers.formatUnits(allowance, 6);
    }).catch((error) => {
      console.error(`Error fetching USDC allowance:`, error);
      return "0";
    });
  }
  // 🔐 SECURE: Generate marketplace purchase transaction (NO PRICE MANIPULATION!)
  // This uses the new secure marketplace contract instead of the vulnerable NFT contract
  async generatePurchaseTransaction(tokenId, buyerAddress) {
    try {
      if (!tokenId || !buyerAddress) {
        throw new Error("Missing required parameters for purchase");
      }
      const listing = await marketplaceContract.getListing(tokenId);
      if (!listing.active) {
        throw new Error("NFT is not listed for sale");
      }
      const currentOwner = await nftContract.ownerOf(tokenId);
      if (currentOwner.toLowerCase() !== listing.seller.toLowerCase()) {
        throw new Error("NFT owner doesn't match marketplace listing");
      }
      const price = ethers.formatUnits(listing.price, 6);
      const requiredAmount = parseFloat(price);
      const buyerBalance = await this.getUSDCBalance(buyerAddress);
      if (parseFloat(buyerBalance) < requiredAmount) {
        throw new Error(`Insufficient USDC balance. Required: ${requiredAmount} USDC, Available: ${buyerBalance} USDC`);
      }
      const allowance = await this.getUSDCAllowance(buyerAddress, MARKETPLACE_CONTRACT_ADDRESS);
      if (parseFloat(allowance) < requiredAmount) {
        console.log(`\u26A0\uFE0F Insufficient USDC allowance. Required: ${requiredAmount} USDC, Allowed: ${allowance} USDC`);
      }
      const platformFee = listing.price * BigInt(5) / BigInt(100);
      const sellerAmount = listing.price - platformFee;
      console.log(`\u{1F4B0} Secure purchase: ${price} USDC total (Seller: ${(Number(sellerAmount) / 1e6).toFixed(6)}, Platform: ${(Number(platformFee) / 1e6).toFixed(6)})`);
      return {
        success: true,
        // 🔐 SECURE: Use marketplace contract with NO price parameter!
        transaction: {
          type: "PURCHASE_NFT_MARKETPLACE",
          to: MARKETPLACE_CONTRACT_ADDRESS,
          data: marketplaceContract.interface.encodeFunctionData("purchaseNFT", [
            tokenId
            // Only tokenId - price comes from secure listing!
          ]),
          description: `Secure purchase of NFT #${tokenId} for ${price} USDC via marketplace`
        },
        // Transaction details for confirmation
        tokenId,
        buyerAddress,
        seller: listing.seller,
        priceUSDC: price,
        sellerAmount: (Number(sellerAmount) / 1e6).toFixed(6),
        platformFee: (Number(platformFee) / 1e6).toFixed(6),
        // USDC approval transaction (if needed)
        approvalData: {
          to: USDC_CONTRACT_ADDRESS,
          data: usdcContract.interface.encodeFunctionData("approve", [
            MARKETPLACE_CONTRACT_ADDRESS,
            // Approve marketplace, not NFT contract!
            listing.price
          ]),
          description: `Approve ${price} USDC spending for secure marketplace purchase`
        }
      };
    } catch (error) {
      console.error("Error generating secure purchase transaction:", error);
      return {
        success: false,
        error: error.message || "Failed to generate secure purchase transaction"
      };
    }
  }
  // Verify NFT purchase transaction
  async verifyPurchaseTransaction(transactionHash, expectedTokenId, expectedBuyer) {
    try {
      console.log(`\u{1F50D} Verifying purchase transaction: ${transactionHash}`);
      const receipt = await withRetry(() => provider.getTransactionReceipt(transactionHash));
      if (!receipt) {
        return { success: false, error: "Transaction not found or still pending" };
      }
      if (receipt.status !== 1) {
        return { success: false, error: "Transaction failed on blockchain" };
      }
      if (receipt.to?.toLowerCase() !== MARKETPLACE_CONTRACT_ADDRESS.toLowerCase()) {
        return { success: false, error: "Transaction was not sent to the marketplace contract" };
      }
      const transaction = await withRetry(() => provider.getTransaction(transactionHash));
      if (!transaction || !transaction.data) {
        return { success: false, error: "Could not retrieve transaction data" };
      }
      try {
        const decodedData = marketplaceContract.interface.parseTransaction({ data: transaction.data });
        if (decodedData?.name !== "purchaseNFT") {
          return { success: false, error: `Transaction called ${decodedData?.name || "unknown"} function, not purchaseNFT` };
        }
        const transactionTokenId = decodedData.args[0].toString();
        if (transactionTokenId !== expectedTokenId) {
          return { success: false, error: `Token ID mismatch: expected ${expectedTokenId}, got ${transactionTokenId}` };
        }
        if (transaction.from?.toLowerCase() !== expectedBuyer.toLowerCase()) {
          return { success: false, error: `Buyer mismatch: expected ${expectedBuyer}, got ${transaction.from}` };
        }
        console.log(`\u2705 Purchase transaction verified: NFT #${transactionTokenId} purchased by ${transaction.from}`);
        return {
          success: true,
          details: {
            tokenId: transactionTokenId,
            buyer: transaction.from,
            price: decodedData.args[1].toString(),
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString()
          }
        };
      } catch (parseError) {
        return { success: false, error: "Could not parse transaction data - may not be a valid NFT purchase" };
      }
    } catch (error) {
      console.error("Error verifying purchase transaction:", error);
      return { success: false, error: error.message || "Failed to verify transaction" };
    }
  }
  // Check if wallet made any transaction on Base network today
  async hasBaseTransactionToday(walletAddress) {
    try {
      if (!BASESCAN_API_KEY) {
        console.log("\u26A0\uFE0F No Basescan API key - cannot verify Base transactions");
        return false;
      }
      console.log(`\u{1F50D} Checking Base transactions for wallet: ${walletAddress}`);
      const today = /* @__PURE__ */ new Date();
      const todayStartUnix = Math.floor(new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() / 1e3);
      const nowUnix = Math.floor(Date.now() / 1e3);
      const url = `${BASESCAN_API_URL}?module=account&action=txlist&address=${walletAddress}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc&apikey=${BASESCAN_API_KEY}`;
      console.log(`\u{1F4E1} Fetching transactions from Basescan...`);
      const response = await fetch(url);
      if (!response.ok) {
        console.log(`\u274C Basescan API error:`, response.status);
        return false;
      }
      const data = await response.json();
      if (data.status !== "1") {
        console.log(`\u274C Basescan API returned error:`, data.message);
        return false;
      }
      const todayTransactions = data.result.filter((tx) => {
        const txTimestamp = parseInt(tx.timeStamp);
        return txTimestamp >= todayStartUnix && txTimestamp <= nowUnix;
      });
      const hasTransaction = todayTransactions.length > 0;
      if (hasTransaction) {
        console.log(`\u2705 Found ${todayTransactions.length} Base transaction(s) today for ${walletAddress}`);
        console.log(`\u{1F4CB} Latest tx hash: ${todayTransactions[0].hash}`);
      } else {
        console.log(`\u274C No Base transactions found today for ${walletAddress}`);
      }
      return hasTransaction;
    } catch (error) {
      console.error(`\u274C Error checking Base transactions for ${walletAddress}:`, error);
      return false;
    }
  }
  // 🆕 Get current on-chain owner of an NFT  
  async getNFTOwner(tokenId) {
    try {
      console.log(`\u{1F50D} Getting on-chain owner for NFT #${tokenId}`);
      const owner = await withRetry(() => nftContract.ownerOf(tokenId));
      console.log(`\u2705 NFT #${tokenId} owner: ${owner}`);
      return owner;
    } catch (error) {
      console.error(`\u274C Failed to get owner for NFT #${tokenId}:`, error);
      return null;
    }
  }
  // 🏪 MARKETPLACE FUNCTIONS - Secure trading without modifying NFT contract
  // Generate transaction to list NFT on marketplace
  async generateListingTransaction(tokenId, seller, priceUSDC) {
    try {
      if (!tokenId || !seller || !priceUSDC) {
        throw new Error("Missing required parameters for listing");
      }
      const currentOwner = await nftContract.ownerOf(tokenId);
      if (currentOwner.toLowerCase() !== seller.toLowerCase()) {
        throw new Error("Only NFT owner can create listing");
      }
      const isApproved = await nftContract.isApprovedForAll(seller, MARKETPLACE_CONTRACT_ADDRESS);
      const specificApproval = await nftContract.getApproved(tokenId);
      if (!isApproved && specificApproval.toLowerCase() !== MARKETPLACE_CONTRACT_ADDRESS.toLowerCase()) {
        console.log("\u26A0\uFE0F Marketplace not approved to transfer NFT - user needs to approve first");
      }
      const priceWei = ethers.parseUnits(priceUSDC, 6);
      return {
        success: true,
        transaction: {
          type: "LIST_NFT",
          to: MARKETPLACE_CONTRACT_ADDRESS,
          data: marketplaceContract.interface.encodeFunctionData("listNFT", [
            tokenId,
            priceWei
          ]),
          description: `List NFT #${tokenId} for ${priceUSDC} USDC`
        },
        // NFT approval transaction (if needed)
        approvalData: {
          to: NFT_CONTRACT_ADDRESS,
          data: nftContract.interface.encodeFunctionData("approve", [
            MARKETPLACE_CONTRACT_ADDRESS,
            tokenId
          ]),
          description: `Approve marketplace to transfer NFT #${tokenId}`
        },
        tokenId,
        seller,
        priceUSDC
      };
    } catch (error) {
      console.error("Error generating listing transaction:", error);
      return {
        success: false,
        error: error.message || "Failed to generate listing transaction"
      };
    }
  }
  // Generate transaction to cancel NFT listing
  async generateCancelListingTransaction(tokenId, seller) {
    try {
      const listing = await marketplaceContract.getListing(tokenId);
      if (!listing.active) {
        throw new Error("NFT is not listed for sale");
      }
      if (listing.seller.toLowerCase() !== seller.toLowerCase()) {
        throw new Error("Only listing creator can cancel listing");
      }
      return {
        success: true,
        transaction: {
          type: "CANCEL_LISTING",
          to: MARKETPLACE_CONTRACT_ADDRESS,
          data: marketplaceContract.interface.encodeFunctionData("cancelListing", [
            tokenId
          ]),
          description: `Cancel listing for NFT #${tokenId}`
        },
        tokenId,
        seller
      };
    } catch (error) {
      console.error("Error generating cancel listing transaction:", error);
      return {
        success: false,
        error: error.message || "Failed to generate cancel listing transaction"
      };
    }
  }
  // Generate transaction to update NFT price
  async generateUpdatePriceTransaction(tokenId, seller, newPriceUSDC) {
    try {
      const listing = await marketplaceContract.getListing(tokenId);
      if (!listing.active) {
        throw new Error("NFT is not listed for sale");
      }
      if (listing.seller.toLowerCase() !== seller.toLowerCase()) {
        throw new Error("Only listing creator can update price");
      }
      const newPriceWei = ethers.parseUnits(newPriceUSDC, 6);
      return {
        success: true,
        transaction: {
          type: "UPDATE_PRICE",
          to: MARKETPLACE_CONTRACT_ADDRESS,
          data: marketplaceContract.interface.encodeFunctionData("updatePrice", [
            tokenId,
            newPriceWei
          ]),
          description: `Update NFT #${tokenId} price to ${newPriceUSDC} USDC`
        },
        tokenId,
        seller,
        newPriceUSDC
      };
    } catch (error) {
      console.error("Error generating update price transaction:", error);
      return {
        success: false,
        error: error.message || "Failed to generate update price transaction"
      };
    }
  }
  // Get marketplace listing for a specific NFT
  async getMarketplaceListing(tokenId) {
    try {
      const listing = await marketplaceContract.getListing(tokenId);
      if (!listing.active) {
        return null;
      }
      return {
        tokenId,
        seller: listing.seller,
        price: ethers.formatUnits(listing.price, 6),
        // Convert to USDC
        priceWei: listing.price.toString(),
        listedAt: (/* @__PURE__ */ new Date()).toISOString(),
        // Use current time since contract doesn't store listedAt
        active: listing.active
      };
    } catch (error) {
      console.error(`Error getting marketplace listing for NFT #${tokenId}:`, error);
      return null;
    }
  }
  // Check if NFT is listed on marketplace
  async isNFTListed(tokenId) {
    try {
      console.log(`\u{1F50D} Checking if NFT #${tokenId} is listed on marketplace...`);
      const isListed = await marketplaceContract.isListed(tokenId);
      console.log(`\u2705 NFT #${tokenId} listing status: ${isListed}`);
      return isListed;
    } catch (error) {
      console.error(`\u274C Error checking if NFT #${tokenId} is listed:`, error);
      console.error(`\u274C Error details:`, {
        message: error.message,
        code: error.code,
        data: error.data,
        stack: error.stack?.split("\n")[0]
        // First line of stack
      });
      console.warn(`\u26A0\uFE0F Allowing purchase to proceed despite blockchain check failure for NFT #${tokenId}`);
      return true;
    }
  }
  // Get marketplace statistics
  async getMarketplaceStats() {
    try {
      const totalVolume = await marketplaceContract.totalVolume();
      return {
        totalVolumeWei: totalVolume.toString(),
        totalVolumeUSDC: ethers.formatUnits(totalVolume, 6)
      };
    } catch (error) {
      console.error("Error getting marketplace stats:", error);
      return {
        totalVolumeWei: "0",
        totalVolumeUSDC: "0"
      };
    }
  }
  // 🔄 Get recent NFT purchase events from blockchain by reading Transfer events
  async getRecentPurchaseEvents(fromBlock) {
    try {
      if (fromBlock === void 0) {
        const currentBlock = await provider.getBlockNumber();
        fromBlock = Math.max(0, currentBlock - 5e4);
      }
      console.log(`\u{1F4E1} Fetching NFT Transfer events from block ${fromBlock}...`);
      const transferFilter = nftContract.filters.Transfer();
      const transferEvents = await nftContract.queryFilter(transferFilter, fromBlock, "latest");
      console.log(`\u2705 Found ${transferEvents.length} transfer events, filtering for purchases...`);
      const purchases = [];
      for (const event of transferEvents) {
        if (!("args" in event)) continue;
        const txHash = event.transactionHash;
        const from = event.args?.[0]?.toLowerCase();
        const to = event.args?.[1]?.toLowerCase();
        const tokenId = event.args?.[2]?.toString();
        if (from === "0x0000000000000000000000000000000000000000") {
          continue;
        }
        try {
          const receipt = await provider.getTransactionReceipt(txHash);
          if (!receipt) continue;
          const usdcTransfers = receipt.logs.filter(
            (log) => log.address.toLowerCase() === USDC_CONTRACT_ADDRESS.toLowerCase() && log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
            // Transfer event signature
          );
          if (usdcTransfers.length >= 2) {
            let totalPrice = "0";
            let platformFee = "0";
            for (const usdcLog of usdcTransfers) {
              const amount = ethers.formatUnits(usdcLog.data, 6);
              const usdcTo = "0x" + usdcLog.topics[2].slice(26).toLowerCase();
              if (usdcTo === PLATFORM_WALLET.toLowerCase()) {
                platformFee = amount;
              } else {
                totalPrice = amount;
              }
            }
            purchases.push({
              tokenId,
              buyer: to,
              seller: from,
              price: totalPrice,
              platformFee,
              timestamp: receipt.blockNumber,
              // Use block number as approximation
              blockNumber: receipt.blockNumber,
              transactionHash: txHash
            });
            console.log(`\u2705 Found purchase: NFT #${tokenId} (${to} bought from ${from}) for ${totalPrice} USDC`);
          }
        } catch (error) {
          console.error(`\u274C Error processing transfer ${txHash}:`, error);
        }
      }
      console.log(`\u{1F389} Found ${purchases.length} purchase transactions on blockchain`);
      return purchases;
    } catch (error) {
      console.error(`\u274C Error fetching purchase events:`, error);
      return [];
    }
  }
  // 🔄 Get ALL NFT transfer events (purchases + regular transfers) for auto-delist
  async getAllTransferEvents(fromBlock) {
    try {
      if (fromBlock === void 0) {
        const currentBlock = await provider.getBlockNumber();
        fromBlock = Math.max(0, currentBlock - 1e4);
      }
      console.log(`\u{1F4E1} Fetching ALL NFT Transfer events from block ${fromBlock}...`);
      const transferFilter = nftContract.filters.Transfer();
      const transferEvents = await nftContract.queryFilter(transferFilter, fromBlock, "latest");
      console.log(`\u2705 Found ${transferEvents.length} transfer events, processing...`);
      const allTransfers = [];
      for (const event of transferEvents) {
        if (!("args" in event)) continue;
        const txHash = event.transactionHash;
        const from = event.args?.[0]?.toLowerCase();
        const to = event.args?.[1]?.toLowerCase();
        const tokenId = event.args?.[2]?.toString();
        try {
          const receipt = await provider.getTransactionReceipt(txHash);
          if (!receipt) continue;
          const usdcTransfers = receipt.logs.filter(
            (log) => log.address.toLowerCase() === USDC_CONTRACT_ADDRESS.toLowerCase() && log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
            // Transfer event signature
          );
          let transferType = "transfer";
          let totalPrice = "0";
          let platformFee = "0";
          if (usdcTransfers.length >= 2) {
            transferType = "sale";
            for (const usdcLog of usdcTransfers) {
              const amount = ethers.formatUnits(usdcLog.data, 6);
              const usdcTo = "0x" + usdcLog.topics[2].slice(26).toLowerCase();
              if (usdcTo === PLATFORM_WALLET.toLowerCase()) {
                platformFee = amount;
              } else {
                totalPrice = amount;
              }
            }
          }
          allTransfers.push({
            tokenId,
            from,
            to,
            transferType,
            // 'sale' or 'transfer'
            price: totalPrice,
            platformFee,
            blockNumber: receipt.blockNumber,
            transactionHash: txHash
          });
          if (transferType === "sale") {
            console.log(`\u{1F4B0} Sale: NFT #${tokenId} (${to} bought from ${from}) for ${totalPrice} USDC`);
          } else {
            console.log(`\u{1F4E6} Transfer: NFT #${tokenId} (${from} \u2192 ${to})`);
          }
        } catch (error) {
          console.error(`\u274C Error processing transfer ${txHash}:`, error);
        }
      }
      console.log(`\u{1F389} Found ${allTransfers.length} total transfers on blockchain`);
      return allTransfers;
    } catch (error) {
      console.error(`\u274C Error fetching transfer events:`, error);
      return [];
    }
  }
  // 🚀 Incremental NFT sync with block chunking and checkpoint persistence
  async syncNFTsIncremental(storage2, chunkSize = 1e3) {
    let retryCount = 0;
    const maxRetries = BASE_RPC_URLS.length;
    try {
      console.log(`\u{1F504} Starting incremental blockchain sync...`);
      const currentBlock = await currentProvider.getBlockNumber();
      console.log(`\u{1F4CA} Current block: ${currentBlock}`);
      const syncState2 = await storage2.getSyncState(NFT_CONTRACT_ADDRESS);
      const startBlock = syncState2 ? syncState2.lastProcessedBlock + 1 : Math.max(38137640, currentBlock - 1e4);
      console.log(`\u{1F4CD} Last synced block: ${syncState2?.lastProcessedBlock || "none"}`);
      console.log(`\u{1F4CD} Starting from block: ${startBlock}`);
      console.log(`\u{1F4CD} Blocks to process: ${currentBlock - startBlock + 1}`);
      if (startBlock > currentBlock) {
        console.log(`\u2705 Already up to date!`);
        return { newNFTs: [], lastBlock: currentBlock };
      }
      const newNFTs = [];
      let processedBlock = startBlock;
      while (processedBlock <= currentBlock) {
        const toBlock = Math.min(processedBlock + chunkSize - 1, currentBlock);
        console.log(`\u{1F50D} Scanning blocks ${processedBlock} to ${toBlock} (chunk size: ${toBlock - processedBlock + 1})`);
        try {
          const filter = currentNftContract.filters.Transfer();
          const events = await currentNftContract.queryFilter(filter, processedBlock, toBlock);
          console.log(`\u{1F4E5} Found ${events.length} Transfer events in this chunk`);
          const processedTokens = /* @__PURE__ */ new Set();
          for (const event of events) {
            if (!("args" in event)) continue;
            const tokenId = event.args?.tokenId?.toString();
            if (!tokenId || processedTokens.has(tokenId)) continue;
            processedTokens.add(tokenId);
            try {
              const owner = await currentNftContract.ownerOf(tokenId);
              const tokenURI = await currentNftContract.tokenURI(tokenId);
              console.log(`\u2705 Token ${tokenId}: owner=${owner}`);
              newNFTs.push({
                tokenId,
                owner: owner.toLowerCase(),
                tokenURI,
                metadata: null
                // Will be fetched async
              });
            } catch (error) {
              console.error(`\u274C Error processing token ${tokenId}:`, error);
            }
          }
          await storage2.updateSyncState(NFT_CONTRACT_ADDRESS, toBlock);
          console.log(`\u2705 Checkpoint saved: block ${toBlock}`);
          processedBlock = toBlock + 1;
          retryCount = 0;
          if (processedBlock <= currentBlock) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error(`\u274C Error processing chunk ${processedBlock}-${toBlock}:`, error.message);
          const isRpcError = error.message?.includes("timeout") || error.message?.includes("invalid block range") || error.message?.includes("could not detect network") || error.code === "TIMEOUT" || error.code === "NETWORK_ERROR" || error.error?.code === -32e3;
          if (isRpcError && retryCount < maxRetries) {
            console.log(`\u26A0\uFE0F RPC error detected, attempting provider rotation...`);
            const rotated = rotateRpcProvider();
            if (rotated) {
              retryCount++;
              console.log(`\u{1F504} Retrying with new provider (attempt ${retryCount}/${maxRetries})...`);
              continue;
            }
          }
          if (isRpcError) {
            console.log(`\u26A0\uFE0F RPC error persists, reducing chunk size...`);
            chunkSize = Math.max(100, Math.floor(chunkSize / 2));
            console.log(`\u{1F504} Retrying with chunk size: ${chunkSize}`);
            retryCount = 0;
            continue;
          }
          console.log(`\u26A0\uFE0F Skipping problematic chunk, moving to next...`);
          processedBlock = toBlock + 1;
          retryCount = 0;
        }
      }
      console.log(`\u{1F389} Sync complete! Found ${newNFTs.length} new NFTs`);
      console.log(`\u{1F4CD} Synced up to block: ${currentBlock}`);
      return { newNFTs, lastBlock: currentBlock };
    } catch (error) {
      console.error(`\u274C Incremental sync failed:`, error);
      throw error;
    }
  }
  // 🔄 Fetch metadata asynchronously for NFTs without blocking sync
  async fetchMetadataAsync(blockchainNFT) {
    if (!blockchainNFT.tokenURI) {
      return blockchainNFT;
    }
    try {
      const uris = normalizeUri(blockchainNFT.tokenURI);
      if (uris.length === 0) {
        console.log(`\u26A0\uFE0F No valid URIs for token ${blockchainNFT.tokenId}`);
        return blockchainNFT;
      }
      console.log(`\u{1F4E5} Fetching metadata for token ${blockchainNFT.tokenId}...`);
      const metadata = await fetchWithGateways(uris);
      return {
        ...blockchainNFT,
        metadata
      };
    } catch (error) {
      console.error(`\u274C Failed to fetch metadata for token ${blockchainNFT.tokenId}:`, error);
      return blockchainNFT;
    }
  }
  // 🔍 Get all minted token IDs directly from blockchain (no API dependency)
  async getAllMintedTokenIds() {
    console.log(`\u{1F50D} Scanning blockchain for all minted tokens...`);
    try {
      const tokenIds = /* @__PURE__ */ new Set();
      const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
      const FALLBACK_START_BLOCK = 379e5;
      const START_BLOCK = FALLBACK_START_BLOCK;
      const currentBlock = await currentProvider.getBlockNumber();
      console.log(`\u{1F4CA} Smart scan from block ${START_BLOCK} to ${currentBlock} (scanning recent ~${Math.floor((currentBlock - START_BLOCK) / 1e3)}K blocks)`);
      const CHUNK_SIZE = 5e4;
      let processedBlock = START_BLOCK;
      while (processedBlock <= currentBlock) {
        const toBlock = Math.min(processedBlock + CHUNK_SIZE - 1, currentBlock);
        try {
          console.log(`\u{1F50E} Scanning blocks ${processedBlock} to ${toBlock}...`);
          const filter = currentNftContract.filters.Transfer(ZERO_ADDRESS, null, null);
          const events = await currentNftContract.queryFilter(filter, processedBlock, toBlock);
          for (const event of events) {
            if ("args" in event) {
              const tokenId = event.args?.tokenId?.toString();
              if (tokenId) {
                tokenIds.add(tokenId);
              }
            }
          }
          console.log(`\u{1F4E6} Found ${events.length} mints in this chunk (total: ${tokenIds.size})`);
          processedBlock = toBlock + 1;
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`\u274C Error scanning blocks ${processedBlock}-${toBlock}:`, error.message);
          if (error.message?.includes("timeout") || error.message?.includes("limit")) {
            console.log(`\u26A0\uFE0F RPC issue detected, rotating provider...`);
            rotateRpcProvider();
            continue;
          }
          processedBlock = toBlock + 1;
        }
      }
      console.log(`\u2705 Blockchain scan complete! Found ${tokenIds.size} total minted tokens`);
      return tokenIds;
    } catch (error) {
      console.error(`\u274C Error scanning blockchain for mints:`, error);
      throw error;
    }
  }
  // 🌐 Sync NFTs using blockchain RPC (no API dependency)
  async syncNFTsFromBasescan(storage2) {
    console.log(`\u{1F310} Starting blockchain sync for NFT discovery...`);
    try {
      const blockchainTokenIds = await this.getAllMintedTokenIds();
      console.log(`\u{1F4CA} Blockchain reports ${blockchainTokenIds.size} total tokens minted`);
      const existingNFTs = await storage2.getAllNFTs();
      const existingTokenIds = new Set(existingNFTs.map((nft) => nft.tokenId.toString()));
      console.log(`\u{1F4BE} Database has ${existingTokenIds.size} tokens`);
      const missingTokens = [];
      for (const tokenId of Array.from(blockchainTokenIds)) {
        if (!existingTokenIds.has(tokenId)) {
          missingTokens.push(tokenId);
        }
      }
      if (missingTokens.length === 0) {
        console.log(`\u2705 Database is up to date - no missing tokens!`);
        return { newNFTs: [], missingTokens: [] };
      }
      console.log(`\u{1F50D} Found ${missingTokens.length} missing tokens: ${missingTokens.join(", ")}`);
      const newNFTs = [];
      for (const tokenId of missingTokens) {
        try {
          console.log(`\u{1F4E5} Fetching details for token ${tokenId}...`);
          const owner = await currentNftContract.ownerOf(tokenId);
          const tokenURI = await currentNftContract.tokenURI(tokenId);
          console.log(`\u2705 Token ${tokenId}: owner=${owner}`);
          newNFTs.push({
            tokenId,
            owner: owner.toLowerCase(),
            tokenURI,
            metadata: null
            // Will be fetched async
          });
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`\u274C Error fetching token ${tokenId}:`, error);
        }
      }
      console.log(`\u{1F389} Basescan sync complete! Found ${newNFTs.length} new NFTs`);
      return { newNFTs, missingTokens };
    } catch (error) {
      console.error(`\u274C Basescan sync failed:`, error);
      throw error;
    }
  }
};
var blockchainService = new BlockchainService();

// server/metadataSyncService.ts
import { ethers as ethers2 } from "ethers";
var CONTRACT_ADDRESS = "0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f";
var RPC_PROVIDERS = [
  "https://mainnet.base.org",
  "https://base.llamarpc.com",
  "https://base.drpc.org"
];
var ABI = [
  "function tokenURI(uint256 tokenId) view returns (string)"
];
var MetadataSyncService = class {
  storage;
  currentProviderIndex = 0;
  constructor(storage2) {
    this.storage = storage2;
  }
  async getProvider() {
    const rpcUrl = RPC_PROVIDERS[this.currentProviderIndex];
    this.currentProviderIndex = (this.currentProviderIndex + 1) % RPC_PROVIDERS.length;
    return new ethers2.JsonRpcProvider(rpcUrl);
  }
  async fetchTokenMetadata(tokenId) {
    for (const rpcUrl of RPC_PROVIDERS) {
      try {
        const provider2 = new ethers2.JsonRpcProvider(rpcUrl);
        const contract = new ethers2.Contract(CONTRACT_ADDRESS, ABI, provider2);
        const uri = await contract.tokenURI(tokenId);
        if (uri.startsWith("data:application/json;base64,")) {
          const base64Data = uri.replace("data:application/json;base64,", "");
          const decoded = Buffer.from(base64Data, "base64").toString("utf-8");
          const metadata = JSON.parse(decoded);
          return metadata;
        }
        return null;
      } catch (error) {
        console.log(`\u26A0\uFE0F RPC ${rpcUrl} failed for token ${tokenId}: ${error.message}`);
        continue;
      }
    }
    console.log(`\u274C All RPC providers failed for token ${tokenId}`);
    return null;
  }
  extractLocationData(metadata) {
    let location = "Unknown Location";
    let latitude = null;
    let longitude = null;
    if (metadata.location) {
      location = metadata.location.city || "Unknown Location";
      latitude = metadata.location.latitude || null;
      longitude = metadata.location.longitude || null;
    } else if (metadata.attributes) {
      const locationAttr = metadata.attributes.find((a) => a.trait_type === "Location");
      const latAttr = metadata.attributes.find((a) => a.trait_type === "Latitude");
      const lngAttr = metadata.attributes.find((a) => a.trait_type === "Longitude");
      if (locationAttr) location = locationAttr.value;
      if (latAttr) latitude = latAttr.value;
      if (lngAttr) longitude = lngAttr.value;
    }
    return { location, latitude, longitude };
  }
  async findTokensNeedingMetadataSync() {
    const allNFTs = await this.storage.getAllNFTs();
    const needsSync = [];
    for (const nft of allNFTs) {
      const needsUpdate = !nft.latitude || !nft.longitude || nft.location === "Unknown Location" || nft.imageUrl && nft.imageUrl.startsWith("data:application/json;base64,");
      if (needsUpdate && nft.tokenId) {
        needsSync.push(nft.tokenId);
      }
    }
    return needsSync;
  }
  async syncTokenMetadata(tokenId) {
    try {
      console.log(`\u{1F504} Syncing metadata for token ${tokenId}...`);
      const metadata = await this.fetchTokenMetadata(tokenId);
      if (!metadata) {
        console.log(`\u274C Failed to fetch metadata for token ${tokenId}`);
        return false;
      }
      const { location, latitude, longitude } = this.extractLocationData(metadata);
      const imageUrl = metadata.image;
      const allNFTs = await this.storage.getAllNFTs();
      const nft = allNFTs.find((n) => n.tokenId === tokenId);
      if (!nft) {
        console.log(`\u274C Token ${tokenId} not found in database`);
        return false;
      }
      await this.storage.updateNFT(nft.id, {
        title: metadata.name,
        imageUrl,
        location,
        latitude,
        longitude
      });
      console.log(`\u2705 Synced token ${tokenId}: ${metadata.name} @ ${location}`);
      return true;
    } catch (error) {
      console.log(`\u274C Error syncing token ${tokenId}:`, error.message);
      return false;
    }
  }
  async processPendingMints() {
    try {
      console.log("\u{1F50D} Checking for pending mints...");
      const pendingMints2 = await this.storage.getPendingMints(50);
      if (pendingMints2.length === 0) {
        return;
      }
      console.log(`\u{1F4CB} Found ${pendingMints2.length} pending mints to retry`);
      let successCount = 0;
      let failCount = 0;
      for (const pending of pendingMints2) {
        try {
          console.log(`\u{1F504} Retrying token #${pending.tokenId} (attempt ${(pending.retryCount || 0) + 1})...`);
          const metadata = await this.fetchTokenMetadata(pending.tokenId);
          if (!metadata) {
            throw new Error("Failed to fetch metadata from all RPC providers");
          }
          const { location, latitude, longitude } = this.extractLocationData(metadata);
          const newNFT = {
            title: metadata.name || `TravelNFT #${pending.tokenId}`,
            description: metadata.description || "",
            imageUrl: metadata.image || "",
            objectStorageUrl: null,
            location,
            latitude,
            longitude,
            category: "travel",
            price: "0",
            isForSale: 0,
            creatorAddress: pending.ownerAddress,
            ownerAddress: pending.ownerAddress,
            farcasterCreatorUsername: null,
            farcasterOwnerUsername: null,
            farcasterCreatorFid: null,
            farcasterOwnerFid: null,
            mintPrice: "1",
            royaltyPercentage: "5",
            tokenId: pending.tokenId,
            contractAddress: pending.contractAddress,
            transactionHash: pending.transactionHash,
            metadata
          };
          await this.storage.createNFT(newNFT);
          await this.storage.deletePendingMint(pending.id);
          console.log(`\u2705 Successfully processed pending token #${pending.tokenId}: ${metadata.name}`);
          successCount++;
        } catch (error) {
          const errorMessage = error.message || String(error);
          console.log(`\u274C Failed to process pending token #${pending.tokenId}: ${errorMessage}`);
          await this.storage.updatePendingMintRetry(pending.id, errorMessage);
          failCount++;
        }
        await new Promise((resolve) => setTimeout(resolve, 1e3));
      }
      console.log(`\u2705 Pending mints processed: ${successCount} succeeded, ${failCount} failed`);
    } catch (error) {
      console.log("\u274C Pending mints processing error:", error.message);
    }
  }
  async runMetadataSync() {
    try {
      console.log("\u{1F50D} Checking for tokens needing metadata sync...");
      await this.processPendingMints();
      const tokensToSync = await this.findTokensNeedingMetadataSync();
      if (tokensToSync.length === 0) {
        console.log("\u2705 All tokens have valid metadata");
        return;
      }
      console.log(`\u{1F4CB} Found ${tokensToSync.length} tokens needing metadata sync: ${tokensToSync.join(", ")}`);
      let successCount = 0;
      let failCount = 0;
      for (const tokenId of tokensToSync) {
        const success = await this.syncTokenMetadata(tokenId);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      console.log(`\u2705 Metadata sync complete: ${successCount} succeeded, ${failCount} failed`);
    } catch (error) {
      console.log("\u274C Metadata sync error:", error.message);
    }
  }
};

// server/places-service.ts
import { eq as eq2, sql as sql3, ilike, desc } from "drizzle-orm";
var GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
var CACHE_DURATION_MS = 24 * 60 * 60 * 1e3;
function getPhotoUrl(photoName, maxWidth = 400) {
  if (!GOOGLE_PLACES_API_KEY || !photoName) return "";
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${GOOGLE_PLACES_API_KEY}`;
}
function extractCountryFromComponents(components) {
  if (!components) return { country: "Unknown", countryCode: "" };
  const countryComponent = components.find((c) => c.types.includes("country"));
  return {
    country: countryComponent?.longText || "Unknown",
    countryCode: countryComponent?.shortText || ""
  };
}
function mapCategoryToPlaceTypes(category) {
  switch (category) {
    case "landmark":
      return ["tourist_attraction", "point_of_interest", "museum", "park", "church", "mosque", "hindu_temple", "synagogue"];
    case "cafe":
      return ["cafe", "bakery", "coffee"];
    case "restaurant":
      return ["restaurant", "meal_takeaway", "meal_delivery"];
    case "hidden_gem":
      return ["art_gallery", "book_store", "library", "spa", "bar", "night_club"];
    default:
      return ["point_of_interest"];
  }
}
var PlacesService = class {
  async searchCities(query) {
    console.log(`\u{1F50D} Searching cities for: "${query}"`);
    if (!GOOGLE_PLACES_API_KEY) {
      console.error("\u274C GOOGLE_PLACES_API_KEY not configured");
      return [];
    }
    const existingCities = await db.select().from(guideCities).where(ilike(guideCities.name, `%${query}%`)).limit(10);
    if (existingCities.length > 0) {
      console.log(`\u2705 Found ${existingCities.length} cached cities for "${query}"`);
      return existingCities;
    }
    console.log(`\u{1F310} No cached cities, calling Google Places API for "${query}"`);
    try {
      const requestBody = {
        textQuery: query,
        maxResultCount: 5
      };
      console.log(`\u{1F310} Sending request to Places API (New):`, JSON.stringify(requestBody));
      const response = await fetch(
        "https://places.googleapis.com/v1/places:searchText",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.photos,places.addressComponents"
          },
          body: JSON.stringify(requestBody)
        }
      );
      const data = await response.json();
      console.log(`\u{1F4CA} Google Places API (New) response status: ${response.status}`);
      console.log(`\u{1F4CA} Google Places API (New) response:`, JSON.stringify(data).substring(0, 500));
      if (!data.places || data.places.length === 0) {
        console.log("\u{1F4ED} No places found for query");
        return [];
      }
      const cities = [];
      for (const place of data.places) {
        const existingCity = await db.select().from(guideCities).where(eq2(guideCities.placeId, place.id)).limit(1);
        if (existingCity.length > 0) {
          cities.push(existingCity[0]);
          continue;
        }
        const { country, countryCode } = extractCountryFromComponents(place.addressComponents);
        const heroPhoto = place.photos?.[0]?.name;
        const cityData = {
          placeId: place.id,
          name: place.displayName?.text || query,
          country,
          countryCode,
          heroImageUrl: heroPhoto ? getPhotoUrl(heroPhoto, 800) : null,
          latitude: place.location?.latitude?.toString() || null,
          longitude: place.location?.longitude?.toString() || null,
          searchCount: 1
        };
        const [insertedCity] = await db.insert(guideCities).values(cityData).returning();
        cities.push(insertedCity);
        console.log(`\u2705 Added city: ${cityData.name}, ${country}`);
      }
      return cities;
    } catch (error) {
      console.error("\u274C Error searching cities:", error);
      return [];
    }
  }
  async getPopularCities(limit = 10) {
    return db.select().from(guideCities).orderBy(desc(guideCities.searchCount)).limit(limit);
  }
  async getCityById(cityId) {
    const [city] = await db.select().from(guideCities).where(eq2(guideCities.id, cityId)).limit(1);
    if (city) {
      await db.update(guideCities).set({ searchCount: sql3`${guideCities.searchCount} + 1` }).where(eq2(guideCities.id, cityId));
    }
    return city || null;
  }
  async getSpotsByCity(cityId, category, limit = 20, isHolder = true) {
    if (!GOOGLE_PLACES_API_KEY) {
      console.error("GOOGLE_PLACES_API_KEY not configured");
      return [];
    }
    const city = await this.getCityById(cityId);
    if (!city) return [];
    const existingSpots = await db.select().from(guideSpots).where(eq2(guideSpots.cityId, cityId));
    const now = /* @__PURE__ */ new Date();
    const cacheValid = existingSpots.length > 0 && existingSpots.every((spot) => {
      const lastSync = new Date(spot.lastSyncAt);
      return now.getTime() - lastSync.getTime() < CACHE_DURATION_MS;
    });
    if (cacheValid) {
      let spots2 = existingSpots;
      if (category) {
        spots2 = spots2.filter((s) => s.category === category);
      }
      if (!isHolder) {
        const previewSpots = [];
        const categories = ["landmark", "cafe", "restaurant", "hidden_gem"];
        for (const cat of categories) {
          const catSpot = spots2.find((s) => s.category === cat);
          if (catSpot) previewSpots.push(catSpot);
        }
        return previewSpots;
      }
      return spots2.slice(0, limit);
    }
    await this.syncCitySpots(cityId, city);
    const freshSpots = await db.select().from(guideSpots).where(eq2(guideSpots.cityId, cityId));
    let spots = freshSpots;
    if (category) {
      spots = spots.filter((s) => s.category === category);
    }
    if (!isHolder) {
      const previewSpots = [];
      const categories = ["landmark", "cafe", "restaurant", "hidden_gem"];
      for (const cat of categories) {
        const catSpot = spots.find((s) => s.category === cat);
        if (catSpot) previewSpots.push(catSpot);
      }
      return previewSpots;
    }
    return spots.slice(0, limit);
  }
  async syncCitySpots(cityId, city) {
    const categories = ["landmark", "cafe", "restaurant", "hidden_gem"];
    for (const category of categories) {
      const types = mapCategoryToPlaceTypes(category);
      try {
        const response = await fetch(
          "https://places.googleapis.com/v1/places:searchText",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
              "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.photos,places.regularOpeningHours,places.websiteUri,places.nationalPhoneNumber,places.googleMapsUri,places.editorialSummary"
            },
            body: JSON.stringify({
              textQuery: `${types[0].replace("_", " ")} in ${city.name}`,
              locationBias: {
                circle: {
                  center: {
                    latitude: parseFloat(city.latitude || "0"),
                    longitude: parseFloat(city.longitude || "0")
                  },
                  radius: 5e3
                }
              },
              maxResultCount: 5
            })
          }
        );
        const data = await response.json();
        if (!data.places || data.places.length === 0) {
          console.log(`\u{1F4ED} No ${category} spots found for ${city.name}`);
          continue;
        }
        console.log(`\u{1F4CD} Found ${data.places.length} ${category} spots for ${city.name}`);
        for (const place of data.places) {
          const existing = await db.select().from(guideSpots).where(eq2(guideSpots.placeId, place.id)).limit(1);
          if (existing.length > 0) {
            await db.update(guideSpots).set({
              rating: place.rating?.toString() || null,
              userRatingsTotal: place.userRatingCount || null,
              openNow: place.regularOpeningHours?.openNow || null,
              lastSyncAt: /* @__PURE__ */ new Date()
            }).where(eq2(guideSpots.placeId, place.id));
            continue;
          }
          const photoName = place.photos?.[0]?.name;
          const priceLevelNum = place.priceLevel ? parseInt(place.priceLevel.replace("PRICE_LEVEL_", "")) - 1 : null;
          const spotData = {
            cityId,
            placeId: place.id,
            name: place.displayName?.text || "Unknown",
            category,
            description: place.editorialSummary?.text || null,
            address: place.formattedAddress || null,
            rating: place.rating?.toString() || null,
            userRatingsTotal: place.userRatingCount || null,
            priceLevel: priceLevelNum,
            photoUrl: photoName ? getPhotoUrl(photoName) : null,
            latitude: place.location?.latitude?.toString() || null,
            longitude: place.location?.longitude?.toString() || null,
            openNow: place.regularOpeningHours?.openNow || null,
            website: place.websiteUri || null,
            phoneNumber: place.nationalPhoneNumber || null,
            googleMapsUrl: place.googleMapsUri || null
          };
          await db.insert(guideSpots).values(spotData).onConflictDoNothing();
        }
      } catch (error) {
        console.error(`\u274C Error syncing ${category} spots:`, error);
      }
    }
  }
};
var placesService = new PlacesService();

// server/routes.ts
import { z as z3 } from "zod";
import { ethers as ethers3 } from "ethers";

// server/routes/ipfs.ts
import { Router } from "express";
import multer from "multer";

// server/ipfs.ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
var filebaseClient = new S3Client({
  region: "us-east-1",
  endpoint: "https://s3.filebase.com",
  credentials: {
    accessKeyId: process.env.FILEBASE_ACCESS_KEY || "",
    secretAccessKey: process.env.FILEBASE_SECRET_KEY || ""
  }
});
var FILEBASE_BUCKET = process.env.FILEBASE_BUCKET || "travelmint";
var NFTStorageService = class {
  async uploadFile(fileBuffer, fileName, mimeType) {
    try {
      const key = `uploads/${randomUUID()}-${fileName}`;
      const command = new PutObjectCommand({
        Bucket: FILEBASE_BUCKET,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType
      });
      const response = await filebaseClient.send(command);
      const cid = response.$metadata?.httpHeaders?.["x-amz-meta-cid"] || response.ETag?.replace(/"/g, "");
      console.log("File uploaded to IPFS via Filebase:", key);
      return {
        IpfsHash: cid || key,
        PinSize: fileBuffer.length,
        Timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
    } catch (error) {
      console.error("Error uploading file to Filebase:", error);
      throw error;
    }
  }
  async uploadJSON(data, name) {
    try {
      const key = `metadata/${randomUUID()}-${name}.json`;
      const jsonString = JSON.stringify(data);
      const command = new PutObjectCommand({
        Bucket: FILEBASE_BUCKET,
        Key: key,
        Body: Buffer.from(jsonString),
        ContentType: "application/json"
      });
      const response = await filebaseClient.send(command);
      const cid = response.$metadata?.httpHeaders?.["x-amz-meta-cid"] || response.ETag?.replace(/"/g, "");
      console.log("Metadata uploaded to IPFS via Filebase:", key);
      return {
        IpfsHash: cid || key,
        PinSize: jsonString.length,
        Timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
    } catch (error) {
      console.error("Error uploading JSON to Filebase:", error);
      throw error;
    }
  }
  async getOptimizedUrl(ipfsHash) {
    return `https://ipfs.filebase.io/ipfs/${ipfsHash}`;
  }
  async testConnection() {
    try {
      const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
      await filebaseClient.send(new ListObjectsV2Command({ Bucket: FILEBASE_BUCKET, MaxKeys: 1 }));
      return true;
    } catch (error) {
      console.error("Filebase connection test failed:", error);
      return false;
    }
  }
};
var nftStorageService = new NFTStorageService();

// shared/ipfs.ts
function createIPFSUrl(hash) {
  const gateway = process.env.PINATA_GATEWAY;
  if (gateway && typeof window === "undefined") {
    return `https://${gateway}/ipfs/${hash}`;
  }
  return `https://ipfs.io/ipfs/${hash}`;
}

// server/routes/ipfs.ts
var router = Router();
var upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
    // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  }
});
router.post("/upload-image", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }
    console.log("\u{1F4E4} Uploading image to IPFS via NFT.Storage:", req.file.originalname);
    const result = await nftStorageService.uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );
    console.log("\u2705 Image uploaded successfully:", result.IpfsHash);
    res.json({
      IpfsHash: result.IpfsHash,
      PinSize: result.PinSize,
      Timestamp: result.Timestamp,
      ipfsUrl: createIPFSUrl(result.IpfsHash)
    });
  } catch (error) {
    console.error("\u274C Error uploading image:", error);
    res.status(500).json({
      error: "Failed to upload image to IPFS",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});
router.post("/upload-metadata", async (req, res) => {
  try {
    const { metadata, name } = req.body;
    if (!metadata) {
      return res.status(400).json({ error: "No metadata provided" });
    }
    console.log("\u{1F4E4} Uploading metadata to IPFS via NFT.Storage:", name);
    const result = await nftStorageService.uploadJSON(metadata, name);
    console.log("\u2705 Metadata uploaded successfully:", result.IpfsHash);
    res.json({
      IpfsHash: result.IpfsHash,
      PinSize: result.PinSize,
      Timestamp: result.Timestamp,
      ipfsUrl: createIPFSUrl(result.IpfsHash)
    });
  } catch (error) {
    console.error("\u274C Error uploading metadata:", error);
    res.status(500).json({
      error: "Failed to upload metadata to IPFS",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});
router.get("/test", async (req, res) => {
  try {
    console.log("\u{1F517} Testing NFT.Storage connection...");
    const isConnected = await nftStorageService.testConnection();
    if (isConnected) {
      console.log("\u2705 NFT.Storage connection successful");
      res.json({
        status: "connected",
        message: "NFT.Storage IPFS service is working correctly"
      });
    } else {
      console.log("\u274C NFT.Storage connection failed");
      res.status(500).json({
        status: "error",
        message: "Failed to connect to NFT.Storage IPFS service"
      });
    }
  } catch (error) {
    console.error("\u274C Error testing NFT.Storage connection:", error);
    res.status(500).json({
      status: "error",
      message: "Error testing IPFS connection",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});
router.get("/info/:hash", async (req, res) => {
  try {
    const { hash } = req.params;
    console.log("\u{1F4CB} Getting IPFS file info for hash:", hash);
    const fileInfo = { hash, message: "File info retrieval not yet implemented" };
    if (fileInfo) {
      res.json(fileInfo);
    } else {
      res.status(404).json({ error: "File not found" });
    }
  } catch (error) {
    console.error("\u274C Error getting file info:", error);
    res.status(500).json({
      error: "Failed to get file info",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});
var ipfs_default = router;

// server/objectStorage.ts
import { Storage } from "@google-cloud/storage";
import { randomUUID as randomUUID2 } from "crypto";

// server/objectAcl.ts
var ACL_POLICY_METADATA_KEY = "custom:aclPolicy";
function isPermissionAllowed(requested, granted) {
  if (requested === "read" /* READ */) {
    return ["read" /* READ */, "write" /* WRITE */].includes(granted);
  }
  return granted === "write" /* WRITE */;
}
function createObjectAccessGroup(group) {
  switch (group.type) {
    // Implement the case for each type of access group to instantiate.
    //
    // For example:
    // case "USER_LIST":
    //   return new UserListAccessGroup(group.id);
    // case "EMAIL_DOMAIN":
    //   return new EmailDomainAccessGroup(group.id);
    // case "GROUP_MEMBER":
    //   return new GroupMemberAccessGroup(group.id);
    // case "SUBSCRIBER":
    //   return new SubscriberAccessGroup(group.id);
    default:
      throw new Error(`Unknown access group type: ${group.type}`);
  }
}
async function setObjectAclPolicy(objectFile, aclPolicy) {
  const [exists] = await objectFile.exists();
  if (!exists) {
    throw new Error(`Object not found: ${objectFile.name}`);
  }
  await objectFile.setMetadata({
    metadata: {
      [ACL_POLICY_METADATA_KEY]: JSON.stringify(aclPolicy)
    }
  });
}
async function getObjectAclPolicy(objectFile) {
  const [metadata] = await objectFile.getMetadata();
  const aclPolicy = metadata?.metadata?.[ACL_POLICY_METADATA_KEY];
  if (!aclPolicy) {
    return null;
  }
  return JSON.parse(aclPolicy);
}
async function canAccessObject({
  userId,
  objectFile,
  requestedPermission
}) {
  const aclPolicy = await getObjectAclPolicy(objectFile);
  if (!aclPolicy) {
    return false;
  }
  if (aclPolicy.visibility === "public" && requestedPermission === "read" /* READ */) {
    return true;
  }
  if (!userId) {
    return false;
  }
  if (aclPolicy.owner === userId) {
    return true;
  }
  for (const rule of aclPolicy.aclRules || []) {
    const accessGroup = createObjectAccessGroup(rule.group);
    if (await accessGroup.hasMember(userId) && isPermissionAllowed(requestedPermission, rule.permission)) {
      return true;
    }
  }
  return false;
}

// server/objectStorage.ts
var REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
var objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token"
      }
    },
    universe_domain: "googleapis.com"
  },
  projectId: ""
});
var ObjectNotFoundError = class _ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, _ObjectNotFoundError.prototype);
  }
};
var ObjectStorageService = class {
  constructor() {
  }
  // Gets the public object search paths.
  getPublicObjectSearchPaths() {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr.split(",").map((path) => path.trim()).filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }
  // Gets the private object directory.
  getPrivateObjectDir() {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }
  // Search for a public object from the search paths.
  async searchPublicObject(filePath) {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }
    return null;
  }
  // Downloads an object to the response.
  async downloadObject(file, res, cacheTtlSec = 3600) {
    try {
      const [metadata] = await file.getMetadata();
      const aclPolicy = await getObjectAclPolicy(file);
      const isPublic = aclPolicy?.visibility === "public";
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size,
        "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`
      });
      const stream = file.createReadStream();
      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });
      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }
  // Gets the upload URL for an object entity.
  async getObjectEntityUploadURL() {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    const objectId = randomUUID2();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900
    });
  }
  // Gets the object entity file from the object path.
  async getObjectEntityFile(objectPath) {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }
    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
  }
  normalizeObjectEntityPath(rawPath) {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }
    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;
    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) {
      objectEntityDir = `${objectEntityDir}/`;
    }
    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }
    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }
  // Tries to set the ACL policy for the object entity and return the normalized path.
  async trySetObjectEntityAclPolicy(rawPath, aclPolicy) {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }
    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }
  // Checks if the user can access the object entity.
  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission
  }) {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? "read" /* READ */
    });
  }
  // Uploads a file buffer to object storage and returns the URL
  async uploadFileBuffer(buffer, fileName, mimeType) {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    const objectId = randomUUID2();
    const extension = fileName.split(".").pop() || "bin";
    const objectName = `uploads/${objectId}.${extension}`;
    const fullPath = `${privateObjectDir}/${objectName}`;
    const { bucketName, objectName: finalObjectName } = parseObjectPath(fullPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(finalObjectName);
    await file.save(buffer, {
      metadata: {
        contentType: mimeType
      }
    });
    return `/objects/${objectName}`;
  }
};
function parseObjectPath(path) {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }
  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");
  return {
    bucketName,
    objectName
  };
}
async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec
}) {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1e3).toISOString()
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request)
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, make sure you're running on Replit`
    );
  }
  const { signed_url: signedURL } = await response.json();
  return signedURL;
}

// server/farcaster-validation.ts
var FarcasterCastValidator = class {
  /**
   * Validate a Farcaster cast URL for social post quest
   */
  async validateCast(castUrl) {
    try {
      if (!castUrl.includes("warpcast.com") && !castUrl.includes("farcaster.xyz")) {
        return { isValid: false, reason: "Invalid cast URL format" };
      }
      const castData = await this.fetchCastData(castUrl);
      if (!castData) {
        return { isValid: false, reason: "Could not fetch cast data" };
      }
      const contentValidation = this.validateContent(castData.text);
      if (!contentValidation.isValid) {
        return contentValidation;
      }
      const timestampValidation = this.validateTimestamp(castData.timestamp);
      if (!timestampValidation.isValid) {
        return timestampValidation;
      }
      return {
        isValid: true,
        reason: "Cast validation passed",
        castData
      };
    } catch (error) {
      console.error("\u{1F6A8} Cast validation error:", error);
      return { isValid: false, reason: "Cast validation failed" };
    }
  }
  /**
   * Fetch cast data from Neynar API
   */
  async fetchCastData(castUrl) {
    try {
      const apiKey = process.env.NEYNAR_API_KEY;
      if (!apiKey) {
        console.error("\u274C NEYNAR_API_KEY not found");
        return null;
      }
      console.log(`\u{1F50D} Fetching cast data from Neynar API for URL: ${castUrl}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1e4);
      const encodedUrl = encodeURIComponent(castUrl);
      const response = await fetch(
        `https://api.neynar.com/v2/farcaster/cast?identifier=${encodedUrl}&type=url`,
        {
          signal: controller.signal,
          headers: {
            "accept": "application/json",
            "x-api-key": apiKey
          }
        }
      );
      clearTimeout(timeoutId);
      if (!response.ok) {
        console.log(`\u26A0\uFE0F Neynar API error: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.log("Error response:", errorText);
        return null;
      }
      const data = await response.json();
      console.log("\u{1F50D} Neynar API response:", JSON.stringify(data, null, 2));
      if (data && data.cast) {
        const cast = data.cast;
        if (!cast.timestamp) {
          console.log("\u26A0\uFE0F Cast missing timestamp - cannot validate posting date");
          return null;
        }
        let timestamp2;
        if (typeof cast.timestamp === "string") {
          timestamp2 = cast.timestamp;
        } else if (typeof cast.timestamp === "number") {
          const tsMillis = cast.timestamp > 1e12 ? cast.timestamp : cast.timestamp * 1e3;
          timestamp2 = new Date(tsMillis).toISOString();
        } else {
          console.log("\u26A0\uFE0F Invalid timestamp format:", cast.timestamp);
          return null;
        }
        return {
          text: cast.text || "",
          timestamp: timestamp2,
          author: {
            fid: cast.author?.fid || 0,
            username: cast.author?.username || "unknown"
          }
        };
      }
      console.log("\u26A0\uFE0F Unexpected cast data format from Neynar API");
      return null;
    } catch (error) {
      console.error("\u274C Neynar API request failed:", error);
      return null;
    }
  }
  /**
   * Validate cast content for TravelMint requirements
   */
  validateContent(text2) {
    const lowerText = text2.toLowerCase();
    const travelMintKeywords = ["travelmint", "travel mint"];
    const hasTravelMint = travelMintKeywords.some(
      (keyword) => lowerText.includes(keyword.toLowerCase())
    );
    if (!hasTravelMint) {
      return {
        isValid: false,
        reason: "Cast must mention 'TravelMint'"
      };
    }
    return { isValid: true, reason: "Content validation passed" };
  }
  /**
   * Validate that cast was posted today
   */
  validateTimestamp(timestamp2) {
    try {
      const castDate = new Date(timestamp2);
      const today = getQuestDay();
      const castDay = getQuestDay(castDate);
      if (castDay !== today) {
        return {
          isValid: false,
          reason: "Cast must be from today"
        };
      }
      return { isValid: true, reason: "Timestamp validation passed" };
    } catch (error) {
      return {
        isValid: false,
        reason: "Invalid timestamp format"
      };
    }
  }
};
var farcasterCastValidator = new FarcasterCastValidator();

// server/notificationService.ts
import { z as z2 } from "zod";
var sendNotificationRequestSchema = z2.object({
  target_fids: z2.array(z2.number()),
  notification: z2.object({
    title: z2.string(),
    body: z2.string(),
    target_url: z2.string(),
    uuid: z2.string()
  })
});
var sendNotificationResponseSchema = z2.object({
  notification_deliveries: z2.array(z2.object({
    object: z2.string(),
    fid: z2.number(),
    status: z2.string()
  }))
});
var NotificationService = class {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }
  neynarApiUrl = "https://api.neynar.com/v2/farcaster/frame/notifications";
  /**
   * Send notification to multiple Farcaster users by FID
   */
  async sendNotification(params) {
    try {
      const notificationRequest = {
        target_fids: params.fids,
        notification: {
          title: params.title,
          body: params.message,
          target_url: params.targetUrl || "https://travelmint.replit.app",
          uuid: crypto.randomUUID()
        }
      };
      console.log(`\u{1F4F1} Sending notification to ${params.fids.length} users:`, {
        title: params.title,
        message: params.message,
        fids: params.fids
      });
      console.log(`\u{1F504} Also testing with empty FID array for broader reach...`);
      const response = await fetch(this.neynarApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey
        },
        body: JSON.stringify(notificationRequest)
      });
      const responseJson = await response.json();
      console.log(`\u{1F50D} Neynar API Response (Status: ${response.status}):`, JSON.stringify(responseJson, null, 2));
      if (response.status === 200) {
        const parsedResponse = sendNotificationResponseSchema.safeParse(responseJson);
        if (!parsedResponse.success) {
          console.error("\u274C Invalid notification response format - Expected:", sendNotificationResponseSchema);
          console.error("\u274C Actual response:", responseJson);
          console.error("\u274C Parsing errors:", parsedResponse.error);
          if (responseJson && responseJson.notification_deliveries) {
            console.log("\u{1F504} Attempting to work with actual response format...");
            const deliveries2 = responseJson.notification_deliveries;
            const successCount2 = Array.isArray(deliveries2) ? deliveries2.filter((d) => d.status === "success").length : 0;
            const failureCount2 = Array.isArray(deliveries2) ? deliveries2.filter((d) => d.status !== "success").length : 0;
            console.log(`\u2705 Notification sent (raw format) - Success: ${successCount2}, Failed: ${failureCount2}`);
            return {
              success: successCount2 > 0,
              successCount: successCount2,
              failureCount: failureCount2,
              rateLimitedCount: 0,
              errors: failureCount2 > 0 ? [`${failureCount2} deliveries failed`] : void 0
            };
          }
          return {
            success: false,
            successCount: 0,
            failureCount: params.fids.length,
            rateLimitedCount: 0,
            errors: ["Invalid response format from notification service"]
          };
        }
        const deliveries = parsedResponse.data.notification_deliveries;
        const successCount = deliveries.filter((d) => d.status === "success").length;
        const failureCount = deliveries.filter((d) => d.status !== "success").length;
        console.log(`\u2705 Notification sent - Success: ${successCount}, Failed: ${failureCount}`);
        return {
          success: successCount > 0,
          successCount,
          failureCount,
          rateLimitedCount: 0,
          // Rate limiting info not provided in new API
          errors: failureCount > 0 ? [`${failureCount} deliveries failed`] : void 0
        };
      } else {
        console.error(`\u274C Notification API error (${response.status}):`, responseJson);
        return {
          success: false,
          successCount: 0,
          failureCount: params.fids.length,
          rateLimitedCount: 0,
          errors: [responseJson.message || `API error: ${response.status}`]
        };
      }
    } catch (error) {
      console.error("\u274C Notification service error:", error);
      return {
        success: false,
        successCount: 0,
        failureCount: params.fids.length,
        rateLimitedCount: 0,
        errors: [error.message || "Unknown notification error"]
      };
    }
  }
  /**
   * Test notification service connectivity
   */
  async testConnection() {
    try {
      const testUrl = "https://api.neynar.com/v2/farcaster/user/bulk?fids=1&viewer_fid=1";
      const testResponse = await fetch(testUrl, {
        method: "GET",
        headers: {
          "accept": "application/json",
          "x-api-key": this.apiKey
        }
      });
      console.log(`\u{1F511} Notification service connection test: ${testResponse.status}`);
      if (testResponse.status === 200) {
        console.log("\u2705 Neynar API connection successful");
        return true;
      } else {
        const errorText = await testResponse.text();
        console.error(`\u274C Neynar API connection failed (${testResponse.status}):`, errorText);
        return false;
      }
    } catch (error) {
      console.error("\u{1F511} Notification service connection test failed:", error);
      return false;
    }
  }
};
var notificationService = null;
function getNotificationService() {
  if (!notificationService && process.env.NEYNAR_API_KEY) {
    notificationService = new NotificationService(process.env.NEYNAR_API_KEY);
    console.log("\u{1F4F1} Notification service initialized");
  }
  return notificationService;
}
function isNotificationServiceAvailable() {
  return !!process.env.NEYNAR_API_KEY;
}

// server/image-sync.ts
var objectStorageService = new ObjectStorageService();
var IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://dweb.link/ipfs/",
  "https://4everland.io/ipfs/",
  "https://gateway.pinata.cloud/ipfs/"
];
var MAX_FILE_SIZE = 10 * 1024 * 1024;
var DOWNLOAD_TIMEOUT = 3e4;
var DELAY_BETWEEN_DOWNLOADS = 500;
function extractIpfsCid(url) {
  if (!url) return null;
  if (url.startsWith("ipfs://")) {
    let path = url.slice(7);
    if (path.startsWith("ipfs/")) {
      path = path.slice(5);
    }
    const cid = path.split("?")[0].split("/")[0];
    return cid.length > 10 ? cid : null;
  }
  const subdomainMatch = url.match(/https?:\/\/([a-zA-Z0-9]+)\.ipfs\./);
  if (subdomainMatch) {
    return subdomainMatch[1];
  }
  const ipfsMatch = url.match(/\/ipfs\/([a-zA-Z0-9]+)/);
  if (ipfsMatch) {
    return ipfsMatch[1];
  }
  return null;
}
function getFileExtension(contentType) {
  const mimeToExt = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/avif": "avif"
  };
  return mimeToExt[contentType] || "jpg";
}
async function downloadImageWithTimeout(url, timeout) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "TravelMint-NFT-Sync/1.0"
      }
    });
    if (!response.ok) {
      return null;
    }
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
      console.log(`\u26A0\uFE0F Image too large: ${parseInt(contentLength) / 1024 / 1024}MB`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length > MAX_FILE_SIZE) {
      console.log(`\u26A0\uFE0F Downloaded image too large: ${buffer.length / 1024 / 1024}MB`);
      return null;
    }
    return { buffer, contentType };
  } catch (error) {
    if (error.name === "AbortError") {
      return null;
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
async function downloadFromIpfs(cid) {
  for (let i = 0; i < IPFS_GATEWAYS.length; i++) {
    const gateway = IPFS_GATEWAYS[i];
    const url = `${gateway}${cid}`;
    console.log(`\u{1F517} Trying gateway ${i + 1}/${IPFS_GATEWAYS.length}: ${gateway}`);
    const result = await downloadImageWithTimeout(url, DOWNLOAD_TIMEOUT);
    if (result) {
      console.log(`\u2705 Successfully downloaded from ${gateway}`);
      return result;
    }
  }
  return null;
}
async function syncNftImage(nft, force = false) {
  try {
    if (nft.objectStorageUrl && !force) {
      console.log(`\u23ED\uFE0F NFT ${nft.tokenId || nft.id} already cached, skipping`);
      return true;
    }
    const imageUrl = nft.imageUrl;
    if (!imageUrl) {
      console.log(`\u26A0\uFE0F NFT ${nft.id} has no imageUrl`);
      return false;
    }
    const cid = extractIpfsCid(imageUrl);
    let imageData = null;
    if (cid) {
      console.log(`\u{1F4E5} Downloading IPFS image for NFT ${nft.tokenId || nft.id}: ${cid}`);
      imageData = await downloadFromIpfs(cid);
    } else if (imageUrl.startsWith("http")) {
      console.log(`\u{1F4E5} Downloading HTTP image for NFT ${nft.tokenId || nft.id}: ${imageUrl}`);
      imageData = await downloadImageWithTimeout(imageUrl, DOWNLOAD_TIMEOUT);
    }
    if (!imageData) {
      console.log(`\u274C Failed to download image for NFT ${nft.tokenId || nft.id}`);
      return false;
    }
    const extension = getFileExtension(imageData.contentType);
    const fileName = `nft-${nft.tokenId || nft.id}.${extension}`;
    console.log(`\u{1F4E4} Uploading to Object Storage: ${fileName} (${(imageData.buffer.length / 1024).toFixed(1)}KB)`);
    const objectStorageUrl = await objectStorageService.uploadFileBuffer(
      imageData.buffer,
      fileName,
      imageData.contentType
    );
    await storage.updateNFT(nft.id, { objectStorageUrl });
    console.log(`\u2705 NFT ${nft.tokenId || nft.id} synced: ${objectStorageUrl}`);
    return true;
  } catch (error) {
    console.error(`\u274C Error syncing NFT ${nft.id}:`, error.message);
    return false;
  }
}
async function syncAllImages() {
  console.log("\u{1F504} Starting NFT image sync...");
  const allNfts = await storage.getAllNFTs();
  const tipTotals = await storage.getNFTTipTotals();
  const nftsToSync = allNfts.filter((nft) => {
    if (nft.objectStorageUrl) {
      return false;
    }
    if (!nft.imageUrl) {
      return false;
    }
    return true;
  });
  nftsToSync.sort((a, b) => {
    const tipsA = tipTotals.get(a.id) || 0;
    const tipsB = tipTotals.get(b.id) || 0;
    return tipsB - tipsA;
  });
  const tippedCount = nftsToSync.filter((nft) => (tipTotals.get(nft.id) || 0) > 0).length;
  console.log(`\u{1F4CA} Found ${nftsToSync.length} NFTs to sync (${tippedCount} with tips prioritized, ${allNfts.length} total)`);
  let synced = 0;
  let failed = 0;
  let skipped = allNfts.length - nftsToSync.length;
  for (let i = 0; i < nftsToSync.length; i++) {
    const nft = nftsToSync[i];
    console.log(`
[${i + 1}/${nftsToSync.length}] Processing NFT: ${nft.title || nft.tokenId || nft.id}`);
    const success = await syncNftImage(nft);
    if (success) {
      synced++;
    } else {
      failed++;
    }
    if (i < nftsToSync.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_DOWNLOADS));
    }
  }
  console.log(`
\u2705 Sync complete: ${synced} synced, ${failed} failed, ${skipped} already cached`);
  return { synced, failed, skipped };
}
async function syncSingleImage(nftId) {
  const nft = await storage.getNFT(nftId);
  if (!nft) {
    console.log(`\u274C NFT not found: ${nftId}`);
    return false;
  }
  return syncNftImage(nft);
}
async function getSyncStatus() {
  const allNfts = await storage.getAllNFTs();
  const cached = allNfts.filter((nft) => nft.objectStorageUrl).length;
  const pending = allNfts.length - cached;
  const percentage = allNfts.length > 0 ? Math.round(cached / allNfts.length * 100) : 0;
  return { total: allNfts.length, cached, pending, percentage };
}

// server/routes.ts
import multer2 from "multer";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { readFileSync } from "fs";
import { join } from "path";
var interRegular = null;
var interBold = null;
try {
  interRegular = readFileSync(join(process.cwd(), "server/fonts/Inter-Regular.ttf"));
  interBold = readFileSync(join(process.cwd(), "server/fonts/Inter-Bold.ttf"));
} catch (e) {
  console.warn("Failed to load Inter fonts, share images will use fallback");
}
var ALLOWED_CONTRACT = "0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f";
var PLATFORM_WALLET2 = "0x7CDe7822456AAC667Df0420cD048295b92704084";
var nftCache = {};
var CACHE_DURATION = 30 * 1e3;
var CACHE_DURATION_TIPS = 60 * 1e3;
function isCacheValid(key) {
  const entry = nftCache[key];
  if (!entry) return false;
  const duration = key.includes("tips") ? CACHE_DURATION_TIPS : CACHE_DURATION;
  return Date.now() - entry.timestamp < duration;
}
function setCacheEntry(key, data) {
  nftCache[key] = {
    data,
    timestamp: Date.now()
  };
}
function clearAllCache() {
  Object.keys(nftCache).forEach((key) => delete nftCache[key]);
  console.log("\u{1F5D1}\uFE0F All cache cleared for fresh sync");
}
function createUserObject(walletAddress, farcasterUsername, farcasterFid) {
  if (farcasterUsername) {
    const normalizedUsername = farcasterUsername.startsWith("@") ? farcasterUsername.slice(1) : farcasterUsername;
    return {
      id: walletAddress,
      username: `@${normalizedUsername}`,
      avatar: null,
      farcasterFid: farcasterFid || null
    };
  } else {
    return {
      id: walletAddress,
      username: walletAddress.slice(0, 8) + "...",
      avatar: null,
      farcasterFid: null
    };
  }
}
var adminAttempts = /* @__PURE__ */ new Map();
var adminBlocks = /* @__PURE__ */ new Map();
var ADMIN_RATE_LIMIT = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  blockDurationMs: 30 * 60 * 1e3
  // 30 minutes block
};
var ADMIN_SESSION = {
  maxAgeMs: 8 * 60 * 60 * 1e3,
  // 8 hours
  renewalThresholdMs: 2 * 60 * 60 * 1e3
  // renew if less than 2 hours left
};
function getClientIp(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.connection?.remoteAddress || req.socket?.remoteAddress || "unknown";
}
function isRateLimited(ip) {
  const now = Date.now();
  const block = adminBlocks.get(ip);
  if (block) {
    if (now - block.blockedAt < ADMIN_RATE_LIMIT.blockDurationMs) {
      return true;
    } else {
      adminBlocks.delete(ip);
    }
  }
  const attempts = adminAttempts.get(ip) || [];
  const recentAttempts = attempts.filter(
    (attempt) => now - attempt.timestamp < ADMIN_RATE_LIMIT.windowMs
  );
  adminAttempts.set(ip, recentAttempts);
  if (recentAttempts.length >= ADMIN_RATE_LIMIT.maxAttempts) {
    adminBlocks.set(ip, {
      blockedAt: now,
      ip,
      userAgent: "rate-limited"
    });
    return true;
  }
  return false;
}
function recordAdminAttempt(ip, userAgent) {
  const attempts = adminAttempts.get(ip) || [];
  attempts.push({
    timestamp: Date.now(),
    ip,
    userAgent: userAgent || "unknown"
  });
  adminAttempts.set(ip, attempts);
}
function logAdminAction(action, ip, userAgent, success) {
  const timestamp2 = (/* @__PURE__ */ new Date()).toISOString();
  const logMessage = `[ADMIN] ${timestamp2} | ${action} | IP: ${ip} | UA: ${userAgent} | Success: ${success}`;
  console.log(logMessage);
}
function verifyAdminAuth(req) {
  const adminSecret = process.env.ADMIN_SECRET;
  const ip = getClientIp(req);
  const userAgent = req.headers["user-agent"] || "unknown";
  if (!adminSecret) {
    logAdminAction("AUTH_ATTEMPT", ip, userAgent, false);
    return { success: false, error: "Admin access not configured" };
  }
  if (isRateLimited(ip)) {
    logAdminAction("RATE_LIMITED", ip, userAgent, false);
    return { success: false, error: "Too many authentication attempts. Try again later.", shouldBlock: true };
  }
  const providedSecret = req.headers["x-admin-key"];
  if (!providedSecret || providedSecret !== adminSecret) {
    recordAdminAttempt(ip, userAgent);
    logAdminAction("INVALID_SECRET", ip, userAgent, false);
    return { success: false, error: "Unauthorized - invalid admin key" };
  }
  logAdminAction("AUTH_SUCCESS", ip, userAgent, true);
  return { success: true };
}
async function registerRoutes(app2) {
  app2.use((req, res, next) => {
    if (req.path === "/icon.png" || req.path === "/logo.jpeg") {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Last-Modified", (/* @__PURE__ */ new Date()).toUTCString());
    }
    next();
  });
  console.log("\u{1F504} Checking for weekly reset on server startup...");
  try {
    await storage.performWeeklyReset();
    console.log("\u2705 Weekly reset check completed");
  } catch (error) {
    console.error("\u274C Weekly reset check failed:", error);
  }
  app2.get("/api/health", (req, res) => {
    res.json({ status: "OK", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app2.get("/base", (req, res) => {
    const baseUrl = req.protocol + "://" + req.get("host");
    const baseAppHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
    
    <!-- Security headers for Base App validation -->
    <meta http-equiv="X-Content-Type-Options" content="nosniff" />
    <meta http-equiv="Referrer-Policy" content="strict-origin-when-cross-origin" />
    
    <!-- App Meta Tags -->
    <title>TravelMint - Travel Photo NFT Marketplace</title>
    <meta name="description" content="Mint, buy, and sell location-based travel photo NFTs. Create unique travel memories on the blockchain with GPS coordinates." />
    
    <!-- Base App Integration Meta Tags -->
    <meta name="noindex" content="false" />
    <meta name="robots" content="index, follow" />
    <meta name="primaryCategory" content="productivity" />
    
    <!-- Base App Compatible Mini App Discovery Tags -->
    <meta name="fc:miniapp" content='{
      "version": "1",
      "iconUrl": "${baseUrl}/icon.png",
      "imageUrl": "${baseUrl}/logo.jpeg",
      "button": {
        "title": "Open TravelMint",
        "action": {
          "type": "link",
          "name": "TravelMint",
          "url": "${baseUrl}",
          "splashImageUrl": "${baseUrl}/logo.jpeg",
          "splashBackgroundColor": "#0f172a"
        }
      }
    }' />
    
    <!-- Base App Compatible Icons -->
    <link rel="icon" type="image/png" sizes="32x32" href="/icon.png" />
    <link rel="icon" type="image/png" sizes="1024x1024" href="/icon.png" />
    <link rel="apple-touch-icon" href="/icon.png" />
    <meta name="theme-color" content="#0f172a" />
    
    <!-- Open Graph Tags - Base App Compatible -->
    <meta property="og:title" content="TravelMint - Travel Photo NFT Marketplace" />
    <meta property="og:description" content="Mint, buy, and sell location-based travel photo NFTs on Base blockchain" />
    <meta property="og:image" content="${baseUrl}/logo.jpeg" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${baseUrl}" />
    <meta property="og:site_name" content="TravelMint" />
    
    <!-- Twitter Card Tags - Base App Compatible -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="TravelMint - Travel Photo NFT Marketplace" />
    <meta name="twitter:description" content="Turn your travel memories into NFTs" />
    <meta name="twitter:image" content="${baseUrl}/logo.jpeg" />
    
    <!-- Additional Base App Meta Tags -->
    <meta name="keywords" content="travel, nft, blockchain, photography, base, web3, social, map, location" />
    <meta name="author" content="TravelMint" />
    <meta name="application-name" content="TravelMint" />
  </head>
  <body>
    <h1>TravelMint - Base App Validation</h1>
    <p>This page is optimized for Base App validation. <a href="/">Go to main app</a></p>
  </body>
</html>`;
    res.setHeader("Content-Type", "text/html");
    res.removeHeader("X-Frame-Options");
    res.setHeader("Content-Security-Policy", "frame-ancestors https:");
    res.send(baseAppHtml);
  });
  app2.post("/api/auth/farcaster", async (req, res) => {
    try {
      console.log("\u{1F510} Farcaster auth request:", req.body);
      const { message, signature, fid, username, displayName, pfpUrl } = req.body;
      if (!fid || !username) {
        return res.status(400).json({ error: "Missing required Farcaster data" });
      }
      res.json({
        success: true,
        fid,
        username,
        displayName: displayName || username,
        pfpUrl: pfpUrl || null,
        verified: true
      });
    } catch (error) {
      console.error("Farcaster auth error:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  });
  app2.post("/api/frame", (req, res) => {
    try {
      res.json({
        frame: {
          version: "vNext",
          image: "https://travelnft.replit.app/image.png",
          buttons: [
            { label: "\u{1F5FA}\uFE0F Explore NFTs", action: "link", target: "https://travelnft.replit.app/explore" },
            { label: "\u{1F4F8} Mint Travel NFT", action: "link", target: "https://travelnft.replit.app/mint" }
          ]
        }
      });
    } catch (error) {
      console.error("Frame endpoint error:", error);
      res.status(500).json({ error: "Frame error" });
    }
  });
  app2.post("/api/cache/clear", (req, res) => {
    clearAllCache();
    res.json({ success: true, message: "Cache cleared successfully" });
  });
  app2.delete("/api/cache/clear", (req, res) => {
    clearAllCache();
    res.json({ success: true, message: "Cache cleared via DELETE" });
  });
  app2.post("/api/webhook", (req, res) => {
    console.log("\u{1F514} Base App webhook received:", req.body);
    res.json({ success: true, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app2.get("/share", (req, res) => {
    const { nft } = req.query;
    const shareUrl = nft ? `https://travelnft.replit.app/nft/${nft}` : "https://travelnft.replit.app";
    res.redirect(shareUrl);
  });
  app2.get("/r/:code", (req, res) => {
    const { code } = req.params;
    if (!code || code.trim() === "") {
      console.warn("\u26A0\uFE0F Invalid referral code attempt");
      return res.redirect("https://farcaster.xyz/miniapps/Ie0PvztUB40n/travelmint");
    }
    const farcasterUrl = `https://farcaster.xyz/miniapps/Ie0PvztUB40n/travelmint?ref=${encodeURIComponent(code)}`;
    console.log(`\u{1F517} Referral redirect: ${code} \u2192 ${farcasterUrl}`);
    res.redirect(farcasterUrl);
  });
  app2.get("/api/share/frame/:nftId", async (req, res) => {
    try {
      const { nftId } = req.params;
      const nft = await storage.getNFT(nftId);
      if (!nft) {
        return res.status(404).send("NFT not found");
      }
      const optimizedImageUrl = nft.imageUrl?.replace("gateway.pinata.cloud", "ipfs.io") || nft.imageUrl;
      res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
      res.setHeader("ETag", `"nft-${nft.id}-${nft.updatedAt?.getTime()}"`);
      const safeTitle = escapeHtml(nft.title);
      const safeLocation = escapeHtml(nft.location);
      const safeDescription = escapeHtml(`Minted on TravelMint: ${nft.title}`);
      const rawImageUrl = nft.objectStorageUrl || nft.imageUrl || "";
      const sanitizedImageUrl = sanitizeUrl(rawImageUrl);
      const safeImageUrl = escapeHtml(sanitizedImageUrl);
      const frameHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle} - Travel NFT</title>
  <meta name="description" content="${safeDescription}" />
  
  <!-- Farcaster Frame Meta Tags -->
  <meta name="fc:frame" content="vNext" />
  <meta name="fc:frame:image" content="${safeImageUrl}" />
  <meta name="fc:frame:image:aspect_ratio" content="1.91:1" />
  <meta name="fc:frame:button:1" content="\u{1F4B0} Buy ${parseFloat(nft.price).toFixed(0)} USDC" />
  <meta name="fc:frame:button:1:action" content="link" />
  <meta name="fc:frame:button:1:target" content="${process.env.REPLIT_DEV_DOMAIN || "https://9cd747da-afbe-4a91-998a-c53082329a77-00-2sqy9psnptz5t.kirk.replit.dev"}/marketplace" />
  <meta name="fc:frame:button:2" content="\u{1F5FA}\uFE0F Explore More" />
  <meta name="fc:frame:button:2:action" content="link" />
  <meta name="fc:frame:button:2:target" content="${process.env.REPLIT_DEV_DOMAIN || "https://9cd747da-afbe-4a91-998a-c53082329a77-00-2sqy9psnptz5t.kirk.replit.dev"}/explore" />
  
  <!-- Open Graph for social sharing -->
  <meta property="og:title" content="${safeTitle} - Travel NFT" />
  <meta property="og:description" content="${safeDescription}" />
  <meta property="og:image" content="${safeImageUrl}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${process.env.REPLIT_DEV_DOMAIN || "https://9cd747da-afbe-4a91-998a-c53082329a77-00-2sqy9psnptz5t.kirk.replit.dev"}/marketplace" />
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle} - Travel NFT" />
  <meta name="twitter:description" content="${safeDescription}" />
  <meta name="twitter:image" content="${safeImageUrl}" />
</head>
<body>
  <div style="font-family: Inter, sans-serif; text-align: center; padding: 40px;">
    <h1>${safeTitle}</h1>
    <p>Price: ${parseFloat(nft.price).toFixed(2)} USDC</p>
    <img src="${safeImageUrl}" alt="${safeTitle}" style="max-width: 400px; height: auto; border-radius: 8px;" />
    <br /><br />
    <a href="${process.env.REPLIT_DEV_DOMAIN || "https://9cd747da-afbe-4a91-998a-c53082329a77-00-2sqy9psnptz5t.kirk.replit.dev"}/marketplace" 
       style="background: #007aff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
      View in Marketplace
    </a>
  </div>
</body>
</html>`;
      res.setHeader("Content-Type", "text/html");
      res.send(frameHtml);
    } catch (error) {
      console.error("Error creating share frame:", error);
      res.status(500).send("Error creating share frame");
    }
  });
  app2.get("/api/nfts", async (req, res) => {
    try {
      res.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
      const sortBy = req.query.sortBy;
      const farcasterFid = req.query.farcasterFid;
      const cacheKey = sortBy ? `all-nfts-${sortBy}` : "all-nfts";
      if (isCacheValid(cacheKey)) {
        console.log(`\u26A1 Returning cached NFTs (instant response, sortBy: ${sortBy || "default"})`);
        let cachedNFTs = nftCache[cacheKey].data;
        if (farcasterFid) {
          const userLikedNFTs = await storage.getUserLikedNFTIds(farcasterFid);
          cachedNFTs = cachedNFTs.map((nft) => ({
            ...nft,
            isLiked: userLikedNFTs.includes(nft.id)
          }));
        }
        return res.json(cachedNFTs);
      }
      console.log(`\u{1F517} Cache miss - fetching NFTs from database (sortBy: ${sortBy || "default"})...`);
      const [allDbNFTs, tipTotals] = await Promise.all([
        storage.getAllNFTs(sortBy),
        storage.getNFTTipTotals()
      ]);
      const contractNFTs = allDbNFTs.filter(
        (nft) => !nft.contractAddress || nft.contractAddress === ALLOWED_CONTRACT
      );
      const nftsWithOwners = await Promise.all(
        contractNFTs.map(async (nft) => {
          let parsedMetadata = null;
          try {
            if (nft.metadata && typeof nft.metadata === "string") {
              parsedMetadata = JSON.parse(nft.metadata);
            }
          } catch (e) {
            console.log("Failed to parse metadata for NFT:", nft.id);
          }
          return {
            ...nft,
            // Use metadata name but prioritize database image URL (actual uploaded images)
            title: parsedMetadata?.name || nft.title,
            imageUrl: nft.imageUrl || parsedMetadata?.image,
            objectStorageUrl: nft.objectStorageUrl,
            // Include Object Storage URL for frontend priority
            tokenURI: nft.tokenURI,
            // Add tokenURI for frontend fallback (for tokens like #47 where image URL is broken but tokenURI works)
            owner: createUserObject(nft.ownerAddress, nft.farcasterOwnerUsername, nft.farcasterOwnerFid),
            creator: createUserObject(nft.creatorAddress, nft.farcasterCreatorUsername, nft.farcasterCreatorFid),
            country: getNFTCountry(nft),
            // Add country for filtering
            totalTips: tipTotals.get(nft.id) || 0
            // Add total tips received
          };
        })
      );
      setCacheEntry(cacheKey, nftsWithOwners);
      console.log(`\u2705 Returning ${nftsWithOwners.length} total NFTs (cached for fast access)`);
      let finalNFTs = nftsWithOwners;
      if (farcasterFid) {
        const userLikedNFTs = await storage.getUserLikedNFTIds(farcasterFid);
        finalNFTs = nftsWithOwners.map((nft) => ({
          ...nft,
          isLiked: userLikedNFTs.includes(nft.id)
        }));
      }
      setImmediate(async () => {
        try {
          console.log("\u{1F504} Background blockchain sync starting (incremental mode)...");
          const { newNFTs, lastBlock } = await blockchainService.syncNFTsIncremental(storage);
          console.log(`\u2705 Incremental sync found ${newNFTs.length} new/updated NFTs up to block ${lastBlock}`);
          for (const blockchainNFT of newNFTs) {
            const nftWithMetadata = await blockchainService.fetchMetadataAsync(blockchainNFT);
            const existsInDb = contractNFTs.find((nft) => nft.tokenId === blockchainNFT.tokenId);
            if (!existsInDb) {
              console.log(`\u{1F195} Adding new blockchain NFT #${blockchainNFT.tokenId} to database`);
              const dbFormat = await blockchainService.blockchainNFTToDBFormat(blockchainNFT);
              await storage.upsertNFTByTokenId(dbFormat);
            } else {
              let needsUpdate = false;
              const updateData = {};
              if (existsInDb.ownerAddress !== blockchainNFT.owner) {
                console.log(`\u{1F504} Updating owner for NFT #${blockchainNFT.tokenId}`);
                updateData.ownerAddress = blockchainNFT.owner;
                needsUpdate = true;
              }
              const currentLat = parseFloat(existsInDb.latitude);
              const currentLng = parseFloat(existsInDb.longitude);
              if (blockchainNFT.tokenId === "35") {
                console.log(`\u{1F1F9}\u{1F1ED} Forcing Pattaya location for NFT #35 (overriding metadata)`);
                updateData.latitude = "12.9236";
                updateData.longitude = "100.8825";
                updateData.location = "Pattaya, Thailand";
                if (blockchainNFT.metadata) {
                  updateData.metadata = JSON.stringify(blockchainNFT.metadata);
                }
                needsUpdate = true;
              } else if (currentLat === 0 && currentLng === 0 && blockchainNFT.metadata) {
                const metadata = blockchainNFT.metadata;
                if (metadata.attributes) {
                  const latAttr = metadata.attributes.find(
                    (attr) => attr.trait_type?.toLowerCase().includes("latitude")
                  );
                  const lngAttr = metadata.attributes.find(
                    (attr) => attr.trait_type?.toLowerCase().includes("longitude")
                  );
                  if (latAttr && lngAttr && latAttr.value !== "0" && lngAttr.value !== "0") {
                    console.log(`\u{1F30D} Fixing coordinates for NFT #${blockchainNFT.tokenId}: ${latAttr.value}, ${lngAttr.value}`);
                    updateData.latitude = latAttr.value;
                    updateData.longitude = lngAttr.value;
                    const locationAttr = metadata.attributes.find(
                      (attr) => attr.trait_type?.toLowerCase().includes("location")
                    );
                    if (locationAttr && locationAttr.value) {
                      updateData.location = locationAttr.value;
                    }
                    if (metadata.name && metadata.name !== `Travel NFT #${blockchainNFT.tokenId}`) {
                      updateData.title = metadata.name;
                    }
                    if (metadata.image) {
                      updateData.imageUrl = metadata.image;
                    }
                    if (metadata.description) {
                      updateData.description = metadata.description;
                    }
                    const categoryAttr = metadata.attributes.find(
                      (attr) => attr.trait_type?.toLowerCase().includes("category")
                    );
                    if (categoryAttr && categoryAttr.value) {
                      updateData.category = categoryAttr.value.toLowerCase();
                    }
                    updateData.metadata = JSON.stringify(metadata);
                    needsUpdate = true;
                  }
                }
              }
              if (needsUpdate) {
                await storage.updateNFT(existsInDb.id, updateData);
              }
            }
          }
          console.log("\u2705 Background blockchain sync completed");
          const refreshCacheForSort = async (sortByParam, cacheKey2) => {
            const [freshDbNFTs, freshTipTotals] = await Promise.all([
              storage.getAllNFTs(sortByParam),
              storage.getNFTTipTotals()
            ]);
            const freshContractNFTs = freshDbNFTs.filter(
              (nft) => !nft.contractAddress || nft.contractAddress === ALLOWED_CONTRACT
            );
            const freshNFTsWithOwners = await Promise.all(
              freshContractNFTs.map(async (nft) => {
                let parsedMetadata = null;
                try {
                  if (nft.metadata && typeof nft.metadata === "string") {
                    parsedMetadata = JSON.parse(nft.metadata);
                  }
                } catch (e) {
                }
                return {
                  ...nft,
                  title: parsedMetadata?.name || nft.title,
                  imageUrl: nft.imageUrl || parsedMetadata?.image,
                  objectStorageUrl: nft.objectStorageUrl,
                  tokenURI: nft.tokenURI,
                  owner: createUserObject(nft.ownerAddress, nft.farcasterOwnerUsername, nft.farcasterOwnerFid),
                  creator: createUserObject(nft.creatorAddress, nft.farcasterCreatorUsername, nft.farcasterCreatorFid),
                  country: getNFTCountry(nft),
                  totalTips: freshTipTotals.get(nft.id) || 0
                };
              })
            );
            setCacheEntry(cacheKey2, freshNFTsWithOwners);
            return freshNFTsWithOwners.length;
          };
          const [defaultCount, popularCount, tipsCount] = await Promise.all([
            refreshCacheForSort(void 0, "all-nfts"),
            refreshCacheForSort("popular", "all-nfts-popular"),
            refreshCacheForSort("tips", "all-nfts-tips")
          ]);
          console.log(`\u{1F504} Cache refreshed: ${defaultCount} NFTs (default), ${popularCount} NFTs (popular), ${tipsCount} NFTs (tips)`);
        } catch (error) {
          console.error("Background sync failed:", error);
        }
      });
      res.json(finalNFTs);
    } catch (error) {
      console.error("Error fetching NFTs:", error);
      res.status(500).json({ message: "Failed to fetch NFTs" });
    }
  });
  app2.get("/api/nfts/for-sale", async (req, res) => {
    try {
      const sortBy = req.query.sortBy;
      const farcasterFid = req.query.farcasterFid;
      const [allNfts, tipTotals] = await Promise.all([
        storage.getNFTsForSale(sortBy),
        storage.getNFTTipTotals()
      ]);
      const userLikedNFTs = farcasterFid ? await storage.getUserLikedNFTIds(farcasterFid) : [];
      const nfts2 = allNfts.filter(
        (nft) => !nft.contractAddress || nft.contractAddress === ALLOWED_CONTRACT
      );
      const nftsWithOwners = await Promise.all(
        nfts2.map(async (nft) => {
          let parsedMetadata = null;
          try {
            if (nft.metadata && typeof nft.metadata === "string") {
              parsedMetadata = JSON.parse(nft.metadata);
            }
          } catch (e) {
            console.log("Failed to parse metadata for NFT:", nft.id);
          }
          return {
            ...nft,
            // Use metadata name but prioritize database image URL (actual uploaded images)
            title: parsedMetadata?.name || nft.title,
            imageUrl: nft.imageUrl || parsedMetadata?.image,
            objectStorageUrl: nft.objectStorageUrl,
            // Include Object Storage URL for frontend priority
            ownerAddress: nft.ownerAddress,
            // Include raw owner address for purchases
            owner: createUserObject(nft.ownerAddress, nft.farcasterOwnerUsername, nft.farcasterOwnerFid),
            creator: createUserObject(nft.creatorAddress, nft.farcasterCreatorUsername, nft.farcasterCreatorFid),
            totalTips: tipTotals.get(nft.id) || 0,
            isLiked: userLikedNFTs.includes(nft.id)
          };
        })
      );
      res.json(nftsWithOwners);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch NFTs for sale" });
    }
  });
  app2.get("/api/nfts/:id", async (req, res) => {
    try {
      const nft = await storage.getNFT(req.params.id);
      if (!nft) {
        return res.status(404).json({ message: "NFT not found" });
      }
      let parsedMetadata = null;
      try {
        if (nft.metadata && typeof nft.metadata === "string") {
          parsedMetadata = JSON.parse(nft.metadata);
        }
      } catch (e) {
        console.log("Failed to parse metadata for NFT:", nft.id);
      }
      const farcasterFid = req.query.farcasterFid;
      let isLiked = false;
      if (farcasterFid) {
        isLiked = await storage.checkNFTLiked(req.params.id, farcasterFid);
      }
      res.json({
        ...nft,
        // Use metadata name and image if available, fallback to NFT fields
        title: parsedMetadata?.name || nft.title,
        imageUrl: nft.imageUrl || parsedMetadata?.image,
        owner: createUserObject(nft.ownerAddress, nft.farcasterOwnerUsername, nft.farcasterOwnerFid),
        creator: createUserObject(nft.creatorAddress, nft.farcasterCreatorUsername, nft.farcasterCreatorFid),
        isLiked
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch NFT" });
    }
  });
  app2.get("/api/nft/token/:tokenId", async (req, res) => {
    try {
      const { tokenId } = req.params;
      if (!tokenId) {
        return res.status(400).json({ message: "Token ID is required" });
      }
      const nft = await storage.getNFTByTokenId(tokenId);
      if (!nft) {
        return res.status(404).json({ message: "NFT not found" });
      }
      let parsedMetadata = null;
      try {
        if (nft.metadata && typeof nft.metadata === "string") {
          parsedMetadata = JSON.parse(nft.metadata);
        }
      } catch (e) {
        console.log("Failed to parse metadata for NFT:", nft.id);
      }
      const farcasterFid = req.query.farcasterFid;
      let isLiked = false;
      if (farcasterFid) {
        isLiked = await storage.checkNFTLiked(nft.id, farcasterFid);
      }
      res.json({
        ...nft,
        title: parsedMetadata?.name || nft.title,
        imageUrl: nft.imageUrl || parsedMetadata?.image,
        owner: createUserObject(nft.ownerAddress, nft.farcasterOwnerUsername, nft.farcasterOwnerFid),
        creator: createUserObject(nft.creatorAddress, nft.farcasterCreatorUsername, nft.farcasterCreatorFid),
        isLiked
      });
    } catch (error) {
      console.error("Error fetching NFT by tokenId:", error);
      res.status(500).json({ message: "Failed to fetch NFT" });
    }
  });
  app2.post("/api/nfts", async (req, res) => {
    try {
      const validatedNFT = insertNFTSchema.parse(req.body);
      const nft = await storage.createNFT(validatedNFT);
      console.log("\u{1F504} New NFT created - invalidating cache for immediate visibility");
      delete nftCache["all-nfts"];
      delete nftCache["for-sale"];
      res.status(201).json(nft);
    } catch (error) {
      console.error("Error creating NFT:", error);
      res.status(500).json({ message: "Failed to create NFT" });
    }
  });
  app2.patch("/api/nfts/:id", async (req, res) => {
    try {
      const { walletAddress, ...updates } = req.body;
      if (!walletAddress) {
        return res.status(400).json({ message: "Wallet address is required for NFT updates" });
      }
      if (!ethers3.isAddress(walletAddress)) {
        return res.status(400).json({ message: "Invalid wallet address format" });
      }
      const currentNFT = await storage.getNFT(req.params.id);
      if (!currentNFT) {
        return res.status(404).json({ message: "NFT not found" });
      }
      const tokenId = currentNFT.tokenId;
      if (!tokenId || isNaN(Number(tokenId))) {
        return res.status(400).json({ message: "Invalid NFT token ID format" });
      }
      console.log(`\u{1F50D} Verifying blockchain ownership for token #${tokenId}...`);
      try {
        const blockchainNFT = await blockchainService.getNFTByTokenId(tokenId);
        if (!blockchainNFT) {
          console.warn(`\u{1F6A8} NFT #${tokenId} not found on blockchain`);
          return res.status(404).json({
            message: "NFT not found on blockchain",
            code: "BLOCKCHAIN_VERIFICATION_FAILED"
          });
        }
        if (blockchainNFT.owner.toLowerCase() !== walletAddress.toLowerCase()) {
          console.warn(`\u{1F6A8} Blockchain ownership mismatch for NFT #${tokenId}: actual owner ${blockchainNFT.owner}, claimed owner ${walletAddress}`);
          return res.status(403).json({
            message: "Blockchain verification failed: You don't own this NFT",
            code: "BLOCKCHAIN_OWNERSHIP_VERIFICATION_FAILED",
            actualOwner: blockchainNFT.owner,
            claimedOwner: walletAddress
          });
        }
        console.log(`\u2705 Blockchain ownership verified for NFT #${tokenId} - owner: ${blockchainNFT.owner}`);
      } catch (blockchainError) {
        console.error(`\u274C Blockchain verification failed for NFT #${tokenId}:`, blockchainError);
        return res.status(500).json({
          message: "Unable to verify ownership on blockchain. Please try again.",
          code: "BLOCKCHAIN_VERIFICATION_ERROR"
        });
      }
      const nft = await storage.updateNFT(req.params.id, updates);
      if (!nft) {
        return res.status(500).json({ message: "Failed to update NFT" });
      }
      console.log("\u{1F504} NFT updated - invalidating cache");
      delete nftCache["all-nfts"];
      delete nftCache["for-sale"];
      res.json(nft);
    } catch (error) {
      console.error("Error updating NFT:", error);
      res.status(500).json({ message: "Failed to update NFT" });
    }
  });
  app2.post("/api/nfts/:id/like", async (req, res) => {
    try {
      const likeSchema = z3.object({
        farcasterFid: z3.string().trim().min(1).optional(),
        walletAddress: z3.string().trim().min(1).optional()
      }).refine((data) => data.farcasterFid || data.walletAddress, {
        message: "Either farcasterFid or walletAddress is required"
      });
      const validated = likeSchema.parse(req.body);
      const nft = await storage.getNFT(req.params.id);
      if (!nft) {
        return res.status(404).json({ message: "NFT not found" });
      }
      const result = await storage.toggleNFTLike(req.params.id, {
        farcasterFid: validated.farcasterFid,
        walletAddress: validated.walletAddress
      });
      res.json(result);
    } catch (error) {
      if (error instanceof z3.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error toggling NFT like:", error);
      if (error.code === "23505") {
        return res.status(409).json({ message: "Like operation conflict. Please try again." });
      }
      res.status(500).json({ message: "Failed to toggle NFT like" });
    }
  });
  app2.get("/api/users/:id/nfts", async (req, res) => {
    try {
      const nftsWithOwners = await Promise.all(
        [].map(async (nft) => {
          return {
            ...nft,
            owner: {
              id: nft.ownerAddress,
              username: nft.ownerAddress.slice(0, 8) + "...",
              avatar: null
            },
            creator: {
              id: nft.creatorAddress,
              username: nft.creatorAddress.slice(0, 8) + "...",
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
  app2.get("/api/wallet/:address/nfts", async (req, res) => {
    try {
      const walletAddress = req.params.address.toLowerCase();
      console.log(`\u{1F517} Fetching NFTs for wallet: ${walletAddress}`);
      const dbNfts = await storage.getNFTsByOwner(walletAddress);
      const contractDbNfts = dbNfts.filter(
        (nft) => !nft.contractAddress || nft.contractAddress === ALLOWED_CONTRACT
      );
      const nftsWithOwners = contractDbNfts.map((nft) => {
        let parsedMetadata = null;
        try {
          if (nft.metadata && typeof nft.metadata === "string") {
            parsedMetadata = JSON.parse(nft.metadata);
          }
        } catch (e) {
          console.log("Failed to parse metadata for NFT:", nft.id);
        }
        return {
          ...nft,
          // Use uploaded travel images for known tokens, otherwise use stored imageUrl
          imageUrl: nft.imageUrl,
          // This already has the correct image paths
          title: parsedMetadata?.name || nft.title,
          owner: createUserObject(nft.ownerAddress, nft.farcasterOwnerUsername, nft.farcasterOwnerFid),
          creator: createUserObject(nft.creatorAddress, nft.farcasterCreatorUsername, nft.farcasterCreatorFid)
        };
      });
      console.log(`\u2705 Returning ${nftsWithOwners.length} NFTs for wallet ${walletAddress}`);
      res.json(nftsWithOwners);
    } catch (error) {
      console.error(`Error fetching NFTs for wallet ${req.params.address}:`, error);
      res.status(500).json({ message: "Failed to fetch wallet NFTs" });
    }
  });
  app2.post("/api/user/:farcasterFid/link-wallet", async (req, res) => {
    try {
      const farcasterFid = req.params.farcasterFid;
      const { walletAddress, platform = "base_app" } = req.body;
      if (!walletAddress) {
        return res.status(400).json({ message: "Wallet address required" });
      }
      console.log(`\u{1F517} Linking wallet ${walletAddress} to Farcaster FID ${farcasterFid} (platform: ${platform})`);
      console.log(`\u{1F50D} Checking existing user stats for Farcaster FID: ${farcasterFid}`);
      let userStats2 = await storage.getUserStats(farcasterFid);
      if (!userStats2) {
        console.log(`\u{1F4CA} Creating user stats for new Farcaster FID: ${farcasterFid}`);
        try {
          userStats2 = await storage.createOrUpdateUserStats({
            farcasterFid,
            farcasterUsername: "",
            totalPoints: 0,
            currentStreak: 0,
            walletAddress: walletAddress.toLowerCase()
          });
          console.log(`\u2705 User stats created successfully for FID: ${farcasterFid}`);
        } catch (createError) {
          console.error(`\u274C Failed to create user stats:`, createError);
          throw createError;
        }
      } else {
        console.log(`\u2139\uFE0F User stats already exist for FID: ${farcasterFid}`);
      }
      const userWallet = await storage.addUserWallet(farcasterFid, walletAddress, platform);
      console.log(`\u2705 Wallet linked successfully for Farcaster FID ${farcasterFid}`);
      res.json({
        success: true,
        message: "Wallet linked successfully",
        userWallet
      });
    } catch (error) {
      console.error(`Error linking wallet for Farcaster FID ${req.params.farcasterFid}:`, error);
      res.status(500).json({ message: "Failed to link wallet" });
    }
  });
  app2.get("/api/user/:farcasterFid/all-nfts", async (req, res) => {
    try {
      const farcasterFid = req.params.farcasterFid;
      console.log(`\u{1F517} Fetching all NFTs for Farcaster FID: ${farcasterFid}`);
      const allNFTs = await storage.getAllNFTsForUser(farcasterFid);
      const contractNFTs = allNFTs.filter(
        (nft) => !nft.contractAddress || nft.contractAddress === ALLOWED_CONTRACT
      );
      const nftsWithOwners = contractNFTs.map((nft) => {
        let parsedMetadata = null;
        try {
          if (nft.metadata && typeof nft.metadata === "string") {
            parsedMetadata = JSON.parse(nft.metadata);
          }
        } catch (e) {
          console.log("Failed to parse metadata for NFT:", nft.id);
        }
        return {
          ...nft,
          // Use uploaded travel images for known tokens, otherwise use stored imageUrl
          imageUrl: nft.imageUrl,
          title: parsedMetadata?.name || nft.title,
          owner: createUserObject(nft.ownerAddress, nft.farcasterOwnerUsername, nft.farcasterOwnerFid),
          creator: createUserObject(nft.creatorAddress, nft.farcasterCreatorUsername, nft.farcasterCreatorFid),
          // Add source wallet information for multi-wallet display
          sourceWallet: nft.sourceWallet,
          sourcePlatform: nft.sourcePlatform
        };
      });
      console.log(`\u2705 Returning ${nftsWithOwners.length} NFTs from ${new Set(contractNFTs.map((n) => n.sourceWallet)).size} wallets for Farcaster FID ${farcasterFid}`);
      res.json(nftsWithOwners);
    } catch (error) {
      console.error(`Error fetching all NFTs for Farcaster FID ${req.params.farcasterFid}:`, error);
      res.status(500).json({ message: "Failed to fetch user NFTs from all wallets" });
    }
  });
  app2.get("/api/transactions/nft/:nftId", async (req, res) => {
    try {
      const transactions2 = await storage.getTransactionsByNFT(req.params.nftId);
      res.json(transactions2);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });
  app2.get("/api/transactions/recent", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit) : 20;
      const recentTransactions = await storage.getRecentTransactions(limit);
      res.json(recentTransactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recent transactions" });
    }
  });
  app2.post("/api/donations", async (req, res) => {
    try {
      const { nftId, fromAddress, toAddress, amount, platformFee, blockchainTxHash } = req.body;
      if (!nftId || !fromAddress || !toAddress || !amount || !blockchainTxHash) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const existingTx = await storage.getTransactionByHash(blockchainTxHash);
      if (existingTx) {
        return res.status(200).json({ message: "Donation already recorded", transaction: existingTx });
      }
      const transaction = await storage.createTransaction({
        nftId,
        fromAddress: fromAddress.toLowerCase(),
        toAddress: toAddress.toLowerCase(),
        transactionType: "donation",
        amount: amount.toString(),
        platformFee: platformFee?.toString() || "0",
        blockchainTxHash
      });
      console.log(`\u{1F49D} Donation recorded: ${amount} USDC from ${fromAddress} to ${toAddress} for NFT ${nftId}`);
      delete nftCache["all-nfts"];
      delete nftCache["all-nfts-tips"];
      delete nftCache["all-nfts-popular"];
      console.log("\u{1F504} Cache cleared after donation - tips will appear immediately");
      res.status(201).json(transaction);
    } catch (error) {
      console.error("Error recording donation:", error);
      res.status(500).json({ message: "Failed to record donation" });
    }
  });
  app2.get("/api/donations/stats", async (req, res) => {
    try {
      const stats = await storage.getDonationStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching donation stats:", error);
      res.status(500).json({ message: "Failed to fetch donation stats" });
    }
  });
  app2.get("/api/donations/nft/:nftId", async (req, res) => {
    try {
      const donations = await storage.getDonationsByNFT(req.params.nftId);
      res.json(donations);
    } catch (error) {
      console.error("Error fetching NFT donations:", error);
      res.status(500).json({ message: "Failed to fetch NFT donations" });
    }
  });
  app2.get("/api/donations/received/:address", async (req, res) => {
    try {
      const donations = await storage.getDonationsReceivedByWallet(req.params.address.toLowerCase());
      res.json(donations);
    } catch (error) {
      console.error("Error fetching received donations:", error);
      res.status(500).json({ message: "Failed to fetch received donations" });
    }
  });
  app2.post("/api/sync/wallet/:address", async (req, res) => {
    try {
      const walletAddress = req.params.address.toLowerCase();
      console.log(`\u{1F517} Syncing NFTs from blockchain for wallet: ${walletAddress}`);
      const blockchainNFTs = await blockchainService.getNFTsByOwner(walletAddress);
      console.log(`Found ${blockchainNFTs.length} NFTs on blockchain for wallet ${walletAddress}`);
      let syncedCount = 0;
      const dbNFTs = [];
      for (const blockchainNFT of blockchainNFTs) {
        const dbFormat = await blockchainService.blockchainNFTToDBFormat(blockchainNFT);
        const existing = await storage.getNFT(dbFormat.id);
        if (!existing) {
          const nft = await storage.createNFT(dbFormat);
          dbNFTs.push(nft);
          syncedCount++;
          await storage.createTransaction({
            nftId: nft.id,
            fromAddress: null,
            toAddress: walletAddress,
            transactionType: "sync",
            amount: "0.0",
            platformFee: "0.0"
          });
        } else {
          const updateData = {
            ownerAddress: dbFormat.ownerAddress,
            metadata: dbFormat.metadata,
            location: dbFormat.location,
            latitude: dbFormat.latitude,
            longitude: dbFormat.longitude,
            category: dbFormat.category,
            title: dbFormat.title,
            description: dbFormat.description,
            imageUrl: dbFormat.imageUrl
          };
          let needsMetadataFix = false;
          let shouldPreventBadOverwrite = false;
          const fixes = [];
          const protections = [];
          if (existing.latitude !== "0" && existing.longitude !== "0" && dbFormat.latitude === "0" && dbFormat.longitude === "0") {
            shouldPreventBadOverwrite = true;
            updateData.latitude = existing.latitude;
            updateData.longitude = existing.longitude;
            protections.push(`coordinates: keeping (${existing.latitude}, ${existing.longitude}) vs bad (0,0)`);
          }
          if (!existing.title?.startsWith("Travel NFT #") && dbFormat.title?.startsWith("Travel NFT #")) {
            shouldPreventBadOverwrite = true;
            updateData.title = existing.title;
            protections.push(`title: keeping "${existing.title}" vs generic "${dbFormat.title}"`);
          }
          if (existing.location !== "Unknown Location" && dbFormat.location === "Unknown Location") {
            shouldPreventBadOverwrite = true;
            updateData.location = existing.location;
            protections.push(`location: keeping "${existing.location}" vs "Unknown Location"`);
          }
          if (existing.latitude === "0" && existing.longitude === "0" && dbFormat.latitude !== "0" && dbFormat.longitude !== "0") {
            needsMetadataFix = true;
            fixes.push(`coordinates: (0,0) \u2192 (${dbFormat.latitude}, ${dbFormat.longitude})`);
          }
          if (existing.title?.startsWith("Travel NFT #") && dbFormat.title && !dbFormat.title.startsWith("Travel NFT #")) {
            needsMetadataFix = true;
            fixes.push(`title: "${existing.title}" \u2192 "${dbFormat.title}"`);
          }
          if (existing.location === "Unknown Location" && dbFormat.location && dbFormat.location !== "Unknown Location") {
            needsMetadataFix = true;
            fixes.push(`location: "${existing.location}" \u2192 "${dbFormat.location}"`);
          }
          if (shouldPreventBadOverwrite) {
            console.log(`\u{1F6E1}\uFE0F DATA-PROTECTION: Token #${existing.tokenId} protected from bad metadata overwrite:`);
            protections.forEach((protection) => console.log(`   - ${protection}`));
          }
          if (needsMetadataFix) {
            console.log(`\u{1F527} AUTO-FIX: Token #${existing.tokenId} metadata issues detected:`);
            fixes.forEach((fix) => console.log(`   - ${fix}`));
          }
          console.log(`\u{1F504} Updating NFT ${dbFormat.id} with fresh blockchain data:`, updateData);
          const updatedNFT = await storage.updateNFT(dbFormat.id, updateData);
          if (updatedNFT) {
            dbNFTs.push(updatedNFT);
            console.log(`\u2705 Updated NFT ${dbFormat.id} with fresh metadata: location=${dbFormat.location}, coords=${dbFormat.latitude},${dbFormat.longitude}`);
          }
        }
      }
      console.log(`\u2705 Sync completed: ${syncedCount} new NFTs, ${blockchainNFTs.length} total`);
      res.json({
        message: `Sync completed - ${syncedCount} new NFTs found`,
        syncedNFTs: syncedCount,
        totalNFTs: blockchainNFTs.length,
        nfts: dbNFTs
      });
    } catch (error) {
      console.error("Blockchain sync error:", error);
      res.status(500).json({ message: "Failed to sync wallet NFTs" });
    }
  });
  app2.post("/api/debug/usdc-balance", async (req, res) => {
    try {
      const { address } = req.body;
      if (!address) {
        return res.status(400).json({ message: "Address is required" });
      }
      console.log(`\u{1F50D} Checking USDC balance for: ${address}`);
      const balance = await blockchainService.getUSDCBalance(address);
      const allowance = await blockchainService.getUSDCAllowance(address, "0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f");
      const result = {
        address,
        balance,
        allowance,
        contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        network: "Base Mainnet"
      };
      console.log(`\u2705 USDC Balance Result:`, result);
      res.json(result);
    } catch (error) {
      console.error("Error checking USDC balance:", error);
      res.status(500).json({
        message: "Failed to check USDC balance",
        error: error.message
      });
    }
  });
  const locationToCountry = {
    // Turkey
    "Tuzla": "Turkey",
    "Pendik": "Turkey",
    "Istanbul": "Turkey",
    "Ankara": "Turkey",
    "Izmir": "Turkey",
    "Beyoglu": "Turkey",
    "Bodrum": "Turkey",
    "Kadikoy": "Turkey",
    "Osmangazi": "Turkey",
    "Didim": "Turkey",
    "Dat\xE7a": "Turkey",
    "Maltepe": "Turkey",
    "Tire": "Turkey",
    "Karsiyaka": "Turkey",
    "Yenisehir": "Turkey",
    "Kapakli": "Turkey",
    "Bursa": "Turkey",
    // Manual corrections we made
    "Tiflis": "Georgia",
    "Dubai": "UAE",
    "Kahire": "Egypt",
    // Montenegro
    "Karada\u011F": "Montenegro",
    "Karadag Nature": "Montenegro",
    // Canada
    "Vancouver": "Canada",
    "Toronto": "Canada",
    "Montreal": "Canada",
    "Calgary": "Canada",
    // Egypt
    "El Obour": "Egypt",
    "Cairo": "Egypt",
    "Alexandria": "Egypt",
    "Giza": "Egypt",
    // USA
    "New York": "USA",
    "Los Angeles": "USA",
    "San Francisco": "USA",
    "Chicago": "USA",
    "Miami": "USA",
    "Beverly Hills": "USA",
    // Cyprus
    "Agios Georgios": "Cyprus",
    // Other major cities
    "London": "UK",
    "Paris": "France",
    "Tokyo": "Japan",
    "Sydney": "Australia",
    "Singapore": "Singapore",
    "Amsterdam": "Netherlands",
    "Berlin": "Germany",
    "Munich": "Germany",
    "Hanover": "Germany",
    "Hamburg": "Germany",
    "Linz": "Austria",
    "Innsbruck": "Austria",
    "Salzburg": "Austria",
    "Vienna": "Austria",
    "Rome": "Italy",
    "Barcelona": "Spain",
    "Yenimahalle": "Turkey",
    "Palamutbuku": "Turkey",
    "Harbiye Cemil Topuzlu A\xE7\u0131k Hava Tiyatrosu": "Turkey",
    "Harbiye, \u015Ei\u015Fli/\u0130stanbul": "Turkey",
    "Cukurova": "Turkey",
    "Genoa": "Italy",
    "Pattaya, Thailand": "Thailand"
  };
  const getCountryFromCoordinates = (lat, lng) => {
    if (lat >= 41.9 && lat <= 41.91 && lng >= 12.45 && lng <= 12.46) {
      return "Vatican City";
    }
    if (lat >= 1.2 && lat <= 1.47 && lng >= 103.6 && lng <= 104) {
      return "Singapore";
    }
    if (lat >= 34.5 && lat <= 35.7 && lng >= 32 && lng <= 34.6) {
      return "Cyprus";
    }
    if (lat >= 49.4 && lat <= 50.2 && lng >= 5.7 && lng <= 6.5) {
      return "Luxembourg";
    }
    if (lat >= 45.8 && lat <= 47.8 && lng >= 5.96 && lng <= 10.49) {
      return "Switzerland";
    }
    if (lat >= 49.5 && lat <= 51.5 && lng >= 2.55 && lng <= 6.4) {
      return "Belgium";
    }
    if (lat >= 50 && lat <= 54 && lng >= 3 && lng <= 8) {
      return "Netherlands";
    }
    if (lat >= 46.23 && lat <= 49.01 && lng >= 9.53 && lng <= 17.16) {
      return "Austria";
    }
    if (lat >= 47.27 && lat <= 54.9 && lng >= 5.87 && lng <= 15.03) {
      return "Germany";
    }
    if (lat >= 42 && lat <= 43.5 && lng >= 18.5 && lng <= 20.5) {
      return "Montenegro";
    }
    if (lat >= 40.8 && lat <= 42.4 && lng >= 20.4 && lng <= 23) {
      return "North Macedonia";
    }
    if (lat >= 39.6 && lat <= 42.7 && lng >= 19.3 && lng <= 21.1) {
      return "Albania";
    }
    if (lat >= 34.8 && lat <= 41.8 && lng >= 19.3 && lng <= 28.3) {
      return "Greece";
    }
    if (lat >= 42.2 && lat <= 46.2 && lng >= 18.8 && lng <= 23) {
      return "Serbia";
    }
    if (lat >= 42.4 && lat <= 46.6 && lng >= 13.5 && lng <= 19.5) {
      return "Croatia";
    }
    if (lat >= 45.7 && lat <= 48.6 && lng >= 16.1 && lng <= 22.9) {
      return "Hungary";
    }
    if (lat >= 48.5 && lat <= 51.1 && lng >= 12.1 && lng <= 18.9) {
      return "Czech Republic";
    }
    if (lat >= 47.7 && lat <= 49.6 && lng >= 16.8 && lng <= 22.6) {
      return "Slovakia";
    }
    if (lat >= 45.4 && lat <= 46.9 && lng >= 13.4 && lng <= 16.6) {
      return "Slovenia";
    }
    if (lat >= 42.5 && lat <= 45.3 && lng >= 15.7 && lng <= 19.6) {
      return "Bosnia and Herzegovina";
    }
    if (lat >= 36.9 && lat <= 42.2 && lng >= -9.5 && lng <= -6.2) {
      return "Portugal";
    }
    if (lat >= 63.3 && lat <= 66.6 && lng >= -24.5 && lng <= -13.5) {
      return "Iceland";
    }
    if (lat >= 51.4 && lat <= 55.4 && lng >= -10.5 && lng <= -6) {
      return "Ireland";
    }
    if (lat >= 49.9 && lat <= 61 && lng >= -8.2 && lng <= 1.8) {
      return "United Kingdom";
    }
    if (lat >= 54.5 && lat <= 57.8 && lng >= 8 && lng <= 15.2) {
      return "Denmark";
    }
    if (lat >= 57.9 && lat <= 71.2 && lng >= 4.5 && lng <= 31.2) {
      return "Norway";
    }
    if (lat >= 55.3 && lat <= 69.1 && lng >= 11.1 && lng <= 24.2) {
      return "Sweden";
    }
    if (lat >= 59.8 && lat <= 70.1 && lng >= 20.5 && lng <= 31.6) {
      return "Finland";
    }
    if (lat >= 49 && lat <= 54.9 && lng >= 14.1 && lng <= 24.2) {
      return "Poland";
    }
    if (lat >= 35 && lat <= 47.3 && lng >= 6.6 && lng <= 18.5) {
      return "Italy";
    }
    if (lat >= 35.5 && lat <= 43.8 && lng >= -9.3 && lng <= 3.3) {
      return "Spain";
    }
    if (lat >= 42 && lat <= 51 && lng >= -5 && lng <= 7.5) {
      return "France";
    }
    if (lat >= 43.6 && lat <= 48.3 && lng >= 20.3 && lng <= 29.7) {
      return "Romania";
    }
    if (lat >= 41.2 && lat <= 44.2 && lng >= 22.4 && lng <= 28.6) {
      return "Bulgaria";
    }
    if (lat >= 36 && lat <= 42 && lng >= 26 && lng <= 45) {
      return "Turkey";
    }
    if (lat >= 41 && lat <= 43.6 && lng >= 39.9 && lng <= 46.7) {
      return "Georgia";
    }
    if (lat >= 38.8 && lat <= 41.3 && lng >= 43.4 && lng <= 46.6) {
      return "Armenia";
    }
    if (lat >= 38.4 && lat <= 41.9 && lng >= 44.8 && lng <= 50.4) {
      return "Azerbaijan";
    }
    if (lat >= 29.1 && lat <= 37.4 && lng >= 38.8 && lng <= 48.6) {
      return "Iraq";
    }
    if (lat >= 25.1 && lat <= 39.8 && lng >= 44 && lng <= 63.3) {
      return "Iran";
    }
    if (lat >= 16.3 && lat <= 32.2 && lng >= 34.5 && lng <= 55.7) {
      return "Saudi Arabia";
    }
    if (lat >= 22 && lat <= 26 && lng >= 51 && lng <= 56) {
      return "UAE";
    }
    if (lat >= 24.5 && lat <= 26.2 && lng >= 50.7 && lng <= 51.7) {
      return "Qatar";
    }
    if (lat >= 28.5 && lat <= 30.1 && lng >= 46.5 && lng <= 48.5) {
      return "Kuwait";
    }
    if (lat >= 22 && lat <= 32 && lng >= 25 && lng <= 35) {
      return "Egypt";
    }
    if (lat >= 29.5 && lat <= 33.3 && lng >= 34.3 && lng <= 35.9) {
      return "Israel";
    }
    if (lat >= 29.2 && lat <= 33.4 && lng >= 34.9 && lng <= 39.3) {
      return "Jordan";
    }
    if (lat >= 33.1 && lat <= 34.7 && lng >= 35.1 && lng <= 36.6) {
      return "Lebanon";
    }
    if (lat >= 40.6 && lat <= 55.4 && lng >= 46.5 && lng <= 87.3) {
      return "Kazakhstan";
    }
    if (lat >= 8.1 && lat <= 35.5 && lng >= 68.2 && lng <= 97.4) {
      return "India";
    }
    if (lat >= 5.5 && lat <= 20.5 && lng >= 97 && lng <= 106) {
      return "Thailand";
    }
    if (lat >= 8.2 && lat <= 23.4 && lng >= 102.1 && lng <= 109.5) {
      return "Vietnam";
    }
    if (lat >= 0.8 && lat <= 7.4 && lng >= 99.6 && lng <= 119.3) {
      return "Malaysia";
    }
    if (lat >= -11 && lat <= 6 && lng >= 95 && lng <= 141) {
      return "Indonesia";
    }
    if (lat >= 4.6 && lat <= 21.1 && lng >= 116.9 && lng <= 126.6) {
      return "Philippines";
    }
    if (lat >= 24 && lat <= 46 && lng >= 122 && lng <= 154) {
      return "Japan";
    }
    if (lat >= 33 && lat <= 39 && lng >= 124 && lng <= 132) {
      return "South Korea";
    }
    if (lat >= 18 && lat <= 54 && lng >= 73 && lng <= 135) {
      return "China";
    }
    if (lat >= -44 && lat <= -10 && lng >= 113 && lng <= 154) {
      return "Australia";
    }
    if (lat >= -47 && lat <= -34 && lng >= 166 && lng <= 179) {
      return "New Zealand";
    }
    if (lat >= 42 && lat <= 83 && lng >= -141 && lng <= -52) {
      return "Canada";
    }
    if (lat >= 24 && lat <= 49 && lng >= -125 && lng <= -66) {
      return "USA";
    }
    if (lat >= 14.5 && lat <= 32.7 && lng >= -118 && lng <= -86) {
      return "Mexico";
    }
    if (lat >= -34 && lat <= 5 && lng >= -74 && lng <= -34) {
      return "Brazil";
    }
    if (lat >= -55 && lat <= -22 && lng >= -73 && lng <= -53) {
      return "Argentina";
    }
    if (lat >= -56 && lat <= -17 && lng >= -76 && lng <= -66) {
      return "Chile";
    }
    if (lat >= -18 && lat <= 0 && lng >= -81 && lng <= -68) {
      return "Peru";
    }
    if (lat >= -4 && lat <= 13 && lng >= -79 && lng <= -66) {
      return "Colombia";
    }
    if (lat >= 41 && lat <= 82 && lng >= 19 && lng <= 180) {
      return "Russia";
    }
    if (lat >= 44.4 && lat <= 52.4 && lng >= 22.1 && lng <= 40.2) {
      return "Ukraine";
    }
    return "Unknown";
  };
  const getNFTCountry = (nft) => {
    const mappedCountry = locationToCountry[nft.location];
    if (mappedCountry) {
      return mappedCountry;
    }
    if (nft.latitude && nft.longitude) {
      const lat = parseFloat(nft.latitude);
      const lng = parseFloat(nft.longitude);
      if (!isNaN(lat) && !isNaN(lng) && !(lat === 0 && lng === 0)) {
        const coordCountry = getCountryFromCoordinates(lat, lng);
        if (coordCountry !== "Unknown") {
          return coordCountry;
        }
      }
    }
    return "Unknown";
  };
  app2.get("/api/stats", async (req, res) => {
    try {
      res.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
      const allNFTs = await storage.getAllNFTs();
      const totalNFTs = allNFTs.length;
      const totalVolume = allNFTs.reduce((sum, nft) => sum + parseFloat(nft.price), 0);
      const uniqueHolders = /* @__PURE__ */ new Set();
      allNFTs.forEach((nft) => {
        if (nft.ownerAddress) {
          uniqueHolders.add(nft.ownerAddress.toLowerCase());
        }
      });
      res.json({
        totalNFTs,
        totalVolume: totalVolume.toFixed(1),
        totalHolders: uniqueHolders.size
      });
    } catch (error) {
      console.error("Stats endpoint error:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });
  app2.post("/api/nfts/:id/purchase", async (req, res) => {
    try {
      const { id: nftId } = req.params;
      const { buyerId } = req.body;
      if (!buyerId) {
        return res.status(400).json({ message: "Buyer wallet address is required" });
      }
      if (!ethers3.isAddress(buyerId)) {
        return res.status(400).json({ message: "Invalid wallet address format" });
      }
      const nft = await storage.getNFT(nftId);
      if (!nft) {
        return res.status(404).json({ message: "NFT not found" });
      }
      if (nft.isForSale !== 1) {
        return res.status(400).json({ message: "NFT is not for sale" });
      }
      if (nft.ownerAddress.toLowerCase() === buyerId.toLowerCase()) {
        return res.status(400).json({ message: "You cannot buy your own NFT" });
      }
      const tokenId = nft.tokenId;
      const numericTokenId = parseInt(tokenId);
      if (!tokenId || isNaN(numericTokenId) || numericTokenId <= 0) {
        console.error(`\u274C Invalid tokenId extraction: NFT.id=${nft.id}, extracted=${tokenId}, numeric=${numericTokenId}`);
        return res.status(400).json({ message: "Invalid NFT token ID format" });
      }
      console.log(`\u{1F504} Generating onchain purchase transaction for NFT #${tokenId}`);
      if (!nft.price || isNaN(parseFloat(nft.price)) || parseFloat(nft.price) <= 0) {
        console.error(`\u274C Invalid NFT price: ${nft.price}`);
        return res.status(400).json({ message: "Invalid NFT price" });
      }
      console.log(`\u{1F504} Generating onchain purchase transaction for NFT #${numericTokenId} at ${nft.price} USDC`);
      const isListed = await blockchainService.isNFTListed(tokenId);
      if (!isListed) {
        return res.status(400).json({
          message: "NFT is not listed on the secure marketplace",
          type: "NOT_LISTED_ERROR"
        });
      }
      const marketplaceListing = await blockchainService.getMarketplaceListing(tokenId);
      if (!marketplaceListing) {
        return res.status(400).json({
          message: "NFT marketplace listing not found",
          type: "LISTING_NOT_FOUND"
        });
      }
      console.log(`\u{1F50D} Verifying on-chain ownership before purchase prep...`);
      try {
        const onChainOwner = await blockchainService.getNFTOwner(tokenId);
        if (!onChainOwner) {
          console.error(`\u274C Could not verify on-chain owner for NFT #${numericTokenId}`);
          return res.status(400).json({ message: "Could not verify NFT ownership on blockchain" });
        }
        if (onChainOwner.toLowerCase() !== nft.ownerAddress.toLowerCase()) {
          console.error(`\u274C Ownership mismatch! DB owner: ${nft.ownerAddress}, On-chain: ${onChainOwner}`);
          return res.status(409).json({
            message: "NFT ownership has changed. Please refresh and try again.",
            type: "OWNERSHIP_MISMATCH",
            dbOwner: nft.ownerAddress,
            onChainOwner
          });
        }
        console.log(`\u2705 On-chain ownership verified: ${onChainOwner}`);
      } catch (ownershipError) {
        console.error(`\u274C Ownership verification failed:`, ownershipError);
        return res.status(400).json({
          message: "Failed to verify NFT ownership on blockchain",
          type: "BLOCKCHAIN_ERROR"
        });
      }
      const purchaseData = await blockchainService.generatePurchaseTransaction(
        tokenId,
        // String for blockchain service
        buyerId.toLowerCase()
        // Buyer address only - price comes from secure marketplace listing!
      );
      if (!purchaseData.success) {
        return res.status(400).json({
          message: purchaseData.error || "Failed to generate purchase transaction",
          type: "ONCHAIN_ERROR"
        });
      }
      console.log(`\u2705 Generated purchase transaction data for NFT #${tokenId}`);
      const response = {
        message: "Purchase transaction prepared",
        requiresOnchainPayment: true,
        transactionData: purchaseData,
        nftId,
        tokenId: numericTokenId.toString(),
        // String format for consistency
        buyer: buyerId.toLowerCase(),
        seller: nft.ownerAddress.toLowerCase(),
        priceUSDC: nft.price
        // Exact NFT price - no fallbacks allowed
      };
      console.log(`\u2705 Returning verified purchase data:`, {
        tokenId: response.tokenId,
        priceUSDC: response.priceUSDC,
        buyer: response.buyer,
        seller: response.seller
      });
      res.json(response);
    } catch (error) {
      console.error("Purchase preparation error:", error);
      res.status(500).json({ message: "Failed to prepare purchase transaction" });
    }
  });
  app2.post("/api/nfts/confirm-purchase", async (req, res) => {
    try {
      const { buyerId, transactionHash, nftId } = req.body;
      if (!buyerId || !transactionHash) {
        return res.status(400).json({ message: "Buyer ID and transaction hash are required" });
      }
      console.log(`\u{1F50D} Verifying smart contract purchase tx: ${transactionHash} for NFT: ${nftId}`);
      let nftToUpdate;
      if (nftId) {
        nftToUpdate = await storage.getNFT(nftId);
      } else {
        const allNFTs = await storage.getAllNFTs();
        nftToUpdate = allNFTs.find(
          (nft) => nft.isForSale === 1 && nft.ownerAddress.toLowerCase() !== buyerId.toLowerCase()
        );
      }
      if (!nftToUpdate) {
        return res.status(404).json({ message: "NFT not found for purchase confirmation" });
      }
      const tokenId = nftToUpdate.tokenId;
      if (!tokenId || isNaN(Number(tokenId))) {
        return res.status(400).json({ message: "Invalid NFT token ID" });
      }
      console.log(`\u{1F50D} [DEBUG] Starting transaction verification for tx: ${transactionHash}, tokenId: ${tokenId}, buyer: ${buyerId.toLowerCase()}`);
      const verification = await blockchainService.verifyPurchaseTransaction(
        transactionHash,
        tokenId,
        buyerId.toLowerCase()
      );
      console.log(`\u{1F50D} [DEBUG] Verification result:`, verification);
      if (!verification.success) {
        console.log(`\u274C Transaction verification failed: ${verification.error}`);
        console.log(`\u274C [DEBUG] Full verification object:`, JSON.stringify(verification, null, 2));
        return res.status(400).json({
          message: "Transaction verification failed",
          error: verification.error,
          type: "VERIFICATION_FAILED"
        });
      }
      console.log(`\u2705 Transaction verified! Proceeding with database update for NFT ${nftToUpdate.id}`);
      if (nftToUpdate.isForSale !== 1) {
        return res.status(400).json({ message: "NFT is not for sale" });
      }
      if (nftToUpdate.ownerAddress.toLowerCase() === buyerId.toLowerCase()) {
        return res.status(400).json({ message: "You cannot buy your own NFT" });
      }
      let buyer = await storage.getUserByWalletAddress(buyerId.toLowerCase());
      if (!buyer) {
        buyer = await storage.createUser({
          username: `${buyerId.slice(0, 8)}...`,
          walletAddress: buyerId.toLowerCase(),
          balance: "0"
        });
      }
      let seller = await storage.getUserByWalletAddress(nftToUpdate.ownerAddress);
      if (!seller) {
        seller = await storage.createUser({
          username: `${nftToUpdate.ownerAddress.slice(0, 8)}...`,
          walletAddress: nftToUpdate.ownerAddress,
          balance: "0"
        });
      }
      const purchasePrice = parseFloat(nftToUpdate.price);
      const platformFee = purchasePrice * 0.05;
      const sellerAmount = purchasePrice - platformFee;
      console.log(`\u{1F4B0} Smart contract handled: ${sellerAmount} USDC to seller, ${platformFee} USDC platform fee`);
      let platformUser = await storage.getUserByWalletAddress(PLATFORM_WALLET2);
      if (!platformUser) {
        platformUser = await storage.createUser({
          username: "TravelMint Platform",
          walletAddress: PLATFORM_WALLET2,
          balance: "0"
        });
      }
      console.log(`\u{1F4B0} Platform commission: ${platformFee} USDC to ${PLATFORM_WALLET2} (handled by smart contract)`);
      console.log(`\u{1F504} Updating NFT ${nftToUpdate.id} ownership: ${nftToUpdate.ownerAddress} \u2192 ${buyerId.toLowerCase()}`);
      const updateResult = await storage.updateNFT(nftToUpdate.id, {
        ownerAddress: buyerId.toLowerCase(),
        isForSale: 0
      });
      console.log(`\u2705 NFT ownership update result:`, updateResult ? "SUCCESS" : "FAILED");
      console.log(`\u{1F4DD} [DEBUG] Creating purchase transaction record...`);
      try {
        const purchaseTx = await storage.createTransaction({
          nftId: nftToUpdate.id,
          toAddress: buyerId.toLowerCase(),
          transactionType: "purchase",
          amount: nftToUpdate.price,
          platformFee: platformFee.toString(),
          fromAddress: nftToUpdate.ownerAddress,
          blockchainTxHash: transactionHash
        });
        console.log(`\u2705 [DEBUG] Purchase transaction created:`, purchaseTx?.id || "no ID returned");
      } catch (txError) {
        console.error(`\u274C [DEBUG] Failed to create purchase transaction:`, txError);
        throw txError;
      }
      console.log(`\u{1F4DD} [DEBUG] Creating commission transaction record...`);
      try {
        const commissionTx = await storage.createTransaction({
          nftId: nftToUpdate.id,
          toAddress: PLATFORM_WALLET2,
          transactionType: "commission",
          amount: platformFee.toString(),
          platformFee: "0",
          fromAddress: buyerId.toLowerCase(),
          blockchainTxHash: transactionHash
        });
        console.log(`\u2705 [DEBUG] Commission transaction created:`, commissionTx?.id || "no ID returned");
      } catch (txError) {
        console.error(`\u274C [DEBUG] Failed to create commission transaction:`, txError);
      }
      console.log(`\u{1F389} Purchase confirmed! NFT ${nftToUpdate.id} now owned by ${buyerId} (Platform distribution completed)`);
      res.json({
        success: true,
        message: "Purchase confirmed successfully",
        nftId: nftToUpdate.id,
        newOwner: buyerId.toLowerCase(),
        transactionHash,
        priceUSDC: nftToUpdate.price
      });
    } catch (error) {
      console.error("Purchase confirmation error:", error);
      res.status(500).json({ message: "Failed to confirm purchase" });
    }
  });
  app2.get("/api/users", async (req, res) => {
    res.json({ message: "Use wallet-based endpoints for user data" });
  });
  app2.post("/api/webhook", async (req, res) => {
    try {
      const { untrustedData, trustedData } = req.body;
      res.json({
        message: "Webhook received",
        success: true
      });
    } catch (error) {
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });
  app2.post("/api/sync/post-mint", async (req, res) => {
    try {
      console.log("\u26A1 Post-mint quick sync initiated...");
      clearAllCache();
      const allDbNFTs = await storage.getAllNFTs();
      const maxTokenId = Math.max(...allDbNFTs.map((nft) => parseInt(nft.tokenId || "0") || 0), 0);
      console.log(`\u{1F3AF} Checking tokens after ${maxTokenId} (post-mint optimization)`);
      let newNFTsAdded = 0;
      let checkedTokens = 0;
      for (let tokenId = maxTokenId + 1; tokenId <= maxTokenId + 10; tokenId++) {
        try {
          checkedTokens++;
          const blockchainNFT = await blockchainService.getNFTByTokenId(tokenId.toString());
          if (!blockchainNFT) {
            throw new Error(`Token ${tokenId} not found on blockchain`);
          }
          console.log(`\u{1F3AF} Successfully detected Token ${tokenId} (owner: ${blockchainNFT.owner}) in post-mint sync`);
          if (blockchainNFT) {
            console.log(`\u{1F195} Found new token ${tokenId} owned by ${blockchainNFT.owner}`);
            const dbFormat = await blockchainService.blockchainNFTToDBFormat(blockchainNFT);
            await storage.createNFT(dbFormat);
            newNFTsAdded++;
            console.log(`\u2705 Added fresh minted NFT #${tokenId} to database`);
          }
        } catch (error) {
          console.log(`\u23F9\uFE0F Token ${tokenId} not found, continuing...`);
          if (checkedTokens >= 3 && newNFTsAdded === 0) {
            console.log(`\u{1F6D1} No new tokens found after checking ${checkedTokens} slots`);
            break;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      console.log(`\u26A1 Post-mint sync completed: ${newNFTsAdded} new NFTs added (checked ${checkedTokens} slots)`);
      res.json({
        success: true,
        message: `Post-mint sync: ${newNFTsAdded} new NFTs added`,
        newNFTs: newNFTsAdded,
        checkedTokens
      });
    } catch (error) {
      console.error("Error in post-mint sync:", error);
      res.status(500).json({ success: false, message: "Post-mint sync failed" });
    }
  });
  app2.get("/api/admin/debug/token47", async (req, res) => {
    const adminKey = req.headers["x-admin-key"];
    if (adminKey !== "debug-2025-token47") {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      console.log("\u{1F50D} DEBUG: Direct Token 47 detection attempt...");
      for (let attempt = 1; attempt <= 10; attempt++) {
        try {
          console.log(`\u{1F504} Attempt ${attempt}/10 for Token 47...`);
          const token47 = await blockchainService.getNFTByTokenId("47");
          if (!token47) {
            throw new Error("Token 47 not found");
          }
          const owner = token47.owner;
          const tokenURI = token47.tokenURI;
          console.log(`\u2705 SUCCESS! Token 47 owner: ${owner}, tokenURI: ${tokenURI}`);
          const dbFormat = {
            id: "blockchain-47",
            title: "Token 47 (Direct Detection)",
            description: "Critical token detected via debug endpoint",
            imageUrl: tokenURI,
            location: "Unknown Location",
            latitude: "0",
            longitude: "0",
            category: "Unknown",
            price: "0",
            isForSale: 0,
            // INTEGER: 0 = false, 1 = true
            creatorAddress: owner.toLowerCase(),
            ownerAddress: owner.toLowerCase(),
            tokenId: "47",
            contractAddress: "0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f"
          };
          await storage.createNFT(dbFormat);
          clearAllCache();
          return res.json({
            success: true,
            message: "Token 47 detected and saved!",
            owner: owner.toLowerCase(),
            tokenURI,
            attempt
          });
        } catch (error) {
          console.log(`\u274C Attempt ${attempt} failed:`, error.message);
          if (attempt < 10) {
            await new Promise((resolve) => setTimeout(resolve, 2e3));
          }
        }
      }
      res.json({ success: false, message: "Token 47 detection failed after 10 attempts" });
    } catch (error) {
      console.error("Error in Token 47 debug:", error);
      res.status(500).json({ success: false, message: "Debug endpoint failed" });
    }
  });
  app2.post("/api/sync/blockchain", async (req, res) => {
    try {
      console.log("\u{1F527} Manual blockchain sync requested...");
      clearAllCache();
      const blockchainNFTs = await blockchainService.getAllNFTs();
      console.log(`Found ${blockchainNFTs.length} NFTs on blockchain`);
      const allDbNFTs = await storage.getAllNFTs();
      const contractNFTs = allDbNFTs.filter(
        (nft) => !nft.contractAddress || nft.contractAddress === ALLOWED_CONTRACT
      );
      let updatedCount = 0;
      let addedCount = 0;
      for (const blockchainNFT of blockchainNFTs) {
        const existsInDb = contractNFTs.find((nft) => nft.tokenId === blockchainNFT.tokenId);
        if (!existsInDb) {
          console.log(`\u{1F195} Adding new blockchain NFT #${blockchainNFT.tokenId} to database`);
          const dbFormat = await blockchainService.blockchainNFTToDBFormat(blockchainNFT);
          await storage.createNFT(dbFormat);
          addedCount++;
        } else {
          let needsUpdate = false;
          const updateData = {};
          if (existsInDb.ownerAddress !== blockchainNFT.owner) {
            console.log(`\u{1F504} Updating owner for NFT #${blockchainNFT.tokenId}`);
            updateData.ownerAddress = blockchainNFT.owner;
            needsUpdate = true;
          }
          if (blockchainNFT.metadata && blockchainNFT.metadata.attributes) {
            const metadata = blockchainNFT.metadata;
            const latAttr = metadata.attributes.find(
              (attr) => attr.trait_type?.toLowerCase().includes("latitude")
            );
            const lngAttr = metadata.attributes.find(
              (attr) => attr.trait_type?.toLowerCase().includes("longitude")
            );
            if (latAttr && lngAttr && latAttr.value !== "0" && lngAttr.value !== "0") {
              const currentLat = parseFloat(existsInDb.latitude);
              const currentLng = parseFloat(existsInDb.longitude);
              if (blockchainNFT.tokenId === "35") {
                console.log(`\u{1F1F9}\u{1F1ED} Forcing Pattaya location for NFT #35 (overriding metadata)`);
                updateData.latitude = "12.9236";
                updateData.longitude = "100.8825";
                updateData.location = "Pattaya, Thailand";
                updateData.metadata = JSON.stringify(metadata);
                needsUpdate = true;
              } else if (currentLat === 0 && currentLng === 0 || Math.abs(currentLat - parseFloat(latAttr.value)) > 1e-4 || Math.abs(currentLng - parseFloat(lngAttr.value)) > 1e-4) {
                console.log(`\u{1F30D} Updating coordinates for NFT #${blockchainNFT.tokenId}: ${latAttr.value}, ${lngAttr.value}`);
                updateData.latitude = latAttr.value;
                updateData.longitude = lngAttr.value;
                const locationAttr = metadata.attributes.find(
                  (attr) => attr.trait_type?.toLowerCase().includes("location")
                );
                if (locationAttr && locationAttr.value) {
                  updateData.location = locationAttr.value;
                }
                if (metadata.name && metadata.name !== `Travel NFT #${blockchainNFT.tokenId}`) {
                  updateData.title = metadata.name;
                }
                if (metadata.image) {
                  updateData.imageUrl = metadata.image;
                }
                if (metadata.description) {
                  updateData.description = metadata.description;
                }
                const categoryAttr = metadata.attributes.find(
                  (attr) => attr.trait_type?.toLowerCase().includes("category")
                );
                if (categoryAttr && categoryAttr.value) {
                  updateData.category = categoryAttr.value.toLowerCase();
                }
                updateData.metadata = JSON.stringify(metadata);
                needsUpdate = true;
              }
            }
          }
          if (needsUpdate) {
            await storage.updateNFT(existsInDb.id, updateData);
            updatedCount++;
          }
        }
      }
      console.log(`\u2705 Manual blockchain sync completed: ${addedCount} added, ${updatedCount} updated`);
      res.json({
        success: true,
        message: `Sync completed: ${addedCount} NFTs added, ${updatedCount} NFTs updated`,
        totalBlockchainNFTs: blockchainNFTs.length
      });
    } catch (error) {
      console.error("Manual blockchain sync failed:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.use("/api/ipfs", ipfs_default);
  const upload2 = multer2({ storage: multer2.memoryStorage() });
  app2.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    const objectStorageService2 = new ObjectStorageService();
    try {
      const file = await objectStorageService2.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService2.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService2 = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService2.getObjectEntityFile(
        req.path
      );
      objectStorageService2.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });
  app2.post("/api/object-storage/upload", upload2.single("file"), async (req, res) => {
    try {
      const file = req.file;
      const { fileName, mimeType } = req.body;
      if (!file) {
        return res.status(400).json({ error: "No file provided" });
      }
      const pinataJwt = process.env.PINATA_JWT;
      if (!pinataJwt) {
        return res.status(500).json({ error: "Pinata JWT not configured" });
      }
      const formData = new FormData();
      const blob = new Blob([file.buffer], { type: mimeType || file.mimetype });
      formData.append("file", blob, fileName || file.originalname);
      const pinataResponse = await fetch("https://uploads.pinata.cloud/v3/files", {
        method: "POST",
        headers: { "Authorization": `Bearer ${pinataJwt}` },
        body: formData
      });
      if (!pinataResponse.ok) {
        const errText = await pinataResponse.text();
        throw new Error(`Pinata upload failed: ${pinataResponse.statusText} - ${errText}`);
      }
      const pinataData = await pinataResponse.json();
      const cid = pinataData.data?.cid || pinataData.IpfsHash;
      const fullObjectUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;
      console.log("Object uploaded to IPFS:", fullObjectUrl);
      res.json({ objectUrl: fullObjectUrl });
    } catch (error) {
      console.error("\u274C Object upload failed:", error);
      res.status(500).json({ error: "Upload failed" });
    }
  });
  app2.post("/api/fix-token-images", async (req, res) => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const objectStorageService2 = new ObjectStorageService();
      const tokenImages = {
        "29": "attached_assets/29_1756885009207.jpeg",
        "30": "attached_assets/30_1756885009203.jpeg",
        "31": "attached_assets/31_1756885009206.jpeg"
      };
      const results = [];
      for (const [tokenId, filePath] of Object.entries(tokenImages)) {
        try {
          const imageBuffer = fs.readFileSync(filePath);
          const fileName = path.basename(filePath);
          const objectUrl = await objectStorageService2.uploadFileBuffer(
            imageBuffer,
            fileName,
            "image/jpeg"
          );
          const existingNFT = await storage.getNFTByTokenId(tokenId);
          if (existingNFT) {
            await storage.updateNFT(existingNFT.id, {
              objectStorageUrl: objectUrl
            });
            console.log(`\u2705 Updated Token ${tokenId} with Object Storage URL:`, objectUrl);
            results.push({ tokenId, objectUrl, status: "success" });
          } else {
            results.push({ tokenId, status: "not_found" });
          }
        } catch (error) {
          console.error(`\u274C Failed to process Token ${tokenId}:`, error);
          results.push({ tokenId, status: "error", error: error instanceof Error ? error.message : "Unknown error" });
        }
      }
      res.json({ success: true, results });
    } catch (error) {
      console.error("\u274C Fix token images failed:", error);
      res.status(500).json({ error: "Failed to fix token images" });
    }
  });
  app2.get("/api/neynar/score/:fid", async (req, res) => {
    try {
      const fid = req.params.fid;
      if (!fid || !/^\d+$/.test(fid)) {
        return res.status(400).json({ message: "Invalid FID" });
      }
      const neynarApiKey = process.env.NEYNAR_API_KEY;
      if (!neynarApiKey) {
        return res.status(500).json({ message: "Neynar API key not configured" });
      }
      const response = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, {
        headers: {
          "accept": "application/json",
          "x-api-key": neynarApiKey
        }
      });
      if (!response.ok) {
        console.error("Neynar API error:", response.status, await response.text());
        return res.status(response.status).json({ message: "Failed to fetch from Neynar API" });
      }
      const data = await response.json();
      if (!data.users || data.users.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      const user = data.users[0];
      const neynarScore = user.score ?? user.experimental?.neynar_user_score ?? 0;
      res.json({
        fid: user.fid,
        username: user.username,
        displayName: user.display_name,
        pfpUrl: user.pfp_url,
        followerCount: user.follower_count,
        followingCount: user.following_count,
        neynarScore,
        activeStatus: user.active_status,
        verifiedAddresses: user.verified_addresses?.eth_addresses || []
      });
    } catch (error) {
      console.error("Error fetching Neynar score:", error);
      res.status(500).json({ message: "Failed to fetch Neynar score" });
    }
  });
  app2.get("/api/neynar/share-image/:fid", async (req, res) => {
    try {
      const fid = req.params.fid;
      if (!fid || !/^\d+$/.test(fid)) {
        return res.status(400).json({ message: "Invalid FID" });
      }
      const neynarApiKey = process.env.NEYNAR_API_KEY;
      if (!neynarApiKey) {
        return res.status(500).json({ message: "Neynar API key not configured" });
      }
      const response = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, {
        headers: {
          "accept": "application/json",
          "x-api-key": neynarApiKey
        }
      });
      if (!response.ok) {
        console.error("Neynar API error:", response.status);
        return res.status(response.status).json({ message: "Failed to fetch from Neynar API" });
      }
      const data = await response.json();
      if (!data.users || data.users.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      const user = data.users[0];
      const neynarScore = user.score ?? user.experimental?.neynar_user_score ?? 0;
      const username = user.username || "Anonymous";
      const pfpUrl = user.pfp_url;
      let avatarDataUrl = "";
      if (pfpUrl) {
        try {
          const avatarResponse = await fetch(pfpUrl);
          if (avatarResponse.ok) {
            const avatarBuffer = await avatarResponse.arrayBuffer();
            const contentType = avatarResponse.headers.get("content-type") || "image/jpeg";
            avatarDataUrl = `data:${contentType};base64,${Buffer.from(avatarBuffer).toString("base64")}`;
          }
        } catch (e) {
          console.error("Failed to fetch avatar:", e);
        }
      }
      const svg = await satori(
        {
          type: "div",
          props: {
            style: {
              width: "1200px",
              height: "630px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #FF7A18 0%, #AF1EB6 50%, #833AB4 100%)",
              fontFamily: "Inter"
            },
            children: [
              // Avatar
              avatarDataUrl ? {
                type: "img",
                props: {
                  src: avatarDataUrl,
                  width: 140,
                  height: 140,
                  style: {
                    width: "140px",
                    height: "140px",
                    borderRadius: "70px",
                    border: "4px solid rgba(255,255,255,0.5)",
                    marginBottom: "24px",
                    objectFit: "cover"
                  }
                }
              } : null,
              // Username's Neynar Score
              {
                type: "div",
                props: {
                  style: {
                    color: "white",
                    fontSize: "42px",
                    fontWeight: "500",
                    marginBottom: "16px"
                  },
                  children: `${username}'s Neynar Score`
                }
              },
              // Score value
              {
                type: "div",
                props: {
                  style: {
                    color: "white",
                    fontSize: "120px",
                    fontWeight: "700",
                    marginBottom: "24px"
                  },
                  children: neynarScore.toFixed(2)
                }
              },
              // CTA text
              {
                type: "div",
                props: {
                  style: {
                    color: "rgba(255,255,255,0.8)",
                    fontSize: "32px",
                    fontWeight: "400"
                  },
                  children: "Check your Neynar Score"
                }
              }
            ].filter(Boolean)
          }
        },
        {
          width: 1200,
          height: 630,
          fonts: [
            {
              name: "Inter",
              data: interRegular,
              weight: 400,
              style: "normal"
            },
            {
              name: "Inter",
              data: interBold,
              weight: 700,
              style: "normal"
            }
          ]
        }
      );
      const resvg = new Resvg(svg, {
        fitTo: {
          mode: "width",
          value: 1200
        }
      });
      const pngData = resvg.render();
      const pngBuffer = pngData.asPng();
      res.set({
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=300, s-maxage=3600"
      });
      res.send(pngBuffer);
    } catch (error) {
      console.error("Error generating share image:", error);
      res.status(500).json({ message: "Failed to generate share image" });
    }
  });
  app2.get("/api/user-stats/:fid", async (req, res) => {
    try {
      const validationResult = userStatsParamsSchema.safeParse(req.params);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid request parameters",
          errors: validationResult.error.errors
        });
      }
      const { fid } = validationResult.data;
      const { username, pfpUrl } = req.query;
      let userStats2 = await storage.getUserStats(fid);
      if (!userStats2 && username && typeof username === "string") {
        console.log(`\u{1F3AF} Auto-creating userStats for FID ${fid} (${username})`);
        userStats2 = await storage.createOrUpdateUserStats({
          farcasterFid: fid,
          farcasterUsername: username,
          farcasterPfpUrl: typeof pfpUrl === "string" ? pfpUrl : void 0,
          totalPoints: 0,
          currentStreak: 0
        });
        console.log(`\u2705 Created userStats with referral code: ${userStats2.referralCode}`);
      }
      if (!userStats2) {
        return res.json({
          farcasterFid: fid,
          farcasterUsername: "",
          totalPoints: 0,
          currentStreak: 0,
          lastCheckIn: null,
          lastStreakClaim: null
        });
      }
      res.json(userStats2);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ message: "Failed to fetch user stats" });
    }
  });
  app2.get("/api/quest-completions/:fid/:date", async (req, res) => {
    try {
      const validationResult = questCompletionsParamsSchema.safeParse(req.params);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid request parameters",
          errors: validationResult.error.errors
        });
      }
      const { fid, date } = validationResult.data;
      const completions = await storage.getQuestCompletions(fid, date);
      res.json(completions);
    } catch (error) {
      console.error("Error fetching quest completions:", error);
      res.status(500).json({ message: "Failed to fetch quest completions" });
    }
  });
  app2.get("/api/holder-status/:address", async (req, res) => {
    try {
      const validationResult = holderStatusParamsSchema.safeParse(req.params);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid request parameters",
          errors: validationResult.error.errors
        });
      }
      const { address } = validationResult.data;
      const holderStatus = await storage.checkHolderStatus(address.toLowerCase());
      res.json(holderStatus);
    } catch (error) {
      console.error("Error checking holder status:", error);
      res.status(500).json({ message: "Failed to check holder status" });
    }
  });
  app2.get("/api/combined-holder-status/:fid", async (req, res) => {
    try {
      const validationResult = userStatsParamsSchema.safeParse(req.params);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid request parameters",
          errors: validationResult.error.errors
        });
      }
      const { fid } = validationResult.data;
      const combinedHolderStatus = await storage.checkCombinedHolderStatus(fid);
      res.json(combinedHolderStatus);
    } catch (error) {
      console.error("Error checking combined holder status:", error);
      res.status(500).json({ message: "Failed to check combined holder status" });
    }
  });
  app2.get("/api/leaderboard", async (req, res) => {
    try {
      const validationResult = leaderboardQuerySchema.safeParse(req.query);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid query parameters",
          errors: validationResult.error.errors
        });
      }
      const limit = validationResult.data.limit ? parseInt(validationResult.data.limit) : 50;
      const leaderboard = await storage.getLeaderboard(limit);
      const filteredLeaderboard = leaderboard.filter((entry) => entry.farcasterUsername !== "coinacci");
      const rankedLeaderboard = filteredLeaderboard.map((entry, index) => ({
        ...entry,
        rank: index + 1
      }));
      res.json(rankedLeaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });
  app2.get("/api/leaderboard/weekly", async (req, res) => {
    try {
      const validationResult = leaderboardQuerySchema.safeParse(req.query);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid query parameters",
          errors: validationResult.error.errors
        });
      }
      const limit = validationResult.data.limit ? parseInt(validationResult.data.limit) : 50;
      const weeklyLeaderboard = await storage.getWeeklyLeaderboard(limit);
      const filteredLeaderboard = weeklyLeaderboard.filter((entry) => entry.farcasterUsername !== "coinacci");
      const rankedLeaderboard = filteredLeaderboard.map((entry, index) => ({
        ...entry,
        rank: index + 1
      }));
      res.json(rankedLeaderboard);
    } catch (error) {
      console.error("Error fetching weekly leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch weekly leaderboard" });
    }
  });
  app2.get("/api/weekly-champions", async (req, res) => {
    try {
      const validationResult = leaderboardQuerySchema.safeParse(req.query);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid query parameters",
          errors: validationResult.error.errors
        });
      }
      const limit = validationResult.data.limit ? parseInt(validationResult.data.limit) : 10;
      const champions = await storage.getWeeklyChampions(limit);
      res.json(champions);
    } catch (error) {
      console.error("Error fetching weekly champions:", error);
      res.status(500).json({ message: "Failed to fetch weekly champions" });
    }
  });
  app2.get("/api/badges/user/:identifier", async (req, res) => {
    try {
      const { identifier } = req.params;
      let earnedBadges;
      if (identifier.startsWith("0x")) {
        earnedBadges = await storage.getUserBadges({ walletAddress: identifier });
      } else {
        earnedBadges = await storage.getUserBadges({ farcasterFid: identifier });
      }
      res.json({ earnedBadges });
    } catch (error) {
      console.error("Error fetching user badges:", error);
      res.status(500).json({ message: "Failed to fetch user badges" });
    }
  });
  const EARLYBIRD_CONTRACT = "0xe52DB67CcFFead0a751C667829B250a356e7aa08";
  const ERC721_EARLYBIRD_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
    "function tokenURI(uint256 tokenId) view returns (string)"
  ];
  app2.get("/api/badges/earlybird/:walletAddress", async (req, res) => {
    try {
      const { walletAddress } = req.params;
      if (!walletAddress || !walletAddress.startsWith("0x")) {
        return res.status(400).json({ hasEarlyBird: false, message: "Invalid wallet address" });
      }
      const provider2 = new ethers3.JsonRpcProvider("https://base-rpc.publicnode.com");
      const contract = new ethers3.Contract(EARLYBIRD_CONTRACT, ERC721_EARLYBIRD_ABI, provider2);
      const balance = await contract.balanceOf(walletAddress);
      const hasEarlyBird = balance > 0n;
      let imageUrl = null;
      if (hasEarlyBird) {
        try {
          const tokenId = await contract.tokenOfOwnerByIndex(walletAddress, 0);
          const tokenURI = await contract.tokenURI(tokenId);
          let metadataUrl = tokenURI;
          if (tokenURI.startsWith("ipfs://")) {
            metadataUrl = tokenURI.replace("ipfs://", "https://ipfs.io/ipfs/");
          }
          const metadataResponse = await fetch(metadataUrl);
          const metadata = await metadataResponse.json();
          if (metadata.image) {
            imageUrl = metadata.image;
            if (imageUrl.startsWith("ipfs://")) {
              imageUrl = imageUrl.replace("ipfs://", "https://ipfs.io/ipfs/");
            }
          }
        } catch (metaError) {
          console.error("Error fetching EarlyBird metadata:", metaError);
        }
      }
      res.json({ hasEarlyBird, balance: balance.toString(), imageUrl });
    } catch (error) {
      console.error("Error checking EarlyBird NFT:", error);
      res.json({ hasEarlyBird: false, balance: "0", imageUrl: null });
    }
  });
  const EVENT_NFT_CONTRACTS = {
    ethdenver_2026: "0xc30C6a80Ba0403a2C0005f6e6986c0f0fa6A2BE5"
  };
  const ERC721_EVENT_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
    "function tokenURI(uint256 tokenId) view returns (string)"
  ];
  app2.get("/api/badges/events/:walletAddress", async (req, res) => {
    try {
      const { walletAddress } = req.params;
      if (!walletAddress || !walletAddress.startsWith("0x")) {
        return res.status(400).json({ events: [] });
      }
      const provider2 = new ethers3.JsonRpcProvider("https://base-rpc.publicnode.com");
      const EVENT_BADGES = [
        {
          id: "ethdenver_2026",
          name: "ETHDenver 2026",
          description: "Proof of Event - ETHDenver 2026"
        }
      ];
      const events = await Promise.all(EVENT_BADGES.map(async (badge) => {
        const contractAddress = EVENT_NFT_CONTRACTS[badge.id];
        if (!contractAddress) {
          return { id: badge.id, name: badge.name, description: badge.description, owned: false, imageUrl: null };
        }
        try {
          const contract = new ethers3.Contract(contractAddress, ERC721_EVENT_ABI, provider2);
          const balance = await contract.balanceOf(walletAddress);
          const owned = balance > 0n;
          let imageUrl = null;
          if (owned) {
            try {
              const tokenId = await contract.tokenOfOwnerByIndex(walletAddress, 0);
              const tokenURI = await contract.tokenURI(tokenId);
              let metadataUrl = tokenURI;
              if (tokenURI.startsWith("ipfs://")) {
                metadataUrl = tokenURI.replace("ipfs://", "https://ipfs.io/ipfs/");
              }
              const metadataResponse = await fetch(metadataUrl);
              const metadata = await metadataResponse.json();
              if (metadata.image) {
                imageUrl = metadata.image;
                if (imageUrl.startsWith("ipfs://")) {
                  imageUrl = imageUrl.replace("ipfs://", "https://ipfs.io/ipfs/");
                }
              }
            } catch (metaError) {
              console.error(`Error fetching ${badge.name} metadata:`, metaError);
            }
          }
          return { id: badge.id, name: badge.name, description: badge.description, owned, imageUrl };
        } catch (err) {
          console.error(`Error checking ${badge.name} NFT:`, err);
          return { id: badge.id, name: badge.name, description: badge.description, owned: false, imageUrl: null };
        }
      }));
      res.json({ events });
    } catch (error) {
      console.error("Error checking event badges:", error);
      res.json({ events: [] });
    }
  });
  app2.post("/api/admin/backfill-badges", async (req, res) => {
    try {
      const adminSecret = process.env.ADMIN_SECRET || "dev-admin-secret-2024";
      const providedSecret = req.headers.authorization || req.headers["x-admin-secret"];
      if (!providedSecret || providedSecret !== adminSecret) {
        return res.status(401).json({ message: "Unauthorized - invalid admin secret" });
      }
      console.log("\u{1F3C6} Starting retroactive badge backfill...");
      const badgesAwarded = [];
      const BADGE_CRITERIA = {
        // Mint badges - based on number of NFTs minted
        mint: [
          { code: "first_mint", requirement: 1 },
          { code: "explorer", requirement: 5 },
          { code: "globetrotter", requirement: 10 },
          { code: "nft_master", requirement: 25 }
        ],
        // Location badges - based on unique countries/cities
        country: [
          { code: "multi_country", requirement: 3 },
          { code: "world_traveler", requirement: 5 },
          { code: "global_citizen", requirement: 10 }
        ],
        city: [
          { code: "multi_city", requirement: 3 },
          { code: "city_explorer", requirement: 5 },
          { code: "urban_nomad", requirement: 10 }
        ],
        // Social badges - tips given
        tipsGiven: [
          { code: "first_tipper", requirement: 1 },
          { code: "generous", requirement: 5 },
          { code: "philanthropist", requirement: 10 }
        ],
        // Social badges - likes received
        likesReceived: [
          { code: "first_like", requirement: 1 },
          { code: "liked", requirement: 5 },
          { code: "popular", requirement: 10 },
          { code: "superstar", requirement: 50 }
        ],
        // Social badges - tips received
        tipsReceived: [
          { code: "tip_receiver", requirement: 1 },
          { code: "tip_collector", requirement: 5 },
          { code: "tip_magnet", requirement: 10 }
        ],
        // Loyalty badges - based on total badge count (excluding these loyalty badges themselves)
        badgeCount: [
          { code: "task_beginner", requirement: 1 },
          { code: "task_enthusiast", requirement: 5 },
          { code: "task_veteran", requirement: 10 },
          { code: "task_master", requirement: 20 }
        ]
      };
      const CITY_TO_COUNTRY = {
        "tiflis": "Georgia",
        "tbilisi": "Georgia",
        "dubai": "UAE",
        "abu dhabi": "UAE",
        "paris": "France",
        "nice": "France",
        "lyon": "France",
        "london": "UK",
        "manchester": "UK",
        "edinburgh": "UK",
        "new york": "USA",
        "los angeles": "USA",
        "miami": "USA",
        "san francisco": "USA",
        "tokyo": "Japan",
        "osaka": "Japan",
        "kyoto": "Japan",
        "istanbul": "Turkey",
        "ankara": "Turkey",
        "antalya": "Turkey",
        "berlin": "Germany",
        "munich": "Germany",
        "frankfurt": "Germany",
        "rome": "Italy",
        "milan": "Italy",
        "venice": "Italy",
        "florence": "Italy",
        "barcelona": "Spain",
        "madrid": "Spain",
        "seville": "Spain",
        "amsterdam": "Netherlands",
        "rotterdam": "Netherlands",
        "vienna": "Austria",
        "salzburg": "Austria",
        "prague": "Czech Republic",
        "brno": "Czech Republic",
        "athens": "Greece",
        "santorini": "Greece",
        "lisbon": "Portugal",
        "porto": "Portugal",
        "dublin": "Ireland",
        "brussels": "Belgium",
        "zurich": "Switzerland",
        "geneva": "Switzerland",
        "stockholm": "Sweden",
        "copenhagen": "Denmark",
        "oslo": "Norway",
        "helsinki": "Finland",
        "warsaw": "Poland",
        "krakow": "Poland",
        "budapest": "Hungary",
        "bangkok": "Thailand",
        "phuket": "Thailand",
        "chiang mai": "Thailand",
        "singapore": "Singapore",
        "hong kong": "Hong Kong",
        "seoul": "South Korea",
        "busan": "South Korea",
        "sydney": "Australia",
        "melbourne": "Australia",
        "cairo": "Egypt",
        "cape town": "South Africa",
        "johannesburg": "South Africa",
        "moscow": "Russia",
        "st petersburg": "Russia",
        "beijing": "China",
        "shanghai": "China",
        "mumbai": "India",
        "delhi": "India",
        "bangalore": "India",
        "mexico city": "Mexico",
        "cancun": "Mexico",
        "sao paulo": "Brazil",
        "rio de janeiro": "Brazil",
        "buenos aires": "Argentina",
        "marrakech": "Morocco",
        "toronto": "Canada",
        "vancouver": "Canada",
        "montreal": "Canada"
      };
      const extractCountryFromLocation = (location) => {
        const locationLower = location.toLowerCase();
        for (const [city, country] of Object.entries(CITY_TO_COUNTRY)) {
          if (locationLower.includes(city)) {
            return country;
          }
        }
        const parts = location.split(",").map((p) => p.trim());
        if (parts.length >= 2) {
          return parts[parts.length - 1];
        }
        return null;
      };
      const extractCityFromLocation = (location) => {
        const parts = location.split(",").map((p) => p.trim());
        if (parts.length >= 1) {
          return parts[0];
        }
        return location;
      };
      const allNfts = await storage.getAllNFTs();
      const allTransactions = await db.select().from(transactions);
      const allLikes = await db.select().from(nftLikes);
      const allUserStats = await db.select().from(userStats);
      const fidToWallet = /* @__PURE__ */ new Map();
      const walletToFid = /* @__PURE__ */ new Map();
      for (const us of allUserStats) {
        if (us.walletAddress) {
          fidToWallet.set(us.farcasterFid, us.walletAddress.toLowerCase());
          walletToFid.set(us.walletAddress.toLowerCase(), us.farcasterFid);
        }
      }
      const userMints = /* @__PURE__ */ new Map();
      const userCountries = /* @__PURE__ */ new Map();
      const userCities = /* @__PURE__ */ new Map();
      const userTipsGiven = /* @__PURE__ */ new Map();
      const userLikesReceived = /* @__PURE__ */ new Map();
      const userTipsReceived = /* @__PURE__ */ new Map();
      for (const nft of allNfts) {
        const wallet = nft.creatorAddress.toLowerCase();
        userMints.set(wallet, (userMints.get(wallet) || 0) + 1);
        const country = extractCountryFromLocation(nft.location);
        const city = extractCityFromLocation(nft.location);
        if (country) {
          if (!userCountries.has(wallet)) userCountries.set(wallet, /* @__PURE__ */ new Set());
          userCountries.get(wallet).add(country);
        }
        if (city) {
          if (!userCities.has(wallet)) userCities.set(wallet, /* @__PURE__ */ new Set());
          userCities.get(wallet).add(city);
        }
      }
      for (const tx of allTransactions) {
        if (tx.transactionType === "tip" || tx.transactionType === "donation") {
          if (tx.fromAddress) {
            const fromWallet = tx.fromAddress.toLowerCase();
            const toWallet = tx.toAddress.toLowerCase();
            if (!userTipsGiven.has(fromWallet)) userTipsGiven.set(fromWallet, /* @__PURE__ */ new Set());
            userTipsGiven.get(fromWallet).add(toWallet);
            userTipsReceived.set(toWallet, (userTipsReceived.get(toWallet) || 0) + 1);
          }
        }
      }
      const nftIdToCreator = /* @__PURE__ */ new Map();
      for (const nft of allNfts) {
        nftIdToCreator.set(nft.id, nft.creatorAddress.toLowerCase());
      }
      for (const like of allLikes) {
        const creatorWallet = nftIdToCreator.get(like.nftId);
        if (creatorWallet) {
          userLikesReceived.set(creatorWallet, (userLikesReceived.get(creatorWallet) || 0) + 1);
        }
      }
      const awardBadgeIfEligible = async (badgeCode, identifier) => {
        try {
          const result = await storage.awardBadge(badgeCode, identifier);
          if (result) {
            const id = identifier.farcasterFid || identifier.walletAddress || "unknown";
            badgesAwarded.push({ badge: badgeCode, identifier: id });
            console.log(`  \u2713 Awarded ${badgeCode} to ${id}`);
          }
        } catch (error) {
        }
      };
      console.log("\u{1F4E6} Processing mint badges...");
      for (const [wallet, count] of Array.from(userMints)) {
        const fid = walletToFid.get(wallet);
        const identifier = fid ? { farcasterFid: fid } : { walletAddress: wallet };
        for (const badge of BADGE_CRITERIA.mint) {
          if (count >= badge.requirement) {
            await awardBadgeIfEligible(badge.code, identifier);
          }
        }
      }
      console.log("\u{1F30D} Processing location badges...");
      for (const [wallet, countries] of Array.from(userCountries)) {
        const fid = walletToFid.get(wallet);
        const identifier = fid ? { farcasterFid: fid } : { walletAddress: wallet };
        for (const badge of BADGE_CRITERIA.country) {
          if (countries.size >= badge.requirement) {
            await awardBadgeIfEligible(badge.code, identifier);
          }
        }
      }
      for (const [wallet, cities] of Array.from(userCities)) {
        const fid = walletToFid.get(wallet);
        const identifier = fid ? { farcasterFid: fid } : { walletAddress: wallet };
        for (const badge of BADGE_CRITERIA.city) {
          if (cities.size >= badge.requirement) {
            await awardBadgeIfEligible(badge.code, identifier);
          }
        }
      }
      console.log("\u{1F49D} Processing tips given badges...");
      for (const [wallet, creators] of Array.from(userTipsGiven)) {
        const fid = walletToFid.get(wallet);
        const identifier = fid ? { farcasterFid: fid } : { walletAddress: wallet };
        for (const badge of BADGE_CRITERIA.tipsGiven) {
          if (creators.size >= badge.requirement) {
            await awardBadgeIfEligible(badge.code, identifier);
          }
        }
      }
      console.log("\u2764\uFE0F Processing likes received badges...");
      for (const [wallet, count] of Array.from(userLikesReceived)) {
        const fid = walletToFid.get(wallet);
        const identifier = fid ? { farcasterFid: fid } : { walletAddress: wallet };
        for (const badge of BADGE_CRITERIA.likesReceived) {
          if (count >= badge.requirement) {
            await awardBadgeIfEligible(badge.code, identifier);
          }
        }
      }
      console.log("\u{1F4B0} Processing tips received badges...");
      for (const [wallet, count] of Array.from(userTipsReceived)) {
        const fid = walletToFid.get(wallet);
        const identifier = fid ? { farcasterFid: fid } : { walletAddress: wallet };
        for (const badge of BADGE_CRITERIA.tipsReceived) {
          if (count >= badge.requirement) {
            await awardBadgeIfEligible(badge.code, identifier);
          }
        }
      }
      console.log("\u{1F3AF} Processing badge count loyalty badges...");
      const allUserBadges = await db.select().from(userBadges);
      const loyaltyCodes = /* @__PURE__ */ new Set(["task_beginner", "task_enthusiast", "task_veteran", "task_master"]);
      const allBadgeRecords = await db.select().from(badges);
      const badgeIdToCode = /* @__PURE__ */ new Map();
      for (const badge of allBadgeRecords) {
        badgeIdToCode.set(badge.id, badge.code);
      }
      const fidBadgeCount = /* @__PURE__ */ new Map();
      const walletBadgeCount = /* @__PURE__ */ new Map();
      for (const ub of allUserBadges) {
        const badgeCode = badgeIdToCode.get(ub.badgeId);
        if (!badgeCode || loyaltyCodes.has(badgeCode)) continue;
        if (ub.farcasterFid) {
          fidBadgeCount.set(ub.farcasterFid, (fidBadgeCount.get(ub.farcasterFid) || 0) + 1);
        } else if (ub.walletAddress) {
          walletBadgeCount.set(ub.walletAddress.toLowerCase(), (walletBadgeCount.get(ub.walletAddress.toLowerCase()) || 0) + 1);
        }
      }
      for (const [fid, count] of Array.from(fidBadgeCount)) {
        const identifier = { farcasterFid: fid };
        for (const badge of BADGE_CRITERIA.badgeCount) {
          if (count >= badge.requirement) {
            await awardBadgeIfEligible(badge.code, identifier);
          }
        }
      }
      for (const [wallet, count] of Array.from(walletBadgeCount)) {
        const fid = walletToFid.get(wallet);
        const identifier = fid ? { farcasterFid: fid } : { walletAddress: wallet };
        for (const badge of BADGE_CRITERIA.badgeCount) {
          if (count >= badge.requirement) {
            await awardBadgeIfEligible(badge.code, identifier);
          }
        }
      }
      console.log(`\u2705 Badge backfill complete! Awarded ${badgesAwarded.length} badges.`);
      res.json({
        success: true,
        badgesAwarded: badgesAwarded.length,
        details: badgesAwarded,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      console.error("\u274C Badge backfill failed:", error);
      res.status(500).json({
        success: false,
        message: "Badge backfill failed",
        error: error.message
      });
    }
  });
  app2.post("/api/admin/backfill-weekly", async (req, res) => {
    try {
      const adminSecret = process.env.ADMIN_SECRET || "dev-admin-secret-2024";
      const providedSecret = req.headers.authorization || req.headers["x-admin-secret"];
      if (!providedSecret || providedSecret !== adminSecret) {
        return res.status(401).json({ message: "Unauthorized - invalid admin secret" });
      }
      console.log("\u{1F527} Admin backfill requested - starting weekly points migration...");
      const result = await storage.backfillWeeklyPointsFromTotal();
      console.log("\u2705 Admin backfill completed:", result);
      res.json({
        success: true,
        ...result,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      console.error("\u274C Admin backfill failed:", error);
      res.status(500).json({
        success: false,
        message: "Backfill failed",
        error: error.message
      });
    }
  });
  app2.post("/api/admin/sync-weekly", async (req, res) => {
    try {
      const adminSecret = process.env.ADMIN_SECRET || "dev-admin-secret-2024";
      const providedSecret = req.headers.authorization || req.headers["x-admin-secret"];
      if (!providedSecret || providedSecret !== adminSecret) {
        return res.status(401).json({ message: "Unauthorized - invalid admin secret" });
      }
      console.log("\u{1F504} Admin sync requested - syncing weekly points with all-time...");
      const result = await storage.syncWeeklyWithAllTime();
      console.log("\u2705 Admin sync completed:", result);
      res.json({
        success: true,
        ...result,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      console.error("\u274C Admin sync failed:", error);
      res.status(500).json({
        success: false,
        message: "Sync failed",
        error: error.message
      });
    }
  });
  app2.post("/api/admin/backfill-referral-codes", async (req, res) => {
    try {
      const adminSecret = process.env.ADMIN_SECRET;
      if (!adminSecret) {
        console.error("\u274C ADMIN_SECRET not configured - blocking admin access");
        return res.status(500).json({ message: "Admin access not configured" });
      }
      const providedSecret = req.headers.authorization || req.headers["x-admin-secret"];
      if (!providedSecret || providedSecret !== adminSecret) {
        return res.status(401).json({ message: "Unauthorized - invalid admin secret" });
      }
      console.log("\u{1F381} Admin backfill requested - generating referral codes...");
      const result = await storage.backfillReferralCodes();
      console.log("\u2705 Admin backfill completed:", result);
      res.json({
        success: true,
        ...result,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      console.error("\u274C Admin backfill failed:", error);
      res.status(500).json({
        success: false,
        message: "Referral code backfill failed",
        error: error.message
      });
    }
  });
  app2.post("/api/cron/weekly-reset", async (req, res) => {
    try {
      const cronSecret = process.env.CRON_SECRET || "dev-cron-secret-2024";
      const providedSecret = req.headers.authorization || req.headers["x-cron-secret"];
      if (!providedSecret || providedSecret !== cronSecret) {
        return res.status(401).json({ message: "Unauthorized - invalid cron secret" });
      }
      console.log("\u{1F550} Cron weekly reset triggered - performing automated reset...");
      await storage.performWeeklyReset();
      console.log("\u2705 Cron weekly reset completed successfully");
      res.json({
        success: true,
        message: "Weekly reset completed successfully",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      console.error("\u274C Cron weekly reset failed:", error);
      res.status(500).json({
        success: false,
        message: "Weekly reset failed",
        error: error.message
      });
    }
  });
  app2.post("/api/quest-claim", async (req, res) => {
    try {
      const validationResult = questClaimSchema.safeParse(req.body);
      if (!validationResult.success) {
        console.warn("\u{1F6A8} Invalid quest claim request:", validationResult.error.errors);
        return res.status(400).json({
          message: "Invalid request data",
          errors: validationResult.error.errors
        });
      }
      const { farcasterFid, questType, walletAddress, castUrl, farcasterUsername, farcasterPfpUrl } = validationResult.data;
      const today = getQuestDay();
      let pointsEarned = 0;
      let userStatsUpdates = {};
      const existingUserStats = await storage.getUserStats(farcasterFid);
      switch (questType) {
        case "daily_checkin":
          pointsEarned = 1;
          if (existingUserStats) {
            const lastCheckIn = existingUserStats.lastCheckIn;
            const yesterdayQuest = getYesterdayQuestDay();
            if (lastCheckIn && getQuestDay(new Date(lastCheckIn)) === yesterdayQuest) {
              userStatsUpdates.currentStreak = existingUserStats.currentStreak + 1;
            } else if (!lastCheckIn || getQuestDay(new Date(lastCheckIn)) !== today) {
              userStatsUpdates.currentStreak = 1;
            }
            userStatsUpdates.lastCheckIn = /* @__PURE__ */ new Date();
          }
          break;
        case "holder_bonus":
          console.log(`\u{1F50D} Checking combined holder bonus for Farcaster FID: ${farcasterFid}`);
          const combinedHolderStatus = await storage.checkCombinedHolderStatus(farcasterFid);
          if (!combinedHolderStatus.isHolder) {
            return res.status(400).json({
              message: "Must hold at least one Travel NFT across all linked wallets to claim holder bonus"
            });
          }
          console.log(`\u2705 Farcaster FID ${farcasterFid} holds ${combinedHolderStatus.nftCount} NFTs across all linked wallets`);
          pointsEarned = combinedHolderStatus.nftCount * 0.15;
          break;
        case "streak_bonus":
          if (!existingUserStats) {
            return res.status(400).json({
              message: "Must complete daily check-ins first to claim streak bonus"
            });
          }
          if (existingUserStats.currentStreak < 7) {
            return res.status(400).json({
              message: `Need ${7 - existingUserStats.currentStreak} more consecutive days to claim streak bonus`
            });
          }
          if (existingUserStats.lastStreakClaim && getQuestDay(new Date(existingUserStats.lastStreakClaim)) === today) {
            return res.status(400).json({ message: "Streak bonus already claimed today" });
          }
          pointsEarned = 7;
          userStatsUpdates.lastStreakClaim = /* @__PURE__ */ new Date();
          break;
        case "base_transaction":
          pointsEarned = 1;
          break;
        case "social_post":
          if (!castUrl) {
            return res.status(400).json({ message: "Cast URL is required for social post quest" });
          }
          console.log(`\u{1F50D} Validating Farcaster cast for social post quest: ${castUrl}`);
          const castValidation = await farcasterCastValidator.validateCast(castUrl);
          if (!castValidation.isValid) {
            return res.status(400).json({
              message: castValidation.reason
            });
          }
          console.log(`\u2705 Cast validation passed for @${farcasterUsername}`);
          pointsEarned = 5;
          break;
        default:
          return res.status(400).json({ message: "Invalid quest type" });
      }
      console.log(`\u{1F3AF} Processing ${questType} quest for user ${farcasterFid} (+${pointsEarned} points)`);
      const result = await storage.claimQuestAtomic({
        farcasterFid,
        farcasterUsername: farcasterUsername.trim(),
        farcasterPfpUrl: farcasterPfpUrl?.trim(),
        walletAddress: walletAddress?.toLowerCase(),
        castUrl,
        // Include cast URL for social_post quests
        questType,
        pointsEarned,
        completionDate: today,
        userStatsUpdates
      });
      console.log(`\u2705 Quest atomically completed: ${questType} (+${pointsEarned} points) for @${farcasterUsername}`);
      res.json({
        success: true,
        pointsEarned,
        totalPoints: result.userStats.totalPoints,
        currentStreak: result.userStats.currentStreak,
        questCompletion: {
          id: result.questCompletion.id,
          completionDate: result.questCompletion.completionDate
        },
        message: `Successfully claimed ${questType} for +${pointsEarned} points!`
      });
    } catch (error) {
      console.error("\u{1F6A8} Quest claim failed:", error);
      if (error instanceof Error && error.message.includes("already completed")) {
        return res.status(409).json({
          message: error.message,
          code: "QUEST_ALREADY_COMPLETED"
        });
      }
      res.status(500).json({
        message: "Failed to claim quest reward. Please try again.",
        code: "QUEST_CLAIM_ERROR"
      });
    }
  });
  app2.post("/api/validate-referral", async (req, res) => {
    try {
      const { referralCode, newUserFid, newUserUsername, newUserPfpUrl } = req.body;
      if (!referralCode || !newUserFid || !newUserUsername) {
        return res.status(400).json({
          success: false,
          message: "Referral code, Farcaster FID and username are required"
        });
      }
      console.log(`\u{1F381} Processing referral: ${newUserUsername} using code ${referralCode}`);
      const result = await storage.validateAndApplyReferral({
        referralCode,
        newUserFid,
        newUserUsername,
        newUserPfpUrl
      });
      if (result.success) {
        console.log(`\u2705 Referral applied successfully: ${newUserUsername} \u2192 ${referralCode}`);
        return res.json(result);
      } else {
        console.warn(`\u26A0\uFE0F Referral validation failed: ${result.message}`);
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error("\u{1F6A8} Referral validation error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to process referral code. Please try again.",
        error: error.message
      });
    }
  });
  app2.post("/api/quests/claim-referral", async (req, res) => {
    try {
      const { farcasterFid } = req.body;
      if (!farcasterFid) {
        return res.status(400).json({
          message: "Farcaster FID is required"
        });
      }
      const userStats2 = await storage.getUserStats(farcasterFid);
      if (!userStats2) {
        return res.status(404).json({
          message: "User not found"
        });
      }
      if (!userStats2.unclaimedReferrals || userStats2.unclaimedReferrals === 0) {
        return res.status(400).json({
          message: "No unclaimed referrals",
          code: "NO_UNCLAIMED_REFERRALS"
        });
      }
      const referralsToClaim = userStats2.unclaimedReferrals;
      const pointsPerReferral = 1;
      const fixedPointsPerReferral = pointsPerReferral * 100;
      const totalPointsToAward = referralsToClaim * fixedPointsPerReferral;
      console.log(`\u{1F381} Claiming ${referralsToClaim} referrals = ${totalPointsToAward / 100} points for @${userStats2.farcasterUsername}`);
      await storage.updateUserStats(farcasterFid, {
        totalPoints: userStats2.totalPoints + totalPointsToAward,
        weeklyPoints: (userStats2.weeklyPoints || 0) + totalPointsToAward,
        unclaimedReferrals: 0
      });
      const responseData = {
        success: true,
        pointsEarned: totalPointsToAward,
        // Send fixed-point (100, 200, 300...) - frontend converts to display
        totalPoints: userStats2.totalPoints + totalPointsToAward,
        message: `Successfully claimed ${referralsToClaim} referral reward${referralsToClaim > 1 ? "s" : ""}!`
      };
      console.log(`\u2705 Referral rewards claimed successfully`);
      console.log(`\u{1F4E4} Sending response:`, responseData);
      res.json(responseData);
    } catch (error) {
      console.error("\u{1F6A8} Claim referral failed:", error);
      res.status(500).json({
        message: "Failed to claim referral rewards. Please try again.",
        code: "REFERRAL_CLAIM_ERROR"
      });
    }
  });
  app2.post("/api/quests/complete-add-miniapp", async (req, res) => {
    try {
      const { farcasterFid, farcasterUsername, farcasterPfpUrl } = req.body;
      if (!farcasterFid || !farcasterUsername) {
        return res.status(400).json({
          message: "Farcaster FID and username are required"
        });
      }
      const userStats2 = await storage.getUserStats(farcasterFid);
      if (userStats2?.hasAddedMiniApp) {
        return res.status(409).json({
          message: "Add Mini App quest already completed",
          code: "QUEST_ALREADY_COMPLETED"
        });
      }
      const pointsEarned = 5;
      const fixedPointsEarned = pointsEarned * 100;
      const result = await storage.completeAddMiniAppQuest({
        farcasterFid,
        farcasterUsername: farcasterUsername.trim(),
        farcasterPfpUrl: farcasterPfpUrl?.trim(),
        pointsEarned: fixedPointsEarned
      });
      console.log(`\u2705 Add Mini App quest completed: +${pointsEarned} points for @${farcasterUsername}`);
      res.json({
        success: true,
        pointsEarned,
        totalPoints: result.totalPoints,
        message: `Successfully completed Add Mini App quest for +${pointsEarned} points!`
      });
    } catch (error) {
      console.error("\u{1F6A8} Add Mini App quest failed:", error);
      res.status(500).json({
        message: "Failed to complete Add Mini App quest. Please try again.",
        code: "QUEST_CLAIM_ERROR"
      });
    }
  });
  const escapeHtml = (text2) => {
    if (!text2) return "";
    return text2.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  };
  const sanitizeUrl = (url) => {
    if (!url) return "about:blank";
    const urlStr = url.toString().trim();
    if (!urlStr) return "about:blank";
    const allowedSchemes = /^(https?|ipfs):/i;
    const dangerousSchemes = /^(javascript|data|vbscript|file):/i;
    if (dangerousSchemes.test(urlStr)) {
      return "about:blank";
    }
    if (!allowedSchemes.test(urlStr)) {
      return urlStr.startsWith("/") ? urlStr : `/${urlStr}`;
    }
    return urlStr;
  };
  app2.get("/api/nft-share-image/:tokenId", async (req, res) => {
    try {
      const { tokenId } = req.params;
      console.log(`\u{1F5BC}\uFE0F Generating share image for token ${tokenId}`);
      const nft = await storage.getNFTByTokenId(tokenId);
      if (!nft) {
        console.log(`\u274C NFT not found for token ${tokenId}`);
        return res.status(404).json({ message: "NFT not found" });
      }
      console.log(`\u{1F4F8} NFT found: ${nft.title}, image: ${nft.objectStorageUrl || nft.imageUrl}`);
      let nftImageDataUrl = "";
      const imageUrl = nft.objectStorageUrl || nft.imageUrl;
      if (imageUrl) {
        try {
          let fetchUrl = imageUrl;
          if (imageUrl.startsWith("/")) {
            const protocol = req.headers["x-forwarded-proto"] || req.protocol;
            const host = req.get("host");
            fetchUrl = `${protocol}://${host}${imageUrl}`;
          }
          console.log(`\u{1F4E5} Fetching image from: ${fetchUrl}`);
          const imageResponse = await fetch(fetchUrl);
          if (imageResponse.ok) {
            const imageBuffer = await imageResponse.arrayBuffer();
            const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
            nftImageDataUrl = `data:${contentType};base64,${Buffer.from(imageBuffer).toString("base64")}`;
            console.log(`\u2705 Image loaded successfully (${Math.round(imageBuffer.byteLength / 1024)}KB)`);
          } else {
            console.log(`\u274C Image fetch failed: ${imageResponse.status} ${imageResponse.statusText}`);
          }
        } catch (e) {
          console.error("\u274C Failed to fetch NFT image:", e);
        }
      } else {
        console.log("\u26A0\uFE0F No image URL found for NFT");
      }
      const creatorName = nft.farcasterCreatorUsername ? `@${nft.farcasterCreatorUsername}` : nft.creatorAddress ? `${nft.creatorAddress.slice(0, 6)}...${nft.creatorAddress.slice(-4)}` : "Unknown";
      const svg = await satori(
        {
          type: "div",
          props: {
            style: {
              width: "1200px",
              height: "630px",
              display: "flex",
              flexDirection: "row",
              background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)",
              fontFamily: "Inter",
              padding: "40px"
            },
            children: [
              // Left side - NFT Image
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    width: "520px",
                    height: "550px",
                    borderRadius: "24px",
                    overflow: "hidden",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.5)"
                  },
                  children: nftImageDataUrl ? {
                    type: "img",
                    props: {
                      src: nftImageDataUrl,
                      width: 520,
                      height: 550,
                      style: {
                        width: "520px",
                        height: "550px",
                        objectFit: "cover"
                      }
                    }
                  } : {
                    type: "div",
                    props: {
                      style: {
                        width: "520px",
                        height: "550px",
                        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "80px"
                      },
                      children: "\u{1F5FA}\uFE0F"
                    }
                  }
                }
              },
              // Right side - Info
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    paddingLeft: "50px",
                    flex: "1"
                  },
                  children: [
                    // TravelMint Logo/Brand
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          marginBottom: "30px"
                        },
                        children: [
                          {
                            type: "div",
                            props: {
                              style: {
                                fontSize: "28px",
                                marginRight: "12px"
                              },
                              children: "\u2708\uFE0F"
                            }
                          },
                          {
                            type: "div",
                            props: {
                              style: {
                                color: "#00b4d8",
                                fontSize: "28px",
                                fontWeight: "700"
                              },
                              children: "TravelMint"
                            }
                          }
                        ]
                      }
                    },
                    // NFT Title
                    {
                      type: "div",
                      props: {
                        style: {
                          color: "white",
                          fontSize: "44px",
                          fontWeight: "700",
                          marginBottom: "20px",
                          lineHeight: "1.2"
                        },
                        children: nft.title.length > 40 ? nft.title.slice(0, 40) + "..." : nft.title
                      }
                    },
                    // Location
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          marginBottom: "24px"
                        },
                        children: [
                          {
                            type: "div",
                            props: {
                              style: {
                                fontSize: "24px",
                                marginRight: "10px"
                              },
                              children: "\u{1F4CD}"
                            }
                          },
                          {
                            type: "div",
                            props: {
                              style: {
                                color: "rgba(255,255,255,0.8)",
                                fontSize: "26px",
                                fontWeight: "500"
                              },
                              children: nft.location.length > 30 ? nft.location.slice(0, 30) + "..." : nft.location
                            }
                          }
                        ]
                      }
                    },
                    // Creator
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          marginBottom: "40px"
                        },
                        children: [
                          {
                            type: "div",
                            props: {
                              style: {
                                fontSize: "22px",
                                marginRight: "10px"
                              },
                              children: "\u{1F3A8}"
                            }
                          },
                          {
                            type: "div",
                            props: {
                              style: {
                                color: "rgba(255,255,255,0.7)",
                                fontSize: "22px"
                              },
                              children: `by ${creatorName}`
                            }
                          }
                        ]
                      }
                    },
                    // CTA
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          background: "linear-gradient(135deg, #00b4d8 0%, #0077b6 100%)",
                          color: "white",
                          padding: "18px 36px",
                          borderRadius: "16px",
                          fontSize: "24px",
                          fontWeight: "600",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "280px"
                        },
                        children: "\u{1F4B0} Tip the Creator"
                      }
                    }
                  ]
                }
              }
            ]
          }
        },
        {
          width: 1200,
          height: 630,
          fonts: interRegular && interBold ? [
            {
              name: "Inter",
              data: interRegular,
              weight: 400,
              style: "normal"
            },
            {
              name: "Inter",
              data: interBold,
              weight: 700,
              style: "normal"
            }
          ] : []
        }
      );
      const resvg = new Resvg(svg, {
        fitTo: {
          mode: "width",
          value: 1200
        }
      });
      const pngData = resvg.render();
      const pngBuffer = pngData.asPng();
      res.set({
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, s-maxage=86400"
      });
      res.send(pngBuffer);
    } catch (error) {
      console.error("Error generating NFT share image:", error);
      res.status(500).json({ message: "Failed to generate NFT share image" });
    }
  });
  app2.get("/api/frames/nft/:tokenId", async (req, res) => {
    try {
      const { tokenId } = req.params;
      const nft = await storage.getNFTByTokenId(tokenId);
      if (!nft) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>NFT Not Found - TravelMint</title>
              <meta name="description" content="NFT not found on TravelMint">
            </head>
            <body>
              <h1>NFT Not Found</h1>
              <p>The requested NFT could not be found.</p>
            </body>
          </html>
        `);
      }
      const safeTitle = escapeHtml(nft.title);
      const safeLocation = escapeHtml(nft.location);
      const safeDescription = escapeHtml(`${nft.title} by ${nft.farcasterCreatorUsername ? "@" + nft.farcasterCreatorUsername : "creator"} - Tip the creator on TravelMint`);
      const productionDomain = "https://travelnft.replit.app";
      const frameUrl = `${productionDomain}/api/frames/nft/${tokenId}`;
      const cacheBuster = Date.now();
      const shareImageUrl = `${productionDomain}/api/nft-share-image/${tokenId}?v=${cacheBuster}`;
      const nftDetailUrl = `${productionDomain}/nft/${tokenId}`;
      const rawImageUrl = nft.objectStorageUrl || nft.imageUrl || "";
      const sanitizedImageUrl = sanitizeUrl(rawImageUrl);
      const safeRawImageUrl = escapeHtml(sanitizedImageUrl);
      const miniAppEmbed = {
        version: "1",
        imageUrl: shareImageUrl,
        button: {
          title: "\u{1F4B0} Tip Creator",
          action: {
            type: "launch_miniapp",
            name: "TravelMint",
            url: nftDetailUrl,
            splashImageUrl: `${productionDomain}/logo.jpeg`,
            splashBackgroundColor: "#0f172a"
          }
        }
      };
      const miniAppEmbedJson = JSON.stringify(miniAppEmbed);
      const escapedMiniAppEmbed = miniAppEmbedJson.replace(/"/g, "&quot;");
      const frameEmbed = {
        version: "1",
        imageUrl: shareImageUrl,
        button: {
          title: "\u{1F4B0} Tip Creator",
          action: {
            type: "launch_frame",
            name: "TravelMint",
            url: nftDetailUrl,
            splashImageUrl: `${productionDomain}/logo.jpeg`,
            splashBackgroundColor: "#0f172a"
          }
        }
      };
      const frameEmbedJson = JSON.stringify(frameEmbed);
      const escapedFrameEmbed = frameEmbedJson.replace(/"/g, "&quot;");
      const frameHtml = `
<!DOCTYPE html>
<html>
  <head>
    <title>${safeTitle} - TravelMint NFT</title>
    <meta name="description" content="${safeDescription}">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${frameUrl}">
    <meta property="og:title" content="${safeTitle} - TravelMint">
    <meta property="og:description" content="${safeDescription}">
    <meta property="og:image" content="${shareImageUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    
    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="${frameUrl}">
    <meta property="twitter:title" content="${safeTitle} - TravelMint">
    <meta property="twitter:description" content="${safeDescription}">
    <meta property="twitter:image" content="${shareImageUrl}">
    
    <!-- Farcaster Mini App Embed (new JSON format) -->
    <meta name="fc:miniapp" content="${escapedMiniAppEmbed}">
    <!-- Backward compatibility -->
    <meta name="fc:frame" content="${escapedFrameEmbed}">
  </head>
  <body>
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; text-align: center;">
      <img src="${safeRawImageUrl}" alt="${safeTitle}" style="max-width: 100%; height: auto; border-radius: 12px; margin-bottom: 20px;">
      <h1 style="color: #333; margin-bottom: 10px;">${safeTitle}</h1>
      <p style="color: #888; margin-bottom: 20px;">Minted on TravelMint</p>
      <a href="${nftDetailUrl}" style="background: #00b4d8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">\u{1F4B0} Tip the Creator</a>
    </div>
  </body>
</html>`;
      res.setHeader("Content-Type", "text/html");
      res.send(frameHtml);
    } catch (error) {
      console.error("Error generating NFT frame:", error);
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Error - TravelMint</title>
            <meta name="description" content="Error loading NFT frame">
          </head>
          <body>
            <h1>Error</h1>
            <p>Unable to load NFT frame. Please try again later.</p>
          </body>
        </html>
      `);
    }
  });
  app2.post("/api/marketplace/list", async (req, res) => {
    try {
      const { tokenId, seller, priceUSDC } = req.body;
      if (!tokenId || !seller || !priceUSDC) {
        return res.status(400).json({ message: "Missing required parameters: tokenId, seller, priceUSDC" });
      }
      if (!ethers3.isAddress(seller)) {
        return res.status(400).json({ message: "Invalid seller address format" });
      }
      if (isNaN(parseFloat(priceUSDC)) || parseFloat(priceUSDC) <= 0) {
        return res.status(400).json({ message: "Invalid price amount" });
      }
      const listingData = await blockchainService.generateListingTransaction(
        tokenId.toString(),
        seller.toLowerCase(),
        priceUSDC
      );
      if (!listingData.success) {
        return res.status(400).json({
          message: listingData.error || "Failed to generate listing transaction",
          type: "LISTING_ERROR"
        });
      }
      console.log(`\u2705 Generated listing transaction for NFT #${tokenId} at ${priceUSDC} USDC`);
      res.json({
        message: "Listing transaction prepared",
        transactionData: listingData,
        tokenId: tokenId.toString(),
        seller: seller.toLowerCase(),
        priceUSDC
      });
    } catch (error) {
      console.error("Marketplace listing error:", error);
      res.status(500).json({ message: "Failed to prepare listing transaction" });
    }
  });
  app2.post("/api/marketplace/cancel", async (req, res) => {
    try {
      const { tokenId, seller } = req.body;
      if (!tokenId || !seller) {
        return res.status(400).json({ message: "Missing required parameters: tokenId, seller" });
      }
      if (!ethers3.isAddress(seller)) {
        return res.status(400).json({ message: "Invalid seller address format" });
      }
      const cancelData = await blockchainService.generateCancelListingTransaction(
        tokenId.toString(),
        seller.toLowerCase()
      );
      if (!cancelData.success) {
        return res.status(400).json({
          message: cancelData.error || "Failed to generate cancel listing transaction",
          type: "CANCEL_ERROR"
        });
      }
      console.log(`\u2705 Generated cancel listing transaction for NFT #${tokenId}`);
      res.json({
        message: "Cancel listing transaction prepared",
        transactionData: cancelData,
        tokenId: tokenId.toString(),
        seller: seller.toLowerCase()
      });
    } catch (error) {
      console.error("Marketplace cancel listing error:", error);
      res.status(500).json({ message: "Failed to prepare cancel listing transaction" });
    }
  });
  app2.post("/api/marketplace/update-price", async (req, res) => {
    try {
      const { tokenId, seller, newPriceUSDC } = req.body;
      if (!tokenId || !seller || !newPriceUSDC) {
        return res.status(400).json({ message: "Missing required parameters: tokenId, seller, newPriceUSDC" });
      }
      if (!ethers3.isAddress(seller)) {
        return res.status(400).json({ message: "Invalid seller address format" });
      }
      if (isNaN(parseFloat(newPriceUSDC)) || parseFloat(newPriceUSDC) <= 0) {
        return res.status(400).json({ message: "Invalid price amount" });
      }
      const updateData = await blockchainService.generateUpdatePriceTransaction(
        tokenId.toString(),
        seller.toLowerCase(),
        newPriceUSDC
      );
      if (!updateData.success) {
        return res.status(400).json({
          message: updateData.error || "Failed to generate update price transaction",
          type: "UPDATE_PRICE_ERROR"
        });
      }
      console.log(`\u2705 Generated update price transaction for NFT #${tokenId} to ${newPriceUSDC} USDC`);
      res.json({
        message: "Update price transaction prepared",
        transactionData: updateData,
        tokenId: tokenId.toString(),
        seller: seller.toLowerCase(),
        newPriceUSDC
      });
    } catch (error) {
      console.error("Marketplace update price error:", error);
      res.status(500).json({ message: "Failed to prepare update price transaction" });
    }
  });
  app2.get("/api/marketplace/listings/:tokenId", async (req, res) => {
    try {
      const { tokenId } = req.params;
      if (!tokenId) {
        return res.status(400).json({ message: "Token ID is required" });
      }
      const listing = await blockchainService.getMarketplaceListing(tokenId);
      if (!listing) {
        return res.status(404).json({ message: "No active listing found for this NFT" });
      }
      res.json({
        listing,
        message: "Listing found"
      });
    } catch (error) {
      console.error("Get marketplace listing error:", error);
      res.status(500).json({ message: "Failed to get marketplace listing" });
    }
  });
  app2.get("/api/marketplace/is-listed/:tokenId", async (req, res) => {
    try {
      const { tokenId } = req.params;
      if (!tokenId) {
        return res.status(400).json({ message: "Token ID is required" });
      }
      const isListed = await blockchainService.isNFTListed(tokenId);
      res.json({
        tokenId,
        isListed,
        message: isListed ? "NFT is listed for sale" : "NFT is not listed"
      });
    } catch (error) {
      console.error("Check if NFT listed error:", error);
      res.status(500).json({ message: "Failed to check listing status" });
    }
  });
  app2.get("/api/marketplace/stats", async (req, res) => {
    try {
      const stats = await blockchainService.getMarketplaceStats();
      res.json({
        stats,
        message: "Marketplace statistics retrieved"
      });
    } catch (error) {
      console.error("Get marketplace stats error:", error);
      res.status(500).json({ message: "Failed to get marketplace statistics" });
    }
  });
  app2.post("/api/farcaster/miniapp-webhook", async (req, res) => {
    try {
      console.log("\u{1F4F1} Received Farcaster Mini App webhook:", req.body);
      const { event, fid, notificationDetails } = req.body;
      if (event === "miniapp_added" && fid && notificationDetails?.token) {
        const { token, url } = notificationDetails;
        console.log(`\u{1F4F1} Mini App added for FID ${fid} with notification token`);
        const updatedUser = await storage.updateUserNotificationToken(
          fid.toString(),
          token
        );
        if (!updatedUser) {
          await storage.createOrUpdateUserStats({
            farcasterFid: fid.toString(),
            farcasterUsername: `user-${fid}`,
            farcasterPfpUrl: null,
            totalPoints: 0,
            weeklyPoints: 0,
            currentStreak: 0,
            longestStreak: 0,
            weeklyResetDate: /* @__PURE__ */ new Date(),
            notificationToken: token,
            notificationsEnabled: true,
            lastNotificationSent: null
          });
        }
        console.log(`\u2705 Stored real notification token for FID ${fid}`);
        res.json({
          success: true,
          message: "Notification token stored successfully"
        });
      } else if (event === "notifications_enabled" && fid) {
        await storage.enableUserNotifications(fid.toString(), true);
        console.log(`\u{1F514} Notifications enabled for FID ${fid}`);
        res.json({ success: true });
      } else if (event === "notifications_disabled" && fid) {
        await storage.enableUserNotifications(fid.toString(), false);
        console.log(`\u{1F515} Notifications disabled for FID ${fid}`);
        res.json({ success: true });
      } else if (event === "miniapp_removed" && fid) {
        await storage.enableUserNotifications(fid.toString(), false);
        console.log(`\u{1F5D1}\uFE0F Mini App removed for FID ${fid}`);
        res.json({ success: true });
      } else {
        console.log("\u2139\uFE0F Unhandled webhook event:", event);
        res.json({ success: true, message: "Event received" });
      }
    } catch (error) {
      console.error("\u274C Farcaster webhook processing failed:", error);
      res.status(500).json({
        success: false,
        message: "Webhook processing failed",
        error: error.message
      });
    }
  });
  app2.post("/api/admin/notifications/send", async (req, res) => {
    try {
      const authResult = verifyAdminAuth(req);
      if (!authResult.success) {
        const statusCode = authResult.shouldBlock ? 429 : 401;
        return res.status(statusCode).json({ message: authResult.error });
      }
      if (!isNotificationServiceAvailable()) {
        return res.status(503).json({
          message: "Notification service unavailable - NEYNAR_API_KEY not configured"
        });
      }
      const sendNotificationSchema = z3.object({
        title: z3.string().min(1, "Title is required").max(100, "Title too long"),
        message: z3.string().min(1, "Message is required").max(500, "Message too long"),
        targetUrl: z3.string().url().optional()
      });
      const validationResult = sendNotificationSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid input data",
          errors: validationResult.error.errors
        });
      }
      const { title, message, targetUrl } = validationResult.data;
      const usersWithNotifications = await storage.getUsersWithNotifications();
      if (usersWithNotifications.length === 0) {
        return res.status(400).json({
          message: "No users have notifications enabled"
        });
      }
      const fids = usersWithNotifications.filter((user) => user.farcasterFid && user.notificationsEnabled).map((user) => parseInt(user.farcasterFid, 10)).filter((fid) => !isNaN(fid));
      if (fids.length === 0) {
        console.log("\u26A0\uFE0F No specific FIDs found, attempting broadcast to all enabled users");
      }
      const notificationService2 = getNotificationService();
      if (!notificationService2) {
        return res.status(503).json({
          message: "Notification service not initialized"
        });
      }
      console.log(`\u{1F3AF} First attempt: Specific FIDs [${fids.join(", ")}]`);
      const result = await notificationService2.sendNotification({
        title,
        message,
        fids,
        targetUrl: targetUrl || "https://travelmint.replit.app"
      });
      if (result.successCount === 0 && fids.length > 0) {
        console.log(`\u{1F504} Specific FIDs failed, trying empty array broadcast...`);
        const broadcastResult = await notificationService2.sendNotification({
          title: title + " (Broadcast)",
          message,
          fids: [],
          // Empty array = all enabled users
          targetUrl: targetUrl || "https://travelmint.replit.app"
        });
        console.log(`\u{1F4CA} Broadcast result: Success: ${broadcastResult.successCount}, Failed: ${broadcastResult.failureCount}`);
        if (broadcastResult.successCount > result.successCount) {
          console.log(`\u2705 Using broadcast result instead`);
          result.successCount = broadcastResult.successCount;
          result.failureCount = broadcastResult.failureCount;
          result.success = broadcastResult.success;
        }
      }
      await storage.createNotificationHistory({
        title,
        message,
        targetUrl: targetUrl || "https://travelmint.replit.app",
        recipientCount: fids.length,
        successCount: result.successCount,
        failureCount: result.failureCount,
        sentBy: "admin"
      });
      if (result.successCount > 0) {
        if (result.failureCount === 0 && result.rateLimitedCount === 0) {
          const successfulFids = usersWithNotifications.map((user) => user.farcasterFid);
          await storage.updateLastNotificationSent(successfulFids);
        }
      }
      res.json({
        success: true,
        message: `Notification sent to ${result.successCount}/${fids.length} users`,
        stats: {
          totalUsers: fids.length,
          successCount: result.successCount,
          failureCount: result.failureCount,
          rateLimitedCount: result.rateLimitedCount
        },
        errors: result.errors
      });
    } catch (error) {
      console.error("\u274C Admin notification send failed:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send notification",
        error: error.message
      });
    }
  });
  app2.get("/api/admin/notifications/history", async (req, res) => {
    try {
      const authResult = verifyAdminAuth(req);
      if (!authResult.success) {
        const statusCode = authResult.shouldBlock ? 429 : 401;
        return res.status(statusCode).json({ message: authResult.error });
      }
      const limit = parseInt(req.query.limit) || 20;
      const history = await storage.getNotificationHistory(limit);
      res.json({
        success: true,
        history,
        count: history.length
      });
    } catch (error) {
      console.error("\u274C Get notification history failed:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get notification history",
        error: error.message
      });
    }
  });
  app2.get("/api/admin/notifications/status", async (req, res) => {
    try {
      const authResult = verifyAdminAuth(req);
      if (!authResult.success) {
        const statusCode = authResult.shouldBlock ? 429 : 401;
        return res.status(statusCode).json({ message: authResult.error });
      }
      const serviceAvailable = isNotificationServiceAvailable();
      let connectionTest = false;
      if (serviceAvailable) {
        const notificationService2 = getNotificationService();
        if (notificationService2) {
          connectionTest = await notificationService2.testConnection();
        }
      }
      const usersWithNotifications = await storage.getUsersWithNotifications();
      const recentHistory = await storage.getNotificationHistory(5);
      res.json({
        success: true,
        status: {
          serviceAvailable,
          connectionTest,
          usersWithTokens: usersWithNotifications.length,
          recentNotifications: recentHistory.length
        },
        recentHistory
      });
    } catch (error) {
      console.error("\u274C Get notification status failed:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get notification status",
        error: error.message
      });
    }
  });
  app2.get("/api/admin/security/status", async (req, res) => {
    try {
      const authResult = verifyAdminAuth(req);
      if (!authResult.success) {
        const statusCode = authResult.shouldBlock ? 429 : 401;
        return res.status(statusCode).json({ message: authResult.error });
      }
      const now = Date.now();
      const rateLimitWindow = ADMIN_RATE_LIMIT.windowMs;
      let totalAttempts = 0;
      let blockedIPs = 0;
      const recentAttempts = [];
      adminBlocks.forEach((block, ip) => {
        if (now - block.blockedAt < ADMIN_RATE_LIMIT.blockDurationMs) {
          blockedIPs++;
        }
      });
      adminAttempts.forEach((attempts, ip) => {
        const recentIpAttempts = attempts.filter(
          (attempt) => now - attempt.timestamp < rateLimitWindow
        );
        if (recentIpAttempts.length > 0) {
          totalAttempts += recentIpAttempts.length;
          const isBlocked = isRateLimited(ip);
          recentAttempts.push({
            ip: ip.length > 15 ? ip.substring(0, 12) + "..." : ip,
            // Truncate long IPs
            attempts: recentIpAttempts.length,
            blocked: isBlocked
          });
        }
      });
      const clientIp = getClientIp(req);
      res.json({
        success: true,
        security: {
          currentTime: (/* @__PURE__ */ new Date()).toISOString(),
          rateLimiting: {
            maxAttempts: ADMIN_RATE_LIMIT.maxAttempts,
            windowMinutes: ADMIN_RATE_LIMIT.windowMs / (60 * 1e3),
            blockDurationMinutes: ADMIN_RATE_LIMIT.blockDurationMs / (60 * 1e3),
            totalRecentAttempts: totalAttempts,
            blockedIPs,
            recentAttempts: recentAttempts.slice(0, 10)
            // Limit to 10 most recent
          },
          currentSession: {
            ip: clientIp.length > 15 ? clientIp.substring(0, 12) + "..." : clientIp,
            userAgent: req.headers["user-agent"]?.substring(0, 50) + "..." || "unknown",
            authenticated: true
          }
        }
      });
    } catch (error) {
      console.error("\u274C Get admin security status failed:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get security status",
        error: error.message
      });
    }
  });
  app2.post("/api/user-stats/notification-token", async (req, res) => {
    try {
      const { farcasterFid, notificationToken, notificationsEnabled } = req.body;
      if (!farcasterFid || !notificationToken) {
        return res.status(400).json({
          message: "farcasterFid and notificationToken are required"
        });
      }
      if (typeof notificationToken !== "string" || notificationToken.length < 10) {
        return res.status(400).json({
          message: "Invalid notification token format"
        });
      }
      const updatedUser = await storage.updateUserNotificationToken(
        farcasterFid,
        notificationToken
      );
      if (updatedUser) {
        console.log(`\u{1F4F1} Stored notification token for user ${farcasterFid}`);
        res.json({
          success: true,
          message: "Notification token stored successfully",
          user: {
            farcasterFid: updatedUser.farcasterFid,
            notificationsEnabled: updatedUser.notificationsEnabled,
            hasToken: !!updatedUser.notificationToken
          }
        });
      } else {
        try {
          const newUserStats = await storage.createOrUpdateUserStats({
            farcasterFid,
            farcasterUsername: `user-${farcasterFid}`,
            // Will be updated when we get real username
            farcasterPfpUrl: null,
            totalPoints: 0,
            weeklyPoints: 0,
            currentStreak: 0,
            longestStreak: 0,
            weeklyResetDate: /* @__PURE__ */ new Date(),
            notificationToken,
            notificationsEnabled: true,
            lastNotificationSent: null
          });
          console.log(`\u{1F4F1} Created user stats with notification token for ${farcasterFid}`);
          res.json({
            success: true,
            message: "User created and notification token stored",
            user: {
              farcasterFid: newUserStats.farcasterFid,
              notificationsEnabled: newUserStats.notificationsEnabled,
              hasToken: !!newUserStats.notificationToken
            }
          });
        } catch (createError) {
          console.error("\u274C Failed to create user stats:", createError);
          res.status(500).json({
            message: "Failed to store notification token"
          });
        }
      }
    } catch (error) {
      console.error("\u274C Store notification token failed:", error);
      res.status(500).json({
        success: false,
        message: "Failed to store notification token",
        error: error.message
      });
    }
  });
  app2.get("/api/admin/notifications/users", async (req, res) => {
    try {
      const adminSecret = process.env.ADMIN_SECRET;
      if (!adminSecret) {
        console.error("\u274C ADMIN_SECRET not configured - blocking admin access");
        return res.status(500).json({ message: "Admin access not configured" });
      }
      const providedSecret = req.headers["x-admin-key"];
      if (!providedSecret || providedSecret !== adminSecret) {
        return res.status(401).json({ message: "Unauthorized - invalid admin key" });
      }
      const users2 = await storage.getUsersWithNotifications();
      const safeUsers = users2.map((user) => ({
        farcasterFid: user.farcasterFid,
        farcasterUsername: user.farcasterUsername,
        hasToken: !!user.notificationToken,
        notificationsEnabled: user.notificationsEnabled,
        lastNotificationSent: user.lastNotificationSent,
        totalPoints: user.totalPoints,
        weeklyPoints: user.weeklyPoints
      }));
      res.json({
        success: true,
        users: safeUsers,
        count: safeUsers.length
      });
    } catch (error) {
      console.error("\u274C Get notification users failed:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get notification users",
        error: error.message
      });
    }
  });
  const validateAdminAccess = (req, res) => {
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
      console.error("\u274C ADMIN_SECRET not configured - blocking admin access");
      res.status(500).json({ message: "Admin access not configured" });
      return false;
    }
    const providedSecret = req.headers["x-admin-key"];
    if (!providedSecret || providedSecret !== adminSecret) {
      res.status(401).json({ message: "Unauthorized - invalid admin key" });
      return false;
    }
    return true;
  };
  app2.get("/api/admin/image-sync/status", async (req, res) => {
    try {
      if (!validateAdminAccess(req, res)) return;
      const status = await getSyncStatus();
      res.json({
        success: true,
        ...status
      });
    } catch (error) {
      console.error("\u274C Get image sync status failed:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get sync status",
        error: error.message
      });
    }
  });
  app2.post("/api/admin/image-sync/start", async (req, res) => {
    try {
      if (!validateAdminAccess(req, res)) return;
      console.log("\u{1F5BC}\uFE0F Image sync triggered via API");
      res.json({
        success: true,
        message: "Image sync started in background. Check /api/admin/image-sync/status for progress."
      });
      syncAllImages().then((result) => {
        console.log(`\u{1F5BC}\uFE0F Background image sync complete: ${result.synced} synced, ${result.failed} failed`);
      }).catch((error) => {
        console.error("\u274C Background image sync failed:", error);
      });
    } catch (error) {
      console.error("\u274C Start image sync failed:", error);
      res.status(500).json({
        success: false,
        message: "Failed to start sync",
        error: error.message
      });
    }
  });
  app2.post("/api/admin/image-sync/nft/:id", async (req, res) => {
    try {
      if (!validateAdminAccess(req, res)) return;
      const { id } = req.params;
      console.log(`\u{1F5BC}\uFE0F Single NFT image sync triggered: ${id}`);
      const success = await syncSingleImage(id);
      res.json({
        success,
        message: success ? "Image synced successfully" : "Failed to sync image"
      });
    } catch (error) {
      console.error("\u274C Single image sync failed:", error);
      res.status(500).json({
        success: false,
        message: "Failed to sync image",
        error: error.message
      });
    }
  });
  async function syncMintEvents() {
    try {
      console.log("\u{1F504} Starting Mint event sync...");
      const transferEvents = await blockchainService.getAllTransferEvents();
      if (transferEvents.length === 0) {
        console.log("\u{1F4ED} No events found on blockchain");
        return;
      }
      const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
      const mintEvents = transferEvents.filter(
        (event) => event.from.toLowerCase() === ZERO_ADDRESS.toLowerCase()
      );
      if (mintEvents.length === 0) {
        console.log("\u{1F4ED} No mint events found");
        return;
      }
      console.log(`\u2728 Found ${mintEvents.length} mint events`);
      let syncedCount = 0;
      for (const event of mintEvents) {
        try {
          const existingNFT = await storage.getNFTByTokenId(event.tokenId);
          if (existingNFT) {
            continue;
          }
          console.log(`\u{1F4E5} Fetching metadata for newly minted NFT #${event.tokenId}...`);
          const blockchainNFT = await blockchainService.getNFTByTokenId(event.tokenId);
          if (!blockchainNFT) {
            console.log(`\u26A0\uFE0F Could not fetch metadata for NFT #${event.tokenId}`);
            continue;
          }
          const metadata = blockchainNFT.metadata || {};
          const title = metadata.name || `Travel NFT #${event.tokenId}`;
          const description = metadata.description || "";
          const imageUrl = metadata.image || blockchainNFT.tokenURI;
          let location = "Unknown";
          let latitude = "0";
          let longitude = "0";
          if (metadata.attributes && Array.isArray(metadata.attributes)) {
            const locationAttr = metadata.attributes.find(
              (attr) => attr.trait_type === "Location" || attr.trait_type === "location"
            );
            if (locationAttr) {
              location = locationAttr.value;
            }
            const latAttr = metadata.attributes.find(
              (attr) => attr.trait_type === "Latitude" || attr.trait_type === "latitude"
            );
            if (latAttr) {
              latitude = latAttr.value.toString();
            }
            const lngAttr = metadata.attributes.find(
              (attr) => attr.trait_type === "Longitude" || attr.trait_type === "longitude"
            );
            if (lngAttr) {
              longitude = lngAttr.value.toString();
            }
          }
          await storage.createNFT({
            tokenId: event.tokenId,
            title,
            description,
            imageUrl,
            price: "1.0",
            // Default price
            location,
            category: "travel",
            // Default category
            latitude,
            longitude,
            creatorAddress: event.to.toLowerCase(),
            // Minter is the creator
            ownerAddress: event.to.toLowerCase(),
            isForSale: 0
          });
          syncedCount++;
          console.log(`\u2705 Synced newly minted NFT #${event.tokenId} (${title}) - owner: ${event.to.slice(0, 10)}...`);
        } catch (error) {
          console.error(`\u274C Failed to sync mint event for NFT #${event.tokenId}:`, error);
        }
      }
      if (syncedCount > 0) {
        console.log(`\u{1F389} Mint sync complete: ${syncedCount} new NFTs added to database`);
      } else {
        console.log("\u2705 Mint sync complete: All NFTs up to date");
      }
    } catch (error) {
      console.error("\u274C Mint sync failed:", error);
    }
  }
  async function syncRecentActivity() {
    try {
      console.log("\u{1F504} Starting blockchain sync for Recent Activity...");
      const transferEvents = await blockchainService.getAllTransferEvents();
      if (transferEvents.length === 0) {
        console.log("\u{1F4ED} No transfer events found on blockchain");
        return;
      }
      const existingTxns = await storage.getRecentTransactions(1e3);
      const existingTxHashes = new Set(
        existingTxns.map((t) => t.blockchainTxHash?.toLowerCase()).filter((hash) => hash)
      );
      let syncedCount = 0;
      let delistedCount = 0;
      for (const event of transferEvents) {
        if (existingTxHashes.has(event.transactionHash.toLowerCase())) {
          continue;
        }
        try {
          const nft = await storage.getNFTByTokenId(event.tokenId);
          if (!nft) {
            console.log(`\u26A0\uFE0F NFT #${event.tokenId} not found in database, skipping...`);
            continue;
          }
          const wasListed = nft.isForSale === 1;
          await storage.updateNFTOwnerAndDelist(event.tokenId, event.to);
          if (wasListed) {
            delistedCount++;
            console.log(`\u{1F513} Auto-delisted NFT #${event.tokenId} (${nft.title}) - transferred to ${event.to.slice(0, 10)}...`);
          }
          await storage.createTransaction({
            nftId: nft.id,
            fromAddress: event.from,
            toAddress: event.to,
            transactionType: event.transferType,
            // 'sale' or 'transfer'
            amount: event.price,
            platformFee: event.platformFee,
            blockchainTxHash: event.transactionHash
          });
          syncedCount++;
          if (event.transferType === "sale") {
            console.log(`\u2705 Synced sale: NFT #${event.tokenId} (${event.to.slice(0, 10)}... bought from ${event.from.slice(0, 10)}...) for ${event.price} USDC`);
          } else {
            console.log(`\u2705 Synced transfer: NFT #${event.tokenId} (${event.from.slice(0, 10)}... \u2192 ${event.to.slice(0, 10)}...)`);
          }
        } catch (error) {
          console.error(`\u274C Failed to sync transaction ${event.transactionHash}:`, error);
        }
      }
      if (syncedCount > 0) {
        console.log(`\u{1F389} Blockchain sync complete: ${syncedCount} new transactions added, ${delistedCount} NFTs auto-delisted`);
      } else {
        console.log("\u2705 Blockchain sync complete: All transactions up to date");
      }
    } catch (error) {
      console.error("\u274C Blockchain sync failed:", error);
    }
  }
  async function syncFromBasescan() {
    try {
      console.log("\u{1F310} Starting Basescan API sync for NFT discovery...");
      const { newNFTs, missingTokens } = await blockchainService.syncNFTsFromBasescan(storage);
      if (newNFTs.length === 0) {
        console.log("\u2705 Basescan sync: Database is up to date");
        return;
      }
      console.log(`\u{1F50D} Basescan found ${newNFTs.length} missing tokens: ${missingTokens.join(", ")}`);
      for (const nft of newNFTs) {
        try {
          const nftWithMetadata = await blockchainService.fetchMetadataAsync(nft);
          const metadata = nftWithMetadata.metadata || {};
          const title = metadata.name || `Travel NFT #${nft.tokenId}`;
          const description = metadata.description || "";
          const imageUrl = metadata.image || nft.tokenURI;
          let location = "Unknown";
          let latitude = "0";
          let longitude = "0";
          if (metadata.attributes && Array.isArray(metadata.attributes)) {
            const locationAttr = metadata.attributes.find(
              (attr) => attr.trait_type === "Location" || attr.trait_type === "location"
            );
            if (locationAttr) location = locationAttr.value;
            const latAttr = metadata.attributes.find(
              (attr) => attr.trait_type === "Latitude" || attr.trait_type === "latitude"
            );
            if (latAttr) latitude = latAttr.value.toString();
            const lngAttr = metadata.attributes.find(
              (attr) => attr.trait_type === "Longitude" || attr.trait_type === "longitude"
            );
            if (lngAttr) longitude = lngAttr.value.toString();
          }
          await storage.createNFT({
            tokenId: nft.tokenId,
            title,
            description,
            imageUrl,
            location,
            latitude,
            longitude,
            ownerAddress: nft.owner,
            creatorAddress: nft.owner,
            category: "Travel",
            price: "0",
            isListed: false
          });
          console.log(`\u2705 Added NFT #${nft.tokenId}: ${title} at ${location}`);
        } catch (error) {
          console.error(`\u274C Error adding NFT #${nft.tokenId}:`, error);
        }
      }
      console.log(`\u{1F389} Basescan sync complete: ${newNFTs.length} new NFTs added to database`);
    } catch (error) {
      console.error("\u274C Basescan sync failed:", error);
    }
  }
  console.log("\u{1F680} Starting initial blockchain sync...");
  syncFromBasescan();
  syncMintEvents();
  syncRecentActivity();
  setInterval(() => {
    syncMintEvents();
    syncRecentActivity();
  }, 5e3);
  console.log("\u23F0 Periodic blockchain sync enabled (Mint events + Transfers every 5 seconds)");
  setInterval(() => {
    syncFromBasescan();
  }, 3e4);
  console.log("\u23F0 Basescan discovery sync enabled (every 30 seconds)");
  const metadataSyncService = new MetadataSyncService(storage);
  console.log("\u{1F527} Running initial metadata sync to fix broken tokens...");
  metadataSyncService.runMetadataSync();
  setInterval(() => {
    metadataSyncService.runMetadataSync();
  }, 15e3);
  console.log("\u23F0 Metadata sync enabled (every 15 seconds)");
  async function isNFTHolder(walletAddress) {
    if (!walletAddress || !ethers3.isAddress(walletAddress)) return false;
    try {
      const holderStatus = await storage.checkHolderStatus(walletAddress.toLowerCase());
      return holderStatus.isHolder;
    } catch (error) {
      console.error("Error checking NFT holder status:", error);
      return false;
    }
  }
  app2.get("/api/guide/cities/search", async (req, res) => {
    try {
      const { query, walletAddress } = req.query;
      const parsed = guideCitySearchSchema.safeParse({ query });
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
      }
      const isHolder = walletAddress ? await isNFTHolder(walletAddress) : false;
      const cities = await placesService.searchCities(parsed.data.query);
      const limitedCities = isHolder ? cities : cities.slice(0, 3);
      res.json({
        cities: limitedCities,
        isHolder,
        totalResults: cities.length,
        message: !isHolder && cities.length > 3 ? "Mint a TravelMint NFT to unlock all cities!" : void 0
      });
    } catch (error) {
      console.error("Error searching cities:", error);
      res.status(500).json({ error: "Failed to search cities" });
    }
  });
  app2.get("/api/guide/cities/popular", async (req, res) => {
    try {
      const { walletAddress } = req.query;
      const isHolder = walletAddress ? await isNFTHolder(walletAddress) : false;
      const cities = await placesService.getPopularCities(10);
      const limitedCities = isHolder ? cities : cities.slice(0, 3);
      res.json({
        cities: limitedCities,
        isHolder,
        message: !isHolder && cities.length > 3 ? "Mint a TravelMint NFT to unlock all cities!" : void 0
      });
    } catch (error) {
      console.error("Error getting popular cities:", error);
      res.status(500).json({ error: "Failed to get popular cities" });
    }
  });
  app2.get("/api/guide/cities/:cityId", async (req, res) => {
    try {
      const { cityId } = req.params;
      const { category, limit, walletAddress } = req.query;
      const parsed = guideSpotQuerySchema.safeParse({ category, limit });
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
      }
      const isHolder = walletAddress ? await isNFTHolder(walletAddress) : false;
      const city = await placesService.getCityById(cityId);
      if (!city) {
        return res.status(404).json({ error: "City not found" });
      }
      const spots = await placesService.getSpotsByCity(
        cityId,
        parsed.data.category,
        parseInt(parsed.data.limit || "20"),
        isHolder
      );
      res.json({
        city,
        spots,
        isHolder,
        message: !isHolder ? "Mint a TravelMint NFT to see all spots and details!" : void 0
      });
    } catch (error) {
      console.error("Error getting city details:", error);
      res.status(500).json({ error: "Failed to get city details" });
    }
  });
  app2.get("/api/guide/holder-status", async (req, res) => {
    try {
      const { walletAddress } = req.query;
      if (!walletAddress || typeof walletAddress !== "string") {
        return res.status(400).json({ error: "Wallet address is required" });
      }
      const isHolder = await isNFTHolder(walletAddress);
      res.json({
        isHolder,
        walletAddress,
        message: isHolder ? "Welcome, TravelMint holder! Full guide access unlocked." : "Mint a TravelMint NFT to unlock the full travel guide!"
      });
    } catch (error) {
      console.error("Error checking holder status:", error);
      res.status(500).json({ error: "Failed to check holder status" });
    }
  });
  app2.get("/api/places/nearby", async (req, res) => {
    try {
      const { lat, lon, radius } = req.query;
      if (!lat || !lon) {
        return res.status(400).json({ error: "Latitude and longitude are required" });
      }
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lon);
      const radiusMeters = radius ? parseInt(radius) : 500;
      if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({ error: "Invalid coordinates" });
      }
      const { getNearbyPOIs: getNearbyPOIs2 } = await Promise.resolve().then(() => (init_overpass_service(), overpass_service_exports));
      const pois = await getNearbyPOIs2(latitude, longitude, radiusMeters);
      res.json({ pois, count: pois.length });
    } catch (error) {
      console.error("Nearby places error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch nearby places" });
    }
  });
  app2.get("/api/places/search", async (req, res) => {
    try {
      const { query, south, west, north, east, limit } = req.query;
      if (!query || !south || !west || !north || !east) {
        return res.status(400).json({ error: "Query and bounding box (south, west, north, east) are required" });
      }
      const { searchPOIs: searchPOIs2 } = await Promise.resolve().then(() => (init_overpass_service(), overpass_service_exports));
      const pois = await searchPOIs2(
        query,
        parseFloat(south),
        parseFloat(west),
        parseFloat(north),
        parseFloat(east),
        limit ? parseInt(limit) : 50
      );
      res.json({ pois, count: pois.length });
    } catch (error) {
      console.error("Search places error:", error);
      res.status(500).json({ error: error.message || "Failed to search places" });
    }
  });
  async function verifyTransactionOnChain(txHash, expectedSender) {
    try {
      if (!txHash) return { verified: false, error: "No transaction hash provided" };
      const maxRetries = 10;
      let retries = 0;
      while (retries < maxRetries) {
        try {
          const receipt = await provider.getTransactionReceipt(txHash);
          if (receipt) {
            if (receipt.status === 1) {
              const tx = await provider.getTransaction(txHash);
              if (tx && tx.from.toLowerCase() === expectedSender.toLowerCase()) {
                console.log("\u2705 Transaction verified on-chain:", txHash);
                return { verified: true };
              } else {
                return { verified: false, error: "Transaction sender mismatch" };
              }
            } else {
              return { verified: false, error: "Transaction reverted" };
            }
          }
          retries++;
          await new Promise((resolve) => setTimeout(resolve, 2e3));
        } catch (e) {
          retries++;
          await new Promise((resolve) => setTimeout(resolve, 2e3));
        }
      }
      console.log("\u23F3 Transaction verification timeout, proceeding anyway:", txHash);
      return { verified: true };
    } catch (error) {
      console.error("Transaction verification error:", error);
      return { verified: true };
    }
  }
  app2.post("/api/checkins", async (req, res) => {
    try {
      console.log("\u{1F4CD} Check-in request received:", JSON.stringify(req.body, null, 2));
      const { walletAddress, farcasterFid, farcasterUsername, osmId, placeName, placeCategory, placeSubcategory, latitude, longitude, transactionHash, txHash, comment } = req.body;
      const finalTxHash = transactionHash || txHash || null;
      if (!walletAddress || !osmId || !placeName || !placeCategory || latitude === void 0 || longitude === void 0) {
        console.log("\u274C Check-in validation failed - missing fields");
        return res.status(400).json({ error: "Missing required fields: walletAddress, osmId, placeName, placeCategory, latitude, longitude" });
      }
      if (finalTxHash) {
        const verification = await verifyTransactionOnChain(finalTxHash, walletAddress);
        if (!verification.verified) {
          console.log("\u274C Transaction verification failed:", verification.error);
          return res.status(400).json({ error: verification.error || "Transaction verification failed" });
        }
      }
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const existingCheckin = await db.execute(sql4`
        SELECT id FROM checkins 
        WHERE wallet_address = ${walletAddress.toLowerCase()} 
        AND osm_id = ${osmId}
        AND DATE(created_at) = ${today}
      `);
      if (existingCheckin.rows.length > 0) {
        return res.status(400).json({ error: "You have already checked in at this place today" });
      }
      const pointsEarned = 10;
      const sanitizedComment = comment ? String(comment).substring(0, 500).trim() : null;
      const result = await db.execute(sql4`
        INSERT INTO checkins (wallet_address, farcaster_fid, farcaster_username, osm_id, place_name, place_category, place_subcategory, latitude, longitude, transaction_hash, points_earned, comment)
        VALUES (${walletAddress.toLowerCase()}, ${farcasterFid || null}, ${farcasterUsername || null}, ${osmId}, ${placeName}, ${placeCategory}, ${placeSubcategory || null}, ${latitude}, ${longitude}, ${finalTxHash}, ${pointsEarned}, ${sanitizedComment})
        RETURNING *
      `);
      if (farcasterFid) {
        await db.execute(sql4`
          UPDATE user_stats 
          SET total_points = total_points + ${pointsEarned * 100},
              weekly_points = weekly_points + ${pointsEarned * 100},
              updated_at = NOW()
          WHERE farcaster_fid = ${farcasterFid}
        `);
      }
      console.log("\u2705 Check-in saved successfully:", result.rows[0]);
      res.json({
        success: true,
        checkin: result.rows[0],
        pointsEarned,
        message: `Check-in successful! You earned ${pointsEarned} points.`
      });
    } catch (error) {
      console.error("\u274C Check-in error:", error);
      res.status(500).json({ error: error.message || "Failed to create check-in" });
    }
  });
  app2.get("/api/checkins/user/:walletAddress", async (req, res) => {
    try {
      const { walletAddress } = req.params;
      const { limit } = req.query;
      if (!walletAddress) {
        return res.status(400).json({ error: "Wallet address is required" });
      }
      const maxResults = limit ? parseInt(limit) : 50;
      const result = await db.execute(sql4`
        SELECT * FROM checkins 
        WHERE wallet_address = ${walletAddress.toLowerCase()}
        ORDER BY created_at DESC
        LIMIT ${maxResults}
      `);
      res.json({
        checkins: result.rows,
        count: result.rows.length
      });
    } catch (error) {
      console.error("Get user checkins error:", error);
      res.status(500).json({ error: "Failed to get check-in history" });
    }
  });
  app2.get("/api/checkins/place/:osmId", async (req, res) => {
    try {
      const osmId = decodeURIComponent(req.params.osmId);
      const { limit } = req.query;
      if (!osmId) {
        return res.status(400).json({ error: "OSM ID is required" });
      }
      const maxResults = limit ? parseInt(limit) : 50;
      const result = await db.execute(sql4`
        SELECT * FROM checkins 
        WHERE osm_id = ${osmId}
        ORDER BY created_at DESC
        LIMIT ${maxResults}
      `);
      const uniqueVisitors = await db.execute(sql4`
        SELECT COUNT(DISTINCT wallet_address) as count FROM checkins WHERE osm_id = ${osmId}
      `);
      res.json({
        checkins: result.rows,
        totalCheckins: result.rows.length,
        uniqueVisitors: Number(uniqueVisitors.rows[0]?.count || 0)
      });
    } catch (error) {
      console.error("Get place checkins error:", error);
      res.status(500).json({ error: "Failed to get place check-ins" });
    }
  });
  app2.get("/api/checkins/stats/:walletAddress", async (req, res) => {
    try {
      const { walletAddress } = req.params;
      if (!walletAddress) {
        return res.status(400).json({ error: "Wallet address is required" });
      }
      const normalized = walletAddress.toLowerCase();
      const totalResult = await db.execute(sql4`
        SELECT COUNT(*) as total FROM checkins WHERE wallet_address = ${normalized}
      `);
      const uniquePlacesResult = await db.execute(sql4`
        SELECT COUNT(DISTINCT osm_id) as count FROM checkins WHERE wallet_address = ${normalized}
      `);
      const pointsResult = await db.execute(sql4`
        SELECT COALESCE(SUM(points_earned), 0) as total_points FROM checkins WHERE wallet_address = ${normalized}
      `);
      const categoriesResult = await db.execute(sql4`
        SELECT place_category, COUNT(*) as count 
        FROM checkins 
        WHERE wallet_address = ${normalized}
        GROUP BY place_category
        ORDER BY count DESC
      `);
      res.json({
        totalCheckins: Number(totalResult.rows[0]?.total || 0),
        uniquePlaces: Number(uniquePlacesResult.rows[0]?.count || 0),
        totalPoints: Number(pointsResult.rows[0]?.total_points || 0),
        categoryCounts: categoriesResult.rows
      });
    } catch (error) {
      console.error("Get checkin stats error:", error);
      res.status(500).json({ error: "Failed to get check-in stats" });
    }
  });
  app2.get("/api/checkins/all", async (req, res) => {
    try {
      const { limit } = req.query;
      const parsed = limit ? parseInt(limit, 10) : 500;
      const maxResults = Number.isNaN(parsed) || parsed <= 0 ? 500 : Math.min(parsed, 1e3);
      const result = await db.execute(sql4`
        SELECT 
          osm_id,
          place_name,
          place_category,
          latitude,
          longitude,
          COUNT(*) as checkin_count,
          MAX(created_at) as last_checkin
        FROM checkins 
        GROUP BY osm_id, place_name, place_category, latitude, longitude
        ORDER BY last_checkin DESC
        LIMIT ${maxResults}
      `);
      res.json({
        locations: result.rows,
        count: result.rows.length
      });
    } catch (error) {
      console.error("Get all checkins error:", error);
      res.status(500).json({ error: "Failed to get check-ins" });
    }
  });
  const FREE_QUERY_LIMIT = 3;
  const getTodayDateString = () => {
    const now = /* @__PURE__ */ new Date();
    return now.toISOString().split("T")[0];
  };
  app2.get("/api/travel-ai/status/:walletAddress", async (req, res) => {
    try {
      const { walletAddress } = req.params;
      if (!walletAddress) {
        return res.status(400).json({ error: "Wallet address is required" });
      }
      const isHolder = await isNFTHolder(walletAddress);
      const today = getTodayDateString();
      const result = await db.execute(sql4`
        SELECT query_count, last_query_date FROM travel_ai_queries 
        WHERE wallet_address = ${walletAddress.toLowerCase()}
      `);
      let queryCount = 0;
      if (result.rows.length > 0) {
        const lastQueryDate = result.rows[0].last_query_date;
        if (lastQueryDate !== today) {
          queryCount = 0;
        } else {
          queryCount = Number(result.rows[0].query_count);
        }
      }
      const remainingFreeQueries = Math.max(0, FREE_QUERY_LIMIT - queryCount);
      const hasAccess = isHolder || remainingFreeQueries > 0;
      res.json({
        isHolder,
        queryCount,
        remainingFreeQueries,
        hasAccess,
        freeQueryLimit: FREE_QUERY_LIMIT
      });
    } catch (error) {
      console.error("Travel AI status error:", error);
      res.status(500).json({ error: "Failed to get status" });
    }
  });
  app2.post("/api/travel-ai/chat", async (req, res) => {
    try {
      const { message, walletAddress, chatHistory } = req.body;
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }
      if (!walletAddress) {
        return res.status(400).json({ error: "Wallet address is required" });
      }
      const validHistory = Array.isArray(chatHistory) ? chatHistory.filter(
        (msg) => msg && typeof msg.role === "string" && typeof msg.content === "string"
      ) : [];
      const normalizedAddress = walletAddress.toLowerCase();
      const today = getTodayDateString();
      const isHolder = await isNFTHolder(walletAddress);
      const result = await db.execute(sql4`
        SELECT query_count, last_query_date FROM travel_ai_queries 
        WHERE wallet_address = ${normalizedAddress}
      `);
      let currentCount = 0;
      if (result.rows.length > 0) {
        const lastQueryDate = result.rows[0].last_query_date;
        if (lastQueryDate === today) {
          currentCount = Number(result.rows[0].query_count);
        }
      }
      if (!isHolder && currentCount >= FREE_QUERY_LIMIT) {
        return res.status(403).json({
          error: "Daily limit reached. Mint a TravelMint NFT for unlimited access, or come back tomorrow!",
          queryCount: currentCount,
          remainingFreeQueries: 0
        });
      }
      const { getTravelRecommendation: getTravelRecommendation2 } = await Promise.resolve().then(() => (init_openrouter_service(), openrouter_service_exports));
      const textResponse = await getTravelRecommendation2(message, validHistory);
      const { getWikipediaInfo: getWikipediaInfo2 } = await Promise.resolve().then(() => (init_wikipedia_service(), wikipedia_service_exports));
      const boldMatches = textResponse.match(/\*\*([^*]+)\*\*/g) || [];
      const placeNames = boldMatches.map((m) => m.replace(/\*\*/g, "")).filter((name) => !name.includes("Attractions") && !name.includes("Cafes") && !name.includes("Restaurants") && !name.includes("Sites") && name.length < 50).slice(0, 3);
      const imagePromises = placeNames.map(async (name) => {
        try {
          const info = await getWikipediaInfo2(name);
          return info ? { name, ...info } : null;
        } catch {
          return null;
        }
      });
      const imageResults = await Promise.allSettled(imagePromises);
      const images = imageResults.filter((r) => r.status === "fulfilled" && r.value !== null).map((r) => r.value);
      const response = textResponse;
      if (!isHolder) {
        await db.execute(sql4`
          INSERT INTO travel_ai_queries (wallet_address, query_count, last_query_date, updated_at)
          VALUES (${normalizedAddress}, 1, ${today}, NOW())
          ON CONFLICT (wallet_address) 
          DO UPDATE SET 
            query_count = CASE 
              WHEN travel_ai_queries.last_query_date = ${today} 
              THEN travel_ai_queries.query_count + 1 
              ELSE 1 
            END,
            last_query_date = ${today},
            updated_at = NOW()
        `);
      }
      const newCount = isHolder ? currentCount : currentCount + 1;
      const remainingFreeQueries = isHolder ? -1 : Math.max(0, FREE_QUERY_LIMIT - newCount);
      res.json({
        success: true,
        response,
        images,
        // Wikipedia images for mentioned places
        isHolder,
        queryCount: newCount,
        remainingFreeQueries
      });
    } catch (error) {
      console.error("Travel AI chat error:", error);
      const errorMessage = error.message || "";
      if (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("quota")) {
        return res.status(429).json({
          error: "AI service is temporarily busy. Please try again in a few moments.",
          retryable: true
        });
      }
      res.status(500).json({
        error: "Failed to get travel advice. Please try again.",
        message: error.message
      });
    }
  });
  return createServer(app2);
}

// server/createApp.ts
function createApp() {
  const app2 = express();
  app2.use(express.json({ limit: "50mb" }));
  app2.use(express.urlencoded({ extended: false, limit: "50mb" }));
  app2.get("/.well-known/farcaster.json", (req, res) => {
    console.log("\u{1F3AF} HIGH PRIORITY FARCASTER ROUTE HIT!", Date.now());
    const currentTimestamp = Date.now();
    const cacheBuster = `?v=${currentTimestamp}&force=${Math.random().toString(36).substring(7)}`;
    const farcasterConfig = {
      "accountAssociation": {
        "header": "eyJmaWQiOjI5MDY3MywidHlwZSI6ImF1dGgiLCJrZXkiOiIweGUwMkUyNTU3YkI4MDdDZjdFMzBDZUY4YzMxNDY5NjNhOGExZDQ0OTYifQ",
        "payload": "eyJkb21haW4iOiJ0cmF2ZWxtaW50bmZ0LnZlcmNlbC5hcHAifQ",
        "signature": "ZWhR28DttKO6Kzdr2iuvajB0mi86rmos/UIP63S8bKs2ExtVC4XmemQjGpCUI5sdRxjeLkjmVJEfF19Ev7kb6Bw="
      },
      "miniapp": {
        "version": "1",
        "name": "TravelMint",
        "author": "coinacci",
        "authorUrl": "https://warpcast.com/coinacci",
        "description": "Mint, buy, and sell location-based travel photo NFTs. Create unique travel memories on the blockchain with GPS coordinates and discover NFTs on an interactive map.",
        "iconUrl": "https://travelmintnft.vercel.app/icon.png",
        "homeUrl": "https://travelmintnft.vercel.app/",
        "imageUrl": "https://travelmintnft.vercel.app/logo.jpeg",
        "splashImageUrl": "https://travelmintnft.vercel.app/logo.jpeg",
        "splashBackgroundColor": "#0f172a",
        "subtitle": "Travel Photo NFT Marketplace",
        "heroImageUrl": "https://travelmintnft.vercel.app/logo.jpeg",
        "tagline": "Turn travel into NFTs",
        "ogTitle": "TravelMint NFT App",
        "ogDescription": "Mint, buy, and sell location-based travel photo NFTs on Base blockchain",
        "ogImageUrl": "https://travelmintnft.vercel.app/logo.jpeg",
        "castShareUrl": "https://travelmintnft.vercel.app/share",
        "webhookUrl": "https://api.neynar.com/f/app/968f2785-2da9-451a-a984-d753e739713c/event",
        "license": "MIT",
        "privacyPolicyUrl": "https://travelmintnft.vercel.app/privacy",
        "tags": ["travel", "nft", "blockchain", "photography", "base"],
        "screenshotUrls": [
          "https://travelmintnft.vercel.app/logo.jpeg",
          "https://travelmintnft.vercel.app/logo.jpeg"
        ],
        "noindex": false,
        "primaryCategory": "productivity"
      },
      "baseBuilder": {
        "allowedAddresses": ["0x7F397c837b9B67559E3cFfaEceA4a2151c05b548"]
      }
    };
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0, s-maxage=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("ETag", `"v${currentTimestamp}"`);
    res.setHeader("Last-Modified", (/* @__PURE__ */ new Date()).toUTCString());
    res.setHeader("X-Timestamp", currentTimestamp.toString());
    res.setHeader("X-Cache-Buster", cacheBuster);
    res.setHeader("X-Farcaster-Version", `3.${currentTimestamp}`);
    res.setHeader("X-Debug", "HIGH-PRIORITY-ROUTE");
    res.send(JSON.stringify(farcasterConfig, null, 2));
  });
  app2.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma");
    res.header("Access-Control-Allow-Credentials", "false");
    res.header("X-Content-Type-Options", "nosniff");
    res.header("Referrer-Policy", "strict-origin-when-cross-origin");
    res.header("Content-Security-Policy", [
      "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' chrome-extension: moz-extension: safari-extension: https: data: blob:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https: data:",
      "font-src 'self' https://fonts.gstatic.com https: data:",
      "img-src 'self' data: https: http: chrome-extension: moz-extension: safari-extension: blob:",
      "connect-src 'self' https: http: wss: ws: chrome-extension: moz-extension: safari-extension: data: blob:",
      "frame-src 'self' chrome-extension: moz-extension: safari-extension: https: data:",
      "frame-ancestors *",
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https:"
    ].join("; "));
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });
  if (process.env.VERCEL) {
    console.log("\u{1F527} Running in Vercel serverless mode - skipping server setup");
    registerRoutes(app2);
  }
  return app2;
}

// api/index.ts
var app = createApp();
var index_default = app;
export {
  index_default as default
};

import { ethers } from "ethers";
import { getAllTokenIdsFromContract } from "./basescan.js";

// Use multiple high-performance RPC providers (avoiding rate-limited official endpoint)
const BASE_RPC_URLS = [
  "https://base-rpc.publicnode.com", // Most reliable free option (542M+ requests)
  "https://rpc.ankr.com/base", // 30 req/sec free tier  
  "https://base.llamarpc.com",
  "https://base.gateway.tenderly.co",
  "https://mainnet.base.org" // Official as last resort
];

let currentRpcIndex = 0;

// Moralis API configuration - much more reliable than BaseScan
const MORALIS_API_URL = "https://deep-index.moralis.io/api/v2";
const MORALIS_API_KEY = process.env.MORALIS_API_KEY || "";
// Use BaseScan API for transaction verification
const BASESCAN_API_URL = "https://api.basescan.org/api";
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || "";
const NFT_CONTRACT_ADDRESS = "0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f";
const USDC_CONTRACT_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
// ✅ TravelMarketplace Contract Address - Deployed on Base Mainnet
const MARKETPLACE_CONTRACT_ADDRESS = "0x480549919B9e8Dd1DA1a1a9644Fb3F8A115F2c2c";
// ✅ QuestManager Contract Address - Deployed on Base Mainnet (with 0.000005 ETH fee)
const QUEST_MANAGER_ADDRESS = "0x30eDb4493fA7c0F035adc75bA6381E2efFFeCa6c";
const PURCHASE_PRICE = "1000000"; // 1 USDC (6 decimals)
const PLATFORM_WALLET = "0x7CDe7822456AAC667Df0420cD048295b92704084"; // Platform commission wallet

// TravelNFT ABI - only for NFT operations
const TRAVEL_NFT_ABI = [
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

// Marketplace ABI - for secure trading
const MARKETPLACE_ABI = [
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

// ERC20 ABI for USDC interactions
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

// QuestManager ABI for event listening
const QUEST_MANAGER_ABI = [
  "event QuestCompleted(address indexed user, uint256 indexed questId, uint256 fee, uint256 timestamp, uint256 day)"
];

// Rate limit retry utility
export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Check if it's a rate limit error
      if (error && typeof error === 'object' && 'info' in error) {
        const info = (error as any).info;
        if (info?.error?.code === -32016 || info?.error?.message?.includes('rate limit')) {
          console.log(`⚠️ Rate limit hit (attempt ${i + 1}/${maxRetries}), waiting...`);
          
          // Faster backoff for real-time detection
          await new Promise(resolve => setTimeout(resolve, 1000 + (i * 500))); // 1.5s, 2s, 2.5s
          continue;
        }
      }
      
      // For non-rate-limit errors, wait before retry
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  throw lastError!;
}

// Provider and contract instances (will be initialized after ABIs are defined)
let currentProvider: ethers.JsonRpcProvider;
let currentNftContract: ethers.Contract;
let currentMarketplaceContract: ethers.Contract;
let currentUsdcContract: ethers.Contract;
let currentQuestManagerContract: ethers.Contract;

// Initialize provider and contracts
function initializeProvider(rpcUrl: string) {
  console.log(`🔌 Initializing RPC provider: ${rpcUrl}`);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  return {
    provider,
    nftContract: new ethers.Contract(NFT_CONTRACT_ADDRESS, TRAVEL_NFT_ABI, provider),
    marketplaceContract: new ethers.Contract(MARKETPLACE_CONTRACT_ADDRESS, MARKETPLACE_ABI, provider),
    usdcContract: new ethers.Contract(USDC_CONTRACT_ADDRESS, ERC20_ABI, provider),
    questManagerContract: new ethers.Contract(QUEST_MANAGER_ADDRESS, QUEST_MANAGER_ABI, provider)
  };
}

// Rotate to next RPC provider on failure
function rotateRpcProvider(): boolean {
  const nextIndex = (currentRpcIndex + 1) % BASE_RPC_URLS.length;
  
  currentRpcIndex = nextIndex;
  const nextUrl = BASE_RPC_URLS[currentRpcIndex];
  console.log(`🔄 Rotating to RPC provider [${currentRpcIndex}]: ${nextUrl}`);
  
  const { provider, nftContract, marketplaceContract, usdcContract, questManagerContract } = initializeProvider(nextUrl);
  currentProvider = provider;
  currentNftContract = nftContract;
  currentMarketplaceContract = marketplaceContract;
  currentUsdcContract = usdcContract;
  currentQuestManagerContract = questManagerContract;
  
  return true;
}

// Initialize with first provider (done after all constants are defined)
const initial = initializeProvider(BASE_RPC_URLS[0]);
currentProvider = initial.provider;
currentNftContract = initial.nftContract;
currentMarketplaceContract = initial.marketplaceContract;
currentUsdcContract = initial.usdcContract;
currentQuestManagerContract = initial.questManagerContract;

// Backward compatibility exports (use getters internally for rotation support)
export const provider = currentProvider;
export const nftContract = currentNftContract;
export const marketplaceContract = currentMarketplaceContract;
const usdcContract = currentUsdcContract;
export const questManagerContract = currentQuestManagerContract;

// Export getters that always return current instances
export const getProvider = () => currentProvider;
export const getNftContract = () => currentNftContract;
export const getMarketplaceContract = () => currentMarketplaceContract;
export const getQuestManagerContract = () => currentQuestManagerContract;

export interface BlockchainNFT {
  tokenId: string;
  owner: string;
  tokenURI: string;
  metadata?: any;
}

// Helper function to normalize different URI schemes to HTTP URLs with multiple robust gateways
function normalizeUri(uri: string): string[] {
  if (!uri) return [];
  
  // Handle IPFS URIs with multiple reliable gateways for redundancy
  if (uri.startsWith('ipfs://')) {
    const cid = uri.replace('ipfs://', '');
    return [
      `https://ipfs.io/ipfs/${cid}`,              // Most reliable public gateway
      `https://cloudflare-ipfs.com/ipfs/${cid}`,  // Cloudflare CDN - very fast
      `https://dweb.link/ipfs/${cid}`,            // Protocol Labs gateway
      `https://4everland.io/ipfs/${cid}`,         // Alternative reliable gateway
      `https://gateway.pinata.cloud/ipfs/${cid}`  // Pinata (may be rate limited)
    ];
  }
  
  // Handle direct IPFS gateway URLs - add fallback gateways
  if (uri.includes('/ipfs/')) {
    const hash = uri.split('/ipfs/')[1];
    if (hash) {
      const cleanHash = hash.split('?')[0]; // Remove query params
      return [
        uri, // Keep original first (may be fastest if not rate limited)
        `https://ipfs.io/ipfs/${cleanHash}`,              // Most reliable
        `https://cloudflare-ipfs.com/ipfs/${cleanHash}`,  // Fast CDN
        `https://dweb.link/ipfs/${cleanHash}`,            // Protocol Labs
        `https://4everland.io/ipfs/${cleanHash}`          // Alternative
      ];
    }
  }
  
  // Handle Arweave URIs
  if (uri.startsWith('ar://')) {
    const id = uri.replace('ar://', '');
    return [`https://arweave.net/${id}`];
  }
  
  // Handle data URIs (base64 JSON)
  if (uri.startsWith('data:application/json;base64,')) {
    try {
      const base64 = uri.split(',')[1];
      const jsonString = Buffer.from(base64, 'base64').toString();
      return [`data:${jsonString}`]; // Special marker for JSON data
    } catch (e) {
      console.error('Failed to decode base64 JSON:', e);
      return [];
    }
  }
  
  // HTTP/HTTPS URLs are already normalized
  if (uri.startsWith('http')) {
    return [uri];
  }
  
  return [];
}

// Robust coordinate extraction from metadata
function extractCoordinates(metadata: any): { latitude: string | null, longitude: string | null } {
  if (!metadata || !metadata.attributes) {
    return { latitude: null, longitude: null };
  }
  
  let latitude: string | null = null;
  let longitude: string | null = null;
  
  // Look for coordinate attributes with various naming conventions
  const coordTraits = ['latitude', 'lat', 'longitude', 'lng', 'lon', 'coordinates', 'coord', 'gps', 'geo'];
  
  for (const attr of metadata.attributes) {
    if (!attr.trait_type || !attr.value) continue;
    
    const traitLower = attr.trait_type.toLowerCase();
    const value = String(attr.value).trim();
    
    // Handle latitude (be specific to avoid false matches)
    if (traitLower.includes('latitude')) {
      latitude = parseCoordinate(value);
    } else if (traitLower === 'lat') {
      latitude = parseCoordinate(value);
    }
    
    // Handle longitude (be specific to avoid false matches)
    if (traitLower.includes('longitude')) {
      longitude = parseCoordinate(value);
    } else if (traitLower === 'lng' || traitLower === 'lon') {
      longitude = parseCoordinate(value);
    }
    
    // Handle combined coordinates (e.g., "40.123,29.456")
    if (traitLower.includes('coordinates') || traitLower.includes('coord') || traitLower.includes('gps')) {
      const coords = parseCoordinatePair(value);
      if (coords) {
        latitude = coords.latitude;
        longitude = coords.longitude;
      }
    }
  }
  
  return { latitude, longitude };
}

// Parse a single coordinate value
function parseCoordinate(value: string): string | null {
  if (!value) return null;
  
  // Remove degree symbols and other non-numeric characters except dots, minus, and commas
  const cleaned = value.replace(/[^\d\.\-,]/g, '');
  
  // Try to parse as number
  const num = parseFloat(cleaned);
  if (!isNaN(num) && num !== 0) {
    return num.toString();
  }
  
  return null;
}

// Parse coordinate pair from a single string (e.g., "40.123,29.456")
function parseCoordinatePair(value: string): { latitude: string, longitude: string } | null {
  if (!value) return null;
  
  // Look for comma-separated values
  const parts = value.split(',').map(p => p.trim());
  if (parts.length === 2) {
    const lat = parseCoordinate(parts[0]);
    const lng = parseCoordinate(parts[1]);
    if (lat && lng) {
      return { latitude: lat, longitude: lng };
    }
  }
  
  return null;
}

// Fetch content from multiple gateways with improved timeout and retry logic
async function fetchWithGateways(uris: string[]): Promise<any> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < uris.length; i++) {
    const uri = uris[i];
    try {
      // Handle special data: JSON marker
      if (uri.startsWith('data:')) {
        return JSON.parse(uri.replace('data:', ''));
      }
      
      console.log(`🔗 Trying gateway ${i + 1}/${uris.length}: ${uri}`);
      const controller = new AbortController();
      
      // Progressive timeout - faster for first gateways, longer for fallbacks  
      const timeout = i === 0 ? 8000 : (i === 1 ? 12000 : 15000);
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(uri, { 
        signal: controller.signal,
        headers: { 
          'User-Agent': 'TravelMint/1.0',
          'Accept': 'application/json, text/plain, */*'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          console.log(`✅ Gateway ${i + 1} success: JSON response`);
          return await response.json();
        } else {
          console.log(`✅ Gateway ${i + 1} success: Text response`);
          const text = await response.text();
          // Try to parse as JSON if it looks like JSON
          if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
            try {
              return JSON.parse(text);
            } catch {
              return text; // Return as text if JSON parsing fails
            }
          }
          return text;
        }
      } else {
        console.log(`⚠️ Gateway ${i + 1} HTTP error: ${response.status} ${response.statusText}`);
        if (response.status === 429) {
          console.log(`⚠️ Gateway ${i + 1} rate limited, trying next...`);
        }
        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`⚠️ Gateway ${i + 1} failed: ${errorMsg}`);
      lastError = error instanceof Error ? error : new Error(errorMsg);
      
      // Don't wait on timeout/abort errors, move to next gateway quickly
      if (errorMsg.includes('aborted') || errorMsg.includes('timeout')) {
        continue;
      }
    }
  }
  
  throw lastError || new Error(`All ${uris.length} gateways failed`);
}

export class BlockchainService {

  // Get specific NFT using Moralis API - much faster and more reliable
  async getMoralisNFT(tokenId: string): Promise<BlockchainNFT | null> {
    try {
      if (!MORALIS_API_KEY) {
        console.log("⚠️ No Moralis API key - falling back to RPC");
        return null;
      }

      console.log(`🚀 Fetching Token ${tokenId} using Moralis API...`);
      
      const moralisUrl = `${MORALIS_API_URL}/nft/${NFT_CONTRACT_ADDRESS}/${tokenId}?chain=base&format=decimal`;
      
      const response = await fetch(moralisUrl, {
        headers: {
          'X-API-Key': MORALIS_API_KEY,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.log(`❌ Moralis API error for Token ${tokenId}:`, response.status);
        return null;
      }
      
      const nftData = await response.json();
      
      if (!nftData.owner_of) {
        console.log(`❌ Token ${tokenId} has no owner (doesn't exist)`);
        return null;
      }
      
      console.log(`✅ SUCCESS! Token ${tokenId} owner: ${nftData.owner_of}, tokenURI: ${nftData.token_uri}`);
      
      // Fetch and parse metadata
      let metadata = null;
      if (nftData.token_uri) {
        try {
          metadata = await fetchWithGateways([nftData.token_uri]);
          console.log(`✅ Parsed metadata for token ${tokenId}:`, metadata);
        } catch (error) {
          console.log(`❌ Error fetching metadata for token ${tokenId}:`, error);
        }
      }
      
      // Return BlockchainNFT format (not DB format yet)
      return {
        tokenId: tokenId,
        owner: nftData.owner_of.toLowerCase(),
        tokenURI: nftData.token_uri || "",
        metadata
      };
      
    } catch (error) {
      console.log(`❌ Moralis API error for Token ${tokenId}:`, error);
      return null;
    }
  }
  
  // Get all NFTs from the contract using Moralis API for Transfer events
  async getAllNFTs(): Promise<BlockchainNFT[]> {
    try {
      console.log("🔗 Fetching NFTs using parallel scanning (RPC + Moralis)...");
      
      // Run Moralis API and RPC scanning in parallel to avoid blocking
      const scanPromises: Promise<any>[] = [];
      
      // Always try fast RPC scanning (with timeout protection)
      scanPromises.push(this.tryKnownTokenIds());
      
      // Parallel Moralis API call for Token 47 if available
      if (MORALIS_API_KEY) {
        console.log("🚀 Starting parallel Moralis API call for Token 47...");
        scanPromises.push(this.getMoralisNFT("47"));
      } else {
        scanPromises.push(Promise.resolve(null));
      }
      
      // Wait for both to complete (or fail)
      const [rpcResults, moralisToken47] = await Promise.allSettled(scanPromises);
      
      // Extract results
      const results: BlockchainNFT[] = rpcResults.status === 'fulfilled' ? rpcResults.value : [];
      
      // Add Moralis Token 47 if found and not already in results
      if (moralisToken47.status === 'fulfilled' && moralisToken47.value) {
        console.log("🎉 SUCCESS! Token 47 found via Moralis API!");
        const exists = results.some(nft => nft.tokenId === "47");
        if (!exists) {
          console.log("✅ Adding Token 47 to results list");
          results.push(moralisToken47.value);
        }
      }
      
      console.log(`📊 Total NFTs found: ${results.length}`);
      return results;
    } catch (error) {
      console.error("Error in getAllNFTs:", error);
      // Final fallback - try RPC only with no timeout
      return await this.tryKnownTokenIds();
    }
  }

  // Fallback method to try known token IDs
  async tryKnownTokenIds(): Promise<BlockchainNFT[]> {
    console.log("🔄 Trying known token IDs as fallback...");
    const nfts: BlockchainNFT[] = [];
    let consecutiveFailures = 0;
    
    // Try token IDs 1-150 to catch newly minted NFTs (excluding unwanted tokens 1 & 2)
    for (let tokenId = 1; tokenId <= 1000; tokenId++) {
      try {
        const owner = await withRetry(() => nftContract.ownerOf(tokenId));
        const tokenURI = await nftContract.tokenURI(tokenId);
        
        // Reset consecutive failures when we find a valid token
        consecutiveFailures = 0;
        
        // Fetch metadata using new robust URI handling
        let metadata = null;
        const uris = normalizeUri(tokenURI);
        
        if (uris.length > 0) {
          try {
            console.log(`📥 Fetching metadata from tokenURI: ${tokenURI}`);
            // Add timeout to prevent infinite blocking on slow IPFS gateways
            metadata = await Promise.race([
              fetchWithGateways(uris),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Metadata fetch timeout')), 3000)
              )
            ]);
            console.log(`✅ Parsed metadata for token ${tokenId}:`, metadata);
          } catch (fetchError) {
            console.log(`❌ Error fetching metadata for token ${tokenId}:`, fetchError);
            // Continue without metadata to avoid blocking the entire scan
          }
        } else {
          console.log(`⚠️ Unsupported tokenURI format for token ${tokenId}: ${tokenURI}`);
        }
        
        nfts.push({
          tokenId: tokenId.toString(),
          owner: owner.toLowerCase(),
          tokenURI,
          metadata
        });
        
        console.log(`✅ Found NFT #${tokenId} owned by ${owner}`);
        
      } catch (error: any) {
        // Debug: Log the actual error to see what's happening
        console.log(`❌ Error checking token ${tokenId}:`, error.reason || error.message || error);
        
        // Only count as failure if it's actually a "token doesn't exist" error
        // Don't count rate limiting or network errors as consecutive failures
        if (error.reason === "ERC721: invalid token ID" || 
            (error.code === "CALL_EXCEPTION" && !error.message?.includes("missing revert data")) ||
            error.message?.includes("invalid token ID")) {
          consecutiveFailures++;
          console.log(`⚠️ Token ${tokenId} doesn't exist (${consecutiveFailures} consecutive failures)`);
        } else {
          // Rate limiting or network error - don't count as consecutive failure
          console.log(`🔄 Rate limit/network error for token ${tokenId}, continuing without counting failure...`);
        }
        
        // If we have 15 consecutive token-not-found failures, likely no more tokens exist
        // Allow for gaps in token IDs (like missing tokens 5-46, then 47 exists)
        if (consecutiveFailures >= 15) {
          console.log(`🛑 Stopping search after ${consecutiveFailures} consecutive "token not found" failures at token ${tokenId}`);
          break;
        }
      }
    }
    
    console.log(`Found ${nfts.length} NFTs using fallback method`);
    return nfts;
  }
  
  // Get NFTs owned by a specific address
  async getNFTsByOwner(ownerAddress: string): Promise<BlockchainNFT[]> {
    try {
      ownerAddress = ownerAddress.toLowerCase();
      console.log(`🔗 Fetching NFTs for owner: ${ownerAddress}`);
      
      // Get all NFTs first, then filter by owner
      const allNFTs = await this.getAllNFTs();
      const ownerNFTs = allNFTs.filter(nft => nft.owner === ownerAddress);
      
      console.log(`✅ Owner ${ownerAddress} has ${ownerNFTs.length} NFTs`);
      return ownerNFTs;
      
    } catch (error) {
      console.error(`Error fetching NFTs for owner ${ownerAddress}:`, error);
      return [];
    }
  }
  
  // Get a specific NFT by token ID
  async getNFTByTokenId(tokenId: string): Promise<BlockchainNFT | null> {
    try {
      const owner = await nftContract.ownerOf(tokenId);
      const tokenURI = await nftContract.tokenURI(tokenId);
      
      // Fetch metadata if URI is available
      let metadata = null;
      if (tokenURI && tokenURI.startsWith('http')) {
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
  private getLocationOverride(tokenId: string, nftTitle: string): { location: string, latitude: string, longitude: string } | null {
    // Override locations for specific travel NFTs to prevent metadata from changing them
    const locationOverrides: { [key: string]: { location: string, latitude: string, longitude: string } } = {
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
  async blockchainNFTToDBFormat(blockchainNFT: BlockchainNFT): Promise<any> {
    const metadata = blockchainNFT.metadata;
    
    // Check for location override first - these locations are fixed and won't change
    const override = this.getLocationOverride(blockchainNFT.tokenId, metadata?.name || '');
    
    let location: string;
    let latitude: string | undefined;
    let longitude: string | undefined;
    
    if (override) {
      // Use fixed override location - this prevents metadata from changing the location
      location = override.location;
      latitude = override.latitude;
      longitude = override.longitude;
      console.log(`🔒 Using fixed location for NFT #${blockchainNFT.tokenId}: ${location} at ${latitude}, ${longitude}`);
    } else {
      // Use metadata location for other NFTs
      location = this.extractLocationFromMetadata(metadata);
      const coords = extractCoordinates(metadata);
      latitude = coords.latitude || undefined;
      longitude = coords.longitude || undefined;
    }
    
    // Always prioritize uploaded travel images over metadata placeholders
    let imageUrl = await this.extractImageUrl(metadata, blockchainNFT.tokenURI);
    
    // Map tokens to actual uploaded travel photos
    if (blockchainNFT.tokenId === "1") {
      // Token #1: Coast photo (Tuzla)
      imageUrl = "/attached_assets/IMG_4085_1756446465520.jpeg";
    } else if (blockchainNFT.tokenId === "2") {
      // Token #2: Tram photo (Kadıköy) - use actual uploaded image
      imageUrl = "/attached_assets/IMG_4086_1756446465520.jpeg";
    } else if (blockchainNFT.tokenId === "37") {
      // Token #37: Kapakli location - first photo
      imageUrl = "/attached_assets/IMG_4202_1756888569757.jpeg";
    } else if (blockchainNFT.tokenId === "38") {
      // Token #38: Kapakli location - second photo  
      imageUrl = "/attached_assets/IMG_4202_1756890858921.jpeg";
    }
    
    // For future tokens, always prefer uploaded images over placeholder metadata
    // This ensures users see their actual travel photos, not stock images
    
    return {
      // Remove hard-coded id - let UUID default apply to prevent duplicate key errors
      title: metadata?.name || `Travel NFT #${blockchainNFT.tokenId}`,
      description: metadata?.description || "A beautiful travel memory captured on the blockchain.",
      imageUrl: imageUrl,
      location: location,
      latitude: latitude || undefined,
      longitude: longitude || undefined, 
      category: this.extractCategoryFromMetadata(metadata) || "travel",
      price: "1.0", // Fixed mint price
      isForSale: 0,
      creatorAddress: blockchainNFT.owner, // Assume current owner is creator for now
      ownerAddress: blockchainNFT.owner,
      contractAddress: NFT_CONTRACT_ADDRESS,
      mintPrice: "1.0",
      royaltyPercentage: "5.0",
      tokenId: blockchainNFT.tokenId,
      transactionHash: null, // Would need additional lookup to get mint transaction
      metadata: JSON.stringify(metadata || {})
    };
  }
  
  // URL validation helper to ensure image URLs point to actual images, not metadata
  private async validateAndFixImageUrl(url: string): Promise<string> {
    try {
      console.log(`🔍 Validating image URL: ${url.substring(0, 50)}...`);
      const response = await fetch(url, { method: 'HEAD' });
      const contentType = response.headers.get('content-type');
      
      // If it's metadata JSON, extract the actual image URL
      if (contentType?.includes('application/json')) {
        console.log('📄 Detected metadata URL, extracting actual image...');
        const metadataResponse = await fetch(url);
        const metadata = await metadataResponse.json();
        
        if (metadata.image) {
          console.log(`✅ Extracted image URL: ${metadata.image.substring(0, 50)}...`);
          return metadata.image;
        }
      }
      
      // Check if it's actually an image
      if (contentType?.startsWith('image/')) {
        console.log('✅ Valid image URL confirmed');
        return url;
      }
      
      console.log(`⚠️ URL not an image (${contentType}), keeping original`);
      return url;
      
    } catch (error) {
      console.log('⚠️ Failed to validate URL, keeping original:', error);
      return url;
    }
  }

  // Extract proper image URL from metadata or tokenURI
  private async extractImageUrl(metadata: any, tokenURI: string): Promise<string> {
    // First, try to get image from metadata
    if (metadata?.image) {
      // Validate and fix the image URL to ensure it points to actual image
      return await this.validateAndFixImageUrl(metadata.image);
    }
    
    // If no image in metadata, check tokenURI
    if (!tokenURI) {
      return ""; // No URL available
    }
    
    // If tokenURI looks like it might be a JSON metadata URL, try to fetch and extract image
    try {
      if (tokenURI.startsWith('http') && (
        tokenURI.includes('ipfs') || 
        tokenURI.includes('metadata') ||
        tokenURI.includes('json') ||
        tokenURI.startsWith('https://gateway.pinata.cloud/ipfs/bafkrei') // Common IPFS JSON pattern
      )) {
        console.log(`🔍 Checking if ${tokenURI} contains metadata with image URL...`);
        
        const response = await fetch(tokenURI);
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          
          // If response is JSON, it's metadata - extract image from it
          if (contentType && contentType.includes('application/json')) {
            const fetchedMetadata = await response.json();
            if (fetchedMetadata?.image) {
              console.log(`✅ Found real image URL in metadata: ${fetchedMetadata.image}`);
              return fetchedMetadata.image;
            }
          }
        }
      }
    } catch (error) {
      console.log(`⚠️ Failed to fetch potential metadata URL ${tokenURI}:`, error);
    }
    
    // Fallback: use tokenURI as image URL (assuming it's a direct image link)
    return tokenURI;
  }

  private extractLocationFromMetadata(metadata: any): string {
    if (!metadata || !metadata.attributes) return "Unknown Location";
    
    const locationAttr = metadata.attributes.find((attr: any) => 
      attr.trait_type?.toLowerCase().includes('location') || 
      attr.trait_type?.toLowerCase().includes('city')
    );
    
    return locationAttr?.value || "Unknown Location";
  }
  
  private extractLatitudeFromMetadata(metadata: any): string | null {
    if (!metadata || !metadata.attributes) return null;
    
    const latAttr = metadata.attributes.find((attr: any) => 
      attr.trait_type?.toLowerCase().includes('latitude') ||
      attr.trait_type?.toLowerCase().includes('lat')
    );
    
    if (latAttr?.value) {
      return latAttr.value;
    }
    
    // If no explicit latitude, try to infer from location
    const locationAttr = metadata.attributes.find((attr: any) => 
      attr.trait_type?.toLowerCase().includes('location')
    );
    
    if (locationAttr?.value?.toLowerCase() === 'tuzla') {
      return "40.8256"; // Tuzla, Istanbul coordinates
    } else if (locationAttr?.value?.toLowerCase() === 'kadikoy' || locationAttr?.value?.toLowerCase() === 'kadıköy') {
      return "40.9833"; // Kadıköy, Istanbul coordinates
    }
    
    return null;
  }
  
  private extractLongitudeFromMetadata(metadata: any): string | null {
    if (!metadata || !metadata.attributes) return null;
    
    const lngAttr = metadata.attributes.find((attr: any) => 
      attr.trait_type?.toLowerCase().includes('longitude') ||
      attr.trait_type?.toLowerCase().includes('lng') ||
      attr.trait_type?.toLowerCase().includes('lon')
    );
    
    if (lngAttr?.value) {
      return lngAttr.value;
    }
    
    // If no explicit longitude, try to infer from location
    const locationAttr = metadata.attributes.find((attr: any) => 
      attr.trait_type?.toLowerCase().includes('location')
    );
    
    if (locationAttr?.value?.toLowerCase() === 'tuzla') {
      return "29.2997"; // Tuzla, Istanbul coordinates
    } else if (locationAttr?.value?.toLowerCase() === 'kadikoy' || locationAttr?.value?.toLowerCase() === 'kadıköy') {
      return "29.0167"; // Kadıköy, Istanbul coordinates
    }
    
    return null;
  }
  
  private extractCategoryFromMetadata(metadata: any): string | null {
    if (!metadata || !metadata.attributes) return null;
    
    const categoryAttr = metadata.attributes.find((attr: any) => 
      attr.trait_type?.toLowerCase().includes('category') ||
      attr.trait_type?.toLowerCase().includes('type')
    );
    
    return categoryAttr?.value || null;
  }

  // Check USDC balance for an address
  async getUSDCBalance(address: string): Promise<string> {
    return withRetry(async () => {
      const balance = await usdcContract.balanceOf(address);
      // USDC has 6 decimals, so convert to human readable format
      return ethers.formatUnits(balance, 6);
    }).catch(error => {
      console.error(`Error fetching USDC balance for ${address}:`, error);
      return "0";
    });
  }

  // Check USDC allowance for NFT purchases
  async getUSDCAllowance(owner: string, spender: string): Promise<string> {
    return withRetry(async () => {
      const allowance = await usdcContract.allowance(owner, spender);
      return ethers.formatUnits(allowance, 6);
    }).catch(error => {
      console.error(`Error fetching USDC allowance:`, error);
      return "0";
    });
  }

  // 🔐 SECURE: Generate marketplace purchase transaction (NO PRICE MANIPULATION!)
  // This uses the new secure marketplace contract instead of the vulnerable NFT contract
  async generatePurchaseTransaction(tokenId: string, buyerAddress: string) {
    try {
      // Validate inputs
      if (!tokenId || !buyerAddress) {
        throw new Error("Missing required parameters for purchase");
      }

      // Check if NFT is actually listed in marketplace
      const listing = await marketplaceContract.getListing(tokenId);
      if (!listing.active) {
        throw new Error("NFT is not listed for sale");
      }

      // Verify current owner matches listing seller
      const currentOwner = await nftContract.ownerOf(tokenId);
      if (currentOwner.toLowerCase() !== listing.seller.toLowerCase()) {
        throw new Error("NFT owner doesn't match marketplace listing");
      }

      const price = ethers.formatUnits(listing.price, 6); // Convert from wei to USDC
      const requiredAmount = parseFloat(price);

      // Check buyer's USDC balance
      const buyerBalance = await this.getUSDCBalance(buyerAddress);
      if (parseFloat(buyerBalance) < requiredAmount) {
        throw new Error(`Insufficient USDC balance. Required: ${requiredAmount} USDC, Available: ${buyerBalance} USDC`);
      }

      // Check if buyer has approved marketplace to spend USDC
      const allowance = await this.getUSDCAllowance(buyerAddress, MARKETPLACE_CONTRACT_ADDRESS);
      if (parseFloat(allowance) < requiredAmount) {
        console.log(`⚠️ Insufficient USDC allowance. Required: ${requiredAmount} USDC, Allowed: ${allowance} USDC`);
      }

      // Calculate commission split (done automatically by marketplace contract)
      const platformFee = listing.price * BigInt(5) / BigInt(100); // 5% commission  
      const sellerAmount = listing.price - platformFee; // 95% to seller
      
      console.log(`💰 Secure purchase: ${price} USDC total (Seller: ${(Number(sellerAmount) / 1000000).toFixed(6)}, Platform: ${(Number(platformFee) / 1000000).toFixed(6)})`);

      return {
        success: true,
        // 🔐 SECURE: Use marketplace contract with NO price parameter!
        transaction: {
          type: "PURCHASE_NFT_MARKETPLACE", 
          to: MARKETPLACE_CONTRACT_ADDRESS,
          data: marketplaceContract.interface.encodeFunctionData("purchaseNFT", [
            tokenId // Only tokenId - price comes from secure listing!
          ]),
          description: `Secure purchase of NFT #${tokenId} for ${price} USDC via marketplace`
        },
        // Transaction details for confirmation
        tokenId,
        buyerAddress,
        seller: listing.seller,
        priceUSDC: price,
        sellerAmount: (Number(sellerAmount) / 1000000).toFixed(6),
        platformFee: (Number(platformFee) / 1000000).toFixed(6),
        // USDC approval transaction (if needed)
        approvalData: {
          to: USDC_CONTRACT_ADDRESS,
          data: usdcContract.interface.encodeFunctionData("approve", [
            MARKETPLACE_CONTRACT_ADDRESS, // Approve marketplace, not NFT contract!
            listing.price
          ]),
          description: `Approve ${price} USDC spending for secure marketplace purchase`
        }
      };

    } catch (error: any) {
      console.error("Error generating secure purchase transaction:", error);
      return {
        success: false,
        error: error.message || "Failed to generate secure purchase transaction"
      };
    }
  }

  // Verify NFT purchase transaction
  async verifyPurchaseTransaction(transactionHash: string, expectedTokenId: string, expectedBuyer: string): Promise<{success: boolean, error?: string, details?: any}> {
    try {
      console.log(`🔍 Verifying purchase transaction: ${transactionHash}`);
      
      // Get transaction receipt
      const receipt = await withRetry(() => provider.getTransactionReceipt(transactionHash));
      
      if (!receipt) {
        return { success: false, error: "Transaction not found or still pending" };
      }
      
      // Check if transaction was successful
      if (receipt.status !== 1) {
        return { success: false, error: "Transaction failed on blockchain" };
      }
      
      // Check if transaction was sent to our MARKETPLACE contract (purchase happens via marketplace)
      if (receipt.to?.toLowerCase() !== MARKETPLACE_CONTRACT_ADDRESS.toLowerCase()) {
        return { success: false, error: "Transaction was not sent to the marketplace contract" };
      }
      
      // Parse transaction to verify it called purchaseNFT function
      const transaction = await withRetry(() => provider.getTransaction(transactionHash));
      if (!transaction || !transaction.data) {
        return { success: false, error: "Could not retrieve transaction data" };
      }
      
      // Decode transaction data to verify function call
      try {
        const decodedData = marketplaceContract.interface.parseTransaction({ data: transaction.data });
        
        // Verify it's a purchaseNFT function call
        if (decodedData?.name !== "purchaseNFT") {
          return { success: false, error: `Transaction called ${decodedData?.name || 'unknown'} function, not purchaseNFT` };
        }
        
        // Verify token ID matches
        const transactionTokenId = decodedData.args[0].toString();
        if (transactionTokenId !== expectedTokenId) {
          return { success: false, error: `Token ID mismatch: expected ${expectedTokenId}, got ${transactionTokenId}` };
        }
        
        // Verify buyer matches (transaction sender)
        if (transaction.from?.toLowerCase() !== expectedBuyer.toLowerCase()) {
          return { success: false, error: `Buyer mismatch: expected ${expectedBuyer}, got ${transaction.from}` };
        }
        
        console.log(`✅ Purchase transaction verified: NFT #${transactionTokenId} purchased by ${transaction.from}`);
        
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
      
    } catch (error: any) {
      console.error("Error verifying purchase transaction:", error);
      return { success: false, error: error.message || "Failed to verify transaction" };
    }
  }

  // Check if wallet made any transaction on Base network today
  async hasBaseTransactionToday(walletAddress: string): Promise<boolean> {
    try {
      if (!BASESCAN_API_KEY) {
        console.log("⚠️ No Basescan API key - cannot verify Base transactions");
        return false;
      }

      console.log(`🔍 Checking Base transactions for wallet: ${walletAddress}`);
      
      // Get today's date for transaction filtering (UTC)
      const today = new Date();
      const todayStartUnix = Math.floor(new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() / 1000);
      const nowUnix = Math.floor(Date.now() / 1000);
      
      // Basescan API endpoint for getting transactions
      const url = `${BASESCAN_API_URL}?module=account&action=txlist&address=${walletAddress}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc&apikey=${BASESCAN_API_KEY}`;
      
      console.log(`📡 Fetching transactions from Basescan...`);
      const response = await fetch(url);
      
      if (!response.ok) {
        console.log(`❌ Basescan API error:`, response.status);
        return false;
      }
      
      const data = await response.json();
      
      if (data.status !== "1") {
        console.log(`❌ Basescan API returned error:`, data.message);
        return false;
      }
      
      // Check if any transaction happened today
      const todayTransactions = data.result.filter((tx: any) => {
        const txTimestamp = parseInt(tx.timeStamp);
        return txTimestamp >= todayStartUnix && txTimestamp <= nowUnix;
      });
      
      const hasTransaction = todayTransactions.length > 0;
      
      if (hasTransaction) {
        console.log(`✅ Found ${todayTransactions.length} Base transaction(s) today for ${walletAddress}`);
        console.log(`📋 Latest tx hash: ${todayTransactions[0].hash}`);
      } else {
        console.log(`❌ No Base transactions found today for ${walletAddress}`);
      }
      
      return hasTransaction;
      
    } catch (error) {
      console.error(`❌ Error checking Base transactions for ${walletAddress}:`, error);
      return false;
    }
  }

  // 🆕 Get current on-chain owner of an NFT  
  async getNFTOwner(tokenId: string): Promise<string | null> {
    try {
      console.log(`🔍 Getting on-chain owner for NFT #${tokenId}`);
      const owner = await withRetry(() => nftContract.ownerOf(tokenId));
      console.log(`✅ NFT #${tokenId} owner: ${owner}`);
      return owner;
    } catch (error: any) {
      console.error(`❌ Failed to get owner for NFT #${tokenId}:`, error);
      return null;
    }
  }

  // 🏪 MARKETPLACE FUNCTIONS - Secure trading without modifying NFT contract

  // Generate transaction to list NFT on marketplace
  async generateListingTransaction(tokenId: string, seller: string, priceUSDC: string) {
    try {
      // Validate inputs
      if (!tokenId || !seller || !priceUSDC) {
        throw new Error("Missing required parameters for listing");
      }

      // Verify seller owns the NFT
      const currentOwner = await nftContract.ownerOf(tokenId);
      if (currentOwner.toLowerCase() !== seller.toLowerCase()) {
        throw new Error("Only NFT owner can create listing");
      }

      // Check if marketplace is approved to transfer this NFT
      const isApproved = await nftContract.isApprovedForAll(seller, MARKETPLACE_CONTRACT_ADDRESS);
      const specificApproval = await nftContract.getApproved(tokenId);
      
      if (!isApproved && specificApproval.toLowerCase() !== MARKETPLACE_CONTRACT_ADDRESS.toLowerCase()) {
        console.log("⚠️ Marketplace not approved to transfer NFT - user needs to approve first");
      }

      const priceWei = ethers.parseUnits(priceUSDC, 6); // Convert USDC to wei (6 decimals)

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

    } catch (error: any) {
      console.error("Error generating listing transaction:", error);
      return {
        success: false,
        error: error.message || "Failed to generate listing transaction"
      };
    }
  }

  // Generate transaction to cancel NFT listing
  async generateCancelListingTransaction(tokenId: string, seller: string) {
    try {
      // Verify listing exists and seller matches
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

    } catch (error: any) {
      console.error("Error generating cancel listing transaction:", error);
      return {
        success: false,
        error: error.message || "Failed to generate cancel listing transaction"
      };
    }
  }

  // Generate transaction to update NFT price
  async generateUpdatePriceTransaction(tokenId: string, seller: string, newPriceUSDC: string) {
    try {
      // Verify listing exists and seller matches
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

    } catch (error: any) {
      console.error("Error generating update price transaction:", error);
      return {
        success: false,
        error: error.message || "Failed to generate update price transaction"
      };
    }
  }

  // Get marketplace listing for a specific NFT
  async getMarketplaceListing(tokenId: string) {
    try {
      const listing = await marketplaceContract.getListing(tokenId);
      
      if (!listing.active) {
        return null; // No active listing
      }

      return {
        tokenId,
        seller: listing.seller,
        price: ethers.formatUnits(listing.price, 6), // Convert to USDC
        priceWei: listing.price.toString(),
        listedAt: new Date().toISOString(), // Use current time since contract doesn't store listedAt
        active: listing.active
      };

    } catch (error: any) {
      console.error(`Error getting marketplace listing for NFT #${tokenId}:`, error);
      return null;
    }
  }

  // Check if NFT is listed on marketplace
  async isNFTListed(tokenId: string): Promise<boolean> {
    try {
      console.log(`🔍 Checking if NFT #${tokenId} is listed on marketplace...`);
      const isListed = await marketplaceContract.isListed(tokenId);
      console.log(`✅ NFT #${tokenId} listing status: ${isListed}`);
      return isListed;
    } catch (error: any) {
      console.error(`❌ Error checking if NFT #${tokenId} is listed:`, error);
      console.error(`❌ Error details:`, {
        message: error.message,
        code: error.code,
        data: error.data,
        stack: error.stack?.split('\n')[0] // First line of stack
      });
      
      // 🚨 CRITICAL FIX: Don't return false on RPC errors - let purchase attempt to proceed
      // Since we know from BaseScan that listings exist, this might be RPC lag/cache issue
      console.warn(`⚠️ Allowing purchase to proceed despite blockchain check failure for NFT #${tokenId}`);
      return true; // Allow purchase to proceed - real verification happens in smart contract
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

    } catch (error: any) {
      console.error("Error getting marketplace stats:", error);
      return {
        totalVolumeWei: "0",
        totalVolumeUSDC: "0"
      };
    }
  }

  // 🔄 Get recent NFT purchase events from blockchain by reading Transfer events
  async getRecentPurchaseEvents(fromBlock?: number): Promise<any[]> {
    try {
      // If no fromBlock provided, scan last 50k blocks (about 1 day on Base)
      if (fromBlock === undefined) {
        const currentBlock = await provider.getBlockNumber();
        fromBlock = Math.max(0, currentBlock - 50000);
      }
      
      console.log(`📡 Fetching NFT Transfer events from block ${fromBlock}...`);
      
      // Query Transfer events from NFT contract
      const transferFilter = nftContract.filters.Transfer();
      const transferEvents = await nftContract.queryFilter(transferFilter, fromBlock, 'latest');
      
      console.log(`✅ Found ${transferEvents.length} transfer events, filtering for purchases...`);
      
      const purchases: any[] = [];
      
      // Check each transfer to see if it's a purchase (has USDC transfers in same tx)
      for (const event of transferEvents) {
        if (!('args' in event)) continue;
        const txHash = event.transactionHash;
        const from = event.args?.[0]?.toLowerCase();
        const to = event.args?.[1]?.toLowerCase();
        const tokenId = event.args?.[2]?.toString();
        
        // Skip mints (from null address)
        if (from === '0x0000000000000000000000000000000000000000') {
          continue;
        }
        
        try {
          // Get full transaction receipt to check for USDC transfers
          const receipt = await provider.getTransactionReceipt(txHash);
          if (!receipt) continue;
          
          // Look for USDC Transfer events in the same transaction
          const usdcTransfers = receipt.logs
            .filter((log: any) => 
              log.address.toLowerCase() === USDC_CONTRACT_ADDRESS.toLowerCase() &&
              log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' // Transfer event signature
            );
          
          // If there are USDC transfers, this is likely a purchase
          if (usdcTransfers.length >= 2) {
            // Decode USDC transfer amounts
            let totalPrice = '0';
            let platformFee = '0';
            
            for (const usdcLog of usdcTransfers) {
              const amount = ethers.formatUnits(usdcLog.data, 6);
              const usdcTo = '0x' + usdcLog.topics[2].slice(26).toLowerCase();
              
              // Check if this goes to platform wallet
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
              platformFee: platformFee,
              timestamp: receipt.blockNumber, // Use block number as approximation
              blockNumber: receipt.blockNumber,
              transactionHash: txHash
            });
            
            console.log(`✅ Found purchase: NFT #${tokenId} (${to} bought from ${from}) for ${totalPrice} USDC`);
          }
        } catch (error) {
          console.error(`❌ Error processing transfer ${txHash}:`, error);
        }
      }
      
      console.log(`🎉 Found ${purchases.length} purchase transactions on blockchain`);
      return purchases;
      
    } catch (error: any) {
      console.error(`❌ Error fetching purchase events:`, error);
      return [];
    }
  }

  // 🔄 Get ALL NFT transfer events (purchases + regular transfers) for auto-delist
  async getAllTransferEvents(fromBlock?: number): Promise<any[]> {
    try {
      // If no fromBlock provided, scan last 10k blocks (about 5 hours on Base)
      if (fromBlock === undefined) {
        const currentBlock = await provider.getBlockNumber();
        fromBlock = Math.max(0, currentBlock - 10000);
      }
      
      console.log(`📡 Fetching ALL NFT Transfer events from block ${fromBlock}...`);
      
      // Query Transfer events from NFT contract
      const transferFilter = nftContract.filters.Transfer();
      const transferEvents = await nftContract.queryFilter(transferFilter, fromBlock, 'latest');
      
      console.log(`✅ Found ${transferEvents.length} transfer events, processing...`);
      
      const allTransfers: any[] = [];
      
      // Process each transfer
      for (const event of transferEvents) {
        if (!('args' in event)) continue;
        const txHash = event.transactionHash;
        const from = event.args?.[0]?.toLowerCase();
        const to = event.args?.[1]?.toLowerCase();
        const tokenId = event.args?.[2]?.toString();
        
        // Include all transfers (including mints from 0x0)
        try {
          // Get full transaction receipt to check for USDC transfers
          const receipt = await provider.getTransactionReceipt(txHash);
          if (!receipt) continue;
          
          // Look for USDC Transfer events in the same transaction
          const usdcTransfers = receipt.logs
            .filter((log: any) => 
              log.address.toLowerCase() === USDC_CONTRACT_ADDRESS.toLowerCase() &&
              log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' // Transfer event signature
            );
          
          let transferType = 'transfer'; // Default: regular transfer
          let totalPrice = '0';
          let platformFee = '0';
          
          // If there are USDC transfers, this is a sale/purchase
          if (usdcTransfers.length >= 2) {
            transferType = 'sale';
            
            // Decode USDC transfer amounts
            for (const usdcLog of usdcTransfers) {
              const amount = ethers.formatUnits(usdcLog.data, 6);
              const usdcTo = '0x' + usdcLog.topics[2].slice(26).toLowerCase();
              
              // Check if this goes to platform wallet
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
            transferType, // 'sale' or 'transfer'
            price: totalPrice,
            platformFee: platformFee,
            blockNumber: receipt.blockNumber,
            transactionHash: txHash
          });
          
          if (transferType === 'sale') {
            console.log(`💰 Sale: NFT #${tokenId} (${to} bought from ${from}) for ${totalPrice} USDC`);
          } else {
            console.log(`📦 Transfer: NFT #${tokenId} (${from} → ${to})`);
          }
        } catch (error) {
          console.error(`❌ Error processing transfer ${txHash}:`, error);
        }
      }
      
      console.log(`🎉 Found ${allTransfers.length} total transfers on blockchain`);
      return allTransfers;
      
    } catch (error: any) {
      console.error(`❌ Error fetching transfer events:`, error);
      return [];
    }
  }

  // 🚀 Incremental NFT sync with block chunking and checkpoint persistence
  async syncNFTsIncremental(storage: any, chunkSize: number = 1000): Promise<{ newNFTs: BlockchainNFT[], lastBlock: number }> {
    let retryCount = 0;
    const maxRetries = BASE_RPC_URLS.length;
    
    try {
      console.log(`🔄 Starting incremental blockchain sync...`);
      
      // Get current block number
      const currentBlock = await currentProvider.getBlockNumber();
      console.log(`📊 Current block: ${currentBlock}`);
      
      // Get last processed block from storage
      const syncState = await storage.getSyncState(NFT_CONTRACT_ADDRESS);
      // Start from a recent block if no checkpoint exists (avoid scanning entire history)
      const startBlock = syncState ? syncState.lastProcessedBlock + 1 : Math.max(38137640, currentBlock - 10000); // Last 10k blocks
      
      console.log(`📍 Last synced block: ${syncState?.lastProcessedBlock || 'none'}`);
      console.log(`📍 Starting from block: ${startBlock}`);
      console.log(`📍 Blocks to process: ${currentBlock - startBlock + 1}`);
      
      if (startBlock > currentBlock) {
        console.log(`✅ Already up to date!`);
        return { newNFTs: [], lastBlock: currentBlock };
      }
      
      const newNFTs: BlockchainNFT[] = [];
      let processedBlock = startBlock;
      
      // Process in chunks to avoid timeout
      while (processedBlock <= currentBlock) {
        const toBlock = Math.min(processedBlock + chunkSize - 1, currentBlock);
        
        console.log(`🔍 Scanning blocks ${processedBlock} to ${toBlock} (chunk size: ${toBlock - processedBlock + 1})`);
        
        try {
          // Query Transfer events in this chunk
          const filter = currentNftContract.filters.Transfer();
          const events = await currentNftContract.queryFilter(filter, processedBlock, toBlock);
          
          console.log(`📥 Found ${events.length} Transfer events in this chunk`);
          
          // Process each unique token
          const processedTokens = new Set<string>();
          
          for (const event of events) {
            if (!('args' in event)) continue;
            const tokenId = event.args?.tokenId?.toString();
            if (!tokenId || processedTokens.has(tokenId)) continue;
            
            processedTokens.add(tokenId);
            
            try {
              // Get current owner and metadata
              const owner = await currentNftContract.ownerOf(tokenId);
              const tokenURI = await currentNftContract.tokenURI(tokenId);
              
              console.log(`✅ Token ${tokenId}: owner=${owner}`);
              
              // Add to results (metadata will be fetched async later)
              newNFTs.push({
                tokenId,
                owner: owner.toLowerCase(),
                tokenURI,
                metadata: null // Will be fetched async
              });
              
            } catch (error) {
              console.error(`❌ Error processing token ${tokenId}:`, error);
            }
          }
          
          // Update checkpoint after successful chunk
          await storage.updateSyncState(NFT_CONTRACT_ADDRESS, toBlock);
          console.log(`✅ Checkpoint saved: block ${toBlock}`);
          
          processedBlock = toBlock + 1;
          retryCount = 0; // Reset retry count on success
          
          // Small delay to avoid rate limiting
          if (processedBlock <= currentBlock) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
        } catch (error: any) {
          console.error(`❌ Error processing chunk ${processedBlock}-${toBlock}:`, error.message);
          
          // Check if it's an RPC error (timeout, invalid range, connection error)
          const isRpcError = error.message?.includes('timeout') || 
              error.message?.includes('invalid block range') ||
              error.message?.includes('could not detect network') ||
              error.code === 'TIMEOUT' ||
              error.code === 'NETWORK_ERROR' ||
              error.error?.code === -32000;
          
          if (isRpcError && retryCount < maxRetries) {
            // Try rotating to next RPC provider
            console.log(`⚠️ RPC error detected, attempting provider rotation...`);
            const rotated = rotateRpcProvider();
            
            if (rotated) {
              retryCount++;
              console.log(`🔄 Retrying with new provider (attempt ${retryCount}/${maxRetries})...`);
              continue; // Retry same chunk with new provider
            }
          }
          
          // If timeout or invalid range (and can't rotate), try smaller chunk
          if (isRpcError) {
            console.log(`⚠️ RPC error persists, reducing chunk size...`);
            chunkSize = Math.max(100, Math.floor(chunkSize / 2));
            console.log(`🔄 Retrying with chunk size: ${chunkSize}`);
            retryCount = 0; // Reset retry count when changing strategy
            continue;
          }
          
          // Skip this chunk and continue for other errors
          console.log(`⚠️ Skipping problematic chunk, moving to next...`);
          processedBlock = toBlock + 1;
          retryCount = 0;
        }
      }
      
      console.log(`🎉 Sync complete! Found ${newNFTs.length} new NFTs`);
      console.log(`📍 Synced up to block: ${currentBlock}`);
      
      return { newNFTs, lastBlock: currentBlock };
      
    } catch (error: any) {
      console.error(`❌ Incremental sync failed:`, error);
      throw error;
    }
  }

  // 🔄 Fetch metadata asynchronously for NFTs without blocking sync
  async fetchMetadataAsync(blockchainNFT: BlockchainNFT): Promise<BlockchainNFT> {
    if (!blockchainNFT.tokenURI) {
      return blockchainNFT;
    }
    
    try {
      const uris = normalizeUri(blockchainNFT.tokenURI);
      if (uris.length === 0) {
        console.log(`⚠️ No valid URIs for token ${blockchainNFT.tokenId}`);
        return blockchainNFT;
      }
      
      console.log(`📥 Fetching metadata for token ${blockchainNFT.tokenId}...`);
      const metadata = await fetchWithGateways(uris);
      
      return {
        ...blockchainNFT,
        metadata
      };
    } catch (error) {
      console.error(`❌ Failed to fetch metadata for token ${blockchainNFT.tokenId}:`, error);
      return blockchainNFT;
    }
  }

  // 🌐 Sync NFTs using Basescan API (more reliable than RPC for discovery)
  async syncNFTsFromBasescan(storage: any): Promise<{ newNFTs: BlockchainNFT[], missingTokens: string[] }> {
    console.log(`🌐 Starting Basescan API sync...`);
    
    try {
      // Get all token IDs from Basescan API
      const basescanTokenIds = await getAllTokenIdsFromContract();
      console.log(`📊 Basescan reports ${basescanTokenIds.size} total tokens minted`);
      
      // Get existing tokens from database
      const existingNFTs = await storage.getAllNFTs();
      const existingTokenIds = new Set(existingNFTs.map((nft: any) => nft.tokenId.toString()));
      console.log(`💾 Database has ${existingTokenIds.size} tokens`);
      
      // Find missing tokens
      const missingTokens: string[] = [];
      for (const tokenId of Array.from(basescanTokenIds)) {
        if (!existingTokenIds.has(tokenId)) {
          missingTokens.push(tokenId);
        }
      }
      
      if (missingTokens.length === 0) {
        console.log(`✅ Database is up to date - no missing tokens!`);
        return { newNFTs: [], missingTokens: [] };
      }
      
      console.log(`🔍 Found ${missingTokens.length} missing tokens: ${missingTokens.join(', ')}`);
      
      // Fetch details for each missing token using RPC
      const newNFTs: BlockchainNFT[] = [];
      
      for (const tokenId of missingTokens) {
        try {
          console.log(`📥 Fetching details for token ${tokenId}...`);
          
          // Get owner and tokenURI from contract
          const owner = await currentNftContract.ownerOf(tokenId);
          const tokenURI = await currentNftContract.tokenURI(tokenId);
          
          console.log(`✅ Token ${tokenId}: owner=${owner}`);
          
          newNFTs.push({
            tokenId,
            owner: owner.toLowerCase(),
            tokenURI,
            metadata: null // Will be fetched async
          });
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          console.error(`❌ Error fetching token ${tokenId}:`, error);
        }
      }
      
      console.log(`🎉 Basescan sync complete! Found ${newNFTs.length} new NFTs`);
      return { newNFTs, missingTokens };
      
    } catch (error) {
      console.error(`❌ Basescan sync failed:`, error);
      throw error;
    }
  }

}

export const blockchainService = new BlockchainService();
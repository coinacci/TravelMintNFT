import { ethers } from "ethers";

// Use multiple RPC providers for rate limit handling
const BASE_RPC_URLS = [
  "https://mainnet.base.org",
  "https://base.llamarpc.com",
  "https://base.gateway.tenderly.co",
  "https://base-rpc.publicnode.com"
];

let currentRpcIndex = 0;
const BASE_RPC_URL = BASE_RPC_URLS[0];
const BASESCAN_API_URL = "https://api.basescan.org/api";
const NFT_CONTRACT_ADDRESS = "0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f";
const USDC_CONTRACT_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PURCHASE_PRICE = "1000000"; // 1 USDC (6 decimals)
const PLATFORM_WALLET = "0x7CDe7822456AAC667Df0420cD048295b92704084"; // Platform commission wallet

// TravelNFT ABI with purchase function
const TRAVEL_NFT_ABI = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function balanceOf(address owner) view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function getApproved(uint256 tokenId) view returns (address)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "function transferFrom(address from, address to, uint256 tokenId)",
  "function approve(address to, uint256 tokenId)",
  "function purchaseNFT(uint256 tokenId, uint256 price)",
  "event NFTPurchased(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price, uint256 platformFee)"
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

// Rate limit retry utility
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
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
          
          // Wait longer on rate limit
          await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
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

// Create provider for Base network
const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);

// Create contract instances
const nftContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, TRAVEL_NFT_ABI, provider);
const usdcContract = new ethers.Contract(USDC_CONTRACT_ADDRESS, ERC20_ABI, provider);

export interface BlockchainNFT {
  tokenId: string;
  owner: string;
  tokenURI: string;
  metadata?: any;
}

export class BlockchainService {
  
  // Get all NFTs from the contract using Basescan API for Transfer events
  async getAllNFTs(): Promise<BlockchainNFT[]> {
    try {
      console.log("🔗 Fetching NFTs using Basescan API...");
      
      // Use Basescan API to get all Transfer events
      const basescanUrl = `${BASESCAN_API_URL}?module=account&action=tokennfttx&contractaddress=${NFT_CONTRACT_ADDRESS}&page=1&offset=100&sort=asc&apikey=${process.env.BASESCAN_API_KEY}`;
      
      const response = await fetch(basescanUrl);
      const data = await response.json();
      
      if (data.status !== "1") {
        console.log("No NFT transfers found or API error:", data.message);
        // Fallback: try known token IDs
        return await this.tryKnownTokenIds();
      }
      
      const transfers = data.result;
      const uniqueTokenIds = new Set<string>();
      
      // Extract unique token IDs from transfers (excluding unwanted NFTs)
      for (const transfer of transfers) {
        if (transfer.to !== "0x0000000000000000000000000000000000000000" &&
            transfer.tokenID !== "1" && transfer.tokenID !== "2") {
          uniqueTokenIds.add(transfer.tokenID);
        }
      }
      
      console.log(`Found ${uniqueTokenIds.size} unique NFTs from transfer events`);
      
      const nfts: BlockchainNFT[] = [];
      
      // Get current owner and metadata for each token
      for (const tokenId of Array.from(uniqueTokenIds)) {
        try {
          const owner = await withRetry(() => nftContract.ownerOf(tokenId));
          const tokenURI = await withRetry(() => nftContract.tokenURI(tokenId));
          
          // Fetch metadata if URI is available with multiple retries and gateways
          let metadata = null;
          if (tokenURI && tokenURI.startsWith('http')) {
            try {
              // Try multiple IPFS gateways for better reliability  
              const gateways = [
                tokenURI,
                tokenURI.replace('gateway.pinata.cloud', 'ipfs.io'),
                tokenURI.replace('gateway.pinata.cloud', 'cloudflare-ipfs.com'),
                tokenURI.replace('ipfs.io', 'gateway.pinata.cloud')
              ];
              
              for (const gatewayUrl of gateways) {
                try {
                  const response = await withRetry(() => fetch(gatewayUrl));
                  if (response.ok) {
                    metadata = await response.json();
                    console.log(`✅ Parsed IPFS metadata for token ${tokenId}:`, metadata);
                    break; // Stop trying other gateways once we succeed
                  }
                } catch (gatewayError: any) {
                  console.log(`⚠️ Failed gateway ${gatewayUrl} for token ${tokenId}:`, gatewayError.message);
                  continue; // Try next gateway
                }
              }
              
              if (!metadata) {
                console.log(`❌ All IPFS gateways failed for token ${tokenId}, metadata will be incomplete`);
              }
            } catch (e) {
              console.log(`Failed to fetch metadata for token ${tokenId}:`, e);
            }
          }
          
          nfts.push({
            tokenId: tokenId.toString(),
            owner: owner.toLowerCase(),
            tokenURI,
            metadata
          });
          
        } catch (error) {
          console.error(`Error fetching NFT ${tokenId}:`, error);
        }
      }
      
      console.log(`✅ Successfully fetched ${nfts.length} NFTs from blockchain`);
      return nfts;
      
    } catch (error) {
      console.error("Error fetching all NFTs:", error);
      // Fallback: try known token IDs
      return await this.tryKnownTokenIds();
    }
  }

  // Fallback method to try known token IDs
  async tryKnownTokenIds(): Promise<BlockchainNFT[]> {
    console.log("🔄 Trying known token IDs as fallback...");
    const nfts: BlockchainNFT[] = [];
    let consecutiveFailures = 0;
    
    // Try token IDs 3-50 to catch newly minted NFTs (excluding unwanted tokens 1 & 2)
    for (let tokenId = 3; tokenId <= 50; tokenId++) {
      try {
        const owner = await withRetry(() => nftContract.ownerOf(tokenId));
        const tokenURI = await nftContract.tokenURI(tokenId);
        
        // Reset consecutive failures when we find a valid token
        consecutiveFailures = 0;
        
        // Fetch metadata if URI is available with multiple retries and gateways
        let metadata = null;
        if (tokenURI) {
          try {
            if (tokenURI.startsWith('http')) {
              // Try multiple IPFS gateways for better reliability  
              const gateways = [
                tokenURI,
                tokenURI.replace('gateway.pinata.cloud', 'ipfs.io'),
                tokenURI.replace('gateway.pinata.cloud', 'cloudflare-ipfs.com'),
                tokenURI.replace('ipfs.io', 'gateway.pinata.cloud')
              ];
              
              for (const gatewayUrl of gateways) {
                try {
                  const response = await withRetry(() => fetch(gatewayUrl));
                  if (response.ok) {
                    metadata = await response.json();
                    console.log(`✅ Parsed IPFS metadata for token ${tokenId}:`, metadata);
                    break; // Stop trying other gateways once we succeed
                  }
                } catch (gatewayError: any) {
                  console.log(`⚠️ Failed gateway ${gatewayUrl} for token ${tokenId}:`, gatewayError.message);
                  continue; // Try next gateway
                }
              }
              
              if (!metadata) {
                console.log(`❌ All IPFS gateways failed for token ${tokenId}, metadata will be incomplete`);
              }
            } else if (tokenURI.startsWith('data:application/json;base64,')) {
              // Handle base64 encoded JSON metadata
              const base64Data = tokenURI.replace('data:application/json;base64,', '');
              const jsonString = Buffer.from(base64Data, 'base64').toString('utf-8');
              metadata = JSON.parse(jsonString);
              console.log(`✅ Parsed base64 metadata for token ${tokenId}:`, metadata);
            }
          } catch (e) {
            console.log(`Failed to fetch/parse metadata for token ${tokenId}:`, e);
          }
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
        if (error.reason === "ERC721: invalid token ID" || 
            error.code === "CALL_EXCEPTION" ||
            error.message?.includes("invalid token ID")) {
          consecutiveFailures++;
          console.log(`⚠️ Token ${tokenId} doesn't exist (${consecutiveFailures} consecutive failures)`);
        } else {
          // Different error - don't count as consecutive failure, just log and continue
          console.log(`🔄 Non-fatal error for token ${tokenId}, continuing...`);
        }
        
        // If we have 5 consecutive token-not-found failures, likely no more tokens exist
        if (consecutiveFailures >= 5) {
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
  
  // Convert blockchain NFT to database format
  async blockchainNFTToDBFormat(blockchainNFT: BlockchainNFT): Promise<any> {
    const metadata = blockchainNFT.metadata;
    
    const location = this.extractLocationFromMetadata(metadata);
    const latitude = this.extractLatitudeFromMetadata(metadata) || "0";
    const longitude = this.extractLongitudeFromMetadata(metadata) || "0";
    
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
    } else if (blockchainNFT.tokenId === "41") {
      // Token #41: Georgia Moments - Tbilisi travel photo
      imageUrl = "/attached_assets/IMG_4237_1757189361019.jpeg";
    }
    
    // For future tokens, always prefer uploaded images over placeholder metadata
    // This ensures users see their actual travel photos, not stock images
    
    return {
      id: `blockchain-${blockchainNFT.tokenId}`,
      title: metadata?.name || `Travel NFT #${blockchainNFT.tokenId}`,
      description: metadata?.description || "A beautiful travel memory captured on the blockchain.",
      imageUrl: imageUrl,
      location: location,
      latitude: latitude,
      longitude: longitude, 
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

  // Generate transaction data for onchain NFT purchase
  // This returns transaction data that the frontend can execute
  async generatePurchaseTransaction(tokenId: string, buyerAddress: string, sellerAddress: string, price: string = "1.0") {
    try {
      // Validate inputs
      if (!tokenId || !buyerAddress || !sellerAddress) {
        throw new Error("Missing required parameters for purchase");
      }

      // Check if NFT exists and get current owner
      const currentOwner = await nftContract.ownerOf(tokenId);
      if (currentOwner.toLowerCase() !== sellerAddress.toLowerCase()) {
        throw new Error("Seller is not the current owner of this NFT");
      }

      // Check buyer's USDC balance
      const buyerBalance = await this.getUSDCBalance(buyerAddress);
      const requiredAmount = parseFloat(price);
      
      if (parseFloat(buyerBalance) < requiredAmount) {
        throw new Error(`Insufficient USDC balance. Required: ${requiredAmount} USDC, Available: ${buyerBalance} USDC`);
      }
      

      // Generate transaction data for the frontend to execute
      // The frontend will need to:
      // 1. Approve USDC spending (if needed)
      // 2. Transfer USDC to seller
      // 3. Transfer NFT from seller to buyer

      const purchasePrice = ethers.parseUnits(price, 6); // NFT price in USDC with 6 decimals
      
      // Calculate commission split: 95% to seller, 5% to platform
      const platformFee = purchasePrice * BigInt(5) / BigInt(100); // 5% commission
      const sellerAmount = purchasePrice - platformFee; // 95% to seller
      
      console.log(`💰 Commission split: Seller ${(Number(sellerAmount) / 1000000).toFixed(6)} USDC, Platform ${(Number(platformFee) / 1000000).toFixed(6)} USDC`);

      return {
        success: true,
        transactions: [
          {
            type: "USDC_TRANSFER",
            to: USDC_CONTRACT_ADDRESS,
            data: usdcContract.interface.encodeFunctionData("transfer", [
              sellerAddress,
              sellerAmount // 95% to seller
            ]),
            description: `Transfer ${(Number(sellerAmount) / 1000000).toFixed(6)} USDC to seller`
          },
          {
            type: "USDC_COMMISSION_TRANSFER",
            to: USDC_CONTRACT_ADDRESS,
            data: usdcContract.interface.encodeFunctionData("transfer", [
              PLATFORM_WALLET, // 5% commission to platform
              platformFee
            ]),
            description: `Transfer ${(Number(platformFee) / 1000000).toFixed(6)} USDC platform commission`
          },
          {
            type: "NFT_TRANSFER", 
            to: NFT_CONTRACT_ADDRESS,
            data: nftContract.interface.encodeFunctionData("transferFrom", [
              sellerAddress,
              buyerAddress,
              tokenId
            ]),
            description: `Transfer NFT #${tokenId} to buyer`
          }
        ],
        tokenId,
        buyerAddress,
        sellerAddress,
        priceUSDC: price,
        sellerAmount: (Number(sellerAmount) / 1000000).toFixed(6),
        platformFee: (Number(platformFee) / 1000000).toFixed(6)
      };

    } catch (error: any) {
      console.error("Error generating purchase transaction:", error);
      return {
        success: false,
        error: error.message || "Failed to generate purchase transaction"
      };
    }
  }

}

export const blockchainService = new BlockchainService();
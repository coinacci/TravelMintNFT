import { ethers } from "ethers";

const BASE_RPC_URL = "https://mainnet.base.org";
const BASESCAN_API_URL = "https://api.basescan.org/api";
const NFT_CONTRACT_ADDRESS = "0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f";

// ERC721 ABI for reading NFT data (without Enumerable extension)
const ERC721_ABI = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function balanceOf(address owner) view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function getApproved(uint256 tokenId) view returns (address)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)"
];

// Create provider for Base network
const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);

// Create contract instance
const nftContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, ERC721_ABI, provider);

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
      
      // Extract unique token IDs from transfers
      for (const transfer of transfers) {
        if (transfer.to !== "0x0000000000000000000000000000000000000000") {
          uniqueTokenIds.add(transfer.tokenID);
        }
      }
      
      console.log(`Found ${uniqueTokenIds.size} unique NFTs from transfer events`);
      
      const nfts: BlockchainNFT[] = [];
      
      // Get current owner and metadata for each token
      for (const tokenId of Array.from(uniqueTokenIds)) {
        try {
          const owner = await nftContract.ownerOf(tokenId);
          const tokenURI = await nftContract.tokenURI(tokenId);
          
          // Fetch metadata if URI is available
          let metadata = null;
          if (tokenURI && tokenURI.startsWith('http')) {
            try {
              const metadataResponse = await fetch(tokenURI);
              if (metadataResponse.ok) {
                metadata = await metadataResponse.json();
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
    
    // Try token IDs 1-10 (common range for new contracts)
    for (let tokenId = 1; tokenId <= 10; tokenId++) {
      try {
        const owner = await nftContract.ownerOf(tokenId);
        const tokenURI = await nftContract.tokenURI(tokenId);
        
        // Fetch metadata if URI is available
        let metadata = null;
        if (tokenURI) {
          try {
            if (tokenURI.startsWith('http')) {
              const response = await fetch(tokenURI);
              if (response.ok) {
                metadata = await response.json();
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
        // Token doesn't exist, continue to next
        if (error.reason === "ERC721: invalid token ID" || error.code === "CALL_EXCEPTION") {
          break; // Stop trying higher token IDs
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
  blockchainNFTToDBFormat(blockchainNFT: BlockchainNFT): any {
    const metadata = blockchainNFT.metadata;
    
    const location = this.extractLocationFromMetadata(metadata);
    const latitude = this.extractLatitudeFromMetadata(metadata) || "0";
    const longitude = this.extractLongitudeFromMetadata(metadata) || "0";
    
    // Always use the uploaded travel image for Token #1 - ignore metadata image completely
    let imageUrl = "/attached_assets/IMG_4085_1756446465520.jpeg";
    if (blockchainNFT.tokenId !== "1") {
      // For other tokens, use metadata image as fallback
      imageUrl = metadata?.image || blockchainNFT.tokenURI;
    }
    
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
}

export const blockchainService = new BlockchainService();
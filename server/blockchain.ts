import { ethers } from "ethers";

const BASE_RPC_URL = "https://mainnet.base.org";
const BASESCAN_API_URL = "https://api.basescan.org/api";
const NFT_CONTRACT_ADDRESS = "0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f";

// ERC721 ABI for reading NFT data
const ERC721_ABI = [
  "function totalSupply() view returns (uint256)",
  "function tokenByIndex(uint256 index) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)"
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
  
  // Get all NFTs from the contract
  async getAllNFTs(): Promise<BlockchainNFT[]> {
    try {
      console.log("Fetching total supply from contract...");
      const totalSupply = await nftContract.totalSupply();
      const totalSupplyNumber = Number(totalSupply);
      
      console.log(`Total NFTs in contract: ${totalSupplyNumber}`);
      
      const nfts: BlockchainNFT[] = [];
      
      // Get each NFT by index
      for (let i = 0; i < totalSupplyNumber; i++) {
        try {
          const tokenId = await nftContract.tokenByIndex(i);
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
          
          nfts.push({
            tokenId: tokenId.toString(),
            owner: owner.toLowerCase(),
            tokenURI,
            metadata
          });
          
        } catch (error) {
          console.error(`Error fetching NFT at index ${i}:`, error);
        }
      }
      
      console.log(`Successfully fetched ${nfts.length} NFTs from blockchain`);
      return nfts;
      
    } catch (error) {
      console.error("Error fetching all NFTs:", error);
      return [];
    }
  }
  
  // Get NFTs owned by a specific address
  async getNFTsByOwner(ownerAddress: string): Promise<BlockchainNFT[]> {
    try {
      ownerAddress = ownerAddress.toLowerCase();
      console.log(`Fetching NFTs for owner: ${ownerAddress}`);
      
      const balance = await nftContract.balanceOf(ownerAddress);
      const balanceNumber = Number(balance);
      
      console.log(`Owner has ${balanceNumber} NFTs`);
      
      if (balanceNumber === 0) {
        return [];
      }
      
      const nfts: BlockchainNFT[] = [];
      
      // Get each NFT owned by this address
      for (let i = 0; i < balanceNumber; i++) {
        try {
          const tokenId = await nftContract.tokenOfOwnerByIndex(ownerAddress, i);
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
          
          nfts.push({
            tokenId: tokenId.toString(),
            owner: ownerAddress,
            tokenURI,
            metadata
          });
          
        } catch (error) {
          console.error(`Error fetching NFT at index ${i} for owner ${ownerAddress}:`, error);
        }
      }
      
      console.log(`Successfully fetched ${nfts.length} NFTs for owner ${ownerAddress}`);
      return nfts;
      
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
    
    return {
      id: `blockchain-${blockchainNFT.tokenId}`,
      title: metadata?.name || `Travel NFT #${blockchainNFT.tokenId}`,
      description: metadata?.description || "A beautiful travel memory captured on the blockchain.",
      imageUrl: metadata?.image || blockchainNFT.tokenURI,
      location: this.extractLocationFromMetadata(metadata),
      latitude: this.extractLatitudeFromMetadata(metadata) || "0",
      longitude: this.extractLongitudeFromMetadata(metadata) || "0", 
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
    
    return latAttr?.value || null;
  }
  
  private extractLongitudeFromMetadata(metadata: any): string | null {
    if (!metadata || !metadata.attributes) return null;
    
    const lngAttr = metadata.attributes.find((attr: any) => 
      attr.trait_type?.toLowerCase().includes('longitude') ||
      attr.trait_type?.toLowerCase().includes('lng') ||
      attr.trait_type?.toLowerCase().includes('lon')
    );
    
    return lngAttr?.value || null;
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
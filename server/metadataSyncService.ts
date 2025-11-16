import { ethers } from 'ethers';
import type { IStorage } from './storage';

const CONTRACT_ADDRESS = '0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f';
const RPC_PROVIDERS = [
  'https://mainnet.base.org',
  'https://base.llamarpc.com',
  'https://base.drpc.org'
];

const ABI = [
  'function tokenURI(uint256 tokenId) view returns (string)'
];

interface TokenMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
  location?: {
    city: string;
    latitude: string;
    longitude: string;
  };
}

export class MetadataSyncService {
  private storage: IStorage;
  private currentProviderIndex = 0;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  async getProvider(): Promise<ethers.JsonRpcProvider> {
    const rpcUrl = RPC_PROVIDERS[this.currentProviderIndex];
    this.currentProviderIndex = (this.currentProviderIndex + 1) % RPC_PROVIDERS.length;
    return new ethers.JsonRpcProvider(rpcUrl);
  }

  async fetchTokenMetadata(tokenId: string): Promise<TokenMetadata | null> {
    for (const rpcUrl of RPC_PROVIDERS) {
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
        
        const uri = await contract.tokenURI(tokenId);
        
        if (uri.startsWith('data:application/json;base64,')) {
          const base64Data = uri.replace('data:application/json;base64,', '');
          const decoded = Buffer.from(base64Data, 'base64').toString('utf-8');
          const metadata = JSON.parse(decoded);
          return metadata;
        }
        
        return null;
      } catch (error: any) {
        console.log(`⚠️ RPC ${rpcUrl} failed for token ${tokenId}: ${error.message}`);
        continue;
      }
    }
    
    console.log(`❌ All RPC providers failed for token ${tokenId}`);
    return null;
  }

  extractLocationData(metadata: TokenMetadata): {
    location: string;
    latitude: string | null;
    longitude: string | null;
  } {
    let location = 'Unknown Location';
    let latitude: string | null = null;
    let longitude: string | null = null;

    if (metadata.location) {
      location = metadata.location.city || 'Unknown Location';
      latitude = metadata.location.latitude || null;
      longitude = metadata.location.longitude || null;
    } else if (metadata.attributes) {
      const locationAttr = metadata.attributes.find(a => a.trait_type === 'Location');
      const latAttr = metadata.attributes.find(a => a.trait_type === 'Latitude');
      const lngAttr = metadata.attributes.find(a => a.trait_type === 'Longitude');
      
      if (locationAttr) location = locationAttr.value;
      if (latAttr) latitude = latAttr.value;
      if (lngAttr) longitude = lngAttr.value;
    }

    return { location, latitude, longitude };
  }

  async findTokensNeedingMetadataSync(): Promise<string[]> {
    const allNFTs = await this.storage.getAllNFTs();
    const needsSync: string[] = [];

    for (const nft of allNFTs) {
      const needsUpdate = 
        !nft.latitude || 
        !nft.longitude || 
        nft.location === 'Unknown Location' ||
        (nft.imageUrl && nft.imageUrl.startsWith('data:application/json;base64,'));
      
      if (needsUpdate && nft.tokenId) {
        needsSync.push(nft.tokenId);
      }
    }

    return needsSync;
  }

  async syncTokenMetadata(tokenId: string): Promise<boolean> {
    try {
      console.log(`🔄 Syncing metadata for token ${tokenId}...`);
      
      const metadata = await this.fetchTokenMetadata(tokenId);
      if (!metadata) {
        console.log(`❌ Failed to fetch metadata for token ${tokenId}`);
        return false;
      }

      const { location, latitude, longitude } = this.extractLocationData(metadata);
      const imageUrl = metadata.image;

      const allNFTs = await this.storage.getAllNFTs();
      const nft = allNFTs.find(n => n.tokenId === tokenId);
      
      if (!nft) {
        console.log(`❌ Token ${tokenId} not found in database`);
        return false;
      }

      await this.storage.updateNFT(nft.id, {
        title: metadata.name,
        imageUrl: imageUrl,
        location: location,
        latitude: latitude,
        longitude: longitude,
      });

      console.log(`✅ Synced token ${tokenId}: ${metadata.name} @ ${location}`);
      return true;
    } catch (error: any) {
      console.log(`❌ Error syncing token ${tokenId}:`, error.message);
      return false;
    }
  }

  async runMetadataSync(): Promise<void> {
    try {
      console.log('🔍 Checking for tokens needing metadata sync...');
      
      const tokensToSync = await this.findTokensNeedingMetadataSync();
      
      if (tokensToSync.length === 0) {
        console.log('✅ All tokens have valid metadata');
        return;
      }

      console.log(`📋 Found ${tokensToSync.length} tokens needing metadata sync: ${tokensToSync.join(', ')}`);
      
      let successCount = 0;
      let failCount = 0;

      for (const tokenId of tokensToSync) {
        const success = await this.syncTokenMetadata(tokenId);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`✅ Metadata sync complete: ${successCount} succeeded, ${failCount} failed`);
    } catch (error: any) {
      console.log('❌ Metadata sync error:', error.message);
    }
  }
}

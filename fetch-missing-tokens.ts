import { getNftContract } from './server/blockchain.js';
import { storage } from './server/storage.js';
import { nanoid } from 'nanoid';

async function fetchMissingTokens() {
  console.log('🔍 Checking for missing tokens 275-280...\n');
  
  const contract = await getNftContract();
  const missing = [];
  
  // Test each token
  for (let tokenId = 275; tokenId <= 280; tokenId++) {
    try {
      const owner = await contract.ownerOf(tokenId);
      console.log(`✅ Token #${tokenId} exists, owner: ${owner.substring(0, 10)}...`);
      missing.push(tokenId);
    } catch (e) {
      console.log(`❌ Token #${tokenId} does NOT exist`);
    }
  }
  
  if (missing.length === 0) {
    console.log('\n✅ No missing tokens found!');
    process.exit(0);
  }
  
  console.log(`\n📦 Found ${missing.length} missing tokens: ${missing.join(', ')}`);
  console.log('\n🔄 Fetching metadata and adding to database...\n');
  
  for (const tokenId of missing) {
    try {
      console.log(`📡 Processing token #${tokenId}...`);
      
      const tokenURI = await contract.tokenURI(tokenId);
      const owner = await contract.ownerOf(tokenId);
      
      // Parse metadata
      let metadata: any = {};
      let imageUrl = '';
      let location = '';
      let latitude: number | null = null;
      let longitude: number | null = null;
      let description = '';
      
      if (tokenURI.startsWith('data:application/json;base64,')) {
        const base64Data = tokenURI.replace('data:application/json;base64,', '');
        const jsonString = Buffer.from(base64Data, 'base64').toString('utf-8');
        metadata = JSON.parse(jsonString);
        
        imageUrl = metadata.image || '';
        description = metadata.description || '';
        
        if (metadata.attributes && Array.isArray(metadata.attributes)) {
          for (const attr of metadata.attributes) {
            if (attr.trait_type === 'Location') location = attr.value || '';
            if (attr.trait_type === 'Latitude') latitude = parseFloat(attr.value);
            if (attr.trait_type === 'Longitude') longitude = parseFloat(attr.value);
          }
        }
      }
      
      // Add to database
      const newNFT = {
        id: nanoid(),
        title: metadata.name || `TravelNFT #${tokenId}`,
        description: description,
        imageUrl: imageUrl,
        objectStorageUrl: null,
        location: location || 'Unknown Location',
        latitude: latitude ? latitude.toString() : null,
        longitude: longitude ? longitude.toString() : null,
        category: 'travel',
        price: '0',
        isForSale: 0,
        creatorAddress: owner.toLowerCase(),
        ownerAddress: owner.toLowerCase(),
        farcasterCreatorUsername: null,
        farcasterOwnerUsername: null,
        farcasterCreatorFid: null,
        farcasterOwnerFid: null,
        mintPrice: '1',
        royaltyPercentage: '5',
        tokenId: tokenId.toString(),
        contractAddress: '0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f',
        transactionHash: null,
        metadata: metadata
      };
      
      await storage.createNFT(newNFT);
      console.log(`✅ Token #${tokenId} added: ${metadata.name} (${location})\n`);
      
    } catch (error: any) {
      console.error(`❌ Failed to process token #${tokenId}:`, error.message);
    }
  }
  
  // Verify final count
  const allNFTs = await storage.getAllNFTs();
  console.log(`\n🎉 Final database count: ${allNFTs.length} NFTs`);
  
  process.exit(0);
}

fetchMissingTokens();

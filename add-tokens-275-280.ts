import { storage } from './server/storage.js';
import { getNftContract } from './server/blockchain.js';
import { nanoid } from 'nanoid';

// Token data from Basescan
const tokensToAdd = [
  { id: 275, txHash: '0x98cd6afd0f115c35a9ff07205eeb5224ae16b02de84e7c907158573fe722795c', owner: '0xF71Fa5918Db043048B25ccaf1603fDDA7C84080b' },
  { id: 276, txHash: '0x0e98c93d38c7847072c00353f8c29d1a06e7de5634e4dd76b6df85c89b7a7464', owner: '0x5F6F7612a682f0423Fd13CA66919c84A5C1cB952' },
  { id: 277, txHash: '0xeb76d5680f52a5c0464401cb08b7f5cf3f1d28ee0487c8a908ac49dc38dabf45', owner: '0x1ce2af6f886b353c21cce43e3b02a93e13e0f740' },
  { id: 278, txHash: '0x94614d3e1bc82608f2d4d28348ce3a35a3e7834377f6167ebdc6ebfc10b937f2', owner: '0x6F88C00e62BD868630E4536D7D829A614443951E' },
  { id: 279, txHash: '0x9b34e4c9c600c9a860ebb9253fbef9667341c6b87978826ecde4ccd7d14c30e3', owner: '0x88B8E5606A99dcE34753B2f4668E51fc05E62A28' },
  { id: 280, txHash: '0x3090c1df636399d47a0e27300a5f2032eb512ee8074712c260ab785028d461ec', owner: '0x6edd22E9792132614dd487ac6434dec3709b79A8' }
];

async function addMissingTokens() {
  const contract = await getNftContract();
  
  console.log(`🔄 Adding ${tokensToAdd.length} missing tokens...\n`);
  
  for (const tokenInfo of tokensToAdd) {
    try {
      console.log(`📡 Processing token #${tokenInfo.id}...`);
      
      // Check if already exists
      const existing = await storage.getNFTByTokenId(tokenInfo.id.toString());
      if (existing) {
        console.log(`  ⚠️ Token #${tokenInfo.id} already exists - skipping\n`);
        continue;
      }
      
      // Fetch metadata
      const tokenURI = await contract.tokenURI(tokenInfo.id);
      
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
      
      const newNFT = {
        id: nanoid(),
        title: metadata.name || `TravelNFT #${tokenInfo.id}`,
        description: description,
        imageUrl: imageUrl,
        objectStorageUrl: null,
        location: location || 'Unknown Location',
        latitude: latitude ? latitude.toString() : null,
        longitude: longitude ? longitude.toString() : null,
        category: 'travel',
        price: '0',
        isForSale: 0,
        creatorAddress: tokenInfo.owner.toLowerCase(),
        ownerAddress: tokenInfo.owner.toLowerCase(),
        farcasterCreatorUsername: null,
        farcasterOwnerUsername: null,
        farcasterCreatorFid: null,
        farcasterOwnerFid: null,
        mintPrice: '1',
        royaltyPercentage: '5',
        tokenId: tokenInfo.id.toString(),
        contractAddress: '0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f',
        transactionHash: tokenInfo.txHash,
        metadata: metadata
      };
      
      await storage.createNFT(newNFT);
      console.log(`  ✅ Added: ${metadata.name} (${location})\n`);
      
    } catch (error: any) {
      console.error(`  ❌ Failed to add token #${tokenInfo.id}:`, error.message, '\n');
    }
  }
  
  const final = await storage.getAllNFTs();
  console.log(`\n🎉 Final count: ${final.length} NFTs in database`);
  
  process.exit(0);
}

addMissingTokens();

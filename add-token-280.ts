import { getProvider, getNftContract } from './server/blockchain.js';
import { db } from './server/db.js';
import { nfts } from './shared/schema.js';
import { nanoid } from 'nanoid';

async function addToken280() {
  console.log('🔍 Fetching Token 280 from blockchain...');
  
  try {
    const nftContract = await getNftContract();
    const tokenURI = await nftContract.tokenURI(280);
    
    console.log(`✅ Token URI fetched (length: ${tokenURI.length})`);
    
    // Parse base64 encoded metadata
    if (!tokenURI.startsWith('data:application/json;base64,')) {
      throw new Error('Invalid tokenURI format');
    }
    
    const base64Data = tokenURI.replace('data:application/json;base64,', '');
    const jsonString = Buffer.from(base64Data, 'base64').toString('utf-8');
    const metadata = JSON.parse(jsonString);
    
    console.log('\n📦 Token 280 Metadata:', JSON.stringify(metadata, null, 2));
    
    // Extract data from metadata
    const name = metadata.name || 'TravelNFT #280';
    const description = metadata.description || '';
    const image = metadata.image || '';
    
    // Extract location attributes
    let location = '';
    let latitude: number | null = null;
    let longitude: number | null = null;
    
    if (metadata.attributes && Array.isArray(metadata.attributes)) {
      for (const attr of metadata.attributes) {
        if (attr.trait_type === 'Location') location = attr.value || '';
        if (attr.trait_type === 'Latitude') latitude = parseFloat(attr.value);
        if (attr.trait_type === 'Longitude') longitude = parseFloat(attr.value);
      }
    }
    
    console.log(`\n🌍 Location: ${location}`);
    console.log(`📍 Coordinates: ${latitude}, ${longitude}`);
    console.log(`🖼️ Image: ${image.substring(0, 80)}...`);
    
    // Insert into database
    const newNFT = {
      id: nanoid(),
      tokenId: 280,
      title: name,
      description: description,
      imageUrl: image,
      location: location,
      latitude: latitude,
      longitude: longitude,
      owner: '0x000', // Will be updated by ownership sync
      price: null,
      forSale: false,
      metadata: metadata
    };
    
    await db.insert(nfts).values(newNFT);
    console.log('\n✅ Token 280 added to database successfully!');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  }
  
  process.exit(0);
}

addToken280();

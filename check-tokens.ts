import { db } from './server/db.js';
import { nfts } from './shared/schema.js';
import { sql } from 'drizzle-orm';

async function checkTokens() {
  console.log('🔍 Checking database tokens...\n');
  
  // Get all token IDs
  const allNFTs = await db.select({ tokenId: nfts.tokenId }).from(nfts).orderBy(nfts.tokenId);
  
  console.log(`📊 Total NFTs in database: ${allNFTs.length}`);
  console.log(`🔢 Token ID range: ${allNFTs[0].tokenId} - ${allNFTs[allNFTs.length - 1].tokenId}`);
  
  // Find missing token IDs
  const tokenIds = allNFTs.map(nft => nft.tokenId);
  const missing = [];
  const maxId = Math.max(...tokenIds);
  
  for (let i = 1; i <= maxId; i++) {
    if (!tokenIds.includes(i)) {
      missing.push(i);
    }
  }
  
  if (missing.length > 0) {
    console.log(`\n❌ Missing token IDs: ${missing.join(', ')}`);
  } else {
    console.log('\n✅ No missing tokens (sequential from 1)');
  }
  
  // Show last 10 tokens
  console.log('\n📋 Last 10 tokens:');
  const lastTen = allNFTs.slice(-10);
  lastTen.forEach(nft => {
    console.log(`  Token #${nft.tokenId}`);
  });
  
  process.exit(0);
}

checkTokens();

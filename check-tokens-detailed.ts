import { db } from './server/db.js';
import { nfts } from './shared/schema.js';
import { desc } from 'drizzle-orm';

async function checkDetailedTokens() {
  const allNFTs = await db
    .select({ tokenId: nfts.tokenId, title: nfts.title, location: nfts.location })
    .from(nfts)
    .orderBy(desc(nfts.tokenId))
    .limit(20);
  
  console.log('🔝 Top 20 highest token IDs:\n');
  allNFTs.forEach((nft, i) => {
    console.log(`${i + 1}. Token #${nft.tokenId} - ${nft.title} (${nft.location})`);
  });
  
  // Get count by token ID ranges
  const allTokens = await db.select({ tokenId: nfts.tokenId }).from(nfts);
  const tokenIds = allTokens.map(t => t.tokenId).sort((a, b) => a - b);
  
  console.log(`\n📊 Statistics:`);
  console.log(`Total: ${tokenIds.length}`);
  console.log(`Min: ${Math.min(...tokenIds)}`);
  console.log(`Max: ${Math.max(...tokenIds)}`);
  console.log(`\nFirst 20: ${tokenIds.slice(0, 20).join(', ')}`);
  console.log(`Last 20: ${tokenIds.slice(-20).join(', ')}`);
  
  process.exit(0);
}

checkDetailedTokens();

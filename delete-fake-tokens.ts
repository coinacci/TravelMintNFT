import { db } from './server/db.js';
import { nfts } from './shared/schema.js';
import { inArray } from 'drizzle-orm';

async function deleteFakeTokens() {
  console.log('🗑️ Deleting fake tokens (275-279)...\n');
  
  const fakeTokenIds = ['275', '276', '277', '278', '279'];
  
  // Delete fake tokens
  const result = await db
    .delete(nfts)
    .where(inArray(nfts.tokenId, fakeTokenIds));
  
  console.log(`✅ Deleted fake tokens\n`);
  
  // Verify remaining count
  const remaining = await db.select().from(nfts);
  console.log(`📊 Total NFTs in database: ${remaining.length}`);
  
  // Find highest token ID
  const tokenIds = remaining
    .map(n => parseInt(n.tokenId || '0'))
    .filter(n => !isNaN(n))
    .sort((a, b) => a - b);
  
  console.log(`🔢 Highest token ID: ${Math.max(...tokenIds)}`);
  console.log(`🔢 Lowest token ID: ${Math.min(...tokenIds)}`);
  
  process.exit(0);
}

deleteFakeTokens();

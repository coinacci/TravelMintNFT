import { db } from './server/db.js';
import { nfts, transactions } from './shared/schema.js';
import { inArray, eq } from 'drizzle-orm';

async function findFakeTokens() {
  console.log('🔍 Finding fake tokens (275-279)...\n');
  
  const fakeTokenIds = ['275', '276', '277', '278', '279'];
  
  // Find tokens with these exact IDs
  const fakeTokens = await db
    .select()
    .from(nfts)
    .where(inArray(nfts.tokenId, fakeTokenIds));
  
  console.log(`Found ${fakeTokens.length} tokens with IDs 275-279:`);
  fakeTokens.forEach(token => {
    console.log(`  - Token #${token.tokenId}: ${token.title} (${token.location}) [DB ID: ${token.id}]`);
  });
  
  if (fakeTokens.length > 0) {
    // Check if these tokens have transactions
    console.log('\n🔍 Checking for transactions...');
    for (const token of fakeTokens) {
      const txs = await db
        .select()
        .from(transactions)
        .where(eq(transactions.nftId, token.id));
      
      if (txs.length > 0) {
        console.log(`  ❌ Token #${token.tokenId} has ${txs.length} transaction(s) - cannot delete`);
      } else {
        console.log(`  ✅ Token #${token.tokenId} has no transactions - can delete`);
      }
    }
  }
  
  process.exit(0);
}

findFakeTokens();

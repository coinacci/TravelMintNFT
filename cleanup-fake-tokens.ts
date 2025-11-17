import { db } from './server/db.js';
import { nfts } from './shared/schema.js';
import { gte, lte, inArray } from 'drizzle-orm';

async function cleanupFakeTokens() {
  console.log('🧹 Cleaning up fake tokens from database...\n');
  
  // Find tokens 275-279
  const fakeTokens = await db
    .select()
    .from(nfts)
    .where(gte(nfts.tokenId, 275));
  
  console.log(`Found ${fakeTokens.length} tokens with ID >= 275:`);
  fakeTokens.forEach(token => {
    console.log(`  - Token #${token.tokenId}: ${token.title} (${token.location})`);
  });
  
  if (fakeTokens.length > 0) {
    // Delete fake tokens
    await db.delete(nfts).where(gte(nfts.tokenId, 275));
    console.log(`\n✅ Deleted ${fakeTokens.length} fake tokens`);
  }
  
  // Verify remaining count
  const remaining = await db.select().from(nfts);
  console.log(`\n📊 Remaining tokens in database: ${remaining.length}`);
  
  // Check for gaps in 1-274 range
  const tokenIds = remaining.map(n => n.tokenId).sort((a, b) => a - b);
  const missing = [];
  for (let i = 1; i <= 274; i++) {
    if (!tokenIds.includes(i)) {
      missing.push(i);
    }
  }
  
  if (missing.length > 0) {
    console.log(`\n⚠️ Missing tokens in 1-274 range: ${missing.slice(0, 20).join(', ')}${missing.length > 20 ? ` ... (${missing.length} total)` : ''}`);
  } else {
    console.log('\n✅ All tokens 1-274 exist (no gaps)');
  }
  
  process.exit(0);
}

cleanupFakeTokens();

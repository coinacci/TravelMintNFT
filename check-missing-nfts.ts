import { db } from './server/db.js';
import { nfts } from './shared/schema.js';
import { sql } from 'drizzle-orm';

async function checkMissing() {
  const all = await db.select({ tokenId: nfts.tokenId }).from(nfts);
  const tokenIds = all.map(n => parseInt(n.tokenId || '0')).filter(n => !isNaN(n) && n > 0).sort((a, b) => a - b);
  
  console.log(`📊 Database: ${tokenIds.length} NFTs`);
  console.log(`🔢 Range: ${Math.min(...tokenIds)} - ${Math.max(...tokenIds)}\n`);
  
  // Find gaps
  const missing = [];
  const max = Math.max(...tokenIds);
  for (let i = 1; i <= max; i++) {
    if (!tokenIds.includes(i)) {
      missing.push(i);
    }
  }
  
  if (missing.length > 0) {
    console.log(`❌ Missing ${missing.length} tokens in range 1-${max}:`);
    if (missing.length <= 50) {
      console.log(missing.join(', '));
    } else {
      console.log(missing.slice(0, 30).join(', '), `... and ${missing.length - 30} more`);
    }
  }
  
  // Check if there might be tokens > max
  console.log(`\n🔍 Basescan shows 280 total NFTs`);
  console.log(`📊 Database has ${tokenIds.length} NFTs`);
  console.log(`🔢 Highest in DB: #${max}`);
  console.log(`❓ Potentially missing: ${280 - tokenIds.length} NFTs`);
  
  if (max < 280) {
    console.log(`\n⚠️ Tokens #${max + 1} to #280 might exist on blockchain but not in database`);
  }
  
  process.exit(0);
}

checkMissing();

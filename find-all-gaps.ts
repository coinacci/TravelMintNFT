import { db } from './server/db.js';
import { nfts } from './shared/schema.js';

async function findGaps() {
  const all = await db.select({ tokenId: nfts.tokenId }).from(nfts);
  const tokenIds = all.map(n => parseInt(n.tokenId || '0')).filter(n => !isNaN(n) && n > 0).sort((a, b) => a - b);
  
  console.log(`📊 Database has ${tokenIds.length} NFTs`);
  console.log(`🔢 Token ID range: ${Math.min(...tokenIds)} - ${Math.max(...tokenIds)}\n`);
  
  // Find ALL gaps
  const gaps = [];
  const max = Math.max(...tokenIds);
  for (let i = 1; i <= max; i++) {
    if (!tokenIds.includes(i)) {
      gaps.push(i);
    }
  }
  
  if (gaps.length > 0) {
    console.log(`❌ Found ${gaps.length} GAPS in range 1-${max}:`);
    console.log(gaps.join(', '));
    console.log(`\n💡 These tokens might exist on blockchain but missing from database`);
  } else {
    console.log(`✅ No gaps - all tokens from 1 to ${max} exist in database`);
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`  - Database: ${tokenIds.length} NFTs`);
  console.log(`  - Expected (if sequential): ${max} NFTs`);
  console.log(`  - Basescan shows: 280 NFTs`);
  console.log(`  - Total missing: ${280 - tokenIds.length} NFTs`);
  
  if (gaps.length > 0) {
    console.log(`\n🔍 Next step: Check if these ${gaps.length} gap tokens exist on blockchain`);
  }
  
  process.exit(0);
}

findGaps();

import { getNftContract } from './server/blockchain.js';

async function checkTotalSupply() {
  console.log('🔍 Checking ACTUAL NFT count on blockchain...\n');
  
  const contract = await getNftContract();
  
  // Method 1: Binary search for highest token
  console.log('🔎 Binary search for highest existing token...');
  let low = 1;
  let high = 500;
  let highest = 0;
  
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    try {
      await contract.ownerOf(mid);
      highest = mid;
      low = mid + 1;
    } catch (e) {
      high = mid - 1;
    }
  }
  
  console.log(`✅ Highest token found: #${highest}\n`);
  
  // Method 2: Count all tokens from 1 to highest+50
  console.log(`🔢 Counting ALL tokens from 1 to ${highest + 50}...`);
  let count = 0;
  const existing = [];
  
  for (let i = 1; i <= highest + 50; i++) {
    try {
      await contract.ownerOf(i);
      count++;
      existing.push(i);
    } catch (e) {
      // Token doesn't exist
    }
  }
  
  console.log(`✅ Total existing tokens: ${count}`);
  console.log(`🔢 Token IDs: ${existing.slice(0, 10).join(', ')}${count > 10 ? ` ... ${existing.slice(-10).join(', ')}` : ''}\n`);
  
  // Check for non-sequential IDs
  const gaps = [];
  for (let i = 1; i <= highest; i++) {
    if (!existing.includes(i)) {
      gaps.push(i);
    }
  }
  
  if (gaps.length > 0) {
    console.log(`❌ Found ${gaps.length} gaps in sequential range:`);
    console.log(gaps.slice(0, 20).join(', '));
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`  - Blockchain total: ${count} NFTs`);
  console.log(`  - Highest token ID: #${highest}`);
  console.log(`  - Database has: 274 NFTs`);
  console.log(`  - Missing from DB: ${count - 274} NFTs`);
  
  process.exit(0);
}

checkTotalSupply();

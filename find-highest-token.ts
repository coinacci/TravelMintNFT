import { getNftContract } from './server/blockchain.js';

async function findHighestToken() {
  const contract = await getNftContract();
  
  console.log('🔍 Binary search for highest existing token...\n');
  
  // Binary search to find the highest existing token
  let low = 1;
  let high = 300;
  let highest = 0;
  
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    
    try {
      await contract.ownerOf(mid);
      console.log(`✅ Token #${mid} exists`);
      highest = mid;
      low = mid + 1;
    } catch (e) {
      console.log(`❌ Token #${mid} does NOT exist`);
      high = mid - 1;
    }
  }
  
  console.log(`\n🎯 HIGHEST EXISTING TOKEN: #${highest}`);
  
  // Verify the boundary
  console.log('\n🔬 Verifying boundary:');
  for (let i = highest - 2; i <= highest + 3; i++) {
    try {
      const owner = await contract.ownerOf(i);
      console.log(`✅ Token #${i}: EXISTS (owner: ${owner.substring(0, 10)}...)`);
    } catch (e) {
      console.log(`❌ Token #${i}: DOES NOT EXIST`);
    }
  }
  
  process.exit(0);
}

findHighestToken();

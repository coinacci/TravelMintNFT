import { storage } from './server/storage.js';

async function checkFinalCount() {
  const allNFTs = await storage.getAllNFTs();
  const tokenIds = allNFTs.map(n => parseInt(n.tokenId || '0')).filter(n => !isNaN(n) && n > 0).sort((a, b) => a - b);
  
  console.log(`📊 Current database count: ${tokenIds.length} NFTs`);
  console.log(`🔢 Highest token ID: #${Math.max(...tokenIds)}`);
  
  // Check for 275-280
  const recent = tokenIds.filter(id => id >= 275);
  console.log(`\n✅ Recently added tokens (275+): ${recent.join(', ')}`);
  
  // Check pending
  const pending = await storage.getPendingMints();
  console.log(`\n⏳ Still pending: ${pending.length} tokens`);
  if (pending.length > 0) {
    console.log(`   Token IDs: ${pending.map(p => p.tokenId).join(', ')}`);
    console.log(`   Will be retried automatically every 2 minutes`);
  }
  
  process.exit(0);
}

checkFinalCount();

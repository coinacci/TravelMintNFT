import { storage } from './server/storage.js';

async function testHolderCount() {
  const allNFTs = await storage.getAllNFTs();
  
  // Calculate unique holders
  const uniqueHolders = new Set(allNFTs.map(nft => nft.ownerAddress.toLowerCase()));
  
  console.log(`📊 NFT Statistics:`);
  console.log(`   Total NFTs: ${allNFTs.length}`);
  console.log(`   Unique holders: ${uniqueHolders.size}`);
  
  // Show top holders
  const holderCounts = new Map<string, number>();
  for (const nft of allNFTs) {
    const owner = nft.ownerAddress.toLowerCase();
    holderCounts.set(owner, (holderCounts.get(owner) || 0) + 1);
  }
  
  const topHolders = Array.from(holderCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  console.log(`\n🏆 Top 5 holders:`);
  topHolders.forEach(([address, count], index) => {
    console.log(`   ${index + 1}. ${address.substring(0, 10)}... - ${count} NFTs`);
  });
  
  // Check recent tokens
  const recentTokens = allNFTs
    .filter(nft => {
      const tokenId = parseInt(nft.tokenId || '0');
      return tokenId >= 275;
    })
    .sort((a, b) => parseInt(b.tokenId || '0') - parseInt(a.tokenId || '0'));
  
  console.log(`\n✅ Recently added tokens (275-280):`);
  recentTokens.forEach(nft => {
    console.log(`   #${nft.tokenId}: ${nft.title} @ ${nft.location}`);
  });
  
  process.exit(0);
}

testHolderCount();

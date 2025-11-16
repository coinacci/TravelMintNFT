import { storage } from "../server/storage";

async function verify() {
  const nfts = await storage.getAllNFTs();
  const withTokenIds = nfts.filter(n => n.tokenId);
  
  console.log("📊 Database Status:");
  console.log(`   Total NFTs: ${nfts.length}`);
  console.log(`   With tokenIds: ${withTokenIds.length}`);
  
  const has276 = withTokenIds.some(n => n.tokenId === "276");
  const has277 = withTokenIds.some(n => n.tokenId === "277");
  
  console.log(`   Token 276: ${has276 ? '✅' : '❌'}`);
  console.log(`   Token 277: ${has277 ? '✅' : '❌'}`);
  
  const state = await storage.getSyncState("0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f");
  console.log(`\n📍 Sync Checkpoint: ${state?.lastProcessedBlock || 'None'}`);
  
  process.exit(0);
}

verify();

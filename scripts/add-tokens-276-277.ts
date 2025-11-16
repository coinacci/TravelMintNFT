import { blockchainService } from "../server/blockchain";
import { storage } from "../server/storage";

async function addMissingTokens() {
  try {
    console.log("🔧 Manually adding Token 276 and 277...\n");
    
    const tokensToAdd = [
      { tokenId: "276", owner: "0x5f6f7612a682f0423fd13ca66919c84a5c1cb952", block: 38249639 },
      { tokenId: "277", owner: "0x1ce2af6f886b353c21cce43e3b02a93e13e0f740", block: 38250194 }
    ];
    
    for (const token of tokensToAdd) {
      console.log(`\n📍 Processing Token #${token.tokenId}`);
      console.log(`   Owner: ${token.owner}`);
      console.log(`   Block: ${token.block}`);
      
      try {
        // Check if already exists
        const existing = await storage.getNFTByTokenId(token.tokenId);
        if (existing) {
          console.log(`   ✅ Already in database, skipping...`);
          continue;
        }
        
        // Fetch from blockchain
        console.log(`   📥 Fetching from blockchain...`);
        const nft = await blockchainService.getNFTByTokenId(token.tokenId);
        
        if (!nft) {
          console.log(`   ❌ Token not found on blockchain`);
          continue;
        }
        
        console.log(`   ✅ Found on blockchain`);
        console.log(`   📦 Token URI: ${nft.tokenURI}`);
        
        // Fetch metadata
        console.log(`   📥 Fetching metadata...`);
        const nftWithMetadata = await blockchainService.fetchMetadataAsync(nft);
        
        // Convert to DB format
        const dbFormat = await blockchainService.blockchainNFTToDBFormat(nftWithMetadata);
        
        console.log(`   💾 Saving to database...`);
        console.log(`   Title: ${dbFormat.title}`);
        console.log(`   Location: ${dbFormat.location}`);
        
        // Insert to database
        await storage.upsertNFTByTokenId(dbFormat);
        
        console.log(`   🎉 Token #${token.tokenId} successfully added!`);
        
      } catch (error: any) {
        console.error(`   ❌ Error processing Token #${token.tokenId}:`, error.message);
      }
      
      // Small delay between tokens
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log("\n" + "=".repeat(60));
    
    // Final count
    const allNFTs = await storage.getAllNFTs();
    const withTokenIds = allNFTs.filter(nft => nft.tokenId);
    
    console.log(`📊 Final Statistics:`);
    console.log(`   Total NFTs in database: ${allNFTs.length}`);
    console.log(`   NFTs with token IDs: ${withTokenIds.length}`);
    
    // Check if 276 and 277 are now present
    const has276 = withTokenIds.some(nft => nft.tokenId === "276");
    const has277 = withTokenIds.some(nft => nft.tokenId === "277");
    
    console.log(`   Token 276 present: ${has276 ? '✅' : '❌'}`);
    console.log(`   Token 277 present: ${has277 ? '✅' : '❌'}`);
    console.log("=".repeat(60));
    
    if (has276 && has277) {
      console.log("\n🎉 SUCCESS! Both tokens added successfully.");
    } else {
      console.log("\n⚠️  WARNING: Some tokens may be missing.");
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  }
}

// Run the script
addMissingTokens();

import { blockchainService } from "../server/blockchain";
import { storage } from "../server/storage";

async function syncMissingTokens() {
  try {
    console.log("🔍 Checking for missing tokens 275-285...");
    
    // Get current DB NFTs
    const dbNFTs = await storage.getAllNFTs();
    const existingTokenIds = new Set(dbNFTs.filter(nft => nft.tokenId).map(nft => nft.tokenId));
    
    console.log(`📦 Database has ${existingTokenIds.size} NFTs with token IDs`);
    
    let foundCount = 0;
    let errorCount = 0;
    
    // Check tokens 275-285
    for (let tokenId = 275; tokenId <= 285; tokenId++) {
      const tokenIdStr = tokenId.toString();
      
      if (existingTokenIds.has(tokenIdStr)) {
        console.log(`✅ Token ${tokenId} already in database`);
        continue;
      }
      
      console.log(`\n🔍 Checking Token ${tokenId}...`);
      
      try {
        // Try to get NFT using blockchain service
        const nft = await blockchainService.getNFTByTokenId(tokenIdStr);
        
        if (nft) {
          console.log(`✅ Token ${tokenId} exists! Owner: ${nft.owner}`);
          
          // Fetch metadata
          console.log(`📥 Fetching metadata...`);
          const nftWithMetadata = await blockchainService.fetchMetadataAsync(nft);
          
          // Convert to DB format
          const dbFormat = await blockchainService.blockchainNFTToDBFormat(nftWithMetadata);
          
          // Upsert to database
          await storage.upsertNFTByTokenId(dbFormat);
          
          console.log(`🎉 Token ${tokenId} added to database!`);
          console.log(`   Title: ${dbFormat.title}`);
          console.log(`   Location: ${dbFormat.location}`);
          console.log(`   Owner: ${dbFormat.ownerAddress}`);
          
          foundCount++;
        } else {
          console.log(`⚠️ Token ${tokenId} does not exist on blockchain`);
        }
        
      } catch (error: any) {
        if (error.message?.includes('invalid token ID') || error.message?.includes('ERC721')) {
          console.log(`⚠️ Token ${tokenId} does not exist`);
        } else {
          console.error(`❌ Error checking Token ${tokenId}:`, error.message);
          errorCount++;
        }
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log("\n" + "=".repeat(50));
    console.log("📊 Summary:");
    console.log(`   🆕 New tokens found: ${foundCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📦 Total in DB: ${existingTokenIds.size + foundCount}`);
    console.log("=".repeat(50));
    
    // Final DB count
    const finalNFTs = await storage.getAllNFTs();
    console.log(`\n🎉 Final database count: ${finalNFTs.length} NFTs`);
    
    process.exit(0);
    
  } catch (error) {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  }
}

// Run the sync
syncMissingTokens();

import { blockchainService } from "../server/blockchain";
import { storage } from "../server/storage";

async function backfillNFTs() {
  try {
    console.log("🚀 Starting NFT backfill...");
    console.log("📊 This will sync all missing NFTs from blockchain to database");
    
    // Get all NFTs from database
    const dbNFTs = await storage.getAllNFTs();
    console.log(`📦 Database has ${dbNFTs.length} NFTs`);
    
    // Run incremental sync to catch new NFTs
    console.log("\n🔄 Running incremental blockchain sync...");
    const { newNFTs, lastBlock } = await blockchainService.syncNFTsIncremental(storage, 5000);
    
    console.log(`\n✅ Sync complete!`);
    console.log(`📍 Synced up to block: ${lastBlock}`);
    console.log(`🆕 Found ${newNFTs.length} new NFTs`);
    
    if (newNFTs.length === 0) {
      console.log("\n✨ No new NFTs found - database is up to date!");
      process.exit(0);
    }
    
    // Process each new NFT
    console.log("\n📥 Processing new NFTs...");
    let successCount = 0;
    let errorCount = 0;
    
    for (const nft of newNFTs) {
      try {
        console.log(`\n🔍 Processing Token #${nft.tokenId}`);
        
        // Fetch metadata (with retry)
        const nftWithMetadata = await blockchainService.fetchMetadataAsync(nft);
        
        // Convert to DB format
        const dbFormat = await blockchainService.blockchainNFTToDBFormat(nftWithMetadata);
        
        // Upsert to database
        await storage.upsertNFTByTokenId(dbFormat);
        
        console.log(`✅ Token #${nft.tokenId} added to database`);
        console.log(`   Owner: ${nft.owner}`);
        console.log(`   Location: ${dbFormat.location || 'Unknown'}`);
        
        successCount++;
        
      } catch (error) {
        console.error(`❌ Error processing Token #${nft.tokenId}:`, error);
        errorCount++;
      }
    }
    
    console.log("\n" + "=".repeat(50));
    console.log("📊 Backfill Summary:");
    console.log(`   ✅ Success: ${successCount} NFTs`);
    console.log(`   ❌ Errors: ${errorCount} NFTs`);
    console.log(`   📦 Total in DB: ${dbNFTs.length + successCount} NFTs`);
    console.log("=".repeat(50));
    
    // Get final database count
    const finalDbNFTs = await storage.getAllNFTs();
    console.log(`\n🎉 Final database count: ${finalDbNFTs.length} NFTs`);
    
    process.exit(0);
    
  } catch (error) {
    console.error("\n❌ Backfill failed:", error);
    process.exit(1);
  }
}

// Run the backfill
backfillNFTs();

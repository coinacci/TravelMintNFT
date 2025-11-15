import { storage } from "../server/storage";

/**
 * One-time script to update all existing NFTs with Farcaster usernames
 * This populates farcaster_owner_username and farcaster_creator_username fields
 */
async function updateAllNFTsWithFarcaster() {
  console.log("🔄 Starting Farcaster username update for all NFTs...");
  
  try {
    // Get all NFTs
    const allNFTs = await storage.getAllNFTs();
    console.log(`📊 Found ${allNFTs.length} NFTs to process`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const nft of allNFTs) {
      try {
        // Check if already has Farcaster data
        if (nft.farcasterOwnerUsername && nft.farcasterCreatorUsername) {
          console.log(`⏭️  Skipping NFT #${nft.tokenId} - already has Farcaster data`);
          skippedCount++;
          continue;
        }
        
        console.log(`🔍 Processing NFT #${nft.tokenId} (${nft.title})`);
        
        // Get Farcaster info for owner
        const ownerInfo = await storage.getFarcasterInfoFromWallet(nft.ownerAddress);
        
        // Get Farcaster info for creator (only if different from owner)
        let creatorInfo = null;
        if (nft.creatorAddress && nft.creatorAddress.toLowerCase() !== nft.ownerAddress.toLowerCase()) {
          creatorInfo = await storage.getFarcasterInfoFromWallet(nft.creatorAddress);
        }
        
        // Update NFT with Farcaster info
        await storage.updateNFT(nft.id, {
          farcasterOwnerUsername: ownerInfo?.username || null,
          farcasterOwnerFid: ownerInfo?.fid || null,
          farcasterCreatorUsername: creatorInfo?.username || null,
          farcasterCreatorFid: creatorInfo?.fid || null,
        });
        
        const ownerDisplay = ownerInfo?.username || nft.ownerAddress.substring(0, 8);
        const creatorDisplay = creatorInfo?.username || (creatorInfo ? nft.creatorAddress.substring(0, 8) : 'same as owner');
        
        console.log(`✅ Updated NFT #${nft.tokenId}: Owner=${ownerDisplay}, Creator=${creatorDisplay}`);
        updatedCount++;
        
      } catch (error) {
        console.error(`❌ Error processing NFT #${nft.tokenId}:`, error);
        errorCount++;
      }
    }
    
    console.log("\n📈 Update Summary:");
    console.log(`  ✅ Updated: ${updatedCount}`);
    console.log(`  ⏭️  Skipped: ${skippedCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log(`  📊 Total: ${allNFTs.length}`);
    
    console.log("\n🎉 Farcaster username update completed!");
    
  } catch (error) {
    console.error("💥 Fatal error during update:", error);
    process.exit(1);
  }
}

// Run the script
updateAllNFTsWithFarcaster()
  .then(() => {
    console.log("✨ Script finished successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Script failed:", error);
    process.exit(1);
  });

import { storage } from "../server/storage";
import { delay } from "../server/neynar-api";

/**
 * One-time script to update all existing NFTs with Farcaster usernames
 * This populates farcaster_owner_username and farcaster_creator_username fields
 * 
 * KEY FIX: For NFTs where creator == owner, copy owner info to creator fields
 */
async function updateAllNFTsWithFarcaster() {
  console.log("🔄 Starting Farcaster username update for all NFTs...");
  console.log("⚠️  This will use Neynar API for unknown wallets - rate limited to 150 req/min");
  
  try {
    // Get all NFTs
    const allNFTs = await storage.getAllNFTs();
    console.log(`📊 Found ${allNFTs.length} NFTs to process`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let neynarCalls = 0;
    
    for (const nft of allNFTs) {
      try {
        // Check if BOTH owner and creator data are complete
        const hasCompleteData = nft.farcasterOwnerUsername && nft.farcasterCreatorUsername;
        
        if (hasCompleteData) {
          console.log(`⏭️  Skipping NFT #${nft.tokenId} - already has complete Farcaster data`);
          skippedCount++;
          continue;
        }
        
        console.log(`🔍 Processing NFT #${nft.tokenId} (${nft.title})`);
        
        // Get Farcaster info for owner (may use Neynar API)
        const ownerInfo = await storage.getFarcasterInfoFromWallet(nft.ownerAddress);
        if (!nft.farcasterOwnerUsername && ownerInfo) {
          neynarCalls++;
        }
        
        // Rate limiting: 400ms between requests (150 req/min = ~400ms/request)
        await delay(400);
        
        // Determine creator info based on whether creator == owner
        let creatorInfo = null;
        const isSameAsOwner = !nft.creatorAddress || 
                              nft.creatorAddress.toLowerCase() === nft.ownerAddress.toLowerCase();
        
        if (isSameAsOwner) {
          // Creator is same as owner - copy owner info to creator fields
          creatorInfo = ownerInfo;
          console.log(`  ℹ️  Creator == Owner - copying owner Farcaster info`);
        } else {
          // Different creator - look up separately
          creatorInfo = await storage.getFarcasterInfoFromWallet(nft.creatorAddress);
          if (!nft.farcasterCreatorUsername && creatorInfo) {
            neynarCalls++;
          }
          await delay(400); // Rate limit
        }
        
        // Update NFT with Farcaster info
        await storage.updateNFT(nft.id, {
          farcasterOwnerUsername: ownerInfo?.username || null,
          farcasterOwnerFid: ownerInfo?.fid || null,
          farcasterCreatorUsername: creatorInfo?.username || null,
          farcasterCreatorFid: creatorInfo?.fid || null,
        });
        
        const ownerDisplay = ownerInfo?.username || nft.ownerAddress.substring(0, 8);
        const creatorDisplay = creatorInfo?.username || 
                              (isSameAsOwner ? '(same as owner)' : nft.creatorAddress.substring(0, 8));
        
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
    console.log(`  🌐 Neynar API calls: ${neynarCalls}`);
    
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

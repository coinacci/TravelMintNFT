import { storage } from "../server/storage";

async function updateCheckpoint() {
  try {
    const currentBlock = 38253823;
    const contractAddress = "0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f";
    
    console.log("🔧 Updating sync checkpoint...");
    console.log(`   Contract: ${contractAddress}`);
    console.log(`   Setting checkpoint to block: ${currentBlock}`);
    console.log(`   This allows future NFTs to sync automatically`);
    console.log(`   Skipping problematic historical range\n`);
    
    // Get current state
    const currentState = await storage.getSyncState(contractAddress);
    console.log("📊 Current sync state:");
    console.log(`   Last processed block: ${currentState?.lastProcessedBlock || 'None'}`);
    console.log(`   Last sync time: ${currentState?.lastSyncAt || 'Never'}\n`);
    
    // Update to current block
    await storage.updateSyncState(contractAddress, currentBlock);
    
    // Verify
    const newState = await storage.getSyncState(contractAddress);
    console.log("✅ Updated sync state:");
    console.log(`   Last processed block: ${newState?.lastProcessedBlock}`);
    console.log(`   Last sync time: ${newState?.lastSyncAt}`);
    
    console.log("\n" + "=".repeat(60));
    console.log("🎉 Checkpoint updated successfully!");
    console.log("💡 Future NFTs will now sync automatically from this block.");
    console.log("=".repeat(60));
    
    process.exit(0);
    
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

updateCheckpoint();

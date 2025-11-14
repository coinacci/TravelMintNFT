import { questManagerContract } from "./blockchain.js";
import { storage } from "./storage.js";
import { getQuestDay } from "../shared/schema.js";

let isListening = false;

export async function startQuestEventListener() {
  if (isListening) {
    console.log("⚠️ Quest event listener already running");
    return;
  }

  console.log("🎧 Starting QuestManager event listener...");
  
  try {
    questManagerContract.on("QuestCompleted", async (user, questId, fee, timestamp, day, event) => {
      // Extract transaction hash from event (ethers v6 format)
      const txHash = event.transactionHash || event.log?.transactionHash || 'unknown';
      
      try {
        console.log(`🎉 QuestCompleted event detected!`);
        console.log(`  User: ${user}`);
        console.log(`  Quest ID: ${questId.toString()}`);
        console.log(`  Fee: ${fee.toString()}`);
        console.log(`  Timestamp: ${timestamp.toString()}`);
        console.log(`  Day: ${day.toString()}`);
        console.log(`  Transaction: ${txHash}`);
        
        const walletAddress = user.toLowerCase();
        const questIdNum = Number(questId);
        
        // Early exit checks - OUTSIDE retry loop to avoid wasting retries
        // Only handle questId 1 (Hello TravelMint daily quest)
        if (questIdNum !== 1) {
          console.log(`⚠️ Ignoring quest ID ${questIdNum} (only handling quest 1)`);
          return;
        }
        
        // Get ALL linked Farcaster accounts for this wallet
        const linkedAccounts = await storage.getLinkedWallets(walletAddress);
        if (!linkedAccounts || linkedAccounts.length === 0) {
          console.log(`⚠️ No Farcaster account linked to wallet ${walletAddress} - tx: ${txHash}`);
          return;
        }
        
        // Use the FIRST linked account (most recently linked)
        // TODO: In future, handle multiple linked accounts more gracefully
        const farcasterFid = linkedAccounts[0].farcasterFid;
        console.log(`✅ Found linked Farcaster account: ${farcasterFid}`);
        
        // Use the emitted day from blockchain event (not current day)
        // This ensures correct deduplication even if events are processed late
        const eventDay = Number(day);
        const eventTimestamp = Number(timestamp);
        console.log(`📅 Event day from blockchain: ${eventDay}`);
        
        // Retry loop for database operations only
        const maxRetries = 3;
        let retryCount = 0;
        
        while (retryCount < maxRetries) {
          try {
            // Check if already claimed on that specific day
            const existingCompletion = await storage.getQuestCompletion(farcasterFid, 'base_transaction', eventDay);
            
            if (existingCompletion) {
              console.log(`⚠️ Quest already claimed for FID ${farcasterFid} on day ${eventDay}`);
              return;
            }
            
            // Record quest completion with blockchain event day
            const pointsEarned = 100; // 1.00 points in fixed-point (stored as 100)
            await storage.addQuestCompletion({
              farcasterFid,
              questType: 'base_transaction',
              completionDate: '', // Unused - addQuestCompletion derives YYYY-MM-DD from day
              pointsEarned,
              day: eventDay // Use blockchain day for deduplication
            });
            
            // Update user stats
            const userStats = await storage.getUserStats(farcasterFid);
            if (userStats) {
              await storage.updateUserStats(farcasterFid, {
                totalPoints: userStats.totalPoints + pointsEarned
              });
            }
            
            console.log(`✅ Quest completion recorded for FID ${farcasterFid} (+${pointsEarned / 100} points) - tx: ${txHash}`);
            
            // Success - break retry loop
            break;
            
          } catch (error) {
            retryCount++;
            console.error(`❌ Error processing quest event (attempt ${retryCount}/${maxRetries}):`, error);
            
            if (retryCount >= maxRetries) {
              console.error(`❌ CRITICAL: Failed to process quest event after ${maxRetries} attempts`);
              console.error(`   User: ${user}`);
              console.error(`   FID: ${farcasterFid}`);
              console.error(`   Quest: ${questId.toString()}`);
              console.error(`   Day: ${eventDay}`);
              console.error(`   Transaction: ${txHash}`);
              console.error(`   ⚠️ This event completion is LOST - manual recovery needed`);
            } else {
              // Wait before retry (exponential backoff: 1s, 2s, 4s)
              const backoffMs = 1000 * Math.pow(2, retryCount - 1);
              console.log(`⏳ Retrying in ${backoffMs}ms...`);
              await new Promise(resolve => setTimeout(resolve, backoffMs));
            }
          }
        }
        
      } catch (error) {
        console.error(`❌ Error in quest event handler (outer):`, error);
        console.error(`   Transaction: ${txHash}`);
      }
    });
    
    isListening = true;
    console.log("✅ QuestManager event listener started successfully");
    
  } catch (error) {
    console.error("❌ Failed to start quest event listener:", error);
  }
}

export function stopQuestEventListener() {
  if (!isListening) {
    return;
  }
  
  console.log("🛑 Stopping QuestManager event listener...");
  questManagerContract.removeAllListeners("QuestCompleted");
  isListening = false;
  console.log("✅ QuestManager event listener stopped");
}

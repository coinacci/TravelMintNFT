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
      try {
        console.log(`🎉 QuestCompleted event detected!`);
        console.log(`  User: ${user}`);
        console.log(`  Quest ID: ${questId.toString()}`);
        console.log(`  Fee: ${fee.toString()}`);
        console.log(`  Timestamp: ${timestamp.toString()}`);
        console.log(`  Day: ${day.toString()}`);
        
        const walletAddress = user.toLowerCase();
        const questIdNum = Number(questId);
        
        // Only handle questId 1 (Hello TravelMint daily quest)
        if (questIdNum !== 1) {
          console.log(`⚠️ Ignoring quest ID ${questIdNum} (only handling quest 1)`);
          return;
        }
        
        // Get linked Farcaster account for this wallet
        const linkedAccounts = await storage.getLinkedWallets(walletAddress);
        if (!linkedAccounts || linkedAccounts.length === 0) {
          console.log(`⚠️ No Farcaster account linked to wallet ${walletAddress}`);
          return;
        }
        
        const farcasterFid = linkedAccounts[0].farcasterFid;
        console.log(`✅ Found linked Farcaster account: ${farcasterFid}`);
        
        // Check if already claimed today
        const today = getQuestDay();
        const existingCompletion = await storage.getQuestCompletion(farcasterFid, 'base_transaction', today);
        
        if (existingCompletion) {
          console.log(`⚠️ Quest already claimed today for FID ${farcasterFid}`);
          return;
        }
        
        // Record quest completion
        const pointsEarned = 100; // 1.00 points in fixed-point (stored as 100)
        await storage.addQuestCompletion({
          farcasterFid,
          questType: 'base_transaction',
          completionDate: new Date().toISOString(),
          pointsEarned,
          day: today
        });
        
        // Update user stats
        const userStats = await storage.getUserStats(farcasterFid);
        if (userStats) {
          await storage.updateUserStats(farcasterFid, {
            totalPoints: userStats.totalPoints + pointsEarned
          });
        }
        
        console.log(`✅ Quest completion recorded for FID ${farcasterFid} (+${pointsEarned / 100} points)`);
        
      } catch (error) {
        console.error("❌ Error processing QuestCompleted event:", error);
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

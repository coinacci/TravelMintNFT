import { ethers } from 'ethers';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log("🔧 Updating QuestManager quest fee...");
  
  const QUEST_MANAGER_ADDRESS = "0xC280030c2d15EF42C207a35CcF7a63A4760d8967";
  const NEW_FEE = "0.000005"; // 0.000005 ETH
  
  console.log("📋 Configuration:");
  console.log("  QuestManager:", QUEST_MANAGER_ADDRESS);
  console.log("  New Fee:", NEW_FEE, "ETH");
  
  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  
  if (!privateKey) {
    throw new Error("DEPLOYER_PRIVATE_KEY not found in environment");
  }
  
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log("\n👛 Wallet:", wallet.address);
  
  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log("💰 Wallet balance:", ethers.formatEther(balance), "ETH");
  
  if (balance < ethers.parseEther("0.00001")) {
    throw new Error("Insufficient balance. Need at least 0.00001 ETH for transaction");
  }
  
  // Load ABI
  const deploymentInfo = JSON.parse(fs.readFileSync('quest-manager-deployment.json', 'utf8'));
  const abi = deploymentInfo.abi;
  
  // Create contract instance
  const questManager = new ethers.Contract(QUEST_MANAGER_ADDRESS, abi, wallet);
  
  // Get current owner
  const owner = await questManager.owner();
  console.log("📜 Contract Owner:", owner);
  
  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.log("\n⚠️  WARNING: Your wallet is not the owner!");
    console.log("   You need to use the owner wallet to update the fee.");
    console.log("   Owner address:", owner);
    throw new Error("Only owner can update quest fee");
  }
  
  // Get current fee
  const currentFee = await questManager.questFee();
  console.log("💵 Current Fee:", ethers.formatEther(currentFee), "ETH");
  
  // Update fee
  console.log("\n⏳ Updating quest fee to", NEW_FEE, "ETH...");
  const newFeeWei = ethers.parseEther(NEW_FEE);
  
  const tx = await questManager.updateQuestFee(newFeeWei);
  console.log("📝 Transaction sent:", tx.hash);
  console.log("⏳ Waiting for confirmation...");
  
  const receipt = await tx.wait();
  console.log("✅ Transaction confirmed! Block:", receipt.blockNumber);
  
  // Verify new fee
  const updatedFee = await questManager.questFee();
  console.log("\n💵 Updated Fee:", ethers.formatEther(updatedFee), "ETH");
  
  console.log("\n🎉 Quest fee successfully updated!");
  console.log("🔗 View transaction:", `https://basescan.org/tx/${tx.hash}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Update failed:", error.message);
    process.exit(1);
  });

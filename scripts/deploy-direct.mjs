import { ethers } from 'ethers';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log("🚀 Deploying QuestManager contract to Base mainnet...");
  
  // Contract addresses
  const TRAVEL_NFT_ADDRESS = "0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f";
  const TREASURY_ADDRESS = "0x7CDe7822456AAC667Df0420cD048295b92704084";
  const OWNER_ADDRESS = "0x7CDe7822456AAC667Df0420cD048295b92704084";
  
  console.log("📋 Configuration:");
  console.log("  TravelNFT:", TRAVEL_NFT_ADDRESS);
  console.log("  Treasury:", TREASURY_ADDRESS);
  console.log("  Owner:", OWNER_ADDRESS);
  
  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  
  if (!privateKey) {
    throw new Error("DEPLOYER_PRIVATE_KEY not found in environment");
  }
  
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log("\n👛 Deployer wallet:", wallet.address);
  
  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log("💰 Wallet balance:", ethers.formatEther(balance), "ETH");
  
  if (balance < ethers.parseEther("0.001")) {
    throw new Error("Insufficient balance. Need at least 0.001 ETH for deployment");
  }
  
  // Load compiled contract
  const abiPath = "build/contracts_QuestManager_sol_QuestManager.abi";
  const binPath = "build/contracts_QuestManager_sol_QuestManager.bin";
  
  const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  const bytecode = "0x" + fs.readFileSync(binPath, 'utf8');
  
  console.log("\n📦 Contract bytecode loaded, size:", bytecode.length / 2 - 1, "bytes");
  
  // Create contract factory
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  
  // Deploy the contract
  console.log("\n⏳ Deploying contract...");
  const contract = await factory.deploy(
    TRAVEL_NFT_ADDRESS,
    TREASURY_ADDRESS,
    OWNER_ADDRESS
  );
  
  console.log("📝 Deployment transaction sent:", contract.deploymentTransaction().hash);
  console.log("⏳ Waiting for confirmations...");
  
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  
  console.log("✅ QuestManager deployed to:", contractAddress);
  
  // Save deployment info
  const deploymentInfo = {
    contractAddress: contractAddress,
    network: "base",
    chainId: 8453,
    deploymentDate: new Date().toISOString(),
    deployer: wallet.address,
    transactionHash: contract.deploymentTransaction().hash,
    travelNFTAddress: TRAVEL_NFT_ADDRESS,
    treasuryAddress: TREASURY_ADDRESS,
    questFee: "0.000005 ETH",
    abi: abi
  };
  
  fs.writeFileSync(
    "quest-manager-deployment.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("\n💾 Deployment info saved to quest-manager-deployment.json");
  console.log("\n🎉 Deployment complete!");
  console.log("📋 Contract Address:", contractAddress);
  console.log("🔗 View on BaseScan:", `https://basescan.org/address/${contractAddress}`);
  console.log("\n⚠️ Manual verification required on BaseScan:");
  console.log("   1. Go to:", `https://basescan.org/address/${contractAddress}#code`);
  console.log("   2. Click 'Verify and Publish'");
  console.log("   3. Constructor Arguments:");
  console.log("      - _travelNFT:", TRAVEL_NFT_ADDRESS);
  console.log("      - _treasury:", TREASURY_ADDRESS);
  console.log("      - initialOwner:", OWNER_ADDRESS);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });

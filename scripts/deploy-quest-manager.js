const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🚀 Deploying QuestManager contract to Base mainnet...");
  
  // Contract addresses
  const TRAVEL_NFT_ADDRESS = "0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f";
  const TREASURY_ADDRESS = "0x7CDe7822456AAC667Df0420cD048295b92704084"; // Platform wallet
  const OWNER_ADDRESS = "0x7CDe7822456AAC667Df0420cD048295b92704084";
  
  console.log("📋 Configuration:");
  console.log("  TravelNFT:", TRAVEL_NFT_ADDRESS);
  console.log("  Treasury:", TREASURY_ADDRESS);
  console.log("  Owner:", OWNER_ADDRESS);
  
  // Get the contract factory
  const QuestManager = await hre.ethers.getContractFactory("QuestManager");
  
  // Deploy the contract
  console.log("\n⏳ Deploying contract...");
  const questManager = await QuestManager.deploy(
    TRAVEL_NFT_ADDRESS,
    TREASURY_ADDRESS,
    OWNER_ADDRESS
  );
  
  await questManager.waitForDeployment();
  const contractAddress = await questManager.getAddress();
  
  console.log("✅ QuestManager deployed to:", contractAddress);
  
  // Get deployment transaction hash
  const deployTx = questManager.deploymentTransaction();
  console.log("📝 Deployment transaction:", deployTx.hash);
  
  // Save deployment info
  const deploymentInfo = {
    contractAddress: contractAddress,
    network: "base",
    chainId: 8453,
    deploymentDate: new Date().toISOString(),
    deployer: OWNER_ADDRESS,
    transactionHash: deployTx.hash,
    travelNFTAddress: TRAVEL_NFT_ADDRESS,
    treasuryAddress: TREASURY_ADDRESS,
    questFee: "0.0001 ETH"
  };
  
  fs.writeFileSync(
    "quest-manager-deployment.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("\n💾 Deployment info saved to quest-manager-deployment.json");
  
  // Wait for a few block confirmations before verifying
  console.log("\n⏳ Waiting for block confirmations...");
  await questManager.deploymentTransaction().wait(5);
  
  // Verify contract on BaseScan
  console.log("\n🔍 Verifying contract on BaseScan...");
  try {
    await hre.run("verify:verify", {
      address: contractAddress,
      constructorArguments: [
        TRAVEL_NFT_ADDRESS,
        TREASURY_ADDRESS,
        OWNER_ADDRESS
      ],
    });
    console.log("✅ Contract verified on BaseScan!");
  } catch (error) {
    console.log("⚠️ Verification error:", error.message);
    console.log("You can verify manually later with:");
    console.log(`npx hardhat verify --network base ${contractAddress} ${TRAVEL_NFT_ADDRESS} ${TREASURY_ADDRESS} ${OWNER_ADDRESS}`);
  }
  
  console.log("\n🎉 Deployment complete!");
  console.log("📋 Contract Address:", contractAddress);
  console.log("🔗 View on BaseScan:", `https://basescan.org/address/${contractAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

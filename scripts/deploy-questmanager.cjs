const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying QuestManager with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");
  
  const travelNFTAddress = "0x35E044c5ce0F2677942F585dd60Ebc66D89Ec7A0";
  const treasuryAddress = "0x7CDe7822456AAC667Df0420cD048295b92704084";
  
  console.log("TravelNFT Address:", travelNFTAddress);
  console.log("Treasury Address:", treasuryAddress);
  console.log("Initial Owner:", deployer.address);
  
  const QuestManager = await ethers.getContractFactory("QuestManager");
  const questManager = await QuestManager.deploy(
    travelNFTAddress,
    treasuryAddress,
    deployer.address
  );
  
  await questManager.waitForDeployment();
  const address = await questManager.getAddress();
  
  console.log("QuestManager deployed to:", address);
  console.log("Quest fee set to: 0.00005 ETH");
  
  return address;
}

main()
  .then((address) => {
    console.log("Deployment successful!");
    console.log("Update QUEST_MANAGER_ADDRESS in map-view.tsx to:", address);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

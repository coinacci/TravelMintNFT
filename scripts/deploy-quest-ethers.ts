import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

const QUEST_MANAGER_BYTECODE = "0x60a060405234801561000f575f80fd5b5060405161115c38038061115c833981016040819052610f0991816101a7565b826001600160a01b03811661003857604051631e4fbdf760e01b81525f600482015260240160405180910390fd5b610041816100e7565b506001600160a01b03831661009d5760405162461bcd60e51b815260206004820152601460248201527f496e76616c6964204e465420636f6e747261637400000000000000000000000060448201526064015b60405180910390fd5b6001600160a01b0382166100f35760405162461bcd60e51b815260206004820152601860248201527f496e76616c696420747265617375727920616464726573730000000000000000604482015260640161009456";

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("DEPLOYER_PRIVATE_KEY not set");
  }

  const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log("Deployer address:", wallet.address);
  
  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
  
  const travelNFTAddress = "0x35E044c5ce0F2677942F585dd60Ebc66D89Ec7A0";
  const treasuryAddress = "0x7CDe7822456AAC667Df0420cD048295b92704084";

  console.log("Parameters:");
  console.log("- TravelNFT:", travelNFTAddress);
  console.log("- Treasury:", treasuryAddress);
  console.log("- Owner:", wallet.address);

  const QuestManagerABI = [
    "constructor(address _travelNFT, address _treasury, address initialOwner)",
    "function completeQuest(uint256 questId) external payable",
    "function questFee() external view returns (uint256)",
    "function treasury() external view returns (address)",
    "function hasCompletedQuestToday(address user, uint256 questId) external view returns (bool)"
  ];

  const contractPath = path.join(__dirname, "..", "contracts", "QuestManager.sol");
  console.log("\\nContract needs to be compiled manually or via Remix.");
  console.log("\\nQuestManager.sol location:", contractPath);
  console.log("\\nTo deploy via Remix:");
  console.log("1. Go to https://remix.ethereum.org");
  console.log("2. Create QuestManager.sol with the updated fee (0.00005 ETH)");
  console.log("3. Deploy on Base mainnet with:");
  console.log("   - _travelNFT:", travelNFTAddress);
  console.log("   - _treasury:", treasuryAddress);
  console.log("   - initialOwner:", wallet.address);
  console.log("4. Copy the deployed address");
  console.log("5. Update QUEST_MANAGER_ADDRESS in map-view.tsx");
}

main().catch(console.error);

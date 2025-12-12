import { ethers } from "ethers";

const QUEST_MANAGER_ADDRESS = "0xC280030c2d15EF42C207a35CcF7a63A4760d8967";
const NEW_FEE = ethers.parseEther("0.00005"); // 0.00005 ETH

const QUEST_MANAGER_ABI = [
  "function updateQuestFee(uint256 newFee) external",
  "function questFee() external view returns (uint256)",
  "function owner() external view returns (address)"
];

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("DEPLOYER_PRIVATE_KEY not set");
  }

  const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log("Wallet address:", wallet.address);
  
  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
  
  const contract = new ethers.Contract(QUEST_MANAGER_ADDRESS, QUEST_MANAGER_ABI, wallet);
  
  // Check current fee
  const currentFee = await contract.questFee();
  console.log("Current fee:", ethers.formatEther(currentFee), "ETH");
  
  // Check owner
  const owner = await contract.owner();
  console.log("Contract owner:", owner);
  console.log("Is wallet owner?", owner.toLowerCase() === wallet.address.toLowerCase());
  
  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.log("ERROR: Wallet is not the contract owner. Cannot update fee.");
    return;
  }
  
  console.log("\nUpdating fee to:", ethers.formatEther(NEW_FEE), "ETH");
  
  const tx = await contract.updateQuestFee(NEW_FEE);
  console.log("Transaction hash:", tx.hash);
  
  const receipt = await tx.wait();
  console.log("Transaction confirmed in block:", receipt?.blockNumber);
  
  // Verify new fee
  const newFee = await contract.questFee();
  console.log("New fee:", ethers.formatEther(newFee), "ETH");
  console.log("\nFee updated successfully!");
}

main().catch(console.error);

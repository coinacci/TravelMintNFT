import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const TREASURY_ADDRESS = "0x7CDe7822456AAC667Df0420cD048295b92704084";
  const PLATFORM_FEE_BPS = 1000; // 10%

  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("DEPLOYER_PRIVATE_KEY not set");
  }

  const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("Deploying DonationSplitter from:", wallet.address);

  const abiPath = path.join(__dirname, "../contracts/build/contracts_DonationSplitter_flattened_sol_DonationSplitter.abi");
  const binPath = path.join(__dirname, "../contracts/build/contracts_DonationSplitter_flattened_sol_DonationSplitter.bin");

  const abi = JSON.parse(fs.readFileSync(abiPath, "utf8"));
  const bytecode = "0x" + fs.readFileSync(binPath, "utf8");

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);

  console.log("Deploying with parameters:");
  console.log("  USDC:", USDC_ADDRESS);
  console.log("  Treasury:", TREASURY_ADDRESS);
  console.log("  Platform Fee BPS:", PLATFORM_FEE_BPS);

  const contract = await factory.deploy(USDC_ADDRESS, TREASURY_ADDRESS, PLATFORM_FEE_BPS);
  console.log("Transaction hash:", contract.deploymentTransaction()?.hash);
  
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  
  console.log("DonationSplitter deployed to:", address);
  console.log("\nAdd this to your environment:");
  console.log(`DONATION_SPLITTER_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

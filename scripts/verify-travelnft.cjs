const hre = require("hardhat");

async function main() {
  console.log("🔍 Verifying TravelNFT contract on BaseScan...");
  
  const contractAddress = "0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f";
  const initialOwner = "0x7CDe7822456AAC667Df0420cD048295b92704084";
  
  console.log("📋 Contract Address:", contractAddress);
  console.log("👤 Constructor Argument (initialOwner):", initialOwner);
  
  try {
    await hre.run("verify:verify", {
      address: contractAddress,
      constructorArguments: [initialOwner],
    });
    
    console.log("✅ Contract verified successfully!");
    console.log("🔗 View on BaseScan:", `https://basescan.org/address/${contractAddress}#code`);
  } catch (error) {
    if (error.message.includes("already verified")) {
      console.log("ℹ️ Contract is already verified");
    } else {
      console.error("❌ Verification failed:", error.message);
      throw error;
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

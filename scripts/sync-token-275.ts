import { ethers } from "ethers";
import { storage } from "../server/storage";

const TRAVEL_NFT_ADDRESS = "0x8c12c9ebf7db0a6370361ce9225e3b77d22a558f";
const BASE_RPC = "https://mainnet.base.org";

async function syncToken275() {
  console.log("🔍 Starting manual sync for Token #275...");
  
  try {
    const provider = new ethers.JsonRpcProvider(BASE_RPC);
    
    const contract = new ethers.Contract(
      TRAVEL_NFT_ADDRESS,
      [
        "function ownerOf(uint256 tokenId) view returns (address)",
        "function tokenURI(uint256 tokenId) view returns (string)"
      ],
      provider
    );
    
    console.log("📡 Fetching Token #275 from blockchain...");
    
    // Get owner
    const owner = await contract.ownerOf(275);
    console.log(`✅ Owner: ${owner}`);
    
    // Get tokenURI
    const tokenURI = await contract.tokenURI(275);
    console.log(`✅ TokenURI: ${tokenURI}`);
    
    // Fetch metadata from tokenURI
    console.log("📥 Fetching metadata...");
    const response = await fetch(tokenURI);
    const metadata = await response.json();
    console.log("✅ Metadata:", JSON.stringify(metadata, null, 2));
    
    // Extract location data
    const location = metadata.location?.city || 
                    metadata.attributes?.find((a: any) => a.trait_type === "Location")?.value || 
                    "Unknown";
    const latitude = metadata.location?.latitude || 
                    metadata.attributes?.find((a: any) => a.trait_type === "Latitude")?.value || 
                    "0";
    const longitude = metadata.location?.longitude || 
                     metadata.attributes?.find((a: any) => a.trait_type === "Longitude")?.value || 
                     "0";
    const category = metadata.attributes?.find((a: any) => a.trait_type === "Category")?.value || "Travel";
    
    // Upsert into database
    console.log("💾 Saving to database...");
    const nft = await storage.upsertNFTByTokenId({
      tokenId: "275",
      title: metadata.name || "Token #275",
      description: metadata.description || "",
      imageUrl: metadata.image || "",
      location,
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      price: "0",
      category,
      isForSale: 0,
      ownerAddress: owner.toLowerCase(),
      creatorAddress: owner.toLowerCase(), // Assume first owner is creator
      metadata: JSON.stringify(metadata)
    });
    
    console.log("✅ Token #275 synced successfully!");
    console.log("NFT ID:", nft.id);
    console.log("Title:", nft.title);
    console.log("Location:", nft.location);
    console.log("Coordinates:", `${nft.latitude}, ${nft.longitude}`);
    
  } catch (error: any) {
    console.error("❌ Error syncing Token #275:", error.message);
    if (error.code === 'CALL_EXCEPTION') {
      console.error("⚠️  Token #275 might not exist on blockchain");
    }
    throw error;
  }
}

// Run the script
syncToken275()
  .then(() => {
    console.log("✨ Script finished successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Script failed:", error);
    process.exit(1);
  });

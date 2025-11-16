import { storage } from "../server/storage";

async function insertTokens() {
  try {
    console.log("💾 Inserting Token 276 and 277 into database...\n");
    
    // Decode base64 metadata
    const token276Metadata = JSON.parse(
      Buffer.from(
        "eyJuYW1lIjoiRGlzbmV5bGFuZCIsImRlc2NyaXB0aW9uIjoiVHJhdmVsIE5GVCIsImltYWdlIjoiaHR0cDovL3RyYXZlbG5mdC5yZXBsaXQuYXBwL29iamVjdHMvdXBsb2Fkcy9kM2VmOGNlNC04ZDE3LTQ5ZTEtYTdmNi01ZTI3ZTNhMzhjMDcuanBnIiwiYXR0cmlidXRlcyI6W3sidHJhaXRfdHlwZSI6IkNhdGVnb3J5IiwidmFsdWUiOiJBcmNoaXRlY3R1cmUifSx7InRyYWl0X3R5cGUiOiJMb2NhdGlvbiIsInZhbHVlIjoiUGFyaXMifSx7InRyYWl0X3R5cGUiOiJMYXRpdHVkZSIsInZhbHVlIjoiNDguODkxMTY4NzMwNDk2NTQifSx7InRyYWl0X3R5cGUiOiJMb25naXR1ZGUiLCJ2YWx1ZSI6IjIuMzE3NDU2MTI3MTk1MjE3In0seyJ0cmFpdF90eXBlIjoiTWludGVkIERhdGUiLCJ2YWx1ZSI6IjIwMjUtMTEtMTZUMTA6MjM6MzguNjYyWiJ9LHsidHJhaXRfdHlwZSI6IlBsYXRmb3JtIiwidmFsdWUiOiJUcmF2ZWxNaW50In1dLCJleHRlcm5hbF91cmwiOiJodHRwczovL3RyYXZlbG1pbnQuYXBwIiwibG9jYXRpb24iOnsiY2l0eSI6IlBhcmlzIiwibGF0aXR1ZGUiOiI0OC44OTExNjg3MzA0OTY1NCIsImxvbmdpdHVkZSI6IjIuMzE3NDU2MTI3MTk1MjE3In19",
        "base64"
      ).toString("utf-8")
    );
    
    const token277Metadata = JSON.parse(
      Buffer.from(
        "eyJuYW1lIjoiRGV2Q29ubmVjdCBBcmdlbnRpbmEiLCJkZXNjcmlwdGlvbiI6IkxhIFJ1cmFsIFZlbnVlLCB3aGVyZSBEZXZjb25uZWN0IGlzIGhhcHBlbmluZy4iLCJpbWFnZSI6Imh0dHA6Ly90cmF2ZWxuZnQucmVwbGl0LmFwcC9vYmplY3RzL3VwbG9hZHMvYTA0Njc2NWMtYWU3NS00ZDk3LTk5NTAtMjcwNzNkYWEyZTc1LmpwZyIsImF0dHJpYnV0ZXMiOlt7InRyYWl0X3R5cGUiOiJDYXRlZ29yeSIsInZhbHVlIjoiU3RyZWV0IFBob3RvZ3JhcGh5In0seyJ0cmFpdF90eXBlIjoiTG9jYXRpb24iLCJ2YWx1ZSI6IkxhIFJ1cmFsIn0seyJ0cmFpdF90eXBlIjoiTGF0aXR1ZGUiLCJ2YWx1ZSI6Ii0zMy45MDg0NTc0OTAyNjkyNyJ9LHsidHJhaXRfdHlwZSI6IkxvbmdpdHVkZSIsInZhbHVlIjoiLTYwLjU0MDA0ODA1OTA5MzMzIn0seyJ0cmFpdF90eXBlIjoiTWludGVkIERhdGUiLCJ2YWx1ZSI6IjIwMjUtMTEtMTZUMTA6NDI6MDUuNDE2WiJ9LHsidHJhaXRfdHlwZSI6IlBsYXRmb3JtIiwidmFsdWUiOiJUcmF2ZWxNaW50In1dLCJleHRlcm5hbF91cmwiOiJodHRwczovL3RyYXZlbG1pbnQuYXBwIiwibG9jYXRpb24iOnsiY2l0eSI6IkxhIFJ1cmFsIiwibGF0aXR1ZGUiOiItMzMuOTA4NDU3NDkwMjY5MjciLCJsb25naXR1ZGUiOiItNjAuNTQwMDQ4MDU5MDkzMzMifX0=",
        "base64"
      ).toString("utf-8")
    );
    
    const nft276 = {
      title: token276Metadata.name,
      description: token276Metadata.description || "Travel NFT",
      imageUrl: token276Metadata.image,
      location: token276Metadata.attributes.find((a: any) => a.trait_type === "Location")?.value || "Unknown",
      latitude: token276Metadata.attributes.find((a: any) => a.trait_type === "Latitude")?.value || "0",
      longitude: token276Metadata.attributes.find((a: any) => a.trait_type === "Longitude")?.value || "0",
      category: token276Metadata.attributes.find((a: any) => a.trait_type === "Category")?.value?.toLowerCase() || "nature",
      price: "1",
      isForSale: 0,
      creatorAddress: "0x5f6f7612a682f0423fd13ca66919c84a5c1cb952",
      ownerAddress: "0x5f6f7612a682f0423fd13ca66919c84a5c1cb952",
      mintPrice: "1",
      royaltyPercentage: "5",
      tokenId: "276",
      contractAddress: "0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f",
      transactionHash: "0x0e98c93d38c7847072c00353f8c29d1a06e7de5634e4dd76b6df85c89b7a7464",
      metadata: JSON.stringify(token276Metadata)
    };
    
    const nft277 = {
      title: token277Metadata.name,
      description: token277Metadata.description || "Travel NFT",
      imageUrl: token277Metadata.image,
      location: token277Metadata.attributes.find((a: any) => a.trait_type === "Location")?.value || "Unknown",
      latitude: token277Metadata.attributes.find((a: any) => a.trait_type === "Latitude")?.value || "0",
      longitude: token277Metadata.attributes.find((a: any) => a.trait_type === "Longitude")?.value || "0",
      category: token277Metadata.attributes.find((a: any) => a.trait_type === "Category")?.value?.toLowerCase() || "nature",
      price: "1",
      isForSale: 0,
      creatorAddress: "0x1ce2af6f886b353c21cce43e3b02a93e13e0f740",
      ownerAddress: "0x1ce2af6f886b353c21cce43e3b02a93e13e0f740",
      mintPrice: "1",
      royaltyPercentage: "5",
      tokenId: "277",
      contractAddress: "0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f",
      transactionHash: "0xeb76d5680f52a5c0464401cb08b7f5cf3f1d28ee0487c8a908ac49dc38dabf45",
      metadata: JSON.stringify(token277Metadata)
    };
    
    console.log("📍 Token 276:");
    console.log(`   Title: ${nft276.title}`);
    console.log(`   Location: ${nft276.location}`);
    console.log(`   Coordinates: ${nft276.latitude}, ${nft276.longitude}`);
    console.log(`   Owner: ${nft276.ownerAddress}\n`);
    
    console.log("📍 Token 277:");
    console.log(`   Title: ${nft277.title}`);
    console.log(`   Location: ${nft277.location}`);
    console.log(`   Coordinates: ${nft277.latitude}, ${nft277.longitude}`);
    console.log(`   Owner: ${nft277.ownerAddress}\n`);
    
    // Insert into database
    console.log("💾 Inserting into database...");
    await storage.upsertNFTByTokenId(nft276);
    console.log("✅ Token 276 inserted");
    
    await storage.upsertNFTByTokenId(nft277);
    console.log("✅ Token 277 inserted");
    
    // Verify
    const allNFTs = await storage.getAllNFTs();
    const withTokenIds = allNFTs.filter(nft => nft.tokenId);
    
    console.log("\n" + "=".repeat(60));
    console.log("📊 Final Statistics:");
    console.log(`   Total NFTs in database: ${allNFTs.length}`);
    console.log(`   NFTs with token IDs: ${withTokenIds.length}`);
    
    const has276 = withTokenIds.some(nft => nft.tokenId === "276");
    const has277 = withTokenIds.some(nft => nft.tokenId === "277");
    
    console.log(`   Token 276 present: ${has276 ? '✅' : '❌'}`);
    console.log(`   Token 277 present: ${has277 ? '✅' : '❌'}`);
    console.log("=".repeat(60));
    
    if (has276 && has277) {
      console.log("\n🎉 SUCCESS! Both tokens added successfully.");
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

insertTokens();

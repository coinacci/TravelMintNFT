import fetch from 'node-fetch';
import { ObjectStorageService } from './objectStorage.js';
import { db } from './db.js';
import { nfts } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Fix missing images by downloading from IPFS and uploading to object storage
 */
async function fixMissingImages() {
  console.log('🔧 Starting to fix missing images...');
  
  const objectStorage = new ObjectStorageService();
  
  // Get NFTs with placeholder URLs
  const nftsWithPlaceholders = await db
    .select()
    .from(nfts)
    .where(eq(nfts.objectStorageUrl, '/objects/placeholder/georgia-moments.jpg'));
    
  console.log(`Found ${nftsWithPlaceholders.length} NFTs with placeholder images`);
  
  for (const nft of nftsWithPlaceholders) {
    try {
      console.log(`🖼️ Processing ${nft.title}...`);
      
      // Download image from IPFS
      const response = await fetch(nft.imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      
      const imageBuffer = await response.arrayBuffer();
      const imageExtension = nft.imageUrl.includes('.jpg') || nft.imageUrl.includes('.jpeg') ? 'jpg' : 'png';
      
      console.log(`📥 Downloaded ${imageBuffer.byteLength} bytes`);
      
      // Get upload URL from object storage
      const uploadUrl = await objectStorage.getObjectEntityUploadURL();
      console.log(`📤 Got upload URL: ${uploadUrl.substring(0, 80)}...`);
      
      // Upload to object storage
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: imageBuffer,
        headers: {
          'Content-Type': `image/${imageExtension}`,
        },
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }
      
      // Extract object path from upload URL
      const urlParts = new URL(uploadUrl);
      const bucketName = urlParts.pathname.split('/')[1];
      const objectName = urlParts.pathname.substring(bucketName.length + 2);
      const objectPath = `/objects/${objectName.replace('uploads/', '')}`;
      
      console.log(`✅ Uploaded to: ${objectPath}`);
      
      // Update database
      await db
        .update(nfts)
        .set({ objectStorageUrl: objectPath })
        .where(eq(nfts.id, nft.id));
        
      console.log(`✅ Updated database for ${nft.title}`);
      
    } catch (error) {
      console.error(`❌ Failed to fix ${nft.title}:`, error);
    }
  }
  
  console.log('🎉 Finished fixing missing images!');
}

// Run the fix
fixMissingImages().catch(console.error);
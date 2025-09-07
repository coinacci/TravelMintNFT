import fetch from 'node-fetch';
import { ObjectStorageService } from './objectStorage.js';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

interface NFT {
  id: string;
  title: string;
  image_url: string;
  object_storage_url?: string;
}

export async function migrateAllImages() {
  console.log('🔄 Starting NFT image migration to object storage...');
  
  const objectStorageService = new ObjectStorageService();
  
  // Get all NFTs that don't have object storage URLs
  const nfts = await sql`
    SELECT id, title, image_url, object_storage_url 
    FROM nfts 
    WHERE object_storage_url IS NULL 
    AND image_url IS NOT NULL
    ORDER BY title
  ` as NFT[];
  
  console.log(`📊 Found ${nfts.length} NFTs to migrate`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const nft of nfts) {
    try {
      console.log(`📸 Migrating: ${nft.title} (${nft.id})`);
      
      // Extract IPFS hash from URL
      const ipfsHash = nft.image_url.match(/\/ipfs\/([a-zA-Z0-9]+)/)?.[1];
      if (!ipfsHash) {
        console.log(`⚠️ No IPFS hash found in URL: ${nft.image_url}`);
        continue;
      }
      
      // Try multiple IPFS gateways
      const gateways = [
        `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
        `https://ipfs.io/ipfs/${ipfsHash}`,
        `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`,
        `https://dweb.link/ipfs/${ipfsHash}`,
        `https://4everland.io/ipfs/${ipfsHash}`
      ];
      
      let imageBuffer: Buffer | null = null;
      let mimeType = 'image/jpeg';
      
      for (const gateway of gateways) {
        try {
          console.log(`🔄 Trying gateway: ${gateway.substring(0, 50)}...`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          
          const response = await fetch(gateway, { 
            signal: controller.signal,
            headers: { 'User-Agent': 'TravelMint-ImageMigration/1.0' }
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            imageBuffer = Buffer.from(await response.arrayBuffer());
            mimeType = response.headers.get('content-type') || 'image/jpeg';
            console.log(`✅ Downloaded from: ${gateway.split('/')[2]} (${imageBuffer.length} bytes)`);
            break;
          }
        } catch (gatewayError) {
          console.log(`❌ Gateway failed: ${gateway.split('/')[2]}`);
        }
      }
      
      if (!imageBuffer) {
        console.log(`❌ Failed to download image for: ${nft.title}`);
        errorCount++;
        continue;
      }
      
      // Upload to object storage
      const fileName = `${nft.id}-${nft.title.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
      const objectUrl = await objectStorageService.uploadFileBuffer(
        imageBuffer,
        fileName,
        mimeType
      );
      
      // Update database with object storage URL
      await sql`
        UPDATE nfts 
        SET object_storage_url = ${objectUrl}
        WHERE id = ${nft.id}
      `;
      
      console.log(`✅ Migrated: ${nft.title} -> ${objectUrl}`);
      successCount++;
      
      // Small delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`❌ Migration failed for ${nft.title}:`, error);
      errorCount++;
    }
  }
  
  console.log('\n🎯 Migration Summary:');
  console.log(`✅ Success: ${successCount} NFTs`);
  console.log(`❌ Errors: ${errorCount} NFTs`);
  console.log(`📊 Total processed: ${successCount + errorCount} NFTs`);
  
  return { successCount, errorCount };
}

// Auto-migration for newly minted NFTs
export async function migrateNewNFT(nftId: string, imageUrl: string, title: string): Promise<string | null> {
  try {
    console.log(`🔄 Auto-migrating new NFT: ${title} (${nftId})`);
    
    const objectStorageService = new ObjectStorageService();
    
    // Extract IPFS hash and download
    const ipfsHash = imageUrl.match(/\/ipfs\/([a-zA-Z0-9]+)/)?.[1];
    if (!ipfsHash) {
      console.log(`⚠️ No IPFS hash found for new NFT: ${imageUrl}`);
      return null;
    }
    
    // Try first available gateway
    const gateways = [
      `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
      `https://ipfs.io/ipfs/${ipfsHash}`,
      `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`
    ];
    
    for (const gateway of gateways) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch(gateway, { 
          signal: controller.signal,
          headers: { 'User-Agent': 'TravelMint-AutoMigration/1.0' }
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const imageBuffer = Buffer.from(await response.arrayBuffer());
          const mimeType = response.headers.get('content-type') || 'image/jpeg';
          
          // Upload to object storage
          const fileName = `${nftId}-${title.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
          const objectUrl = await objectStorageService.uploadFileBuffer(
            imageBuffer,
            fileName,
            mimeType
          );
          
          // Update database
          await sql`
            UPDATE nfts 
            SET object_storage_url = ${objectUrl}
            WHERE id = ${nftId}
          `;
          
          console.log(`✅ Auto-migrated new NFT: ${title} -> ${objectUrl}`);
          return objectUrl;
        }
      } catch (gatewayError) {
        continue;
      }
    }
    
    console.log(`❌ Auto-migration failed for new NFT: ${title}`);
    return null;
    
  } catch (error) {
    console.error(`❌ Auto-migration error for ${title}:`, error);
    return null;
  }
}

// Manual run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateAllImages()
    .then((result) => {
      console.log('\n🏁 Migration completed!', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}
import { storage } from "./storage";
import { ObjectStorageService } from "./objectStorage";
import type { NFT } from "@shared/schema";

const objectStorageService = new ObjectStorageService();

const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://dweb.link/ipfs/",
  "https://4everland.io/ipfs/",
  "https://gateway.pinata.cloud/ipfs/"
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const DOWNLOAD_TIMEOUT = 30000;
const DELAY_BETWEEN_DOWNLOADS = 500;

function extractIpfsCid(url: string): string | null {
  if (!url) return null;
  
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', '');
  }
  
  const ipfsMatch = url.match(/\/ipfs\/([a-zA-Z0-9]+)/);
  if (ipfsMatch) {
    return ipfsMatch[1];
  }
  
  return null;
}

function getFileExtension(contentType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/avif': 'avif'
  };
  return mimeToExt[contentType] || 'jpg';
}

async function downloadImageWithTimeout(url: string, timeout: number): Promise<{ buffer: Buffer; contentType: string } | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'TravelMint-NFT-Sync/1.0'
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const contentLength = response.headers.get('content-length');
    
    if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
      console.log(`⚠️ Image too large: ${parseInt(contentLength) / 1024 / 1024}MB`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    if (buffer.length > MAX_FILE_SIZE) {
      console.log(`⚠️ Downloaded image too large: ${buffer.length / 1024 / 1024}MB`);
      return null;
    }
    
    return { buffer, contentType };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return null;
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function downloadFromIpfs(cid: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  for (let i = 0; i < IPFS_GATEWAYS.length; i++) {
    const gateway = IPFS_GATEWAYS[i];
    const url = `${gateway}${cid}`;
    
    console.log(`🔗 Trying gateway ${i + 1}/${IPFS_GATEWAYS.length}: ${gateway}`);
    
    const result = await downloadImageWithTimeout(url, DOWNLOAD_TIMEOUT);
    if (result) {
      console.log(`✅ Successfully downloaded from ${gateway}`);
      return result;
    }
  }
  
  return null;
}

async function syncNftImage(nft: NFT, force: boolean = false): Promise<boolean> {
  try {
    // Skip if already cached (unless force=true)
    if (nft.objectStorageUrl && !force) {
      console.log(`⏭️ NFT ${nft.tokenId || nft.id} already cached, skipping`);
      return true;
    }
    
    const imageUrl = nft.imageUrl;
    if (!imageUrl) {
      console.log(`⚠️ NFT ${nft.id} has no imageUrl`);
      return false;
    }
    
    const cid = extractIpfsCid(imageUrl);
    
    let imageData: { buffer: Buffer; contentType: string } | null = null;
    
    if (cid) {
      console.log(`📥 Downloading IPFS image for NFT ${nft.tokenId || nft.id}: ${cid}`);
      imageData = await downloadFromIpfs(cid);
    } else if (imageUrl.startsWith('http')) {
      console.log(`📥 Downloading HTTP image for NFT ${nft.tokenId || nft.id}: ${imageUrl}`);
      imageData = await downloadImageWithTimeout(imageUrl, DOWNLOAD_TIMEOUT);
    }
    
    if (!imageData) {
      console.log(`❌ Failed to download image for NFT ${nft.tokenId || nft.id}`);
      return false;
    }
    
    const extension = getFileExtension(imageData.contentType);
    const fileName = `nft-${nft.tokenId || nft.id}.${extension}`;
    
    console.log(`📤 Uploading to Object Storage: ${fileName} (${(imageData.buffer.length / 1024).toFixed(1)}KB)`);
    
    const objectStorageUrl = await objectStorageService.uploadFileBuffer(
      imageData.buffer,
      fileName,
      imageData.contentType
    );
    
    await storage.updateNFT(nft.id, { objectStorageUrl });
    
    console.log(`✅ NFT ${nft.tokenId || nft.id} synced: ${objectStorageUrl}`);
    return true;
  } catch (error: any) {
    console.error(`❌ Error syncing NFT ${nft.id}:`, error.message);
    return false;
  }
}

export async function syncAllImages(): Promise<{ synced: number; failed: number; skipped: number }> {
  console.log('🔄 Starting NFT image sync...');
  
  const allNfts = await storage.getAllNFTs();
  
  const nftsToSync = allNfts.filter(nft => {
    if (nft.objectStorageUrl) {
      return false;
    }
    if (!nft.imageUrl) {
      return false;
    }
    return true;
  });
  
  console.log(`📊 Found ${nftsToSync.length} NFTs to sync (${allNfts.length} total)`);
  
  let synced = 0;
  let failed = 0;
  let skipped = allNfts.length - nftsToSync.length;
  
  for (let i = 0; i < nftsToSync.length; i++) {
    const nft = nftsToSync[i];
    console.log(`\n[${i + 1}/${nftsToSync.length}] Processing NFT: ${nft.title || nft.tokenId || nft.id}`);
    
    const success = await syncNftImage(nft);
    if (success) {
      synced++;
    } else {
      failed++;
    }
    
    if (i < nftsToSync.length - 1) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_DOWNLOADS));
    }
  }
  
  console.log(`\n✅ Sync complete: ${synced} synced, ${failed} failed, ${skipped} already cached`);
  
  return { synced, failed, skipped };
}

export async function syncSingleImage(nftId: string): Promise<boolean> {
  const nft = await storage.getNFT(nftId);
  if (!nft) {
    console.log(`❌ NFT not found: ${nftId}`);
    return false;
  }
  
  return syncNftImage(nft);
}

export async function getSyncStatus(): Promise<{
  total: number;
  cached: number;
  pending: number;
  percentage: number;
}> {
  const allNfts = await storage.getAllNFTs();
  const cached = allNfts.filter(nft => nft.objectStorageUrl).length;
  const pending = allNfts.length - cached;
  const percentage = allNfts.length > 0 ? Math.round((cached / allNfts.length) * 100) : 0;
  
  return { total: allNfts.length, cached, pending, percentage };
}

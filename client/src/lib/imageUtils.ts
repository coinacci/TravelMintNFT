// Simple image URL utilities
export const MODAL_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='40%25' text-anchor='middle' font-family='Arial' font-size='16' fill='%236b7280'%3ETravel Memory%3C/text%3E%3Ctext x='50%25' y='55%25' text-anchor='middle' font-family='Arial' font-size='12' fill='%239ca3af'%3ELoading...%3C/text%3E%3Ctext x='50%25' y='70%25' text-anchor='middle' font-family='Arial' font-size='10' fill='%23d1d5db'%3E🌍 TravelMint%3C/text%3E%3C/svg%3E";

/**
 * Convert Pinata gateway URLs to ipfs.io (more reliable)
 */
function fixIPFSUrl(url: string): string {
  if (url.includes('gateway.pinata.cloud')) {
    return url.replace('gateway.pinata.cloud', 'ipfs.io');
  }
  return url;
}

/**
 * Get best image URL - priority: Object Storage > IPFS with format check
 */
export function getBestImageUrl(nft: { 
  objectStorageUrl?: string; 
  imageUrl: string; 
}): string {
  // Current domain for object storage
  const domain = typeof window !== 'undefined' ? window.location.origin : '';
  
  // 1. Object Storage URL (preferred - always JPG format)
  if (nft.objectStorageUrl) {
    // If relative, make absolute
    if (nft.objectStorageUrl.startsWith('/')) {
      return `${domain}${nft.objectStorageUrl}`;
    }
    return nft.objectStorageUrl;
  }
  
  // 2. IPFS fallback with reliable gateway
  const ipfsUrl = fixIPFSUrl(nft.imageUrl);
  
  // Debug: Log all image URL processing
  console.log(`🖼️ Image processing for NFT:`, {
    title: (nft as any).title || 'Unknown',
    objectStorageUrl: nft.objectStorageUrl,
    originalImageUrl: nft.imageUrl,
    processedIpfsUrl: ipfsUrl
  });
  
  // 3. If IPFS URL might be HEIC (unsupported), return placeholder directly
  // HEIC detection: Common IPFS hash patterns that typically contain HEIC
  const isHEIC = ipfsUrl && (
    ipfsUrl.includes('/QmRrsiPvf36enpvBBhDY1GfRtbUSD5Cw9QkYGfy6wJficE') ||
    ipfsUrl.includes('/QmduukpbfkT5YkiMcRgHabwdR5wcCwFJWLymowP6nhPcWJ') ||
    ipfsUrl.toLowerCase().includes('heic') ||
    ipfsUrl.toLowerCase().includes('heif')
  );
  
  if (isHEIC) {
    console.log(`⚠️ HEIC DETECTED - Skipping potentially HEIC image: ${ipfsUrl.substring(0, 80)}...`);
    return MODAL_PLACEHOLDER;
  }
  
  return ipfsUrl || MODAL_PLACEHOLDER;
}
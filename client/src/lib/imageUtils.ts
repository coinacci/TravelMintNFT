// Simple image URL utilities
export const MODAL_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='40%25' text-anchor='middle' font-family='Arial' font-size='16' fill='%236b7280'%3ETravel Memory%3C/text%3E%3Ctext x='50%25' y='55%25' text-anchor='middle' font-family='Arial' font-size='12' fill='%239ca3af'%3ELoading...%3C/text%3E%3Ctext x='50%25' y='70%25' text-anchor='middle' font-family='Arial' font-size='10' fill='%23d1d5db'%3E🌍 TravelMint%3C/text%3E%3C/svg%3E";

/**
 * Get best image URL - simple priority: Object Storage first, then IPFS
 */
export function getBestImageUrl(nft: { 
  objectStorageUrl?: string; 
  imageUrl: string; 
}): string {
  // Current domain for object storage
  const domain = typeof window !== 'undefined' ? window.location.origin : '';
  
  // 1. Object Storage URL (preferred)
  if (nft.objectStorageUrl) {
    // If relative, make absolute
    if (nft.objectStorageUrl.startsWith('/')) {
      return `${domain}${nft.objectStorageUrl}`;
    }
    return nft.objectStorageUrl;
  }
  
  // 2. IPFS fallback
  return nft.imageUrl || MODAL_PLACEHOLDER;
}
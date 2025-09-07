// Image URL utility functions for NFT display
export const MODAL_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='40%25' text-anchor='middle' font-family='Arial' font-size='16' fill='%236b7280'%3ETravel Memory%3C/text%3E%3Ctext x='50%25' y='55%25' text-anchor='middle' font-family='Arial' font-size='12' fill='%239ca3af'%3ELoading...%3C/text%3E%3Ctext x='50%25' y='70%25' text-anchor='middle' font-family='Arial' font-size='10' fill='%23d1d5db'%3E🌍 TravelMint%3C/text%3E%3C/svg%3E";

/**
 * Gets the current domain for absolute URL conversion
 */
function getCurrentDomain(): string {
  if (typeof window === 'undefined') return '';
  
  const { hostname, protocol, port } = window.location;
  
  // Use current domain with proper protocol
  if (port && port !== '80' && port !== '443') {
    return `${protocol}//${hostname}:${port}`;
  }
  return `${protocol}//${hostname}`;
}

/**
 * Converts relative object storage URLs to absolute URLs
 */
export function makeAbsoluteUrl(url: string): string {
  if (!url) return url;
  
  // Already absolute URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Relative URL - convert to absolute
  if (url.startsWith('/')) {
    const domain = getCurrentDomain();
    return `${domain}${url}`;
  }
  
  return url;
}

/**
 * Get prioritized image URLs for NFT display
 * Returns object storage URL first (if available), then IPFS fallback
 */
export function getImageUrls(nft: { 
  objectStorageUrl?: string; 
  imageUrl: string; 
}): string[] {
  const urls: string[] = [];
  
  // 1. Object Storage URL (preferred) - convert to absolute
  if (nft.objectStorageUrl) {
    urls.push(makeAbsoluteUrl(nft.objectStorageUrl));
  }
  
  // 2. IPFS URL as fallback
  if (nft.imageUrl && !urls.includes(nft.imageUrl)) {
    urls.push(nft.imageUrl);
  }
  
  return urls;
}

/**
 * Get the best image URL (first working URL from prioritized list)
 */
export function getBestImageUrl(nft: { 
  objectStorageUrl?: string; 
  imageUrl: string; 
}): string {
  const urls = getImageUrls(nft);
  return urls[0] || MODAL_PLACEHOLDER;
}
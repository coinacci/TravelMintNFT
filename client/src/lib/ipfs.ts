// Client-side IPFS utilities for TravelMint
import { createIPFSUrl, type IPFSUploadResponse, type NFTMetadata } from '@shared/ipfs';

// List of reliable IPFS gateways in order of preference
const IPFS_GATEWAYS = [
  'https://nftstorage.link/ipfs',
  'https://ipfs.io/ipfs',
  'https://cloudflare-ipfs.com/ipfs',
  'https://gateway.pinata.cloud/ipfs',
];

/**
 * Extract IPFS hash from various IPFS URL formats
 */
export function extractIpfsHash(url: string): string | null {
  if (!url) return null;

  // Handle ipfs:// protocol
  if (url.startsWith('ipfs://')) {
    const hash = url.replace('ipfs://', '').replace('ipfs/', '');
    return hash;
  }

  // Handle HTTP gateway URLs
  const ipfsPattern = /\/ipfs\/([a-zA-Z0-9]+)/;
  const match = url.match(ipfsPattern);
  if (match && match[1]) {
    return match[1];
  }

  // If it's already a valid HTTP URL without IPFS, return null
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return null;
  }

  // Assume it's a bare hash
  if (/^[a-zA-Z0-9]+$/.test(url)) {
    return url;
  }

  return null;
}

/**
 * Convert any IPFS URL format to a reliable HTTP gateway URL
 */
export function normalizeIpfsUrl(url: string, gatewayIndex: number = 0): string {
  if (!url) return url;

  // If it's already a regular HTTP/HTTPS URL and not IPFS, return as is
  if ((url.startsWith('http://') || url.startsWith('https://')) && !url.includes('/ipfs/') && !url.startsWith('ipfs://')) {
    return url;
  }

  const hash = extractIpfsHash(url);
  if (!hash) return url;

  // Use the specified gateway (for fallback)
  const gateway = IPFS_GATEWAYS[gatewayIndex] || IPFS_GATEWAYS[0];
  return `${gateway}/${hash}`;
}

/**
 * Get all possible gateway URLs for an IPFS resource
 */
export function getAllIpfsGatewayUrls(url: string): string[] {
  const hash = extractIpfsHash(url);
  if (!hash) return [url];

  return IPFS_GATEWAYS.map(gateway => `${gateway}/${hash}`);
}

/**
 * Check if a URL is an IPFS URL
 */
export function isIpfsUrl(url: string): boolean {
  if (!url) return false;
  return url.startsWith('ipfs://') || url.includes('/ipfs/');
}

export class IPFSClient {
  
  // Upload image file to IPFS via backend API
  async uploadImage(file: File): Promise<string> {
    try {
      console.log('📤 Uploading image to IPFS:', file.name, file.size, 'bytes');
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);
      formData.append('mimeType', file.type);

      const response = await fetch('/api/ipfs/upload-image', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const result: IPFSUploadResponse = await response.json();
      const ipfsUrl = createIPFSUrl(result.IpfsHash);
      
      console.log('✅ Image uploaded to IPFS:', ipfsUrl);
      return ipfsUrl;
    } catch (error) {
      console.error('❌ Error uploading image to IPFS:', error);
      throw error;
    }
  }

  // Upload metadata to IPFS via backend API
  async uploadMetadata(metadata: NFTMetadata): Promise<string> {
    try {
      console.log('📤 Uploading metadata to IPFS:', metadata.name);
      
      const response = await fetch('/api/ipfs/upload-metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ metadata, name: `${metadata.name}_metadata` })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Metadata upload failed: ${response.status} - ${errorText}`);
      }

      const result: IPFSUploadResponse = await response.json();
      const ipfsUrl = createIPFSUrl(result.IpfsHash);
      
      console.log('✅ Metadata uploaded to IPFS:', ipfsUrl);
      return ipfsUrl;
    } catch (error) {
      console.error('❌ Error uploading metadata to IPFS:', error);
      throw error;
    }
  }

  // Convert File to base64 for preview
  fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }

  // Test IPFS connectivity
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch('/api/ipfs/test');
      return response.ok;
    } catch (error) {
      console.error('❌ IPFS connection test failed:', error);
      return false;
    }
  }
}

export const ipfsClient = new IPFSClient();
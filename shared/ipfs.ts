// IPFS utilities for TravelMint
// Shared between client and server

export interface IPFSUploadResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

export interface NFTMetadata {
  name: string;
  description: string;
  image: string; // IPFS URL
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
  external_url?: string;
  location?: {
    city: string;
    latitude: string;
    longitude: string;
  };
}

export function createNFTMetadata(params: {
  title: string;
  description: string;
  imageIpfsUrl: string;
  category: string;
  location: {
    city: string;
    latitude: string;
    longitude: string;
  };
}): NFTMetadata {
  return {
    name: params.title,
    description: params.description || "Travel NFT minted on TravelMint",
    image: params.imageIpfsUrl,
    attributes: [
      { trait_type: "Category", value: params.category },
      { trait_type: "Location", value: params.location.city },
      { trait_type: "Latitude", value: params.location.latitude },
      { trait_type: "Longitude", value: params.location.longitude },
      { trait_type: "Minted Date", value: new Date().toISOString() },
      { trait_type: "Platform", value: "TravelMint" }
    ],
    external_url: "https://travelmint.app",
    location: params.location
  };
}

export function createIPFSUrl(hash: string): string {
  return `https://gateway.pinata.cloud/ipfs/${hash}`;
}

export function extractIPFSHash(ipfsUrl: string): string {
  // Extract hash from various IPFS URL formats
  if (ipfsUrl.includes('gateway.pinata.cloud/ipfs/')) {
    return ipfsUrl.split('gateway.pinata.cloud/ipfs/')[1];
  }
  if (ipfsUrl.includes('ipfs://')) {
    return ipfsUrl.replace('ipfs://', '');
  }
  if (ipfsUrl.startsWith('Qm') || ipfsUrl.startsWith('baf')) {
    return ipfsUrl;
  }
  throw new Error('Invalid IPFS URL format');
}
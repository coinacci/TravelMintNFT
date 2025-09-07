import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Mock NFT data for now
  const mockNFTs = [
    {
      id: "blockchain-41",
      title: "Georgia Moments",
      description: "Beautiful travel photo from Georgia",
      imageUrl: "https://ipfs.io/ipfs/bafybeielklb5tsiy447vofhcab2znxeadbog3alpwiwivbamvvprdfhxqa",
      location: "Tiflis, Georgia",
      price: "5",
      isForSale: 1,
      creator: { username: "traveler1" },
      owner: { username: "owner1" }
    }
  ];
  
  res.status(200).json(mockNFTs);
}
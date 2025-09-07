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
  
  // Mock data for now since we don't have the full database setup in Vercel yet
  const mockStats = {
    totalNFTs: 39,
    totalVolume: "3049.0",
    totalHolders: 25,
    avgPrice: "78.2"
  };
  
  res.status(200).json(mockStats);
}
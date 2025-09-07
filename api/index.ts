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
  
  // API router for Vercel
  const { url } = req;
  
  // Route to specific handlers
  if (url?.includes('/health')) {
    return res.status(200).json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      message: 'TravelMint API Main Handler'
    });
  }
  
  if (url?.includes('/stats')) {
    return res.status(200).json({
      totalNFTs: 39,
      totalVolume: "3049.0", 
      totalHolders: 25
    });
  }
  
  if (url?.includes('/nfts')) {
    return res.status(200).json([]);
  }
  
  // Default response
  res.status(200).json({ 
    message: 'TravelMint API',
    path: url,
    availableEndpoints: ['/api/health', '/api/stats', '/api/nfts']
  });
}
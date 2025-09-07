import type { VercelRequest, VercelResponse } from '@vercel/node';

// This will be the main entry point for Vercel serverless functions
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Health check endpoint
  if (req.url === '/api/health') {
    res.status(200).json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      message: 'TravelMint API is running on Vercel'
    });
    return;
  }
  
  // For now, return a simple response
  // You'll need to adapt your existing routes for Vercel's serverless structure
  res.status(200).json({ 
    message: 'TravelMint API',
    path: req.url,
    method: req.method 
  });
}
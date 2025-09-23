// IPFS API routes for TravelMint
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { nftStorageService } from '../ipfs';
import { createIPFSUrl, type NFTMetadata } from '@shared/ipfs';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Upload image to IPFS
router.post('/upload-image', upload.single('file'), async (req: Request & { file?: Express.Multer.File }, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    console.log('📤 Uploading image to IPFS via NFT.Storage:', req.file.originalname);

    const result = await nftStorageService.uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    console.log('✅ Image uploaded successfully:', result.IpfsHash);

    res.json({
      IpfsHash: result.IpfsHash,
      PinSize: result.PinSize,
      Timestamp: result.Timestamp,
      ipfsUrl: createIPFSUrl(result.IpfsHash)
    });

  } catch (error) {
    console.error('❌ Error uploading image:', error);
    res.status(500).json({ 
      error: 'Failed to upload image to IPFS',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Upload metadata to IPFS
router.post('/upload-metadata', async (req: Request, res: Response) => {
  try {
    const { metadata, name } = req.body;

    if (!metadata) {
      return res.status(400).json({ error: 'No metadata provided' });
    }

    console.log('📤 Uploading metadata to IPFS via NFT.Storage:', name);

    const result = await nftStorageService.uploadJSON(metadata as NFTMetadata, name);

    console.log('✅ Metadata uploaded successfully:', result.IpfsHash);

    res.json({
      IpfsHash: result.IpfsHash,
      PinSize: result.PinSize,
      Timestamp: result.Timestamp,
      ipfsUrl: createIPFSUrl(result.IpfsHash)
    });

  } catch (error) {
    console.error('❌ Error uploading metadata:', error);
    res.status(500).json({ 
      error: 'Failed to upload metadata to IPFS',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test NFT.Storage connection
router.get('/test', async (req: Request, res: Response) => {
  try {
    console.log('🔗 Testing NFT.Storage connection...');
    
    const isConnected = await nftStorageService.testConnection();
    
    if (isConnected) {
      console.log('✅ NFT.Storage connection successful');
      res.json({ 
        status: 'connected',
        message: 'NFT.Storage IPFS service is working correctly'
      });
    } else {
      console.log('❌ NFT.Storage connection failed');
      res.status(500).json({ 
        status: 'error',
        message: 'Failed to connect to NFT.Storage IPFS service'
      });
    }

  } catch (error) {
    console.error('❌ Error testing NFT.Storage connection:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error testing IPFS connection',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get file info from IPFS hash
router.get('/info/:hash', async (req: Request, res: Response) => {
  try {
    const { hash } = req.params;
    
    console.log('📋 Getting IPFS file info for hash:', hash);
    
    // Temporary: Return basic info since getFileInfo method is not implemented
    const fileInfo = { hash, message: 'File info retrieval not yet implemented' };
    
    if (fileInfo) {
      res.json(fileInfo);
    } else {
      res.status(404).json({ error: 'File not found' });
    }

  } catch (error) {
    console.error('❌ Error getting file info:', error);
    res.status(500).json({ 
      error: 'Failed to get file info',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
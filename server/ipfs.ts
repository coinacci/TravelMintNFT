// Server-side IPFS utilities using NFT.Storage
import { NFTStorage, File } from 'nft.storage';
import { IPFSUploadResponse, NFTMetadata } from '@shared/ipfs';

export class NFTStorageService {
  private client: NFTStorage;

  constructor() {
    if (!process.env.NFT_STORAGE_API_KEY) {
      throw new Error('NFT_STORAGE_API_KEY environment variable is required');
    }
    
    // Initialize NFT.Storage client
    this.client = new NFTStorage({
      token: process.env.NFT_STORAGE_API_KEY
    });
    
    console.log('🔗 NFT.Storage client initialized');
  }

  // Upload file buffer to IPFS via NFT.Storage
  async uploadFile(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<IPFSUploadResponse> {
    try {
      // Create File object from buffer
      const file = new File([fileBuffer], fileName, { type: mimeType });
      
      // Upload file using NFT.Storage
      const cid = await this.client.storeBlob(file);
      
      console.log('✅ File uploaded to IPFS via NFT.Storage:', cid);
      
      // Return in expected format
      return {
        IpfsHash: cid,
        PinSize: fileBuffer.length,
        Timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error uploading file to IPFS:', error);
      throw error;
    }
  }

  // Upload JSON metadata to IPFS via NFT.Storage
  async uploadJSON(data: NFTMetadata, name: string): Promise<IPFSUploadResponse> {
    try {
      // Convert metadata to JSON string and create blob
      const jsonString = JSON.stringify(data);
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      // Upload JSON using NFT.Storage
      const cid = await this.client.storeBlob(blob);
      
      console.log('✅ Metadata uploaded to IPFS via NFT.Storage:', cid);
      
      // Return in expected format  
      return {
        IpfsHash: cid,
        PinSize: jsonString.length,
        Timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error uploading JSON to IPFS:', error);
      throw error;
    }
  }

  // Get optimized URL for IPFS content
  async getOptimizedUrl(ipfsHash: string): Promise<string> {
    try {
      // NFT.Storage uses IPFS.io gateway by default
      const url = `https://ipfs.io/ipfs/${ipfsHash}`;
      console.log('🌐 Using IPFS.io gateway URL:', url);
      return url;
    } catch (error) {
      console.error('❌ Error getting optimized URL, using fallback:', error);
      // Fallback to NFT.Storage gateway
      return `https://nftstorage.link/ipfs/${ipfsHash}`;
    }
  }

  // Test NFT.Storage connection
  async testConnection(): Promise<boolean> {
    try {
      // Simple test by creating a small blob and checking if we can store it
      const testBlob = new Blob(['test'], { type: 'text/plain' });
      const cid = await this.client.storeBlob(testBlob);
      console.log('🔗 NFT.Storage connection test successful:', cid);
      return true;
    } catch (error) {
      console.error('❌ NFT.Storage connection test failed:', error);
      return false;
    }
  }
}

export const nftStorageService = new NFTStorageService();
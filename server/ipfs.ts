// Server-side IPFS utilities using new Pinata SDK
import { PinataSDK } from 'pinata';
import { IPFSUploadResponse, NFTMetadata } from '@shared/ipfs';

export class PinataService {
  private pinata: PinataSDK;
  private gateway: string | null;

  constructor() {
    if (!process.env.PINATA_JWT) {
      throw new Error('PINATA_JWT environment variable is required');
    }
    
    // Initialize with new SDK
    this.pinata = new PinataSDK({
      pinataJwt: process.env.PINATA_JWT,
      pinataGateway: process.env.PINATA_GATEWAY || undefined
    });
    
    this.gateway = process.env.PINATA_GATEWAY || null;
    
    console.log('🔗 Pinata SDK initialized with', this.gateway ? 'dedicated gateway' : 'public gateway');
  }

  // Upload file buffer to IPFS via Pinata SDK
  async uploadFile(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<IPFSUploadResponse> {
    try {
      // Create File object from buffer
      const file = new File([fileBuffer], fileName, { type: mimeType });
      
      // Upload with metadata using correct API
      const upload = await this.pinata.upload.public.file(file);
      
      console.log('✅ File uploaded to IPFS via new SDK:', upload.IpfsHash);
      
      // Return in expected format
      return {
        IpfsHash: upload.cid,
        PinSize: upload.size,
        Timestamp: upload.created_at
      };
    } catch (error) {
      console.error('❌ Error uploading file to IPFS:', error);
      throw error;
    }
  }

  // Upload JSON metadata to IPFS via Pinata SDK
  async uploadJSON(data: NFTMetadata, name: string): Promise<IPFSUploadResponse> {
    try {
      // Upload JSON with metadata using correct API
      const upload = await this.pinata.upload.public.json(data);
      
      console.log('✅ Metadata uploaded to IPFS via new SDK:', upload.IpfsHash);
      
      // Return in expected format  
      return {
        IpfsHash: upload.cid,
        PinSize: upload.size,
        Timestamp: upload.created_at
      };
    } catch (error) {
      console.error('❌ Error uploading JSON to IPFS:', error);
      throw error;
    }
  }

  // Get optimized URL for IPFS content
  async getOptimizedUrl(ipfsHash: string): Promise<string> {
    try {
      if (this.gateway) {
        // Use dedicated gateway for faster access
        const url = `https://${this.gateway}/ipfs/${ipfsHash}`;
        console.log('🚀 Using dedicated gateway URL:', url);
        return url;
      } else {
        // Fallback to public gateway
        const url = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
        console.log('🌐 Using public gateway URL:', url);
        return url;
      }
    } catch (error) {
      console.error('❌ Error getting optimized URL:', error);
      // Fallback to public gateway
      return `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
    }
  }

  // Test Pinata connection using new SDK
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.pinata.testAuthentication();
      console.log('🔗 Pinata connection test:', result);
      return true;
    } catch (error) {
      console.error('❌ Pinata connection test failed:', error);
      return false;
    }
  }
}

export const pinataService = new PinataService();
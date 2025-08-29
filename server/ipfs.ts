// Server-side IPFS utilities using Pinata
import { IPFSUploadResponse, NFTMetadata } from '@shared/ipfs';

const PINATA_API_URL = 'https://api.pinata.cloud';

export class PinataService {
  private jwt: string;

  constructor() {
    if (!process.env.PINATA_JWT) {
      throw new Error('PINATA_JWT environment variable is required');
    }
    this.jwt = process.env.PINATA_JWT;
  }

  // Upload file buffer to IPFS via Pinata
  async uploadFile(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<IPFSUploadResponse> {
    try {
      const formData = new FormData();
      
      // Create blob from buffer
      const blob = new Blob([fileBuffer], { type: mimeType });
      formData.append('file', blob, fileName);
      
      // Optional: Add metadata
      const metadata = JSON.stringify({
        name: fileName,
        keyvalues: {
          uploaded_by: 'TravelMint',
          file_type: 'travel_photo'
        }
      });
      formData.append('pinataMetadata', metadata);
      
      const response = await fetch(`${PINATA_API_URL}/pinning/pinFileToIPFS`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.jwt}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pinata upload failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ File uploaded to IPFS:', result.IpfsHash);
      
      return result;
    } catch (error) {
      console.error('❌ Error uploading file to IPFS:', error);
      throw error;
    }
  }

  // Upload JSON metadata to IPFS via Pinata
  async uploadJSON(data: NFTMetadata, name: string): Promise<IPFSUploadResponse> {
    try {
      const pinataContent = {
        pinataContent: data,
        pinataMetadata: {
          name: name,
          keyvalues: {
            uploaded_by: 'TravelMint',
            content_type: 'nft_metadata',
            nft_name: data.name
          }
        }
      };

      const response = await fetch(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.jwt}`
        },
        body: JSON.stringify(pinataContent)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pinata JSON upload failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Metadata uploaded to IPFS:', result.IpfsHash);
      
      return result;
    } catch (error) {
      console.error('❌ Error uploading JSON to IPFS:', error);
      throw error;
    }
  }

  // Get file info from IPFS hash
  async getFileInfo(ipfsHash: string) {
    try {
      const response = await fetch(`${PINATA_API_URL}/data/pinList?hashContains=${ipfsHash}`, {
        headers: {
          'Authorization': `Bearer ${this.jwt}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get file info: ${response.status}`);
      }

      const result = await response.json();
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Error getting file info:', error);
      throw error;
    }
  }

  // Test Pinata connection
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${PINATA_API_URL}/data/testAuthentication`, {
        headers: {
          'Authorization': `Bearer ${this.jwt}`
        }
      });

      const result = await response.json();
      console.log('🔗 Pinata connection test:', result.message);
      return response.ok;
    } catch (error) {
      console.error('❌ Pinata connection test failed:', error);
      return false;
    }
  }
}

export const pinataService = new PinataService();
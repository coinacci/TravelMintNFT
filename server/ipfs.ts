import { IPFSUploadResponse, NFTMetadata } from '@shared/ipfs';

export class NFTStorageService {
  private pinataJwt: string;

  constructor() {
    if (!process.env.PINATA_JWT) {
      throw new Error('PINATA_JWT environment variable is required');
    }
    this.pinataJwt = process.env.PINATA_JWT;
    console.log('Pinata V3 client initialized');
  }

  async uploadFile(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<IPFSUploadResponse> {
    try {
      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: mimeType });
      formData.append('file', blob, fileName);

      const response = await fetch('https://uploads.pinata.cloud/v3/files', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.pinataJwt}` },
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Pinata upload failed: ${response.statusText} - ${errText}`);
      }

      const data = await response.json();
      const cid = data.data?.cid || data.IpfsHash;
      console.log('File uploaded to IPFS via Pinata V3:', cid);

      return {
        IpfsHash: cid,
        PinSize: fileBuffer.length,
        Timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error uploading file to IPFS:', error);
      throw error;
    }
  }

  async uploadJSON(data: NFTMetadata, name: string): Promise<IPFSUploadResponse> {
    try {
      const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.pinataJwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pinataContent: data,
          pinataMetadata: { name },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Pinata JSON upload failed: ${response.statusText} - ${errText}`);
      }

      const result = await response.json();
      console.log('Metadata uploaded to IPFS via Pinata:', result.IpfsHash);

      return {
        IpfsHash: result.IpfsHash,
        PinSize: JSON.stringify(data).length,
        Timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error uploading JSON to IPFS:', error);
      throw error;
    }
  }

  async getOptimizedUrl(ipfsHash: string): Promise<string> {
    return `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch('https://api.pinata.cloud/data/testAuthentication', {
        headers: { 'Authorization': `Bearer ${this.pinataJwt}` },
      });
      return response.ok;
    } catch (error) {
      console.error('Pinata connection test failed:', error);
      return false;
    }
  }
}

export const nftStorageService = new NFTStorageService();

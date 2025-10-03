// Client-side IPFS utilities for TravelMint
import { createIPFSUrl, type IPFSUploadResponse, type NFTMetadata } from '@shared/ipfs';

export class IPFSClient {
  
  // Upload image file to IPFS via backend API
  async uploadImage(file: File): Promise<string> {
    try {
      console.log('📤 Uploading image to IPFS:', file.name, file.size, 'bytes');
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);
      formData.append('mimeType', file.type);

      const response = await fetch('/api/ipfs/upload-image', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const result: IPFSUploadResponse = await response.json();
      const ipfsUrl = createIPFSUrl(result.IpfsHash);
      
      console.log('✅ Image uploaded to IPFS:', ipfsUrl);
      return ipfsUrl;
    } catch (error) {
      console.error('❌ Error uploading image to IPFS:', error);
      throw error;
    }
  }

  // Upload metadata to IPFS via backend API
  async uploadMetadata(metadata: NFTMetadata): Promise<string> {
    try {
      console.log('📤 Uploading metadata to IPFS:', metadata.name);
      
      const response = await fetch('/api/ipfs/upload-metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ metadata, name: `${metadata.name}_metadata` })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Metadata upload failed: ${response.status} - ${errorText}`);
      }

      const result: IPFSUploadResponse = await response.json();
      const ipfsUrl = createIPFSUrl(result.IpfsHash);
      
      console.log('✅ Metadata uploaded to IPFS:', ipfsUrl);
      return ipfsUrl;
    } catch (error) {
      console.error('❌ Error uploading metadata to IPFS:', error);
      throw error;
    }
  }

  // Convert File to base64 for preview
  fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }

  // Test IPFS connectivity
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch('/api/ipfs/test');
      return response.ok;
    } catch (error) {
      console.error('❌ IPFS connection test failed:', error);
      return false;
    }
  }
}

export const ipfsClient = new IPFSClient();
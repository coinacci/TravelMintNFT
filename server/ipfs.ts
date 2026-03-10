import { IPFSUploadResponse, NFTMetadata } from '@shared/ipfs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

const filebaseClient = new S3Client({
  region: 'us-east-1',
  endpoint: 'https://s3.filebase.com',
  credentials: {
    accessKeyId: process.env.FILEBASE_ACCESS_KEY || '',
    secretAccessKey: process.env.FILEBASE_SECRET_KEY || '',
  },
});

const FILEBASE_BUCKET = process.env.FILEBASE_BUCKET || 'travelmint';

export class NFTStorageService {
  async uploadFile(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<IPFSUploadResponse> {
    try {
      const key = `uploads/${randomUUID()}-${fileName}`;
      
      const command = new PutObjectCommand({
        Bucket: FILEBASE_BUCKET,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
      });

      const response = await filebaseClient.send(command);
      const cid = (response as any).$metadata?.httpHeaders?.['x-amz-meta-cid'] || 
                  (response as any).ETag?.replace(/"/g, '');
      
      console.log('File uploaded to IPFS via Filebase:', key);

      return {
        IpfsHash: cid || key,
        PinSize: fileBuffer.length,
        Timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error uploading file to Filebase:', error);
      throw error;
    }
  }

  async uploadJSON(data: NFTMetadata, name: string): Promise<IPFSUploadResponse> {
    try {
      const key = `metadata/${randomUUID()}-${name}.json`;
      const jsonString = JSON.stringify(data);
      
      const command = new PutObjectCommand({
        Bucket: FILEBASE_BUCKET,
        Key: key,
        Body: Buffer.from(jsonString),
        ContentType: 'application/json',
      });

      const response = await filebaseClient.send(command);
      const cid = (response as any).$metadata?.httpHeaders?.['x-amz-meta-cid'] || 
                  (response as any).ETag?.replace(/"/g, '');

      console.log('Metadata uploaded to IPFS via Filebase:', key);

      return {
        IpfsHash: cid || key,
        PinSize: jsonString.length,
        Timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error uploading JSON to Filebase:', error);
      throw error;
    }
  }

  async getOptimizedUrl(ipfsHash: string): Promise<string> {
    return `https://ipfs.filebase.io/ipfs/${ipfsHash}`;
  }

  async testConnection(): Promise<boolean> {
    try {
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      await filebaseClient.send(new ListObjectsV2Command({ Bucket: FILEBASE_BUCKET, MaxKeys: 1 }));
      return true;
    } catch (error) {
      console.error('Filebase connection test failed:', error);
      return false;
    }
  }
}

export const nftStorageService = new NFTStorageService();

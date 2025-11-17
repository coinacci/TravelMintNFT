import { storage } from './server/storage.js';

const tokensToAdd = [
  { tokenId: '275', owner: '0xF71Fa5918Db043048B25ccaf1603fDDA7C84080b', txHash: '0x98cd6afd0f115c35a9ff07205eeb5224ae16b02de84e7c907158573fe722795c' },
  { tokenId: '276', owner: '0x5F6F7612a682f0423Fd13CA66919c84A5C1cB952', txHash: '0x0e98c93d38c7847072c00353f8c29d1a06e7de5634e4dd76b6df85c89b7a7464' },
  { tokenId: '277', owner: '0x1ce2af6f886b353c21cce43e3b02a93e13e0f740', txHash: '0xeb76d5680f52a5c0464401cb08b7f5cf3f1d28ee0487c8a908ac49dc38dabf45' },
  { tokenId: '278', owner: '0x6F88C00e62BD868630E4536D7D829A614443951E', txHash: '0x94614d3e1bc82608f2d4d28348ce3a35a3e7834377f6167ebdc6ebfc10b937f2' },
  { tokenId: '279', owner: '0x88B8E5606A99dcE34753B2f4668E51fc05E62A28', txHash: '0x9b34e4c9c600c9a860ebb9253fbef9667341c6b87978826ecde4ccd7d14c30e3' },
  { tokenId: '280', owner: '0x6edd22E9792132614dd487ac6434dec3709b79A8', txHash: '0x3090c1df636399d47a0e27300a5f2032eb512ee8074712c260ab785028d461ec' }
];

async function addPendingTokens() {
  console.log(`💾 Adding ${tokensToAdd.length} tokens to pending_mints queue...\n`);
  
  for (const token of tokensToAdd) {
    try {
      // Check if already in database
      const existing = await storage.getNFTByTokenId(token.tokenId);
      if (existing) {
        console.log(`⚠️ Token #${token.tokenId} already exists in NFT database - skipping`);
        continue;
      }
      
      // Add to pending queue
      await storage.createPendingMint({
        tokenId: token.tokenId,
        contractAddress: '0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f',
        ownerAddress: token.owner.toLowerCase(),
        transactionHash: token.txHash,
        retryCount: 0,
        lastError: 'tokenURI() reverted - metadata not available yet',
        lastAttemptAt: new Date()
      });
      
      console.log(`✅ Token #${token.tokenId} added to pending queue (owner: ${token.owner.substring(0, 10)}...)`);
      
    } catch (error: any) {
      console.error(`❌ Failed to add token #${token.tokenId}:`, error.message);
    }
  }
  
  console.log('\n📊 Summary:');
  const pending = await storage.getPendingMints();
  console.log(`   Total pending mints: ${pending.length}`);
  console.log(`   Will be retried automatically every 2 minutes by metadata sync service`);
  
  process.exit(0);
}

addPendingTokens();

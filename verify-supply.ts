import { getNftContract } from './server/blockchain.js';

async function verifySupply() {
  try {
    const contract = await getNftContract();
    
    // Try different methods to get total supply
    console.log('🔍 Checking on-chain NFT count...\n');
    
    // Method 1: Try calling a potential totalSupply() function
    try {
      const totalSupply = await contract.totalSupply();
      console.log(`✅ totalSupply() = ${totalSupply.toString()}`);
    } catch (e) {
      console.log('ℹ️ Contract does not have totalSupply() function');
    }
    
    // Method 2: Try getting token 279 and 280
    console.log('\n📝 Testing token existence:');
    
    for (const tokenId of [278, 279, 280, 281]) {
      try {
        const owner = await contract.ownerOf(tokenId);
        console.log(`✅ Token #${tokenId} exists, owner: ${owner.substring(0, 10)}...`);
      } catch (e) {
        console.log(`❌ Token #${tokenId} does NOT exist (contract reverts)`);
      }
    }
    
    console.log('\n🎯 Conclusion: Highest existing token ID can be determined by testing');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
}

verifySupply();

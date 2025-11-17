import { JsonRpcProvider, Contract } from 'ethers';

const RPC_URL = 'https://mainnet.base.org';
const CONTRACT_ADDRESS = '0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f';

const NFT_ABI = [
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function totalSupply() view returns (uint256)'
];

async function fetchToken280() {
  console.log('🔍 Fetching Token 280 metadata...');
  
  const provider = new JsonRpcProvider(RPC_URL);
  const contract = new Contract(CONTRACT_ADDRESS, NFT_ABI, provider);
  
  try {
    const totalSupply = await contract.totalSupply();
    console.log(`📊 Total Supply on blockchain: ${totalSupply.toString()}`);
    
    const tokenURI = await contract.tokenURI(280);
    console.log(`📝 Token 280 URI length: ${tokenURI.length}`);
    
    if (tokenURI.startsWith('data:application/json;base64,')) {
      const base64Data = tokenURI.replace('data:application/json;base64,', '');
      const jsonString = Buffer.from(base64Data, 'base64').toString('utf-8');
      const metadata = JSON.parse(jsonString);
      
      console.log('\n✅ Token 280 Metadata:');
      console.log(JSON.stringify(metadata, null, 2));
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

fetchToken280();

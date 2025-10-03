import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
const contractAddress = '0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f';
const tokenId = 169;

const abi = [
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)'
];

const contract = new ethers.Contract(contractAddress, abi, provider);

try {
  const [tokenURI, owner] = await Promise.all([
    contract.tokenURI(tokenId),
    contract.ownerOf(tokenId)
  ]);
  
  console.log(JSON.stringify({ tokenId, tokenURI, owner }, null, 2));
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}

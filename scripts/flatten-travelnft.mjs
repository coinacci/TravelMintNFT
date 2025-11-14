import fs from 'fs';
import path from 'path';

// Read OpenZeppelin contracts from node_modules
const ozPath = 'node_modules/@openzeppelin/contracts';

// Helper to read file and remove SPDX license (we'll add one at the top)
function readContract(relativePath) {
  const fullPath = path.join(ozPath, relativePath);
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Remove SPDX license identifier
  content = content.replace(/\/\/ SPDX-License-Identifier: MIT\n/g, '');
  
  // Remove pragma statements (we'll add one at the top)
  content = content.replace(/pragma solidity [^;]+;\n/g, '');
  
  // Remove all import statements
  content = content.replace(/import\s+.*?;\n/g, '');
  content = content.replace(/import\s+.*?\n/g, '');
  
  return content;
}

// Start with SPDX and pragma
let flattened = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

`;

// Add all OpenZeppelin dependencies in correct order
console.log('📦 Adding IERC165...');
flattened += readContract('utils/introspection/IERC165.sol') + '\n\n';

console.log('📦 Adding ERC165...');
flattened += readContract('utils/introspection/ERC165.sol') + '\n\n';

console.log('📦 Adding IERC721...');
flattened += readContract('token/ERC721/IERC721.sol') + '\n\n';

console.log('📦 Adding IERC721Metadata...');
flattened += readContract('token/ERC721/extensions/IERC721Metadata.sol') + '\n\n';

console.log('📦 Adding IERC721Errors...');
flattened += readContract('interfaces/draft-IERC6093.sol') + '\n\n';

console.log('📦 Adding Context...');
flattened += readContract('utils/Context.sol') + '\n\n';

console.log('📦 Adding Strings...');
flattened += readContract('utils/Strings.sol') + '\n\n';

console.log('📦 Adding Math...');
flattened += readContract('utils/math/Math.sol') + '\n\n';

console.log('📦 Adding SignedMath...');
flattened += readContract('utils/math/SignedMath.sol') + '\n\n';

console.log('📦 Adding IERC721Receiver...');
flattened += readContract('token/ERC721/IERC721Receiver.sol') + '\n\n';

console.log('📦 Adding ERC721...');
flattened += readContract('token/ERC721/ERC721.sol') + '\n\n';

console.log('📦 Adding ERC721URIStorage...');
flattened += readContract('token/ERC721/extensions/ERC721URIStorage.sol') + '\n\n';

console.log('📦 Adding IERC20...');
flattened += readContract('token/ERC20/IERC20.sol') + '\n\n';

console.log('📦 Adding Ownable...');
flattened += readContract('access/Ownable.sol') + '\n\n';

console.log('📦 Adding ReentrancyGuard...');
flattened += readContract('utils/ReentrancyGuard.sol') + '\n\n';

// Now add TravelNFT contract
console.log('📦 Adding TravelNFT...');
let travelNFT = fs.readFileSync('contracts/TravelNFT.sol', 'utf8');

// Remove imports and SPDX/pragma from TravelNFT
travelNFT = travelNFT.replace(/\/\/ SPDX-License-Identifier: MIT\n/g, '');
travelNFT = travelNFT.replace(/pragma solidity [^;]+;\n/g, '');
travelNFT = travelNFT.replace(/import "@openzeppelin\/contracts\/[^"]+";?\n/g, '');

flattened += travelNFT;

// Write flattened file
fs.writeFileSync('TravelNFT-flattened.sol', flattened);

console.log('✅ Flattened contract saved to TravelNFT-flattened.sol');
console.log(`📊 Total size: ${flattened.length} characters`);
console.log(`📊 Total lines: ${flattened.split('\n').length} lines`);

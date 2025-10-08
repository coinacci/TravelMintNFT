const solc = require('solc');
const fs = require('fs');
const path = require('path');

// Find imports callback
function findImports(importPath) {
  try {
    const fullPath = path.join('node_modules', importPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    return { contents: content };
  } catch (e) {
    return { error: 'File not found: ' + importPath };
  }
}

// Read contract
const contractPath = 'contracts/TravelNFT.sol';
const source = fs.readFileSync(contractPath, 'utf8');

// Compile input
const input = {
  language: 'Solidity',
  sources: {
    [contractPath]: { content: source }
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 200
    },
    outputSelection: {
      '*': {
        '*': ['*']
      }
    }
  }
};

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

if (output.errors) {
  output.errors.forEach(err => {
    console.log(err.formattedMessage);
  });
}

// Save standard JSON input for verification
fs.writeFileSync('standard-input.json', JSON.stringify(input, null, 2));
console.log('✅ Standard JSON input saved to: standard-input.json');
console.log('\nYou can use this file to verify on Basescan:');
console.log('1. Go to: https://basescan.org/verifyContract');
console.log('2. Select: "Solidity (Standard-Json-Input)"');
console.log('3. Upload: standard-input.json');
console.log('4. Contract Address: 0x8c12c9ebf7db0a6370361ce9225e3b77d22a558f');
console.log('5. Constructor Args: 0000000000000000000000007cde7822456aac667df0420cd048295b92704084');

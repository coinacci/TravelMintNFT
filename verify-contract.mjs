import fetch from 'node-fetch';
import fs from 'fs';

async function verifyContract() {
  const contractAddress = '0x8c12c9ebf7db0a6370361ce9225e3b77d22a558f';
  const sourceCode = fs.readFileSync('basescan_verified_contract.sol', 'utf8');
  const constructorArgs = '0000000000000000000000007cde7822456aac667df0420cd048295b92704084';
  
  const data = new URLSearchParams({
    chainId: '8453',
    codeformat: 'solidity-single-file',
    sourceCode: sourceCode,
    contractaddress: contractAddress,
    contractname: 'TravelNFT',
    compilerversion: 'v0.8.20+commit.a1b79de6',
    optimizationUsed: '1',
    runs: '200',
    constructorArguments: constructorArgs,  // Fixed typo!
    evmversion: 'paris',
    licenseType: '3', // MIT
  });
  
  const params = new URLSearchParams({
    module: 'contract',
    action: 'verifysourcecode',
    apikey: process.env.BASESCAN_API_KEY,
  });
  
  console.log('🚀 Submitting contract for verification...');
  console.log('📍 Contract:', contractAddress);
  console.log('🔑 Constructor args:', constructorArgs);
  
  const response = await fetch(`https://api.basescan.org/api?${params}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: data,
  });
  
  const result = await response.json();
  console.log('\n📝 Response:', JSON.stringify(result, null, 2));
  
  if (result.status === '1') {
    console.log('\n✅ Verification submitted successfully!');
    console.log('🔍 GUID:', result.result);
    console.log('⏳ Checking verification status in 10 seconds...');
    
    // Wait and check status
    await new Promise(resolve => setTimeout(resolve, 10000));
    await checkStatus(result.result);
  } else {
    console.log('\n❌ Verification failed:', result.result);
  }
}

async function checkStatus(guid) {
  const params = new URLSearchParams({
    module: 'contract',
    action: 'checkverifystatus',
    guid: guid,
    apikey: process.env.BASESCAN_API_KEY,
  });
  
  const response = await fetch(`https://api.basescan.org/api?${params}`);
  const result = await response.json();
  
  console.log('\n📊 Verification Status:', result.result);
  
  if (result.result === 'Pass - Verified') {
    console.log('✅ Contract successfully verified on Basescan!');
    console.log('🔗 View at: https://basescan.org/address/0x8c12c9ebf7db0a6370361ce9225e3b77d22a558f#code');
  } else if (result.result.includes('Pending')) {
    console.log('⏳ Still pending... Check again in a minute');
  } else {
    console.log('Status:', result.result);
  }
}

verifyContract().catch(console.error);

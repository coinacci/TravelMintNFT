import fs from 'fs';
import 'dotenv/config';

async function verifyContract() {
  const deploymentInfo = JSON.parse(fs.readFileSync('contract-deployment.json', 'utf8'));
  const contractAddress = deploymentInfo.contractAddress;
  
  console.log('Verifying contract on BaseScan...');
  console.log('Contract Address:', contractAddress);
  
  // Read the contract source
  const contractSource = fs.readFileSync('contracts/TravelNFT.sol', 'utf8');
  
  // Prepare verification data
  const verificationData = {
    apikey: process.env.BASESCAN_API_KEY,
    module: 'contract',
    action: 'verifysourcecode',
    contractaddress: contractAddress,
    sourceCode: contractSource,
    codeformat: 'solidity-single-file',
    contractname: 'TravelNFT',
    compilerversion: 'v0.8.20+commit.a1b79de6', // Solidity compiler version
    optimizationUsed: '1',
    runs: '200',
    constructorArguements: '', // No constructor arguments encoding needed for address
    evmversion: '',
    licenseType: '3' // MIT license
  };
  
  // Submit verification
  const submitResponse = await fetch('https://api.basescan.org/api', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(verificationData).toString()
  });
  
  const submitResult = await submitResponse.json();
  console.log('Verification submission result:', submitResult);
  
  if (submitResult.status === '1') {
    console.log('✅ Contract verification submitted successfully!');
    console.log('GUID:', submitResult.result);
    
    // Check verification status
    console.log('\nChecking verification status...');
    let verified = false;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!verified && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const statusResponse = await fetch(`https://api.basescan.org/api?module=contract&action=checkverifystatus&guid=${submitResult.result}&apikey=${process.env.BASESCAN_API_KEY}`);
      const statusResult = await statusResponse.json();
      
      console.log(`Attempt ${attempts + 1}: ${statusResult.result}`);
      
      if (statusResult.status === '1') {
        console.log('✅ Contract verified successfully on BaseScan!');
        verified = true;
      } else if (statusResult.result === 'Fail - Unable to verify') {
        console.log('❌ Verification failed');
        break;
      }
      
      attempts++;
    }
    
    if (verified) {
      console.log('\n🎉 Contract is now verified and safe!');
      console.log('🔗 View on BaseScan:', `https://basescan.org/address/${contractAddress}#code`);
      console.log('\n⚠️  Wallet safety warning should now be resolved!');
    }
    
  } else {
    console.log('❌ Verification submission failed:', submitResult.result);
  }
}

verifyContract()
  .then(() => {
    console.log('\nContract verification process complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Verification failed:', error.message);
    process.exit(1);
  });
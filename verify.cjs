const fs = require('fs');
const https = require('https');
const querystring = require('querystring');

const sourceCode = fs.readFileSync('TravelNFT_Clean.sol', 'utf8');

const params = {
  module: 'contract',
  action: 'verifysourcecode',
  chainId: '8453',
  contractaddress: '0x8c12c9ebf7db0a6370361ce9225e3b77d22a558f',
  sourceCode: sourceCode,
  codeformat: 'solidity-single-file',
  contractname: 'TravelNFT',
  compilerversion: 'v0.8.20+commit.a1b79de6',
  optimizationUsed: '1',
  runs: '200',
  constructorArguements: '0000000000000000000000007cde7822456aac667df0420cd048295b92704084',
  apikey: process.env.BASESCAN_API_KEY || ''
};

const postData = querystring.stringify(params);

const options = {
  hostname: 'api.etherscan.io',
  path: '/v2/api?chainid=8453',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Response:', data);
    const response = JSON.parse(data);
    if (response.status === '1') {
      console.log('\n✅ Verification submitted successfully!');
      console.log('GUID:', response.result);
      console.log('\nCheck status at: https://basescan.org/address/0x8c12c9ebf7db0a6370361ce9225e3b77d22a558f#code');
    } else {
      console.log('\n❌ Verification failed:', response.result);
    }
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(postData);
req.end();

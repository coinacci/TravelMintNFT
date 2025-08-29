const https = require('https');
const querystring = require('querystring');
const fs = require('fs');

// Contract source code
const sourceCode = fs.readFileSync('./contracts/TravelNFT.sol', 'utf8');

const data = querystring.stringify({
  module: 'contract',
  action: 'verifysourcecode',
  contractaddress: '0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f',
  sourceCode: sourceCode,
  codeformat: 'solidity-single-file',
  contractname: 'TravelNFT',
  compilerversion: 'v0.8.20+commit.a1b79de6',
  optimizationUsed: 0,
  runs: 200,
  constructorArguements: '000000000000000000000000e02e2557bb807cf7e30cef8c3146963a8a1d4496',
  evmversion: 'default',
  licenseType: 3,
  apikey: process.env.BASESCAN_API_KEY
});

const options = {
  hostname: 'api.basescan.org',
  path: '/api',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(data)
  }
};

console.log('🔄 Kontrat verification gönderiliyor...');
console.log('📝 Contract Address: 0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f');
console.log('⚙️  Compiler: v0.8.20+commit.a1b79de6');
console.log('🏗️  Constructor Args: 000000000000000000000000e02e2557bb807cf7e30cef8c3146963a8a1d4496');

const req = https.request(options, (res) => {
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('\n📤 Basescan API Response:');
    console.log(responseData);
    
    try {
      const result = JSON.parse(responseData);
      if (result.status === '1') {
        console.log('\n✅ CONTRACT VERIFICATION BAŞARILI!');
        console.log('📍 GUID:', result.result);
        console.log('⏳ Birkaç dakika içinde verify edilecek...');
        console.log('🔗 Kontrol linki: https://basescan.org/address/0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f#code');
      } else {
        console.log('\n❌ Verification hatası:', result.message || result.result);
        console.log('💡 Farklı compiler versiyonu veya parametreler denemeniz gerekebilir');
      }
    } catch (e) {
      console.log('\n❌ Response parse hatası:', e.message);
      console.log('Raw response:', responseData);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Network hatası:', e.message);
});

req.write(data);
req.end();

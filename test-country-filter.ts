// Test country filtering accuracy
const BASE_URL = 'http://localhost:5000';

async function test() {
  console.log('🧪 Testing Country Filtering System\n');
  
  // Test 1: Get countries list
  const countriesRes = await fetch(`${BASE_URL}/api/countries`);
  const countries = await countriesRes.json();
  console.log(`✅ Countries loaded: ${countries.length} total`);
  console.log(`   Sample: ${countries.slice(0, 5).join(', ')}`);
  
  // Test 2: Filter by Turkey
  console.log('\n🇹🇷 Testing Turkey filter...');
  const turkeyRes = await fetch(`${BASE_URL}/api/nfts/by-country?country=Turkey`);
  const turkeyNFTs = await turkeyRes.json();
  console.log(`✅ Found ${turkeyNFTs.length} NFTs in Turkey`);
  if (turkeyNFTs.length > 0) {
    console.log(`   Sample: ${turkeyNFTs[0].title} @ ${turkeyNFTs[0].location}`);
    console.log(`   Coords: ${turkeyNFTs[0].latitude}, ${turkeyNFTs[0].longitude}`);
  }
  
  // Test 3: Filter by France
  console.log('\n🇫🇷 Testing France filter...');
  const franceRes = await fetch(`${BASE_URL}/api/nfts/by-country?country=France`);
  const franceNFTs = await franceRes.json();
  console.log(`✅ Found ${franceNFTs.length} NFTs in France`);
  if (franceNFTs.length > 0) {
    console.log(`   Sample: ${franceNFTs[0].title} @ ${franceNFTs[0].location}`);
  }
  
  // Test 4: Filter by Japan
  console.log('\n🇯🇵 Testing Japan filter...');
  const japanRes = await fetch(`${BASE_URL}/api/nfts/by-country?country=Japan`);
  const japanNFTs = await japanRes.json();
  console.log(`✅ Found ${japanNFTs.length} NFTs in Japan`);
  if (japanNFTs.length > 0) {
    console.log(`   Sample: ${japanNFTs[0].title} @ ${japanNFTs[0].location}`);
  }
  
  // Test 5: Filter by United States
  console.log('\n🇺🇸 Testing United States filter...');
  const usRes = await fetch(`${BASE_URL}/api/nfts/by-country?country=United%20States%20of%20America`);
  const usNFTs = await usRes.json();
  console.log(`✅ Found ${usNFTs.length} NFTs in United States`);
  if (usNFTs.length > 0) {
    console.log(`   Sample: ${usNFTs[0].title} @ ${usNFTs[0].location}`);
  }
  
  console.log('\n✅ Country filtering tests complete!');
  process.exit(0);
}

test().catch(err => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});

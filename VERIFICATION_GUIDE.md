# 📋 TravelNFT Contract Verification Rehberi

## Contract Bilgileri
- **Contract Address**: `0x8c12c9ebf7db0a6370361ce9225e3b77d22a558f`
- **Network**: Base Mainnet
- **Compiler**: v0.8.20+commit.a1b79de6
- **Optimization**: Enabled, 200 runs
- **Constructor Args**: `0000000000000000000000007cde7822456aac667df0420cd048295b92704084`

## Sorun
Hardhat ile otomatik verification denemesi Basescan API limitasyonları nedeniyle başarısız oldu:
- Flattened dosyada base contract sıralama sorunu
- Standard JSON'da nested dependency eksiklikleri

## ✅ Çözüm: Manuel Verification (Web UI)

### Adım 1: Basescan'e Git
https://basescan.org/verifyContract

### Adım 2: Contract Bilgilerini Gir
1. **Contract Address**: `0x8c12c9ebf7db0a6370361ce9225e3b77d22a558f`
2. **Compiler Type**: Seç "Solidity (Single File)"
3. **Compiler Version**: Seç "v0.8.20+commit.a1b79de6"
4. **License**: MIT

### Adım 3: Optimization Ayarları
- **Optimization**: YES
- **Runs**: 200

### Adım 4: Source Code
- contracts/TravelNFT.sol dosyasını tüm import'larıyla birlikte yapıştır
- VEYA Basescan'ın kendi "Multi-Part files" seçeneğini kullan

### Adım 5: Constructor Arguments  
```
0000000000000000000000007cde7822456aac667df0420cd048295b92704084
```

### Adım 6: Verify!
"Verify and Publish" butonuna tıkla

## 🔄 Alternatif: Multi-Part Files
Eğer Single File başarısız olursa:
1. "Solidity (Multi-Part files)" seç
2. Tüm contract dosyalarını yükle:
   - contracts/TravelNFT.sol
   - node_modules/@openzeppelin/... (gerekli olanları)

## 📊 Sonuç Kontrolü
Başarılı olursa contract sayfasında "Contract Source Code Verified" görünecek:
https://basescan.org/address/0x8c12c9ebf7db0a6370361ce9225e3b77d22a558f#code


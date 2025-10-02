# TravelMintNFT

Welcome to **TravelMintNFT**, a decentralized platform that lets you create Non-Fungible Tokens (NFTs) from your travel photos, anchor them to specific geographic locations, and trade them on a marketplace. While ownership of the NFTs can change, their associated locations remain fixed, creating a unique digital collectible tied to real-world experiences.

---

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

---

## Overview
TravelMintNFT allows users to:

- **Mint NFTs**: Transform travel photos into unique NFTs.  
- **Geotag NFTs**: Associate NFTs with specific locations where the photos were taken.  
- **Display NFTs**: View NFTs at their anchored locations via a map-based interface.  
- **Trade NFTs**: Buy, sell, or trade NFTs on a decentralized marketplace while preserving their location data.  

This project leverages blockchain technology to ensure ownership authenticity and immutability of location data.

---

## Features
- **Photo-to-NFT Conversion**: Upload travel photos and mint them as NFTs.  
- **Geolocation Tagging**: Pin NFTs to real-world coordinates using geolocation data.  
- **Immutable Location**: The location of an NFT is fixed on the blockchain, even if ownership changes.  
- **Marketplace Integration**: Trade NFTs on a secure, decentralized platform.  
- **Interactive Map**: Visualize NFTs at their respective locations using a map interface.  

---

## Getting Started

### Prerequisites
To run or contribute to TravelMintNFT, ensure you have the following installed:

- Node.js (v16 or higher)  
- MetaMask (for blockchain interaction)  
- A Web3-enabled browser  
- Truffle (for smart contract development)  
- IPFS (for decentralized storage of photo data)  
- An Ethereum wallet with testnet ETH (e.g., Rinkeby or Sepolia)  

---

### Installation

**Clone the Repository:**
```bash
git clone https://github.com/coinacci/TravelMintNFT.git
cd TravelMintNFT
```

**Install Dependencies:**
```bash
npm install
```

**Set Up Environment Variables:**  
Create a `.env` file in the root directory and add the following:
```env
MNEMONIC="your-metamask-mnemonic"
INFURA_API_KEY="your-infura-api-key"
IPFS_API_KEY="your-ipfs-api-key"
```

**Deploy Smart Contracts:**
```bash
truffle migrate --network
```

**Start the Frontend:**
```bash
npm start
```

Open your browser and navigate to [http://localhost:3000](http://localhost:3000).

---

### Usage

**Mint an NFT:**
1. Connect your MetaMask wallet.  
2. Upload a travel photo and provide its geolocation (latitude/longitude).  
3. Confirm the transaction to mint the NFT.  

**View NFTs:**
- Use the map interface to explore NFTs pinned to their locations.  
- Click on an NFT to view its details, such as the photo, owner, and location.  

**Trade NFTs:**
- List your NFT on the marketplace or browse available NFTs.  
- Purchase or bid on NFTs using ETH.  

---

## Contributing
We welcome contributions to TravelMintNFT! To contribute:

1. Fork the repository.  
2. Create a new branch:
   ```bash
   git checkout -b feature/your-feature
   ```
3. Commit your changes:
   ```bash
   git commit -m "Add your feature"
   ```
4. Push to the branch:
   ```bash
   git push origin feature/your-feature
   ```
5. Open a Pull Request.  

Please ensure your code follows the project's coding standards and includes appropriate tests.

---

## License
This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---

## Contact
For questions or support, reach out via:  

- **GitHub Issues**: Open an issue  

Happy traveling and minting!

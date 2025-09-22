// TravelMarketplace Contract Deployment Script for Base Network
// This script helps deploy the TravelMarketplace.sol contract

const contractCode = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title TravelMarketplace
 * @dev Secure marketplace for TravelNFT without modifying the original NFT contract
 * Prevents price manipulation by storing listing prices on-chain
 */
contract TravelMarketplace is Ownable, ReentrancyGuard {
    IERC721 public immutable nftContract;
    IERC20 public immutable usdcContract;
    
    uint256 public constant PLATFORM_FEE_PERCENTAGE = 5; // 5% platform fee
    address public platformWallet;
    
    struct Listing {
        address seller;
        uint256 priceUSDC; // Price in USDC (6 decimals)
        bool active;
    }
    
    mapping(uint256 => Listing) public listings;
    
    event NFTListed(uint256 indexed tokenId, address indexed seller, uint256 priceUSDC);
    event NFTSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 priceUSDC);
    event ListingCancelled(uint256 indexed tokenId, address indexed seller);
    event ListingUpdated(uint256 indexed tokenId, address indexed seller, uint256 newPriceUSDC);
    
    error NotOwner();
    error NotListed();
    error AlreadyListed();
    error InvalidPrice();
    error CannotBuyOwnNFT();
    error SellerMismatch();
    error InsufficientUSDCBalance();
    error InsufficientUSDCAllowance();
    error TransferFailed();
    
    constructor(
        address _nftContract,
        address _usdcContract,
        address _platformWallet
    ) Ownable(msg.sender) {
        nftContract = IERC721(_nftContract);
        usdcContract = IERC20(_usdcContract);
        platformWallet = _platformWallet;
    }
    
    function listNFT(uint256 tokenId, uint256 priceUSDC) external nonReentrant {
        if (nftContract.ownerOf(tokenId) != msg.sender) revert NotOwner();
        if (listings[tokenId].active) revert AlreadyListed();
        if (priceUSDC == 0) revert InvalidPrice();
        
        // Require approval
        if (nftContract.getApproved(tokenId) != address(this) && 
            !nftContract.isApprovedForAll(msg.sender, address(this))) {
            revert("NFT not approved for marketplace");
        }
        
        listings[tokenId] = Listing({
            seller: msg.sender,
            priceUSDC: priceUSDC,
            active: true
        });
        
        emit NFTListed(tokenId, msg.sender, priceUSDC);
    }
    
    function cancelListing(uint256 tokenId) external nonReentrant {
        Listing storage listing = listings[tokenId];
        if (!listing.active) revert NotListed();
        if (listing.seller != msg.sender && msg.sender != owner()) revert SellerMismatch();
        
        listing.active = false;
        
        emit ListingCancelled(tokenId, listing.seller);
    }
    
    function updatePrice(uint256 tokenId, uint256 newPriceUSDC) external nonReentrant {
        Listing storage listing = listings[tokenId];
        if (!listing.active) revert NotListed();
        if (listing.seller != msg.sender) revert SellerMismatch();
        if (newPriceUSDC == 0) revert InvalidPrice();
        
        listing.priceUSDC = newPriceUSDC;
        
        emit ListingUpdated(tokenId, msg.sender, newPriceUSDC);
    }
    
    function purchaseNFT(uint256 tokenId) external nonReentrant {
        Listing storage listing = listings[tokenId];
        if (!listing.active) revert NotListed();
        
        address currentOwner = nftContract.ownerOf(tokenId);
        if (currentOwner != listing.seller) revert SellerMismatch();
        if (msg.sender == listing.seller) revert CannotBuyOwnNFT();
        
        uint256 totalPrice = listing.priceUSDC;
        uint256 platformFee = (totalPrice * PLATFORM_FEE_PERCENTAGE) / 100;
        uint256 sellerAmount = totalPrice - platformFee;
        
        // Check USDC balance and allowance
        if (usdcContract.balanceOf(msg.sender) < totalPrice) revert InsufficientUSDCBalance();
        if (usdcContract.allowance(msg.sender, address(this)) < totalPrice) revert InsufficientUSDCAllowance();
        
        // Transfer USDC
        if (!usdcContract.transferFrom(msg.sender, listing.seller, sellerAmount)) revert TransferFailed();
        if (!usdcContract.transferFrom(msg.sender, platformWallet, platformFee)) revert TransferFailed();
        
        // Transfer NFT
        nftContract.safeTransferFrom(listing.seller, msg.sender, tokenId);
        
        // Clear the listing
        listing.active = false;
        
        emit NFTSold(tokenId, listing.seller, msg.sender, totalPrice);
    }
    
    function getListing(uint256 tokenId) external view returns (address seller, uint256 priceUSDC, bool active) {
        Listing memory listing = listings[tokenId];
        return (listing.seller, listing.priceUSDC, listing.active);
    }
    
    function isListed(uint256 tokenId) external view returns (bool) {
        return listings[tokenId].active;
    }
    
    function getMarketplaceStats() external view returns (uint256 totalVolumeWei, uint256 totalVolumeUSDC) {
        // Note: These would need to be tracked through events in a production system
        return (0, 0);
    }
    
    function setPlatformWallet(address _platformWallet) external onlyOwner {
        platformWallet = _platformWallet;
    }
    
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = usdcContract.balanceOf(address(this));
        if (balance > 0) {
            usdcContract.transfer(owner(), balance);
        }
    }
}
`;

console.log("🚀 TravelMarketplace Contract Deployment Guide");
console.log("===============================================");
console.log("");
console.log("📋 Contract Details:");
console.log("- Contract Name: TravelMarketplace");
console.log("- Network: Base Mainnet");
console.log("- Dependencies: OpenZeppelin Contracts v5.0");
console.log("");
console.log("📦 Constructor Parameters:");
console.log("- _nftContract: 0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f (TravelNFT)");
console.log("- _usdcContract: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 (Base USDC)");
console.log("- _platformWallet: 0x7CDe7822456AAC667Df0420cD048295b92704084 (Commission wallet)");
console.log("");
console.log("🔧 Deployment Steps:");
console.log("1. Copy the contract code above");
console.log("2. Go to https://remix.ethereum.org");
console.log("3. Create new file: TravelMarketplace.sol");
console.log("4. Paste the contract code");
console.log("5. Install OpenZeppelin contracts (npm install @openzeppelin/contracts)");
console.log("6. Compile with Solidity 0.8.20+");
console.log("7. Deploy to Base network with constructor parameters");
console.log("8. Copy the deployed contract address");
console.log("9. Update server/blockchain.ts with the new address");
console.log("");
console.log("💰 Gas Estimate: ~2-3 million gas (deployment cost varies)");
console.log("⚠️  Requirement: ETH on Base network for gas fees");
console.log("");
console.log("🔗 Useful Links:");
console.log("- Remix IDE: https://remix.ethereum.org");
console.log("- Base Network RPC: https://mainnet.base.org");
console.log("- Base Explorer: https://basescan.org");
console.log("- OpenZeppelin Wizard: https://wizard.openzeppelin.com");

// Alternative: Hardhat deployment script
const hardhatScript = `
// scripts/deploy-marketplace.js
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Contract addresses on Base
  const NFT_CONTRACT = "0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f";
  const USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const PLATFORM_WALLET = "0x7CDe7822456AAC667Df0420cD048295b92704084";

  const TravelMarketplace = await ethers.getContractFactory("TravelMarketplace");
  const marketplace = await TravelMarketplace.deploy(
    NFT_CONTRACT,
    USDC_CONTRACT,
    PLATFORM_WALLET
  );

  await marketplace.deployed();

  console.log("TravelMarketplace deployed to:", marketplace.address);
  console.log("Update server/blockchain.ts with this address!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
`;

console.log("\n\n📁 Hardhat Deployment Script:");
console.log("=============================");
console.log(hardhatScript);
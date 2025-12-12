// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TravelMarketplace
 * @dev Secure marketplace for TravelNFT without modifying the original NFT contract
 * @notice This contract handles secure buying/selling while NFTs remain in original contract
 */
contract TravelMarketplace is Ownable, ReentrancyGuard {
    
    // 🎯 External Contracts
    IERC721 public immutable travelNFT;     // Original NFT contract (unchanged)
    IERC20 public immutable USDC;           // USDC contract on Base
    
    // 💰 Platform Configuration
    address public constant PLATFORM_WALLET = 0x7CDe7822456AAC667Df0420cD048295b92704084;
    uint256 public constant PLATFORM_FEE_PERCENT = 5; // 5% platform fee
    
    // 📦 Listing Structure
    struct Listing {
        address seller;      // Who listed the NFT
        uint256 price;       // Price in USDC (6 decimals)
        bool active;         // Is listing active
        uint256 listedAt;    // Timestamp when listed
    }
    
    // 📊 Storage
    mapping(uint256 => Listing) public listings;    // tokenId => Listing
    mapping(address => uint256) public totalSales;  // seller => total USDC earned
    uint256 public totalVolume;                     // Total marketplace volume
    
    // 🎭 Events
    event NFTListed(
        uint256 indexed tokenId, 
        address indexed seller, 
        uint256 price, 
        uint256 timestamp
    );
    
    event NFTUnlisted(
        uint256 indexed tokenId, 
        address indexed seller, 
        uint256 timestamp
    );
    
    event PriceUpdated(
        uint256 indexed tokenId, 
        address indexed seller, 
        uint256 oldPrice, 
        uint256 newPrice, 
        uint256 timestamp
    );
    
    event NFTPurchased(
        uint256 indexed tokenId,
        address indexed buyer,
        address indexed seller,
        uint256 price,
        uint256 platformFee,
        uint256 timestamp
    );
    
    // 🚨 Custom Errors
    error NFTNotApproved();
    error NotNFTOwner();
    error InvalidPrice();
    error NFTNotListed();
    error ListingNotActive();
    error CannotBuyOwnNFT();
    error NFTNotExist();
    error SellerMismatch();
    error InsufficientPayment();
    error TransferFailed();
    
    /**
     * @dev Constructor
     * @param _travelNFT Address of the original TravelNFT contract
     * @param _usdc Address of USDC contract on Base
     * @param _owner Address of the marketplace owner
     */
    constructor(
        address _travelNFT,
        address _usdc,
        address _owner
    ) Ownable(_owner) {
        require(_travelNFT != address(0), "Invalid NFT contract");
        require(_usdc != address(0), "Invalid USDC contract");
        require(_owner != address(0), "Invalid owner");
        
        travelNFT = IERC721(_travelNFT);
        USDC = IERC20(_usdc);
    }
    
    /**
     * @dev List NFT for sale
     * @param tokenId The NFT token ID to list
     * @param price The price in USDC (with 6 decimals)
     */
    function listNFT(uint256 tokenId, uint256 price) external nonReentrant {
        // 🔍 Validation checks
        if (travelNFT.ownerOf(tokenId) != msg.sender) revert NotNFTOwner();
        if (price == 0) revert InvalidPrice();
        
        // 🔐 Check if marketplace is approved to transfer this NFT
        if (travelNFT.getApproved(tokenId) != address(this) && 
            !travelNFT.isApprovedForAll(msg.sender, address(this))) {
            revert NFTNotApproved();
        }
        
        // 📝 Create listing
        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            active: true,
            listedAt: block.timestamp
        });
        
        emit NFTListed(tokenId, msg.sender, price, block.timestamp);
    }
    
    /**
     * @dev Cancel NFT listing
     * @param tokenId The NFT token ID to unlist
     */
    function cancelListing(uint256 tokenId) external nonReentrant {
        Listing storage listing = listings[tokenId];
        
        // 🔍 Validation
        if (!listing.active) revert NFTNotListed();
        if (listing.seller != msg.sender) revert NotNFTOwner();
        
        // 🗑️ Remove listing
        listing.active = false;
        
        emit NFTUnlisted(tokenId, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Update NFT price
     * @param tokenId The NFT token ID
     * @param newPrice The new price in USDC (with 6 decimals)
     */
    function updatePrice(uint256 tokenId, uint256 newPrice) external nonReentrant {
        Listing storage listing = listings[tokenId];
        
        // 🔍 Validation
        if (!listing.active) revert NFTNotListed();
        if (listing.seller != msg.sender) revert NotNFTOwner();
        if (newPrice == 0) revert InvalidPrice();
        
        uint256 oldPrice = listing.price;
        listing.price = newPrice;
        
        emit PriceUpdated(tokenId, msg.sender, oldPrice, newPrice, block.timestamp);
    }
    
    /**
     * @dev Purchase NFT with USDC - SECURE VERSION
     * @param tokenId The NFT token ID to purchase
     */
    function purchaseNFT(uint256 tokenId) external nonReentrant {
        Listing storage listing = listings[tokenId];
        
        // 🔍 Validation checks
        if (!listing.active) revert ListingNotActive();
        
        address seller = travelNFT.ownerOf(tokenId);
        if (seller != listing.seller) revert SellerMismatch();
        if (seller == msg.sender) revert CannotBuyOwnNFT();
        
        uint256 price = listing.price;
        if (price == 0) revert InvalidPrice();
        
        // 💰 Calculate fees
        uint256 platformFee = (price * PLATFORM_FEE_PERCENT) / 100;
        uint256 sellerAmount = price - platformFee;
        
        // 💳 Transfer USDC from buyer
        // To seller (95%)
        if (!USDC.transferFrom(msg.sender, seller, sellerAmount)) {
            revert TransferFailed();
        }
        
        // To platform (5%)
        if (!USDC.transferFrom(msg.sender, PLATFORM_WALLET, platformFee)) {
            revert TransferFailed();
        }
        
        // 🎨 Transfer NFT from seller to buyer (SECURE - uses original contract)
        travelNFT.safeTransferFrom(seller, msg.sender, tokenId);
        
        // 📊 Update stats
        totalSales[seller] += sellerAmount;
        totalVolume += price;
        
        // 🗑️ Clear listing
        listing.active = false;
        
        emit NFTPurchased(
            tokenId, 
            msg.sender, 
            seller, 
            price, 
            platformFee, 
            block.timestamp
        );
    }
    
    /**
     * @dev Get listing details
     * @param tokenId The NFT token ID
     * @return Listing details
     */
    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return listings[tokenId];
    }
    
    /**
     * @dev Check if NFT is listed
     * @param tokenId The NFT token ID
     * @return true if active listing exists
     */
    function isListed(uint256 tokenId) external view returns (bool) {
        return listings[tokenId].active;
    }
    
    /**
     * @dev Get seller's total sales volume
     * @param seller The seller address
     * @return Total USDC earned by seller
     */
    function getSellerVolume(address seller) external view returns (uint256) {
        return totalSales[seller];
    }
    
    /**
     * @dev Emergency function to pause listings (only owner)
     * @param tokenId The NFT token ID to force-cancel
     * @dev Can be used in case of disputes or emergencies
     */
    function emergencyCancelListing(uint256 tokenId) external onlyOwner {
        Listing storage listing = listings[tokenId];
        if (listing.active) {
            listing.active = false;
            emit NFTUnlisted(tokenId, listing.seller, block.timestamp);
        }
    }
    
    /**
     * @dev Get marketplace statistics
     * @return totalVolume_ Total trading volume
     * @return totalListings_ Number of active listings
     */
    function getMarketplaceStats() external view returns (uint256 totalVolume_, uint256 totalListings_) {
        totalVolume_ = totalVolume;
        
        // Note: Counting active listings requires iteration or separate tracking
        // For gas efficiency, this could be optimized with additional storage
        totalListings_ = 0; // Placeholder - could be implemented with counter
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TravelNFT is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard {
    uint256 private _nextTokenId;
    
    // USDC contract on Base
    IERC20 public constant USDC = IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);
    
    // Fixed mint price: 1 USDC (6 decimals)
    uint256 public constant MINT_PRICE = 1000000; // 1 USDC
    
    // Platform commission wallet
    address public constant PLATFORM_WALLET = 0x7CDe7822456AAC667Df0420cD048295b92704084;
    
    // Platform commission: 5%
    uint256 public constant PLATFORM_FEE_PERCENT = 5;
    
    // Events
    event TravelNFTMinted(address indexed to, uint256 indexed tokenId, string location);
    event RoyaltyPaid(uint256 indexed tokenId, address indexed recipient, uint256 amount);
    event NFTPurchased(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price, uint256 platformFee);
    event NFTListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event NFTUnlisted(uint256 indexed tokenId, address indexed seller);
    event PriceUpdated(uint256 indexed tokenId, address indexed seller, uint256 oldPrice, uint256 newPrice);
    
    // Struct for NFT metadata
    struct TravelMetadata {
        string location;
        string latitude;
        string longitude; 
        string category;
        uint256 mintTimestamp;
        address originalMinter;
    }
    
    mapping(uint256 => TravelMetadata) public travelMetadata;
    
    // 🔒 SECURITY FIX: On-chain listing system
    struct Listing {
        address seller;
        uint256 price;
        bool active;
    }
    
    mapping(uint256 => Listing) public listings;
    
    constructor(address initialOwner) 
        ERC721("TravelMint NFT", "TRAVEL") 
        Ownable(initialOwner)
    {
        _nextTokenId = 1;
    }
    
    /**
     * @dev Mint a new Travel NFT with USDC payment
     * @param to Address to mint the NFT to
     * @param location Location string (city name or coordinates)
     * @param latitude GPS latitude as string
     * @param longitude GPS longitude as string  
     * @param category Photo category
     * @param uri IPFS hash or metadata URI
     */
    function mintTravelNFT(
        address to,
        string memory location,
        string memory latitude,
        string memory longitude,
        string memory category,
        string memory uri
    ) public nonReentrant returns (uint256) {
        require(to != address(0), "Cannot mint to zero address");
        require(bytes(location).length > 0, "Location cannot be empty");
        require(bytes(uri).length > 0, "Token URI cannot be empty");
        
        // Transfer USDC from sender to contract owner
        bool success = USDC.transferFrom(msg.sender, owner(), MINT_PRICE);
        require(success, "USDC transfer failed");
        
        uint256 tokenId = _nextTokenId++;
        
        // Mint NFT
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        
        // Store travel metadata
        travelMetadata[tokenId] = TravelMetadata({
            location: location,
            latitude: latitude, 
            longitude: longitude,
            category: category,
            mintTimestamp: block.timestamp,
            originalMinter: msg.sender
        });
        
        emit TravelNFTMinted(to, tokenId, location);
        
        return tokenId;
    }
    
    /**
     * @dev Batch mint multiple NFTs (gas efficient)
     */
    function batchMintTravelNFT(
        address[] memory recipients,
        string[] memory locations,
        string[] memory latitudes,
        string[] memory longitudes,
        string[] memory categories,
        string[] memory uris
    ) external nonReentrant returns (uint256[] memory) {
        require(recipients.length == locations.length, "Arrays length mismatch");
        require(recipients.length == latitudes.length, "Arrays length mismatch");
        require(recipients.length == longitudes.length, "Arrays length mismatch");
        require(recipients.length == categories.length, "Arrays length mismatch");
        require(recipients.length == uris.length, "Arrays length mismatch");
        
        uint256[] memory tokenIds = new uint256[](recipients.length);
        uint256 totalCost = MINT_PRICE * recipients.length;
        
        // Transfer total USDC amount
        bool success = USDC.transferFrom(msg.sender, owner(), totalCost);
        require(success, "USDC transfer failed");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            uint256 tokenId = _nextTokenId++;
            
            _safeMint(recipients[i], tokenId);
            _setTokenURI(tokenId, uris[i]);
            
            travelMetadata[tokenId] = TravelMetadata({
                location: locations[i],
                latitude: latitudes[i],
                longitude: longitudes[i], 
                category: categories[i],
                mintTimestamp: block.timestamp,
                originalMinter: msg.sender
            });
            
            tokenIds[i] = tokenId;
            emit TravelNFTMinted(recipients[i], tokenId, locations[i]);
        }
        
        return tokenIds;
    }
    
    /**
     * @dev Get travel metadata for a token
     */
    function getTravelMetadata(uint256 tokenId) external view returns (TravelMetadata memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return travelMetadata[tokenId];
    }
    
    /**
     * @dev Get next token ID
     */
    function getNextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }
    
    /**
     * @dev List NFT for sale - SECURITY FIX: Only owner can list with stored price
     * @param tokenId The NFT token ID to list
     * @param price The price in USDC (with 6 decimals)
     */
    function listNFT(uint256 tokenId, uint256 price) external {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(ownerOf(tokenId) == msg.sender, "Only NFT owner can list");
        require(price > 0, "Price must be greater than 0");
        
        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            active: true
        });
        
        emit NFTListed(tokenId, msg.sender, price);
    }
    
    /**
     * @dev Cancel NFT listing - Only seller can cancel
     * @param tokenId The NFT token ID to unlist
     */
    function cancelListing(uint256 tokenId) external {
        Listing storage listing = listings[tokenId];
        require(listing.active, "NFT is not listed");
        require(listing.seller == msg.sender, "Only seller can cancel listing");
        
        listing.active = false;
        emit NFTUnlisted(tokenId, msg.sender);
    }
    
    /**
     * @dev Update NFT price - Only seller can update
     * @param tokenId The NFT token ID to update price for
     * @param newPrice The new price in USDC (with 6 decimals)
     */
    function updatePrice(uint256 tokenId, uint256 newPrice) external {
        Listing storage listing = listings[tokenId];
        require(listing.active, "NFT is not listed");
        require(listing.seller == msg.sender, "Only seller can update price");
        require(newPrice > 0, "Price must be greater than 0");
        
        uint256 oldPrice = listing.price;
        listing.price = newPrice;
        
        emit PriceUpdated(tokenId, msg.sender, oldPrice, newPrice);
    }
    
    /**
     * @dev Purchase NFT with USDC - SECURITY FIX: Uses stored price and requires active listing
     * @param tokenId The NFT token ID to purchase
     */
    function purchaseNFT(uint256 tokenId) external nonReentrant {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        
        // 🔒 SECURITY FIX: Check listing exists and is active
        Listing storage listing = listings[tokenId];
        require(listing.active, "NFT is not listed for sale");
        
        address seller = ownerOf(tokenId);
        require(seller == listing.seller, "Listing seller mismatch");
        require(seller != msg.sender, "Cannot buy your own NFT");
        
        // 🔒 SECURITY FIX: Use stored price, not buyer-provided price
        uint256 price = listing.price;
        require(price > 0, "Invalid listing price");
        
        // Calculate commission split
        uint256 platformFee = (price * PLATFORM_FEE_PERCENT) / 100;
        uint256 sellerAmount = price - platformFee;
        
        // Transfer USDC from buyer to seller (95%)
        bool sellerSuccess = USDC.transferFrom(msg.sender, seller, sellerAmount);
        require(sellerSuccess, "USDC transfer to seller failed");
        
        // Transfer platform commission (5%)
        bool platformSuccess = USDC.transferFrom(msg.sender, PLATFORM_WALLET, platformFee);
        require(platformSuccess, "USDC transfer to platform failed");
        
        // Transfer NFT from seller to buyer
        _transfer(seller, msg.sender, tokenId);
        
        // 🔒 SECURITY FIX: Clear listing after successful purchase
        listing.active = false;
        
        emit NFTPurchased(tokenId, msg.sender, seller, price, platformFee);
    }

    /**
     * @dev Emergency withdraw function for owner
     */
    function withdrawUSDC() external onlyOwner {
        uint256 balance = USDC.balanceOf(address(this));
        require(balance > 0, "No USDC to withdraw");
        
        bool success = USDC.transfer(owner(), balance);
        require(success, "USDC withdrawal failed");
    }
    
    /**
     * @dev Update mint price (only owner)
     */
    function updateMintPrice(uint256 newPrice) external onlyOwner {
        // Note: This would require a storage variable for mint price
        // For now, mint price is constant at 1 USDC
        revert("Mint price is fixed at 1 USDC");
    }

    /**
     * @dev Claim Base network reward - simple on-chain transaction for quest
     */
    function claimBaseReward() external payable {
        // Minimal transaction fee required (0.0001 ETH)
        require(msg.value >= 0.0001 ether, "Minimum fee required: 0.0001 ETH");
        
        // Emit event for quest tracking
        emit BaseRewardClaimed(msg.sender, msg.value, block.timestamp);
    }
    
    // New event for Base reward claims
    event BaseRewardClaimed(address indexed user, uint256 amount, uint256 timestamp);

    // Required overrides
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
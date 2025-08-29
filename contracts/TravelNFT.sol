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
    
    // Events
    event TravelNFTMinted(address indexed to, uint256 indexed tokenId, string location);
    event RoyaltyPaid(uint256 indexed tokenId, address indexed recipient, uint256 amount);
    
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
     * @param tokenURI IPFS hash or metadata URI
     */
    function mintTravelNFT(
        address to,
        string memory location,
        string memory latitude,
        string memory longitude,
        string memory category,
        string memory tokenURI
    ) public nonReentrant returns (uint256) {
        require(to != address(0), "Cannot mint to zero address");
        require(bytes(location).length > 0, "Location cannot be empty");
        require(bytes(tokenURI).length > 0, "Token URI cannot be empty");
        
        // Transfer USDC from sender to contract owner
        bool success = USDC.transferFrom(msg.sender, owner(), MINT_PRICE);
        require(success, "USDC transfer failed");
        
        uint256 tokenId = _nextTokenId++;
        
        // Mint NFT
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        
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
        string[] memory tokenURIs
    ) external nonReentrant returns (uint256[] memory) {
        require(recipients.length == locations.length, "Arrays length mismatch");
        require(recipients.length == latitudes.length, "Arrays length mismatch");
        require(recipients.length == longitudes.length, "Arrays length mismatch");
        require(recipients.length == categories.length, "Arrays length mismatch");
        require(recipients.length == tokenURIs.length, "Arrays length mismatch");
        
        uint256[] memory tokenIds = new uint256[](recipients.length);
        uint256 totalCost = MINT_PRICE * recipients.length;
        
        // Transfer total USDC amount
        bool success = USDC.transferFrom(msg.sender, owner(), totalCost);
        require(success, "USDC transfer failed");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            uint256 tokenId = _nextTokenId++;
            
            _safeMint(recipients[i], tokenId);
            _setTokenURI(tokenId, tokenURIs[i]);
            
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
ovedForAll(owner, spender) || getApproved(tokenId) == spender);
    }

    function _mint(address to, uint256 tokenId) internal virtual {
        require(to != address(0), "ERC721: mint to the zero address");
        require(!_exists(tokenId), "ERC721: token already minted");
        unchecked {
            _balances[to] += 1;
        }
        _owners[tokenId] = to;
        emit Transfer(address(0), to, tokenId);
    }

    function _safeMint(address to, uint256 tokenId) internal virtual {
        _safeMint(to, tokenId, "");
    }

    function _safeMint(address to, uint256 tokenId, bytes memory data) internal virtual {
        _mint(to, tokenId);
        require(
            _checkOnERC721Received(address(0), to, tokenId, data),
            "ERC721: transfer to non ERC721Receiver implementer"
        );
    }

    function _transfer(address from, address to, uint256 tokenId) internal virtual {
        require(ERC721.ownerOf(tokenId) == from, "ERC721: transfer from incorrect owner");
        require(to != address(0), "ERC721: transfer to the zero address");
        _approve(address(0), tokenId);
        unchecked {
            _balances[from] -= 1;
            _balances[to] += 1;
        }
        _owners[tokenId] = to;
        emit Transfer(from, to, tokenId);
    }

    function _approve(address to, uint256 tokenId) internal virtual {
        _tokenApprovals[tokenId] = to;
        emit Approval(ERC721.ownerOf(tokenId), to, tokenId);
    }

    function _setApprovalForAll(address owner, address operator, bool approved) internal virtual {
        require(owner != operator, "ERC721: approve to caller");
        _operatorApprovals[owner][operator] = approved;
        emit ApprovalForAll(owner, operator, approved);
    }

    function _requireMinted(uint256 tokenId) internal view virtual {
        require(_exists(tokenId), "ERC721: invalid token ID");
    }

    function _checkOnERC721Received(address from, address to, uint256 tokenId, bytes memory data) private returns (bool) {
        if (to.code.length > 0) {
            try IERC721Receiver(to).onERC721Received(_msgSender(), from, tokenId, data) returns (bytes4 retval) {
                return retval == IERC721Receiver.onERC721Received.selector;
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert("ERC721: transfer to non ERC721Receiver implementer");
                } else {
                    assembly {
                        revert(add(32, reason), mload(reason))
                    }
                }
            }
        } else {
            return true;
        }
    }
}

abstract contract ERC721URIStorage is ERC721 {
    using Strings for uint256;
    mapping(uint256 => string) private _tokenURIs;

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        _requireMinted(tokenId);
        string memory _tokenURI = _tokenURIs[tokenId];
        string memory base = _baseURI();
        if (bytes(base).length == 0) {
            return _tokenURI;
        }
        if (bytes(_tokenURI).length > 0) {
            return string(abi.encodePacked(base, _tokenURI));
        }
        return super.tokenURI(tokenId);
    }

    function _setTokenURI(uint256 tokenId, string memory _tokenURI) internal virtual {
        require(_exists(tokenId), "ERC721URIStorage: URI set of nonexistent token");
        _tokenURIs[tokenId] = _tokenURI;
    }
}

abstract contract Ownable is Context {
    address private _owner;
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address _initialOwner) {
        _transferOwnership(_initialOwner);
    }

    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    function owner() public view virtual returns (address) {
        return _owner;
    }

    function _checkOwner() internal view virtual {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
    }

    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _transferOwnership(newOwner);
    }

    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

abstract contract ReentrancyGuard {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    constructor() {
        _status = _NOT_ENTERED;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
}

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
    
    function getTravelMetadata(uint256 tokenId) external view returns (TravelMetadata memory) {
        require(_exists(tokenId), "Token does not exist");
        return travelMetadata[tokenId];
    }
    
    function getNextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }
    
    function withdrawUSDC() external onlyOwner {
        uint256 balance = USDC.balanceOf(address(this));
        require(balance > 0, "No USDC to withdraw");
        
        bool success = USDC.transfer(owner(), balance);
        require(success, "USDC withdrawal failed");
    }
    
    function updateMintPrice(uint256 newPrice) external onlyOwner {
        revert("Mint price is fixed at 1 USDC");
    }

    // Required overrides
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}

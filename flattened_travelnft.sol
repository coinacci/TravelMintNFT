// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Flattened TravelNFT Contract - All dependencies included
 * For Basescan verification compatibility
 */

interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

interface IERC721 {
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    function balanceOf(address owner) external view returns (uint256 balance);
    function ownerOf(uint256 tokenId) external view returns (address owner);
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external;
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function transferFrom(address from, address to, uint256 tokenId) external;
    function approve(address to, uint256 tokenId) external;
    function setApprovalForAll(address operator, bool approved) external;
    function getApproved(uint256 tokenId) external view returns (address operator);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}

interface IERC721Metadata {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function tokenURI(uint256 tokenId) external view returns (string memory);
}

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

library Strings {
    bytes16 private constant HEX_DIGITS = "0123456789abcdef";
    
    function toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}

abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }
}

abstract contract Ownable is Context {
    address private _owner;
    
    error OwnableUnauthorizedAccount(address account);
    error OwnableInvalidOwner(address owner);
    
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }
    
    modifier onlyOwner() {
        _checkOwner();
        _;
    }
    
    function owner() public view virtual returns (address) {
        return _owner;
    }
    
    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }
    
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }
    
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }
    
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

abstract contract ReentrancyGuard {
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;
    uint256 private _status;
    
    error ReentrancyGuardReentrantCall();
    
    constructor() {
        _status = NOT_ENTERED;
    }
    
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }
    
    function _nonReentrantBefore() private {
        if (_status == ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }
        _status = ENTERED;
    }
    
    function _nonReentrantAfter() private {
        _status = NOT_ENTERED;
    }
    
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == ENTERED;
    }
}

contract ERC721 is Context, IERC165, IERC721, IERC721Metadata {
    using Strings for uint256;
    
    string private _name;
    string private _symbol;
    mapping(uint256 tokenId => address) private _owners;
    mapping(address owner => uint256) private _balances;
    mapping(uint256 tokenId => address) private _tokenApprovals;
    mapping(address owner => mapping(address operator => bool)) private _operatorApprovals;
    
    error ERC721IncorrectOwner(address sender, uint256 tokenId, address owner);
    error ERC721NonexistentToken(uint256 tokenId);
    error ERC721InsufficientApproval(address operator, uint256 tokenId);
    error ERC721InvalidApprover(address approver);
    error ERC721InvalidOperator(address operator);
    error ERC721InvalidOwner(address owner);
    error ERC721InvalidReceiver(address receiver);
    error ERC721InvalidSender(address sender);
    
    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }
    
    function supportsInterface(bytes4 interfaceId) public view virtual returns (bool) {
        return interfaceId == type(IERC721).interfaceId || 
               interfaceId == type(IERC721Metadata).interfaceId ||
               interfaceId == type(IERC165).interfaceId;
    }
    
    function balanceOf(address owner) public view virtual returns (uint256) {
        if (owner == address(0)) {
            revert ERC721InvalidOwner(address(0));
        }
        return _balances[owner];
    }
    
    function ownerOf(uint256 tokenId) public view virtual returns (address) {
        return _requireOwned(tokenId);
    }
    
    function name() public view virtual returns (string memory) {
        return _name;
    }
    
    function symbol() public view virtual returns (string memory) {
        return _symbol;
    }
    
    function tokenURI(uint256 tokenId) public view virtual returns (string memory) {
        _requireOwned(tokenId);
        string memory baseURI = _baseURI();
        return bytes(baseURI).length > 0 ? string.concat(baseURI, tokenId.toString()) : "";
    }
    
    function _baseURI() internal view virtual returns (string memory) {
        return "";
    }
    
    function approve(address to, uint256 tokenId) public virtual {
        _approve(to, tokenId, _msgSender());
    }
    
    function getApproved(uint256 tokenId) public view virtual returns (address) {
        _requireOwned(tokenId);
        return _getApproved(tokenId);
    }
    
    function setApprovalForAll(address operator, bool approved) public virtual {
        _setApprovalForAll(_msgSender(), operator, approved);
    }
    
    function isApprovedForAll(address owner, address operator) public view virtual returns (bool) {
        return _operatorApprovals[owner][operator];
    }
    
    function transferFrom(address from, address to, uint256 tokenId) public virtual {
        if (to == address(0)) {
            revert ERC721InvalidReceiver(address(0));
        }
        address previousOwner = _update(to, tokenId, _msgSender());
        if (previousOwner != from) {
            revert ERC721IncorrectOwner(from, tokenId, previousOwner);
        }
    }
    
    function safeTransferFrom(address from, address to, uint256 tokenId) public {
        safeTransferFrom(from, to, tokenId, "");
    }
    
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public virtual {
        transferFrom(from, to, tokenId);
        _checkOnERC721Received(from, to, tokenId, data);
    }
    
    function _ownerOf(uint256 tokenId) internal view virtual returns (address) {
        return _owners[tokenId];
    }
    
    function _getApproved(uint256 tokenId) internal view virtual returns (address) {
        return _tokenApprovals[tokenId];
    }
    
    function _isAuthorized(address owner, address spender, uint256 tokenId) internal view virtual returns (bool) {
        return spender != address(0) && (owner == spender || isApprovedForAll(owner, spender) || _getApproved(tokenId) == spender);
    }
    
    function _checkAuthorized(address owner, address spender, uint256 tokenId) internal view virtual {
        if (!_isAuthorized(owner, spender, tokenId)) {
            if (owner == address(0)) {
                revert ERC721NonexistentToken(tokenId);
            } else {
                revert ERC721InsufficientApproval(spender, tokenId);
            }
        }
    }
    
    function _increaseBalance(address account, uint128 value) internal virtual {
        unchecked {
            _balances[account] += value;
        }
    }
    
    function _update(address to, uint256 tokenId, address auth) internal virtual returns (address) {
        address from = _ownerOf(tokenId);
        
        if (auth != address(0)) {
            _checkAuthorized(from, auth, tokenId);
        }
        
        if (from != address(0)) {
            _approve(address(0), tokenId, address(0), false);
            unchecked {
                _balances[from] -= 1;
            }
        }
        
        if (to != address(0)) {
            unchecked {
                _balances[to] += 1;
            }
        }
        
        _owners[tokenId] = to;
        emit Transfer(from, to, tokenId);
        return from;
    }
    
    function _mint(address to, uint256 tokenId) internal {
        if (to == address(0)) {
            revert ERC721InvalidReceiver(address(0));
        }
        address previousOwner = _update(to, tokenId, address(0));
        if (previousOwner != address(0)) {
            revert ERC721InvalidSender(address(0));
        }
    }
    
    function _safeMint(address to, uint256 tokenId) internal {
        _safeMint(to, tokenId, "");
    }
    
    function _safeMint(address to, uint256 tokenId, bytes memory data) internal virtual {
        _mint(to, tokenId);
        _checkOnERC721Received(address(0), to, tokenId, data);
    }
    
    function _approve(address to, uint256 tokenId, address auth) internal {
        _approve(to, tokenId, auth, true);
    }
    
    function _approve(address to, uint256 tokenId, address auth, bool emitEvent) internal virtual {
        if (emitEvent || auth != address(0)) {
            address owner = _requireOwned(tokenId);
            
            if (auth != address(0) && owner != auth && !isApprovedForAll(owner, auth)) {
                revert ERC721InvalidApprover(auth);
            }
            
            if (emitEvent) {
                emit Approval(owner, to, tokenId);
            }
        }
        
        _tokenApprovals[tokenId] = to;
    }
    
    function _setApprovalForAll(address owner, address operator, bool approved) internal virtual {
        if (operator == address(0)) {
            revert ERC721InvalidOperator(operator);
        }
        _operatorApprovals[owner][operator] = approved;
        emit ApprovalForAll(owner, operator, approved);
    }
    
    function _requireOwned(uint256 tokenId) internal view returns (address) {
        address owner = _ownerOf(tokenId);
        if (owner == address(0)) {
            revert ERC721NonexistentToken(tokenId);
        }
        return owner;
    }
    
    function _checkOnERC721Received(address from, address to, uint256 tokenId, bytes memory data) private {
        if (to.code.length > 0) {
            try IERC721Receiver(to).onERC721Received(_msgSender(), from, tokenId, data) returns (bytes4 retval) {
                if (retval != IERC721Receiver.onERC721Received.selector) {
                    revert ERC721InvalidReceiver(to);
                }
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert ERC721InvalidReceiver(to);
                } else {
                    assembly {
                        revert(add(32, reason), mload(reason))
                    }
                }
            }
        }
    }
}

interface IERC721Receiver {
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) external returns (bytes4);
}

abstract contract ERC721URIStorage is ERC721 {
    using Strings for uint256;
    
    mapping(uint256 tokenId => string) private _tokenURIs;
    
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        _requireOwned(tokenId);
        
        string memory _tokenURI = _tokenURIs[tokenId];
        string memory base = _baseURI();
        
        if (bytes(base).length == 0) {
            return _tokenURI;
        }
        
        if (bytes(_tokenURI).length > 0) {
            return string.concat(base, _tokenURI);
        }
        
        return super.tokenURI(tokenId);
    }
    
    function _setTokenURI(uint256 tokenId, string memory _tokenURI) internal virtual {
        _tokenURIs[tokenId] = _tokenURI;
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
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
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

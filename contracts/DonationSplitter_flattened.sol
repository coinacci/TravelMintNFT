// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

contract DonationSplitter {
    IERC20 public immutable usdc;
    address public treasury;
    address public owner;
    uint256 public platformFeeBps;

    event DonationRecorded(
        uint256 indexed nftId,
        address indexed donor,
        address indexed creator,
        uint256 totalAmount,
        uint256 creatorShare,
        uint256 platformShare
    );

    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event PlatformFeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(
        address _usdc,
        address _treasury,
        uint256 _platformFeeBps
    ) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_treasury != address(0), "Invalid treasury address");
        require(_platformFeeBps <= 10000, "Fee cannot exceed 100%");

        usdc = IERC20(_usdc);
        treasury = _treasury;
        platformFeeBps = _platformFeeBps;
        owner = msg.sender;
    }

    function donate(
        uint256 nftId,
        address creator,
        uint256 amount
    ) external {
        require(amount > 0, "Amount must be greater than 0");
        require(creator != address(0), "Invalid creator address");
        require(creator != msg.sender, "Cannot donate to yourself");

        uint256 platformShare = (amount * platformFeeBps) / 10000;
        uint256 creatorShare = amount - platformShare;

        require(usdc.transferFrom(msg.sender, creator, creatorShare), "Creator transfer failed");
        require(usdc.transferFrom(msg.sender, treasury, platformShare), "Treasury transfer failed");

        emit DonationRecorded(
            nftId,
            msg.sender,
            creator,
            amount,
            creatorShare,
            platformShare
        );
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury address");
        address oldTreasury = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(oldTreasury, _treasury);
    }

    function setPlatformFee(uint256 _platformFeeBps) external onlyOwner {
        require(_platformFeeBps <= 10000, "Fee cannot exceed 100%");
        uint256 oldFeeBps = platformFeeBps;
        platformFeeBps = _platformFeeBps;
        emit PlatformFeeUpdated(oldFeeBps, _platformFeeBps);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

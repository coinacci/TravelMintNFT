// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract DonationSplitter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    address public treasury;
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

    constructor(
        address _usdc,
        address _treasury,
        uint256 _platformFeeBps
    ) Ownable(msg.sender) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_treasury != address(0), "Invalid treasury address");
        require(_platformFeeBps <= 10000, "Fee cannot exceed 100%");

        usdc = IERC20(_usdc);
        treasury = _treasury;
        platformFeeBps = _platformFeeBps;
    }

    function donate(
        uint256 nftId,
        address creator,
        uint256 amount
    ) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(creator != address(0), "Invalid creator address");
        require(creator != msg.sender, "Cannot donate to yourself");

        uint256 platformShare = (amount * platformFeeBps) / 10000;
        uint256 creatorShare = amount - platformShare;

        usdc.safeTransferFrom(msg.sender, creator, creatorShare);
        usdc.safeTransferFrom(msg.sender, treasury, platformShare);

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
}

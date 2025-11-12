// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title QuestManager
 * @dev Manages on-chain quest completions for TravelMint
 * Separate from NFT contract for cleaner architecture and upgradeability
 */
contract QuestManager is Ownable, ReentrancyGuard {
    // TravelNFT contract address for holder verification
    IERC721 public immutable travelNFT;
    
    // Treasury address for quest fees
    address public treasury;
    
    // Minimum fee per quest completion (0.0001 ETH)
    uint256 public questFee = 0.0001 ether;
    
    // Quest completion tracking: user => questId => day => completed
    // Using day-based tracking to allow daily quests
    mapping(address => mapping(uint256 => mapping(uint256 => bool))) public questCompletions;
    
    // Events
    event QuestCompleted(
        address indexed user,
        uint256 indexed questId,
        uint256 fee,
        uint256 timestamp,
        uint256 day
    );
    
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event QuestFeeUpdated(uint256 oldFee, uint256 newFee);
    
    /**
     * @dev Constructor
     * @param _travelNFT Address of the TravelNFT contract
     * @param _treasury Initial treasury address for quest fees
     * @param initialOwner Owner of the QuestManager contract
     */
    constructor(
        address _travelNFT,
        address _treasury,
        address initialOwner
    ) Ownable(initialOwner) {
        require(_travelNFT != address(0), "Invalid NFT contract");
        require(_treasury != address(0), "Invalid treasury address");
        
        travelNFT = IERC721(_travelNFT);
        treasury = _treasury;
    }
    
    /**
     * @dev Complete a quest by paying the required fee
     * @param questId The ID of the quest being completed
     * Includes replay protection to prevent double-claiming same quest on same day
     */
    function completeQuest(uint256 questId) external payable nonReentrant {
        require(msg.value >= questFee, "Insufficient fee");
        
        // NFT holder verification - only TravelNFT holders can complete quests
        require(travelNFT.balanceOf(msg.sender) > 0, "Must own TravelNFT");
        
        // Calculate current day (blocks since epoch / blocks per day)
        // Using simple timestamp-based day calculation
        uint256 currentDay = block.timestamp / 1 days;
        
        // Replay protection: check if user already completed this quest today
        require(
            !questCompletions[msg.sender][questId][currentDay],
            "Quest already completed today"
        );
        
        // Mark quest as completed for this user, quest, and day
        questCompletions[msg.sender][questId][currentDay] = true;
        
        // Transfer fee to treasury
        (bool success, ) = treasury.call{value: msg.value}("");
        require(success, "Treasury transfer failed");
        
        // Emit event for backend tracking
        emit QuestCompleted(
            msg.sender,
            questId,
            msg.value,
            block.timestamp,
            currentDay
        );
    }
    
    /**
     * @dev Check if user has completed a specific quest today
     * @param user The user address
     * @param questId The quest ID
     * @return bool Whether the quest was completed today
     */
    function hasCompletedQuestToday(address user, uint256 questId) external view returns (bool) {
        uint256 currentDay = block.timestamp / 1 days;
        return questCompletions[user][questId][currentDay];
    }
    
    /**
     * @dev Check if user has completed a quest on a specific day
     * @param user The user address
     * @param questId The quest ID
     * @param day The day number (timestamp / 1 days)
     * @return bool Whether the quest was completed on that day
     */
    function hasCompletedQuestOnDay(
        address user,
        uint256 questId,
        uint256 day
    ) external view returns (bool) {
        return questCompletions[user][questId][day];
    }
    
    /**
     * @dev Update treasury address (only owner)
     * @param newTreasury The new treasury address
     */
    function updateTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury address");
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }
    
    /**
     * @dev Update quest fee (only owner)
     * @param newFee The new fee amount in wei
     */
    function updateQuestFee(uint256 newFee) external onlyOwner {
        require(newFee > 0, "Fee must be greater than 0");
        uint256 oldFee = questFee;
        questFee = newFee;
        emit QuestFeeUpdated(oldFee, newFee);
    }
    
    /**
     * @dev Emergency withdraw - only if funds get stuck in contract
     * Should not normally have balance as fees go directly to treasury
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        
        (bool success, ) = owner().call{value: balance}("");
        require(success, "Withdraw failed");
    }
    
    /**
     * @dev Check if user holds any TravelMint NFTs
     * @param user The user address
     * @return bool Whether user holds at least one NFT
     */
    function isNFTHolder(address user) external view returns (bool) {
        return travelNFT.balanceOf(user) > 0;
    }
}

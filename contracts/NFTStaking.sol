// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./ERC721Mock.sol";
import "./DevX.sol";

/**
 * @title NFTStaking
 * @dev Contract for staking NFTs and earning ERC20 rewards. Implements UUPS upgradeability pattern.
 */
contract NFTStaking is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    DevX public rewardToken;
    ERC721Mock public nftToken;

    uint256 public rewardPerBlock;
    uint256 public unbondingPeriod;
    uint256 public rewardClaimDelay;

    struct StakeInfo {
        uint256 stakedAtBlock;
        uint256 unbondingStartBlock;
        uint256 rewards;
    }

    mapping(address => mapping(uint256 => StakeInfo)) public stakes;
    mapping(address => uint256[]) public userStakedTokens;

    event Staked(address indexed user, uint256 tokenId);
    event Unstaked(address indexed user, uint256 tokenId);
    event Withdrawn(address indexed user, uint256 tokenId);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardPerBlockUpdated(uint256 newRewardPerBlock);
    event UnbondingPeriodUpdated(uint256 newUnbondingPeriod);
    event RewardClaimDelayUpdated(uint256 newRewardClaimDelay);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract with the given parameters.
     * @param _rewardToken The address of the ERC20 reward token.
     * @param _nftToken The address of the ERC721 NFT token.
     * @param _rewardPerBlock The reward rate per block.
     * @param _unbondingPeriod The unbonding period in blocks.
     * @param _rewardClaimDelay The reward claim delay in blocks.
     * @param _initialOwner The address of the owner.
     */
    function initialize(
        DevX _rewardToken,
        ERC721Mock _nftToken,
        uint256 _rewardPerBlock,
        uint256 _unbondingPeriod,
        uint256 _rewardClaimDelay,
        address _initialOwner
    ) public initializer {
        __Pausable_init();
        __Ownable_init(_initialOwner);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        require(
            address(_rewardToken) != address(0),
            "Invalid reward token address"
        );
        require(address(_nftToken) != address(0), "Invalid NFT token address");

        rewardToken = _rewardToken;
        nftToken = _nftToken;
        rewardPerBlock = _rewardPerBlock;
        unbondingPeriod = _unbondingPeriod;
        rewardClaimDelay = _rewardClaimDelay;
    }

    /**
     * @dev Authorizes upgrades to the contract. Only callable by the owner.
     * @param newImplementation The address of the new implementation contract.
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    /**
     * @dev Stakes the given NFTs. Transfers NFTs from the user to the contract.
     * @param tokenIds The IDs of the NFTs to stake.
     */
    function stake(uint256[] calldata tokenIds) external whenNotPaused {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            require(stakes[msg.sender][tokenId].stakedAtBlock == 0, "Token already staked");
            nftToken.transferFrom(msg.sender, address(this), tokenId);
            stakes[msg.sender][tokenId] = StakeInfo(block.number, 0, 0);
            userStakedTokens[msg.sender].push(tokenId);
            emit Staked(msg.sender, tokenId);
        }
    }

    /**
     * @dev Unstakes the given NFTs. Initiates the unbonding period.
     * @param tokenIds The IDs of the NFTs to unstake.
     */
    function unstake(uint256[] calldata tokenIds) external whenNotPaused {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            StakeInfo storage stakeInfo = stakes[msg.sender][tokenId];
            require(stakeInfo.stakedAtBlock > 0, "NFT not staked");
            require(stakeInfo.unbondingStartBlock == 0, "NFT already in unbonding");

            _updateRewards(msg.sender, tokenId);

            // To ensure it's not mistaken as still staked
            stakeInfo.stakedAtBlock = 0; 

            stakeInfo.unbondingStartBlock = block.number;
            emit Unstaked(msg.sender, tokenId);
        }
    }

    /**
     * @dev Withdraws an unstaked NFT after the unbonding period.
     * @param tokenId The ID of the NFT to withdraw.
     */
    function withdraw(uint256 tokenId) external whenNotPaused {
        StakeInfo storage stakeInfo = stakes[msg.sender][tokenId];
        require(stakeInfo.unbondingStartBlock > 0, "NFT not unstaked");
        require(
            block.number >= stakeInfo.unbondingStartBlock + unbondingPeriod,
            "Unbonding period not over"
        );

        nftToken.transferFrom(address(this), msg.sender, tokenId);
        delete stakes[msg.sender][tokenId];
        _removeUserStakedToken(msg.sender, tokenId);
        emit Withdrawn(msg.sender, tokenId);
    }

    /**
     * @dev Claims accumulated rewards.
     */
    function claimRewards() external whenNotPaused {
        uint256 totalRewards = 0;
        uint256[] storage stakedTokens = userStakedTokens[msg.sender];

        for (uint256 i = 0; i < stakedTokens.length; i++) {
            uint256 tokenId = stakedTokens[i];
            StakeInfo storage stakeInfo = stakes[msg.sender][tokenId];

            if (
                stakeInfo.stakedAtBlock > 0 &&
                block.number >= stakeInfo.stakedAtBlock + rewardClaimDelay
            ) {
                _updateRewards(msg.sender, tokenId);
                totalRewards += stakeInfo.rewards;
                stakeInfo.rewards = 0;
            }
        }

        require(totalRewards > 0, "No rewards to claim");
        rewardToken.mint(msg.sender, totalRewards);
        emit RewardsClaimed(msg.sender, totalRewards);
    }

    /**
     * @dev Updates the rewards for a staked NFT.
     * @param user The address of the user.
     * @param tokenId The ID of the staked NFT.
     */
    function _updateRewards(address user, uint256 tokenId) internal {
        StakeInfo storage stakeInfo = stakes[user][tokenId];
        if (stakeInfo.unbondingStartBlock == 0) {
            uint256 blocksStaked = block.number - stakeInfo.stakedAtBlock;
            stakeInfo.rewards += blocksStaked * rewardPerBlock;
            stakeInfo.stakedAtBlock = block.number;
        }
    }

    /**
     * @dev Removes a staked NFT from the user's list.
     * @param user The address of the user.
     * @param tokenId The ID of the staked NFT.
     */
    function _removeUserStakedToken(address user, uint256 tokenId) internal {
        uint256[] storage stakedTokens = userStakedTokens[user];
        for (uint256 i = 0; i < stakedTokens.length; i++) {
            if (stakedTokens[i] == tokenId) {
                stakedTokens[i] = stakedTokens[stakedTokens.length - 1];
                stakedTokens.pop();
                break;
            }
        }
    }

    /**
     * @dev Sets the reward rate per block.
     * @param _rewardPerBlock The new reward rate per block.
     */
    function setRewardPerBlock(uint256 _rewardPerBlock) external onlyOwner {
        rewardPerBlock = _rewardPerBlock;
        emit RewardPerBlockUpdated(_rewardPerBlock);
    }

    /**
     * @dev Sets the unbonding period.
     * @param _unbondingPeriod The new unbonding period in blocks.
     */
    function setUnbondingPeriod(uint256 _unbondingPeriod) external onlyOwner {
        unbondingPeriod = _unbondingPeriod;
        emit UnbondingPeriodUpdated(_unbondingPeriod);
    }

    /**
     * @dev Sets the reward claim delay.
     * @param _rewardClaimDelay The new reward claim delay in blocks.
     */
    function setRewardClaimDelay(uint256 _rewardClaimDelay) external onlyOwner {
        rewardClaimDelay = _rewardClaimDelay;
        emit RewardClaimDelayUpdated(_rewardClaimDelay);
    }

    /**
     * @dev Pauses the contract.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpauses the contract.
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}

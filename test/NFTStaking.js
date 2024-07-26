const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { mine } = require("@nomicfoundation/hardhat-network-helpers");

describe("NFTStaking", function () {
  let NFTStaking, staking, owner, addr1, addr2;
  let RewardToken, rewardToken;
  let NFTToken, nftToken;
  let rewardTokenAddress, NFTTokenAddress, NFTStakingAddress;
  const rewardPerBlock = 10;
  const unbondingPeriod = 10;
  const rewardClaimDelay = 5;

  beforeEach(async function () {
    [owner, addr1, addr2, _] = await ethers.getSigners();
    RewardToken = await ethers.getContractFactory("DevX");
    rewardToken = await RewardToken.deploy(owner.address);
    await rewardToken.deploymentTransaction().wait();
    rewardTokenAddress = await rewardToken.getAddress();

    NFTToken = await ethers.getContractFactory("ERC721Mock");
    nftToken = await NFTToken.deploy();
    await nftToken.deploymentTransaction().wait();
    NFTTokenAddress = await nftToken.getAddress();

    NFTStaking = await ethers.getContractFactory("NFTStaking");
    staking = await upgrades.deployProxy(
      NFTStaking,
      [
        await rewardToken.getAddress(),
        await nftToken.getAddress(),
        rewardPerBlock,
        unbondingPeriod,
        rewardClaimDelay,
        owner.address,
      ],
      { initializer: "initialize", kind: 'uups' }
    );
    await staking.deploymentTransaction().wait();
    NFTStakingAddress = await staking.getAddress();
    await rewardToken.connect(owner).addController(NFTStakingAddress);
  });

  describe("Deployment", function () {
    it("Should deploy with correct parameters", async function () {
      expect(await staking.rewardToken()).to.equal(
        await rewardToken.getAddress()
      );
      expect(await staking.nftToken()).to.equal(await nftToken.getAddress());
      expect(await staking.rewardPerBlock()).to.equal(rewardPerBlock);
      expect(await staking.unbondingPeriod()).to.equal(unbondingPeriod);
      expect(await staking.rewardClaimDelay()).to.equal(rewardClaimDelay);
    });
  });

  describe("Staking", function () {
    it("Should stake NFTs", async function () {
      await nftToken.mint(addr1.address);
      await nftToken.connect(addr1).approve(NFTStakingAddress, 1);
      await staking.connect(addr1).stake([1]);
      expect(await nftToken.ownerOf(1)).to.equal(NFTStakingAddress);
      const stakeInfo = await staking.stakes(addr1.address, 1);
      expect(parseInt(stakeInfo.stakedAtBlock)).to.be.greaterThan(0);
    });

    it("Should prevent staking already staked NFTs", async function () {
      await nftToken.mint(addr1.address);
      await nftToken.connect(addr1).approve(NFTStakingAddress, 1);
      await staking.connect(addr1).stake([1]);
      await expect(staking.connect(addr1).stake([1])).to.be.revertedWith(
        "Token already staked"
      );
    });
  });

  describe("Unstaking", function () {
    it("Should unstake NFTs and initiate unbonding", async function () {
      await nftToken.mint(addr1.address);
      await nftToken.connect(addr1).approve(NFTStakingAddress, 1);
      await staking.connect(addr1).stake([1]);
      await staking.connect(addr1).unstake([1]);
      const stakeInfo = await staking.stakes(addr1.address, 1);
      expect(parseInt(stakeInfo.unbondingStartBlock)).to.be.greaterThan(0);
    });

    it("Should prevent unstaking NFTs not staked", async function () {
      await nftToken.mint(addr1.address);
      await nftToken.connect(addr1).approve(NFTStakingAddress, 1);
      await expect(staking.connect(addr1).unstake([1])).to.be.revertedWith(
        "NFT not staked"
      );
    });

    it("Should prevent unstaking NFTs already in unbonding", async function () {
      await nftToken.mint(addr1.address);
      await nftToken.connect(addr1).approve(NFTStakingAddress, 1);
      await staking.connect(addr1).stake([1]);
      await staking.connect(addr1).unstake([1]);
      await expect(staking.connect(addr1).unstake([1])).to.be.revertedWith(
        "NFT not staked"
      );
    });
  });

  describe("Withdraw", function () {
    it("Should withdraw unstaked NFTs after unbonding period", async function () {
      await nftToken.mint(addr1.address);
      await nftToken.connect(addr1).approve(NFTStakingAddress, 1);
      await staking.connect(addr1).stake([1]);
      await staking.connect(addr1).unstake([1]);
      await mine(20);
      await staking.connect(addr1).withdraw(1);
      expect(await nftToken.ownerOf(1)).to.equal(addr1.address);
    });

    it("Should prevent withdrawing NFTs before unbonding period", async function () {
      await nftToken.mint(addr1.address);
      await nftToken.connect(addr1).approve(NFTStakingAddress, 1);
      await staking.connect(addr1).stake([1]);
      await staking.connect(addr1).unstake([1]);
      await expect(staking.connect(addr1).withdraw(1)).to.be.revertedWith(
        "Unbonding period not over"
      );
    });
  });

  describe("Claiming Rewards", function () {
    it("Should claim rewards correctly", async function () {
      await nftToken.mint(addr1.address);
      await nftToken.connect(addr1).approve(NFTStakingAddress, 1);
      await staking.connect(addr1).stake([1]);
      await mine(20);
      await staking.connect(addr1).claimRewards();
      expect(await rewardToken.balanceOf(addr1.address)).to.equal(
        rewardPerBlock * 21
      );
    });

    it("Should prevent claiming rewards before claim delay", async function () {
      await nftToken.mint(addr1.address);
      await nftToken.connect(addr1).approve(NFTStakingAddress, 1);
      await staking.connect(addr1).stake([1]);
      await expect(staking.connect(addr1).claimRewards()).to.be.revertedWith(
        "No rewards to claim"
      );
    });
  });

  describe("Owner Functions", function () {
    it("Should update reward per block", async function () {
      await staking.connect(owner).setRewardPerBlock(20);
      expect(await staking.rewardPerBlock()).to.equal(20);
    });

    it("Should update unbonding period", async function () {
      await staking.connect(owner).setUnbondingPeriod(20);
      expect(await staking.unbondingPeriod()).to.equal(20);
    });

    it("Should update reward claim delay", async function () {
      await staking.connect(owner).setRewardClaimDelay(10);
      expect(await staking.rewardClaimDelay()).to.equal(10);
    });

    it("Should pause and unpause the contract", async function () {
      await staking.connect(owner).pause();
      await expect(
        staking.connect(addr1).stake([1])
      ).eventually.to.rejectedWith(
        Error,
        "VM Exception while processing transaction: reverted with custom error 'EnforcedPause()'"
      );

      await staking.connect(owner).unpause();
      await nftToken.mint(addr1.address);
      await nftToken.connect(addr1).approve(NFTStakingAddress, 1);
      await staking.connect(addr1).stake([1]);
      expect(await nftToken.ownerOf(1)).to.equal(NFTStakingAddress);
    });
  });

  describe("Access Control", function () {
    it("Should only allow owner to add/remove controllers", async function () {
      await expect(
        rewardToken.connect(addr1).addController(addr1.address)
      ).eventually.to.rejectedWith(
        Error,
        `VM Exception while processing transaction: reverted with custom error 'OwnableUnauthorizedAccount("${addr1.address}")'`
      );

      await rewardToken.connect(owner).addController(addr1.address);
      await expect(rewardToken.connect(addr1).mint(addr1.address, 100)).to.not
        .be.reverted;
      await rewardToken.connect(owner).removeController(addr1.address);
      await expect(
        rewardToken.connect(addr1).mint(addr1.address, 100)
      ).to.be.revertedWith("Only controllers can mint");
    });
  });

  describe("Pausable Functionality", function () {
    it("Should prevent unstaking when paused", async function () {
      await nftToken.mint(addr1.address);
      await nftToken.connect(addr1).approve(NFTStakingAddress, 1);
      await staking.connect(addr1).stake([1]);
      await staking.connect(owner).pause();
      await expect(
        staking.connect(addr1).unstake([1])
      ).eventually.to.rejectedWith(
        Error,
        "VM Exception while processing transaction: reverted with custom error 'EnforcedPause()'"
      );
    });

    it("Should prevent withdrawing when paused", async function () {
      await nftToken.mint(addr1.address);
      await nftToken.connect(addr1).approve(NFTStakingAddress, 1);
      await staking.connect(addr1).stake([1]);
      await staking.connect(addr1).unstake([1]);
      await mine(20);
      await staking.connect(owner).pause();
      await expect(
        staking.connect(addr1).withdraw(1)
      ).eventually.to.rejectedWith(
        Error,
        "VM Exception while processing transaction: reverted with custom error 'EnforcedPause()'"
      );
    });

    it("Should prevent claiming rewards when paused", async function () {
      await nftToken.mint(addr1.address);
      await nftToken.connect(addr1).approve(NFTStakingAddress, 1);
      await staking.connect(addr1).stake([1]);
      await mine(20);
      await staking.connect(owner).pause();
      await expect(
        staking.connect(addr1).claimRewards()
      ).eventually.to.rejectedWith(
        Error,
        "VM Exception while processing transaction: reverted with custom error 'EnforcedPause()'"
      );
    });
  });

  describe("Event Emission", function () {
    it("Should emit Stake event on staking", async function () {
      await nftToken.mint(addr1.address);
      await nftToken.connect(addr1).approve(NFTStakingAddress, 1);
      await expect(staking.connect(addr1).stake([1]))
        .to.emit(staking, "Staked")
        .withArgs(addr1.address, 1);
    });

    it("Should emit Unstake event on unstaking", async function () {
      await nftToken.mint(addr1.address);
      await nftToken.connect(addr1).approve(NFTStakingAddress, 1);
      await staking.connect(addr1).stake([1]);
      await expect(staking.connect(addr1).unstake([1]))
        .to.emit(staking, "Unstaked")
        .withArgs(addr1.address, 1);
    });

    it("Should emit Withdraw event on withdrawal", async function () {
      await nftToken.mint(addr1.address);
      await nftToken.connect(addr1).approve(NFTStakingAddress, 1);
      await staking.connect(addr1).stake([1]);
      await staking.connect(addr1).unstake([1]);
      await mine(20);
      await expect(staking.connect(addr1).withdraw(1))
        .to.emit(staking, "Withdrawn")
        .withArgs(addr1.address, 1);
    });

    it("Should emit ClaimRewards event on reward claim", async function () {
      await nftToken.mint(addr1.address);
      await nftToken.connect(addr1).approve(NFTStakingAddress, 1);
      await staking.connect(addr1).stake([1]);
      await mine(20);
      await expect(staking.connect(addr1).claimRewards())
        .to.emit(staking, "RewardsClaimed")
        .withArgs(addr1.address, rewardPerBlock * 21);
    });
  });
});

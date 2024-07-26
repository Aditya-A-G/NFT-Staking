const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const RewardTokenFactory = await ethers.getContractFactory("DevX");
  const rewardToken = await RewardTokenFactory.deploy(deployer.address);
  await rewardToken.deploymentTransaction().wait();
  const rewardTokenAddress = await rewardToken.getAddress();
  console.log("RewardToken deployed to:", rewardTokenAddress);

  const NFTTokenFactory = await ethers.getContractFactory("ERC721Mock");
  const nftToken = await NFTTokenFactory.deploy();
  await nftToken.deploymentTransaction().wait();
  const nftTokenAddress = await nftToken.getAddress();
  console.log("NFTToken deployed to:", nftTokenAddress);

  const NFTStaking = await ethers.getContractFactory("NFTStaking");
  const staking = await upgrades.deployProxy(
    NFTStaking,
    [rewardTokenAddress, nftTokenAddress, 10, 10, 5, deployer.address],
    { initializer: "initialize", kind: 'uups' }
  );
  await staking.deploymentTransaction().wait();
  const stakingAddress = await staking.getAddress();
  console.log("NFTStaking deployed to:", stakingAddress);
  
  await rewardToken.connect(deployer).addController(stakingAddress);
  console.log("Staking contract added as controller in RewardToken.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

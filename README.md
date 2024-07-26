# NFT Staking Contract

# Deployed Contract Addresses

- RewardToken deployed to: 0x1E80aF95e3FA22CBCC9860602Efc81f937031231
- NFTToken deployed to: 0xF204248E964Cf9Dc7De9C3670A6BF68506472813
- Proxy deployed to: 0x252b4AE2eA4993C72574AC24E9725F656eC50B42
- NFTStaking deployed to: 0xc2147115dE66887eA226F5a0b5a617EF62b1fe73

## Overview
This contract allows users to stake NFTs and earn ERC20 rewards. The contract supports upgradeability using the UUPS pattern.

## Features
- Stake and unstake NFTs.
- Claim ERC20 rewards.
- Configurable reward rate, unbonding period, and claim delay.
- Pausable contract.
- Upgradeable using the UUPS pattern.

## Installation
1. Clone the repository.
2. Install dependencies:
    ```bash
    npm install
    ```

## Deployment
1. Configure the deployment script in `scripts/deploy.js`.
2. Run the deployment script:
    ```bash
    npx hardhat run scripts/deploy.js --network <network-name>
    ```

## Testing
1. Run tests:
    ```bash
    npx hardhat test
    ```

## Interacting with the Contract
1. Use Hardhat console to interact with the contract:
    ```bash
    npx hardhat console --network <network-name>
    ```

2. Example interaction:
    ```javascript
    const NFTStaking = await ethers.getContractFactory("NFTStaking");
    const staking = await NFTStaking.attach("<deployed-address>");
    await staking.stake([1, 2, 3]);
    ```

## License
This project is licensed under the MIT License.

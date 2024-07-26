# NFT Staking Contract

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

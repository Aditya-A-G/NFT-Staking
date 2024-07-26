const { ethers, upgrades } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Upgrading contracts with the account:", deployer.address);

    // Get the address of the existing proxy contract
    const proxyAddress = "0xExistingProxyAddress"; // Replace with the proxy contract address

    // Get the contract factory for the new implementation
    const NFTStakingV2 = await ethers.getContractFactory("NFTStakingV2"); // New implementation

    // Upgrade the proxy to point to the new implementation
    console.log("Upgrading proxy...");
    await upgrades.upgradeProxy(proxyAddress, NFTStakingV2);
    console.log("Proxy upgraded to new implementation");
    console.log("Upgraded proxy address:", upgradedProxy.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/**
 * @title DevX
 * @dev Custom ERC20 token for reward distribution with controlled minting.
 */
contract DevX is ERC20, ERC20Burnable, Ownable {
    mapping(address => bool) controllers;
  
    constructor(address _initialOwner) ERC20("DevX", "DX") Ownable(_initialOwner) {}

    /**
     * @dev Mints tokens to a specified address. Only controllers can call this function.
     * @param to The address to receive the minted tokens.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) external {
        require(controllers[msg.sender], "Only controllers can mint");
        _mint(to, amount);
    }

    /**
     * @dev Burns tokens from a specified address. If the caller is a controller, it burns directly.
     * @param account The address from which to burn tokens.
     * @param amount The amount of tokens to burn.
     */
    function burnFrom(address account, uint256 amount) public override {
        if (controllers[msg.sender]) {
            _burn(account, amount);
        } else {
            super.burnFrom(account, amount);
        }
    }

    /**
     * @dev Adds a controller address. Only the owner can call this function.
     * @param controller The address to be added as a controller.
     */
    function addController(address controller) external onlyOwner {
        controllers[controller] = true;
    }

    /**
     * @dev Removes a controller address. Only the owner can call this function.
     * @param controller The address to be removed as a controller.
     */
    function removeController(address controller) external onlyOwner {
        controllers[controller] = false;
    }
}

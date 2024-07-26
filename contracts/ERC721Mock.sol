// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title ERC721Mock
 * @dev Simple ERC721 Token example, where all tokens are pre-assigned to the creator.
 * Note they can later distribute these tokens as they wish using `transfer` and other
 * `ERC721` functions.
 */
contract ERC721Mock is ERC721 {
    uint256 private _currentTokenId;

    constructor() ERC721("MockNFT", "MNFT") {}

    /**
     * @dev Mints a new token to the specified address.
     * @param to The address to receive the minted token.
     * @return tokenId The ID of the minted token.
     */
    function mint(address to) external returns (uint256 tokenId) {
        _currentTokenId++;
        tokenId = _currentTokenId;
        _mint(to, tokenId);
    }

    /**
     * @dev _baseURI to return a custom base URI for the NFTs.
     * @return baseURI The base URI for the NFTs.
     */
    function _baseURI() internal pure override returns (string memory) {
        return "https://api.example.com/metadata/";
    }
}

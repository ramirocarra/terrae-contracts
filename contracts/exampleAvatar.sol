// contracts/GameItem.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract ExampleAvatar is ERC721Enumerable {
  constructor() ERC721("ExampleAvatarTerrae", "EAT") {}

  function awardAvatar(address _address) public returns (uint256) {
    uint256 newAvatarId = totalSupply();
    _mint(_address, newAvatarId);

    return newAvatarId;
  }

  function _baseURI() internal pure override returns (string memory) {
    return "https:/test.avatar/";
  }
}

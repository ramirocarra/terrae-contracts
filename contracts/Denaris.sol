// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

contract Denaris is ERC20Votes {
  constructor(address _treasury) ERC20("Denaris", "DENI") ERC20Permit("Denaris") {
    _mint(_treasury, 50_000_000 ether);
  }
}

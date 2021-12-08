// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Profiles.sol";

contract ExampleHouse {
  address private _profileContractAddress;

  constructor(address profileContractAddress) {
    _profileContractAddress = profileContractAddress;
  }

  /**
   * @dev Selects this house for a profile.
   * Should be called by the profile owner
   */
  function selectHouse() public returns (bool) {
    Profiles profileContract = Profiles(_profileContractAddress);
    // Check if user has enough experience
    uint256 profileExp = profileContract.getExp(msg.sender);
    require(profileExp > 1000, "Not enough experience to set this house");

    // Check that no house has been set
    address currentHouseContract = profileContract.getHouseContract(msg.sender);
    require(currentHouseContract == address(0), "Profile already has a House");

    profileContract.setHouseContract(msg.sender);

    return true;
  }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract Profiles is AccessControl, ERC721Enumerable {
  bytes32 private constant USE_ENERGY_ROLE = keccak256("USE_ENERGY_ROLE");
  bytes32 private constant MANTAINER_ROLE = keccak256("MANTAINER_ROLE");
  bytes32 private constant ADD_EXP_ROLE = keccak256("ADD_EXP_ROLE");

  mapping(uint256 => Profile) public profiles;
  mapping(string => uint256) private _nameToProfileId;
  mapping(address => bool) private _avatarContractsEnabled;

  uint8 private _maxDefaultAvatars = 4;
  string private _defaultAvatarBaseURI = "https://terrae.finance/avatars/";

  uint256 public maxEnergy = 100;
  uint256 public secondsPerEnergy = 300;

  struct Profile {
    string name; //limits???? moderator?
    uint256 created;
    uint256 exp;
    uint8 defaultAvatarId;
    // The id of the custom NFT Avatar
    // Allow to whitelist minting contracts?
    uint256 customAvatarId;
    address customAvatarContract; // Minting address if customizable, will need to ckeck ownership always
    uint256 energy;
    uint256 energyTimestamp;
  }

  // Symbol thoughts????
  constructor() ERC721("TerraeProfile", "TPC") {
    _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    _setupRole(MANTAINER_ROLE, msg.sender);

    // assign profile zero to owner
    createProfile("Owner", 0);
  }

  function _baseURI() internal pure override returns (string memory) {
    return "https://terrae.finance/profile/";
  }

  // Avoid transfer to users that already own a profile
  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal virtual override {
    super._beforeTokenTransfer(from, to, amount);
    require(!hasProfile(to), "Receiving address already owns a profile");
  }

  /**
   * @dev See {IERC165-supportsInterface}.
   */
  function supportsInterface(bytes4 interfaceId) public view override(AccessControl, ERC721Enumerable) returns (bool) {
    return
      interfaceId == type(IERC721).interfaceId ||
      interfaceId == type(IERC721Metadata).interfaceId ||
      super.supportsInterface(interfaceId);
  }

  /**
   * @dev Checks if the address has a profile.
   */
  function hasProfile(address _address) public view returns (bool) {
    return balanceOf(_address) > 0;
  }

  /**
   * @dev Checks if the name is already taken.
   */
  function nameTaken(string memory _name) public view returns (bool) {
    return (_nameToProfileId[_name] > 0);
  }

  /**
   * @dev Creates a new profile.
   * only one profile can be owned by an address
   */
  function createProfile(string memory name, uint8 defaultAvatarId) public returns (uint256) {
    require(defaultAvatarId < _maxDefaultAvatars, "avatar id selected not available");
    require(!hasProfile(msg.sender), "address already has a Profile");
    require(!nameTaken(name), "name already taken");

    uint256 profileId = totalSupply();
    _nameToProfileId[name] = profileId;

    _safeMint(msg.sender, profileId); // mint to origin or sender??
    profiles[profileId] = Profile(
      name,
      block.timestamp,
      1, // experience
      defaultAvatarId, //default avatar
      0, // custom avatar id
      address(0), // custom avatar address
      maxEnergy, // energy
      block.timestamp //energy timestamp
    );

    return profileId;
  }

  /**
   * @dev Gets and address by Profile Id.
   *  Fails if profile id doesnt exist
   */
  function getAddressByProfileId(uint256 profileId) public view returns (address) {
    return ownerOf(profileId);
  }

  /**
   * @dev Gets a profile by its Id.
   */
  function getProfileById(uint256 _profileId)
    public
    view
    returns (
      string memory,
      uint256,
      uint256,
      uint8,
      uint256,
      address,
      bool,
      string memory
    )
  {
    require(_exists(_profileId), "Profile does not exist");
    Profile memory profile = profiles[_profileId];
    string memory avatarURI = bytes(_defaultAvatarBaseURI).length > 0
      ? string(abi.encodePacked(_defaultAvatarBaseURI, Strings.toString(profile.defaultAvatarId)))
      : "";
    // Check if a custom avatar exists and that it is still owned by profile
    bool ownsCustomAvatar = false;
    if (profile.customAvatarContract != address(0)) {
      IERC721Metadata customAvatarContractInterface = IERC721Metadata(profile.customAvatarContract);
      if (getAddressByProfileId(_profileId) == customAvatarContractInterface.ownerOf(profile.customAvatarId)) {
        ownsCustomAvatar = true;
        avatarURI = customAvatarContractInterface.tokenURI(profile.customAvatarId);
      }
    }

    return (
      profile.name,
      profile.created,
      profile.exp,
      profile.defaultAvatarId,
      profile.customAvatarId,
      profile.customAvatarContract,
      ownsCustomAvatar,
      avatarURI
    );
  }

  /**
   * @dev Gets a profile ID by address.
   */
  // Set the return types when defined
  function getProfileIdByAddress(address _address) public view returns (uint256) {
    require(hasProfile(_address), "address does not own a profile");
    return tokenOfOwnerByIndex(_address, 0);
  }

  /**
   * @dev Gets a profile ID by name.
   */
  // Set the return types when defined
  function getProfileIdByName(string memory profileName) public view returns (uint256) {
    require(nameTaken(profileName), "name not found");
    return _nameToProfileId[profileName];
  }

  /**
   * @dev Update default avatar.
   * Only owner change the avatar or must be approved
   */
  function updateDefaultAvatar(uint256 profileId, uint8 defaultAvatarId) public returns (bool) {
    require(_isApprovedOrOwner(msg.sender, profileId), "caller is not owner nor approved");
    require(defaultAvatarId < _maxDefaultAvatars, "avatar id selected not available");
    profiles[profileId].defaultAvatarId = defaultAvatarId;
    return true;
  }

  /**
   * @dev Update custom avatar.
   * Only owner change the avatar or must be approved
   * Avatar Contract should be whitelisted
   * Owner should own the NFT avatar
   */
  function updateCustomAvatar(
    uint256 profileId,
    uint8 customAvatarId,
    address customAvatarContract
  ) public returns (bool) {
    require(_isApprovedOrOwner(msg.sender, profileId), "caller is not owner nor approved");
    require(_avatarContractsEnabled[customAvatarContract], "Avatar contract not whitelisted");
    // check that is owned in contract
    require(
      getAddressByProfileId(profileId) == IERC721Metadata(customAvatarContract).ownerOf(customAvatarId),
      "Avatar not owned by profile owner"
    );

    profiles[profileId].customAvatarId = customAvatarId;
    profiles[profileId].customAvatarContract = customAvatarContract;
    return true;
  }

  /**
   * @dev Updates the experience for a profile by it's address.
   * Only constracts with ADD_EXP_ROLE can call
   */
  function addExp(address profileAddress, uint256 newExp) public onlyRole(ADD_EXP_ROLE) {
    require(hasProfile(profileAddress), "address does not own a profile");
    uint256 profileId = tokenOfOwnerByIndex(profileAddress, 0);
    profiles[profileId].exp += newExp;
  }

  /**
   * @dev Get the energy by profile id.
   */
  function getEnergy(uint256 profileId) public view returns (uint256) {
    require(_exists(profileId), "Profile does not exist");
    Profile memory profile = profiles[profileId];
    uint256 newEnergy = (block.timestamp - profile.energyTimestamp) / secondsPerEnergy;
    (bool overflowed, uint256 totalEnergy) = SafeMath.tryAdd(profile.energy, newEnergy);
    if (!overflowed || totalEnergy > maxEnergy) {
      totalEnergy = maxEnergy;
    }
    return totalEnergy;
  }

  /**
   * @dev Consumes energy for a profile by it's address.
   * Only constracts with USE_ENERGY_ROLE can call
   * Returns true if consumed, false if not enough energy
   */
  function useEnergy(address profileAddress, uint256 energyToConsume) public onlyRole(USE_ENERGY_ROLE) returns (bool) {
    require(hasProfile(profileAddress), "address does not own a profile");
    uint256 profileId = tokenOfOwnerByIndex(profileAddress, 0);
    uint256 currentEnergy = getEnergy(profileId);
    if (currentEnergy < energyToConsume) {
      // Or revert????
      return false;
    }
    profiles[profileId].energy = currentEnergy - energyToConsume;
    return true;
  }

  // Maintenance functions

  /**
   * @dev Updates the maximum default avatars available.
   * Only MANTAINER_ROLE can call
   */
  function updateMaxDefaultAvatars(uint8 newMaxDefaultAvatars) public onlyRole(MANTAINER_ROLE) {
    _maxDefaultAvatars = newMaxDefaultAvatars;
  }

  /**
   * @dev Adds a new ERC721 contract for custom avatars.
   * Only MANTAINER_ROLE can call
   */
  function addCustomAvatarContract(address customAvatarContract) public onlyRole(MANTAINER_ROLE) {
    require(Address.isContract(customAvatarContract), "Cannot verify contract existance");
    require(
      ERC165Checker.supportsInterface(customAvatarContract, type(IERC721Metadata).interfaceId),
      "Contract is not IERC721Metadata compliant"
    );
    _avatarContractsEnabled[customAvatarContract] = true;
  }

  /**
   * @dev removes a contract for custom avatars.
   * Only MANTAINER_ROLE can call
   */
  function removeCustomAvatarContract(address customAvatarContract) public onlyRole(MANTAINER_ROLE) {
    _avatarContractsEnabled[customAvatarContract] = false;
  }

  /**
   * @dev Updates the default Avatar Base URI.
   * Only MANTAINER_ROLE can call
   */
  function updateDefaultAvatarBaseURI(string memory newDefaultAvatarBaseURI) public onlyRole(MANTAINER_ROLE) {
    _defaultAvatarBaseURI = newDefaultAvatarBaseURI;
  }

  /**
   * @dev Updates the energy max value.
   * Only MANTAINER_ROLE can call
   */
  function updateMaxEnergy(uint256 newMaxEnergy) public onlyRole(MANTAINER_ROLE) {
    maxEnergy = newMaxEnergy;
  }

  /**
   * @dev Updates the seconds Per Energy.
   * Only MANTAINER_ROLE can call
   */
  function updateSecondsPerEnergy(uint256 newSecondsPerEnergy) public onlyRole(MANTAINER_ROLE) {
    secondsPerEnergy = newSecondsPerEnergy;
  }
}

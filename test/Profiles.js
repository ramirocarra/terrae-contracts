const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Terrae Profiles", () => {
  let profiles;
  let randomWallet;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async () => {
    [owner, addr1, addr2] = await ethers.getSigners();
    const Profiles = await ethers.getContractFactory("Profiles");
    profiles = await Profiles.deploy();
    await profiles.deployed();
    randomWallet = await new ethers.Wallet.createRandom().connect(
      ethers.provider
    );
  });

  it("Should Check Token initialized and owner profile", async () => {
    expect(await profiles.name()).to.equal("TerraeProfile");
    expect(await profiles.symbol()).to.equal("TPC");
    expect(await profiles.totalSupply()).to.equal(1);
    expect((await profiles.getProfileById(0))[0]).to.equal("Owner");
    expect(await profiles.tokenURI(0)).to.equal(
      "https://terrae.finance/profile/0"
    );
    // check roles
    expect(
      // admin role
      await profiles.hasRole("0x".padEnd(66, "0"), owner.address)
    ).to.equal(true);
    expect(
      await profiles.hasRole(
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MANTAINER_ROLE")),
        owner.address
      )
    ).to.equal(true);
  });

  describe("New profiles", () => {
    it("Should mint a profile and check getters", async () => {
      const tx = await profiles.connect(addr1).createProfile("John Doe", 2);
      const receipt = await tx.wait();
      console.log("Gas used to mint a profile: ", receipt.gasUsed.toNumber());

      expect(await profiles.totalSupply()).to.equal(2);
      const mintedProfile = await profiles.getProfileById(1);
      expect(mintedProfile[0]).to.equal("John Doe");
      expect(mintedProfile[2]).to.equal(1);
      expect(mintedProfile[3]).to.equal(0);
      expect(mintedProfile[8]).to.equal("https://terrae.finance/avatars/2");
      expect(
        await profiles
          .connect(randomWallet.address)
          .getProfileIdByAddress(addr1.address)
      ).to.equal(1);
      expect(
        await profiles
          .connect(randomWallet.address)
          .getProfileIdByName("John Doe")
      ).to.equal(1);
    });

    it("Should mint two profiles and check getters", async () => {
      await profiles.connect(addr1).createProfile("John Doe", 2);
      await profiles.connect(addr2).createProfile("Jack Black", 3);
      expect(await profiles.totalSupply()).to.equal(3);
      const mintedProfile = await profiles.getProfileById(2);
      expect(mintedProfile[0]).to.equal("Jack Black");
      expect(await profiles.getProfileIdByAddress(addr2.address)).to.equal(2);
      expect(await profiles.getProfileIdByName("Jack Black")).to.equal(2);
    });

    it("Should try to overflow max default avatars and fail", async () => {
      await expect(
        profiles.connect(addr1).createProfile("John Doe", 11)
      ).to.be.revertedWith(
        "VM Exception while processing transaction: reverted with reason string 'avatar id selected not available'"
      );
    });

    it("Should try to use same name and fail", async () => {
      await profiles.connect(addr1).createProfile("John Doe", 2);
      await expect(
        profiles.connect(addr2).createProfile("John Doe", 3)
      ).to.be.revertedWith(
        "VM Exception while processing transaction: reverted with reason string 'name already taken'"
      );
    });

    it("Should try to create a second profile qith same address and fail", async () => {
      await profiles.connect(addr1).createProfile("John Doe", 2);
      await expect(
        profiles.connect(addr1).createProfile("Jack Black", 3)
      ).to.be.revertedWith(
        "VM Exception while processing transaction: reverted with reason string 'address already has a Profile'"
      );
    });
  });

  describe("Profile Transfer", () => {
    it("Should transfer a profile", async () => {
      await profiles.connect(addr1).createProfile("John Doe", 2);
      expect(await profiles.getProfileIdByAddress(addr1.address)).to.equal(1);

      const tx = await profiles
        .connect(addr1)
        .transferFrom(addr1.address, addr2.address, 1);
      const receipt = await tx.wait();
      console.log(
        "Gas used to transfer a profile: ",
        receipt.gasUsed.toNumber()
      );

      expect(await profiles.getAddressByProfileId(1)).to.equal(addr2.address);
      expect(await profiles.totalSupply()).to.equal(2);
      await expect(
        profiles.getProfileIdByAddress(addr1.address)
      ).to.be.revertedWith(
        "VM Exception while processing transaction: reverted with reason string 'address does not own a profile'"
      );
    });

    it("Should try to transfer to an address with profile and fail", async () => {
      await profiles.connect(addr1).createProfile("John Doe", 2);
      await profiles.connect(addr2).createProfile("Jack Black", 2);
      await expect(
        profiles.connect(addr1).transferFrom(addr1.address, addr2.address, 1)
      ).to.be.revertedWith(
        "VM Exception while processing transaction: reverted with reason string 'Receiving address already owns a profile'"
      );
    });
  });

  describe("Experience stats and usage", () => {
    it("Should get and update exp", async () => {
      await profiles.connect(addr1).createProfile("John Doe", 2);
      expect(await profiles.getLevel(1)).to.equal(0);

      // grant role
      await profiles.grantRole(
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ADD_EXP_ROLE")),
        addr2.address
      );
      // add exp to user
      await profiles.connect(addr2).addExp(addr1.address, 2000);
      // check level
      expect(await profiles.getLevel(1)).to.equal(2);

    });
  });

  describe("Energy stats and usage", () => {
    it("Should get and use energy", async () => {
      await profiles.connect(addr1).createProfile("John Doe", 2);
      expect(await profiles.getEnergy(1)).to.equal(100);

      // grant role
      await profiles.grantRole(
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("USE_ENERGY_ROLE")),
        addr2.address
      );
      // use Energy
      await profiles.connect(addr2).useEnergy(addr1.address, 20);
      // get new Energy
      expect(await profiles.getEnergy(1)).to.equal(80);
    });
  });

  describe("Avatar updating", () => {
    let notNftContract;
    let exampleAvatarContract;

    beforeEach(async () => {
      const Denaris = await ethers.getContractFactory("Denaris");
      notNftContract = await Denaris.deploy(owner.address);
      await notNftContract.deployed();
      const ExampleAvatar = await ethers.getContractFactory("ExampleAvatar");
      exampleAvatarContract = await ExampleAvatar.deploy();
      await exampleAvatarContract.deployed();
    });

    it("Should update default avatar", async () => {
      await profiles.connect(addr1).createProfile("John Doe", 2);
      expect((await profiles.getProfileById(1))[8]).to.equal(
        "https://terrae.finance/avatars/2"
      );
      await profiles
        .connect(addr1)
        .updateDefaultAvatar(1, 3);
      expect((await profiles.getProfileById(1))[8]).to.equal(
        "https://terrae.finance/avatars/3"
      );
    });

    it("Should add an ERC721 compliant contract and update a custom avatar", async () => {
      expect(
        profiles
          .connect(owner)
          .addCustomAvatarContract(exampleAvatarContract.address)
      ).to.not.reverted;

      await profiles.connect(addr1).createProfile("John Doe", 2);

      // Try with not owned or not existent
      await expect(
        profiles
          .connect(addr1)
          .updateCustomAvatar(1, 2, exampleAvatarContract.address)
      ).to.be.revertedWith(
        "VM Exception while processing transaction: reverted with reason string 'ERC721: owner query for nonexistent token'"
      );

      // Mint an avatar
      await exampleAvatarContract.awardAvatar(addr1.address);

      // Try with owned
      await profiles
        .connect(addr1)
        .updateCustomAvatar(1, 0, exampleAvatarContract.address);

      // Get profile with new avatar
      expect((await profiles.getProfileById(1))[8]).to.equal(
        "https:/test.avatar/0"
      );

      // transfer avatar
      await exampleAvatarContract
        .connect(addr1)
        .transferFrom(addr1.address, addr2.address, 0);

      // get profile without owning avatar
      expect((await profiles.getProfileById(1))[8]).to.equal(
        "https://terrae.finance/avatars/2"
      );

      // remove whitelisted
      await profiles
        .connect(owner)
        .removeCustomAvatarContract(exampleAvatarContract.address);

      // try to use it again
      await expect(
        profiles
          .connect(addr1)
          .updateCustomAvatar(1, 2, exampleAvatarContract.address)
      ).to.be.revertedWith(
        "VM Exception while processing transaction: reverted with reason string 'Avatar contract not whitelisted'"
      );
    });

    it("Should try to use a not whitelisted contract", async () => {
      await profiles.connect(addr1).createProfile("John Doe", 2);
      await expect(
        profiles.connect(addr1).updateCustomAvatar(1, 2, addr2.address)
      ).to.be.revertedWith(
        "VM Exception while processing transaction: reverted with reason string 'Avatar contract not whitelisted'"
      );
    });

    it("Should try to whitelist an address that is not a contract", async () => {
      await expect(
        profiles.connect(owner).addCustomAvatarContract(addr2.address)
      ).to.be.revertedWith(
        "VM Exception while processing transaction: reverted with reason string 'Cannot verify contract existance'"
      );
    });

    it("Should try to add non ERC721 compliant contract", async () => {
      await expect(
        profiles.connect(owner).addCustomAvatarContract(notNftContract.address)
      ).to.be.revertedWith(
        "VM Exception while processing transaction: reverted with reason string 'Contract is not IERC721Metadata compliant'"
      );
    });
  });

  describe("Mantainer functions", () => {
    it("Should update max default avatars", async () => {
      await profiles.connect(owner).updateMaxDefaultAvatars(10);
      await profiles.connect(addr1).createProfile("John Doe", 9);
    });

    it("Should update default avatars base URI", async () => {
      await profiles.connect(addr1).createProfile("John Doe", 2);
      expect((await profiles.getProfileById(1))[8]).to.equal("https://terrae.finance/avatars/2");
      await profiles
        .connect(owner)
        .updateDefaultAvatarBaseURI("https://new.path/avatars/");
      expect((await profiles.getProfileById(1))[8]).to.equal(
        "https://new.path/avatars/2"
      );
    });

    it("Should update experience table", async () => {
      expect(await profiles.experienceTable(2)).to.equal(1048);
      await profiles.connect(owner).updateExperienceTable([1, 2, 3, 4, 5, 6]);
      expect(await profiles.experienceTable(2)).to.equal(3);
    });

    it("Should update max energy", async () => {
      expect(await profiles.maxEnergy()).to.equal(100);
      await profiles.connect(owner).updateMaxEnergy(222);
      expect(await profiles.maxEnergy()).to.equal(222);
    });

    it("Should update seconds per Energy", async () => {
      expect(await profiles.secondsPerEnergy()).to.equal(300);
      await profiles.connect(owner).updateSecondsPerEnergy(2222);
      expect(await profiles.secondsPerEnergy()).to.equal(2222);
    });

  });
});

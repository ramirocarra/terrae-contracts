const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Denaris Governance Token", () => {
  let denaris;
  let randomWallet;

  beforeEach(async() => {
    const [owner] = await ethers.getSigners();
    const Denaris = await ethers.getContractFactory("Denaris");
    denaris = await Denaris.deploy(owner.address);
    randomWallet = new ethers.Wallet.createRandom();
  });

  it("Check transfer function gas", async () => {
    const tx = await denaris.transfer(randomWallet.address, 100);
    const receipt = await tx.wait();
    expect(receipt.gasUsed.toNumber()).to.be.lessThan(150_000);
  });
});

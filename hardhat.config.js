require("dotenv").config();
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: "0.8.4",
  defaultNetwork: "hardhat",
  networks: {
    mainnet: {
      url: process.env.MAINNET_RPC_URL,
      gasMultiplier: 1.15,
    },
  }
};

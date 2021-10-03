const hardhat = require("hardhat");
const { ethers } = hardhat;

const main = async () => {
  const deployer = new ethers.Wallet(process.env.DEPLOYMENT_PRIVATE_KEY).connect(ethers.provider);
  const DenarisFactory = await ethers.getContractFactory("Denaris", deployer);
  
  const balance = ethers.utils.formatEther(await ethers.provider.getBalance(deployer.address));
  console.log(
    "About to deploy in", hardhat.network.name,
    "with Address:", deployer.address,
    "Balance:", balance, "ETH"
  );
  await sleepSeconds(3);

  console.log("Deploying...");
  const instance = await DenarisFactory.deploy(
    process.env.TREASURY_ADDRESS,
    {
      gasLimit: process.env.GAS_LIMIT,
      gasPrice: process.env.GAS_PRICE
    }
  );

  console.log("Transaction hash:", instance.deployTransaction.hash);

  await instance.deployed();
  await instance.deployTransaction.wait();
  
  console.log("Denaris deployed succesfully at address:", instance.address);
};

const sleepSeconds = (seconds) => new Promise((res) => setTimeout(res, seconds * 1000));

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error deploying the contract", error);
    process.exit(1);
  });

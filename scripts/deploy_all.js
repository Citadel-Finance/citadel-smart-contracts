const hre = require("hardhat");
const Web3 = require("web3");
const web3 = new Web3("");
fs = require('fs');


async function main() {
  require('dotenv').config();
  const CitadelToken = await hre.ethers.getContractFactory("CTLToken");
  const citadel_token = await CitadelToken.deploy(
    process.env.TOKEN_NAME,
    process.env.TOKEN_SYMBOL,
    process.env.TOKEN_DECIMALS,
    web3.utils.toWei(process.env.TOKEN_TOTAL_SUPPLY, "ether")
  );
  await citadel_token.deployed();
  console.log("Token address:", citadel_token.address);

  const CitadelFactory = await hre.ethers.getContractFactory("CitadelFactory");
  const citadel_factory = await CitadelFactory.deploy(citadel_token.address);
  await citadel_factory.deployed();

  await citadel_token.grantRole(await citadel_token.ADMIN_ROLE(), citadel_factory.address);

  console.log("Factory address:", citadel_factory.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

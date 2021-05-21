const hre = require("hardhat");
const Web3 = require("web3");
const web3 = new Web3("");
const { parseEther } = require("ethers/utils");

async function main() {
  require('dotenv').config();
  const OutsideToken = await hre.ethers.getContractFactory("OutsideToken");
  const outside_token = await OutsideToken.deploy("OUTSIDE", "OUT", 18, parseEther(process.env.TOKEN_TOTAL_SUPPLY));
  await outside_token.deployed();

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
  console.log("Factory address:", citadel_factory.address);

  await citadel_token.grantRole(await citadel_token.DEFAULT_ADMIN_ROLE(), citadel_factory.address);

  let start_time = new Date().getTime();
  await citadel_factory.addPool(outside_token.address, start_time, parseEther('0.007'), parseEther('0.012'))
  console.log("Pool address:", await citadel_factory.pools(outside_token.address));

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

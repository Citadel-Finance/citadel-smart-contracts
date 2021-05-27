const hre = require("hardhat");
const Web3 = require("web3");
const web3 = new Web3("");
const { parseEther } = require("ethers/utils");

async function main() {
  require('dotenv').config();
  const OutsideToken = await hre.ethers.getContractFactory("OutsideToken");
  const outside_token = await OutsideToken.deploy("OUTSIDE", "OUT", 18, parseEther(process.env.TOKEN_TOTAL_SUPPLY));
  await outside_token.deployed();
  console.log("OUT token address:", outside_token.address);

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

  let bl_num = await hre.ethers.provider.send("eth_blockNumber");
  let block = await hre.ethers.provider.send("eth_getBlockByNumber", [bl_num, false]);
  let start_time = block.timestamp-100;
  await citadel_factory.addPool(outside_token.address, start_time, parseEther(process.env.POOL_TOKENS_PER_BLOCK), parseEther(process.env.POOL_APY_TAX), parseEther(process.env.POOL_PREMIUM_COEF))
  console.log("Pool address:", await citadel_factory.pools(outside_token.address));

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

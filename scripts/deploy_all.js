const hre = require("hardhat");
const Web3 = require("web3");
const web3 = new Web3("");
const { parseEther } = require("ethers/utils");

async function main() {
  require('dotenv').config();
  const OutsideToken = await hre.ethers.getContractFactory("OutsideToken");
  const outside_token = await OutsideToken.attach("0x3281b72e55D1Dbe9D63395deDeAe0bbE8B4dC6d9");
  //const outside_token = await OutsideToken.deploy("OUTSIDE", "OUT", 18, parseEther(process.env.TOKEN_TOTAL_SUPPLY));
  //await outside_token.deployed();
  console.log("OUT token address:", outside_token.address);

  const CitadelToken = await hre.ethers.getContractFactory("CTLToken");
  const citadel_token = await CitadelToken.deploy(
    process.env.TOKEN_NAME,
    process.env.TOKEN_SYMBOL,
    process.env.TOKEN_DECIMALS,
    parseEther(process.env.TOKEN_TOTAL_SUPPLY)
  );
  await citadel_token.deployed();


  console.log("Token address:", citadel_token.address);

  const CitadelFactory = await hre.ethers.getContractFactory("CitadelFactory");
  const citadel_factory = await CitadelFactory.deploy(citadel_token.address, {gasLimit: 6721975});
  await citadel_factory.deployed();
  console.log("Factory address:", citadel_factory.address);

  await citadel_token.grantRole(await citadel_token.ADMIN_ROLE(), citadel_factory.address, {gasLimit: 6721975});

  //start_time = process.env.POOL_START_TIME
  let bl_num = await hre.ethers.provider.send("eth_blockNumber");
  let block = await hre.ethers.provider.send("eth_getBlockByNumber", [bl_num, false]);
  let start_time = block.timestamp - 100;
  //await citadel_factory.addPool(outside_token.address, start_time, parseEther(process.env.POOL_TOKENS_PER_BLOCK), parseEther(process.env.POOL_APY_TAX), parseEther(process.env.POOL_PREMIUM_COEF), true, {gasLimit: 6721975});
  //await citadel_factory.addPool("0x3D5eccb772b6387FB48E0D970bd414D27D2245ef", start_time, parseEther(process.env.POOL_TOKENS_PER_BLOCK), parseEther(process.env.POOL_APY_TAX), parseEther(process.env.POOL_PREMIUM_COEF), true, {gasLimit: 6721975});
  // await citadel_factory.addPool("0x4B1308749dD122844A3527704c117c3Cb9d9D30C", start_time, parseEther(process.env.POOL_TOKENS_PER_BLOCK), parseEther(process.env.POOL_APY_TAX), parseEther(process.env.POOL_PREMIUM_COEF), false);
  // await citadel_factory.addPool("0x32022d67d5a9Cbc317902EB2E94f255437A46169", start_time, parseEther(process.env.POOL_TOKENS_PER_BLOCK), parseEther(process.env.POOL_APY_TAX), parseEther(process.env.POOL_PREMIUM_COEF), false);
  await citadel_factory.grantRole(await citadel_factory.ADMIN_ROLE(), "0x601a908cC273338357D89a7863E1EcB404DA22f5", {gasLimit: 6721975});
  await citadel_factory.grantRole(await citadel_factory.ADMIN_ROLE(), "0xBC6ae91F55af580B4C0E8c32D7910d00D3dbe54d", {gasLimit: 6721975});


  // const CitadelPool = await hre.ethers.getContractFactory("CitadelPool");

  // let all_pools = await citadel_factory.allPools();
  //  let citadel_pool = await CitadelPool.attach((all_pools[0]).pool);
  // await citadel_pool.grantRole(await citadel_pool.ADMIN_ROLE(), "0x601a908cC273338357D89a7863E1EcB404DA22f5");
  // await citadel_pool.grantRole(await citadel_pool.ADMIN_ROLE(), "0xBC6ae91F55af580B4C0E8c32D7910d00D3dbe54d");
  // citadel_pool = await CitadelPool.attach((all_pools[3]).pool);
  // await citadel_pool.grantRole(await citadel_pool.ADMIN_ROLE(), "0x601a908cC273338357D89a7863E1EcB404DA22f5");
  // await citadel_pool.grantRole(await citadel_pool.ADMIN_ROLE(), "0xBC6ae91F55af580B4C0E8c32D7910d00D3dbe54d");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

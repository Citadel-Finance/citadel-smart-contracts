const hre = require("hardhat");
const { parseEther } = require("ethers/utils");

async function main() {
  require('dotenv').config();

  const CitadelToken = await hre.ethers.getContractFactory("CTLToken");
  const citadel_token = await CitadelToken.deploy(
    process.env.TOKEN_NAME,
    process.env.TOKEN_SYMBOL,
    process.env.TOKEN_DECIMALS,
    process.env.TOKEN_START_BLOCK
  );
  await citadel_token.deployed();
  console.log("CTL token address:", citadel_token.address);

  const CitadelFactory = await hre.ethers.getContractFactory("CitadelFactory");
  const citadel_factory = await CitadelFactory.deploy(citadel_token.address, {gasLimit: 5000000});
  await citadel_factory.deployed();
  console.log("Factory address:", citadel_factory.address);

  await citadel_token.grantRole(await citadel_token.ADMIN_ROLE(), citadel_factory.address, {gasLimit: 5000000});
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

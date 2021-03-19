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

  await citadel_token.deployed().then(
    val => {
      console.log("Token deployed to:", val.address);
      fs.writeFileSync(
        ".main_token.addr",
        val.address,
        encoding="utf8",
        function(err, data){
          if (err) return console.log(err);
          console.log(data);
        }
      );
    }
  );
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

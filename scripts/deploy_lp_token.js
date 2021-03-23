const hre = require("hardhat");
const Web3 = require("web3");
const web3 = new Web3("");
fs = require('fs');

pool_addr=fs.readFileSync(
  ".liquidity_pool.addr",
  (err, data) => {
    if (err) return console.log(err);
    console.log(data);
  }
).toString();

async function main() {
  require('dotenv').config();
  const CitadelToken = await hre.ethers.getContractFactory("LPToken");
  const citadel_token = await CitadelToken.deploy(
    process.env.LP_TOKEN_NAME,
    process.env.LP_TOKEN_SYMBOL,
    process.env.LP_TOKEN_DECIMALS,
    web3.utils.toWei(process.env.LP_TOKEN_TOTAL_SUPPLY, "ether"),
    pool_addr
  );

  await citadel_token.deployed().then(
    val => {
      console.log("Token deployed to:", val.address);
      fs.writeFileSync(
        ".lp_token.addr",
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

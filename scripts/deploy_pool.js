const hre = require("hardhat");
fs = require('fs');


async function main() {
  const CitadelPool = await hre.ethers.getContractFactory("CitadelPool");
  const citadel_pool = await CitadelPool.deploy();
  await citadel_pool.deployed().then(
    val => {
      console.log("Liquidity pool deployed to:", val.address);
      fs.writeFileSync(
        ".liquidity_pool.addr",
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

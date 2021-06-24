const { parseEther } = require("ethers/lib/utils");

task("withdraw", "Withdraw funds from pool")
    .addParam("pool", "The number of pool")
    .addParam("amount", "The amount of funds")
    .setAction(async function (args, hre, runSuper) {
        const accounts = await ethers.getSigners();
        const sender = accounts[0].address;
        console.log("Sender address: ", sender);

        const factory = await hre.ethers.getContractAt("CitadelFactory", process.env.FACTORY_ADDRESS);
        const CitadelPool = await hre.ethers.getContractFactory("CitadelPool");
        console.log("Factory address:", factory.address);

        let all_pools = await factory.allPools();
        console.log("Pool address:", all_pools[args.pool].pool);

        const pool = await CitadelPool.attach(all_pools[args.pool].pool);
        await pool.withdraw(parseEther(args.amount));
        console.log("Done.");
    });
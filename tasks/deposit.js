const { parseEther } = require("ethers/lib/utils");

task("withdraw", "Withdraw from pool")
    .addParam("pool", "The number of pool")
    .addParam("amount", "The amount of funds")
    .setAction(async function (args, hre, runSuper) {
        const accounts = await ethers.getSigners();
        const sender = accounts[0].address;
        console.log("Sender address: ", sender);

        const factory = await hre.ethers.getContractAt("CitadelFactory", process.env.FACTORY_ADDRESS);
        const CitadelPool = await hre.ethers.getContractFactory("CitadelPool");
        const OutsideToken = await hre.ethers.getContractFactory("OutsideToken");
        console.log("Factory address:", factory.address);

        let all_pools = await factory.allPools();
        console.log("Pool address:", all_pools[args.pool].pool);

        const pool = await CitadelPool.attach(all_pools[args.pool].pool);
        const out_token = await OutsideToken.attach(all_pools[args.pool].token);

        await out_token.approve(pool.address, parseEther(args.amount));
        await pool.deposit(parseEther(args.amount));

        console.log("Done.");
    });
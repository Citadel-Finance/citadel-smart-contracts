task("user_data", "Get user state of pools")
    .addParam("user", "The address of an user")
    .setAction(async function (args, hre, runSuper) {
        require('dotenv').config();
        const accounts = await ethers.getSigners();
        const sender = accounts[0].address;
        console.log("Sender address: ", sender);

        const factory = await hre.ethers.getContractAt("CitadelFactory", process.env.FACTORY_ADDRESS);
        const CitadelPool = await hre.ethers.getContractFactory("CitadelPool");
        console.log("Factory address:", factory.address);
        let all_pools = await factory.allPools({gasLimit: 500000});
        console.log("Pools:");
        for (i = 0; i < all_pools.length; i++) {
            console.log("token:", all_pools[i].token, "pool:", all_pools[i].pool);
            const pool = await CitadelPool.attach(all_pools[i].pool);
            let user_staked = await pool.userStaked(args.user, {gasLimit: 500000});
            // let available_ctl = await pool.availableCtl(args.user, {gasLimit: 500000});
            console.log(
                "Total Staked:", user_staked.totalStaked / 1e18,
                "Claimed CTL:", user_staked.claimedCtl / 1e18,
                "Missed CTL:", user_staked.signMissedCtl ? "-" : "+", user_staked.missedCtl / 1e18
                // "Available CTL:", available_ctl / 1e18);
            );
        }
    });
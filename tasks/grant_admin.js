task("grant_admin", "Add a new admin to the factory and pools")
    .addParam("user", "The user address")
    .setAction(async function (args, hre, runSuper) {
        const accounts = await ethers.getSigners();
        const sender = accounts[0].address;
        console.log("Sender address: ", sender);

        const factory = await hre.ethers.getContractAt("CitadelFactory", process.env.FACTORY_ADDRESS);
        console.log("Factory address:", factory.address);
        let admin_role = await factory.ADMIN_ROLE();
        await factory.grantRole(admin_role, args.user);

        let all_pools = await factory.allPools();
        console.log("Pools:");
        for (i = 0; i < all_pools.length; i++) {
            console.log("token:", all_pools[i].token, "pool:", all_pools[i].pool);
            const pool = await CitadelPool.attach(all_pools[i].pool);
            await pool.grantRole(admin_role, args.user);
        }
    });
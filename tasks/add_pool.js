task("add_pool", "Create a pool for given token address")
    .addParam("token", "The token address")
    .setAction(async function (args, hre, runSuper) {
        require('dotenv').config();
        const { parseEther } = require("ethers/utils");
        const accounts = await ethers.getSigners();
        const sender = accounts[0].address;
        console.log("Sender address: ", sender);

        const factory = await hre.ethers.getContractAt("CitadelFactory", process.env.FACTORY_ADDRESS);
        console.log("Factory address:", factory.address);
        console.log("Try to add a new pool...");
        await factory.addPool(args.token, parseEther(process.env.POOL_TOKENS_PER_BLOCK), parseEther(process.env.POOL_APY_TAX), parseEther(process.env.POOL_PREMIUM_COEF), true);
        console.log("Done.");
    });
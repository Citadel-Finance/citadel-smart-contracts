task("claim_all", "Claim all rewards from all pools")
    .setAction(async function (args, hre, runSuper) {
        const accounts = await ethers.getSigners();
        const sender = accounts[0].address;
        console.log("Sender address: ", sender);

        const factory = await hre.ethers.getContractAt("CitadelFactory", process.env.FACTORY_ADDRESS);
        console.log("Factory address:", factory.address);
        await factory.claimAllRewards();
        console.log("Done.");
    });
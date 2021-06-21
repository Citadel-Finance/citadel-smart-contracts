const { parseEther } = require("ethers/utils");

async function main() {

    require('dotenv').config();
    let provider = await ethers.getDefaultProvider("https://data-seed-prebsc-2-s1.binance.org:8545");
    let owner = await new ethers.Wallet(process.env.SECRET_KEY, provider);
    const CitadelFactory = await hre.ethers.getContractFactory("CitadelFactory");
    const CitadelPool = await hre.ethers.getContractFactory("CitadelPool");
    const CTLToken = await hre.ethers.getContractFactory("CTLToken");
    const factory = await CitadelFactory.attach("0xC16FcBb4e16F7aC232B1A5439Ac84fD7bB576750");
    const ctl_token = await CTLToken.attach(await factory.connect(owner).ctlToken());


    console.log(await ctl_token.connect(owner).balanceOf(owner.address) / 1e18);
    await factory.connect(owner).claimAllRewards();
    console.log(await ctl_token.connect(owner).balanceOf(owner.address) / 1e18);
    // await factory.connect(owner).addPool("0x3281b72e55D1Dbe9D63395deDeAe0bbE8B4dC6d9", parseEther(process.env.POOL_TOKENS_PER_BLOCK), parseEther(process.env.POOL_APY_TAX), parseEther(process.env.POOL_PREMIUM_COEF), true, { gasLimit: 5000000 });
    let all_pools = await factory.connect(owner).allPools();
    console.log(all_pools);
    const pool = await CitadelPool.attach(all_pools[0].pool);
    // console.log("ctl_token:", ctl_token.address);

    console.log("Top providers:");
    let top_providers = await pool.connect(owner).getTopProviders();
    for (i = 0; i < top_providers.length; i++) {
        let staked = top_providers[i].staked;
        if (staked > 0) {
            console.log(top_providers[i].user, staked/1e18);
        }
    }

    console.log("Available ctl:", await pool.connect(owner).availableCtl(owner.address) / 1e18);
    // console.log(await pool.connect(owner).getTopProviders());
    // const admin_role = await pool.connect(owner).ADMIN_ROLE();
    // console.log(await pool.connect(owner).hasRole(admin_role, "0xBC6ae91F55af580B4C0E8c32D7910d00D3dbe54d"));
    // console.log(await pool.connect(owner).hasRole(admin_role, "0x601a908cC273338357D89a7863E1EcB404DA22f5"));

    //await pool.connect(owner).balanceOf("0x601a908cC273338357D89a7863E1EcB404DA22f5");
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
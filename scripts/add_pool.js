const { parseEther } = require("ethers/utils");

async function main() {

    require('dotenv').config();
    let provider = await ethers.getDefaultProvider("https://data-seed-prebsc-1-s1.binance.org:8545");
    let owner = await new ethers.Wallet(process.env.SECRET_KEY, provider);
    const CitadelFactory = await hre.ethers.getContractFactory("CitadelFactory");
    const CitadelPool = await hre.ethers.getContractFactory("CitadelPool");
    const factory = await CitadelFactory.attach("0x6a8972d80014d4ad3Fc5Fafcf1d26445d22678EA");

    //await factory.connect(owner).addPool("0x3281b72e55D1Dbe9D63395deDeAe0bbE8B4dC6d9", 1622726505, parseEther(process.env.POOL_TOKENS_PER_BLOCK), parseEther(process.env.POOL_APY_TAX), parseEther(process.env.POOL_PREMIUM_COEF), true, { gasLimit: 5000000 });
    let all_pools = await factory.connect(owner).allPools();
    const pool = await CitadelPool.attach(all_pools[0].pool);
    const admin_role = await pool.connect(owner).ADMIN_ROLE();
    console.log(await pool.connect(owner).hasRole(admin_role, "0xBC6ae91F55af580B4C0E8c32D7910d00D3dbe54d"));
    console.log(await pool.connect(owner).hasRole(admin_role, "0x601a908cC273338357D89a7863E1EcB404DA22f5"));
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
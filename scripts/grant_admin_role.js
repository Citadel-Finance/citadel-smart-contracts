const { parseEther } = require("ethers/utils");

//0x34cBe3A4F129933F53b20F4753Fe781E4f52e451 Tamara
//0x601a908cC273338357D89a7863E1EcB404DA22f5 Lera
//0xBC6ae91F55af580B4C0E8c32D7910d00D3dbe54d Vlad

async function main() {

    require('dotenv').config();
    let provider = await ethers.getDefaultProvider("https://data-seed-prebsc-2-s3.binance.org:8545");
    let owner = await new ethers.Wallet(process.env.SECRET_KEY, provider);
    const CitadelFactory = await hre.ethers.getContractFactory("CitadelFactory");
    const CitadelPool = await hre.ethers.getContractFactory("CitadelPool");

    const factory = await CitadelFactory.attach("0xC16FcBb4e16F7aC232B1A5439Ac84fD7bB576750");
    let admin_role = await factory.connect(owner).ADMIN_ROLE();
    await factory.connect(owner).grantRole(admin_role, "0x34cBe3A4F129933F53b20F4753Fe781E4f52e451");

    pools = await factory.connect(owner).allPools();
    const pool = await CitadelPool.attach(pools[0].pool);
    await pool.connect(owner).grantRole(admin_role, "0x34cBe3A4F129933F53b20F4753Fe781E4f52e451");

}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
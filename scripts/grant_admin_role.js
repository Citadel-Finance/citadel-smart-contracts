const { parseEther } = require("ethers/utils");

async function main() {

    require('dotenv').config();
    let provider = await ethers.getDefaultProvider("https://data-seed-prebsc-1-s1.binance.org:8545");
    let owner = await new ethers.Wallet(process.env.SECRET_KEY, provider);
    const CitadelFactory = await hre.ethers.getContractFactory("CitadelFactory");
    const factory = await CitadelFactory.attach("");

    await factory.connect(owner).grantRole(await factory.connect(owner).ADMIN_ROLE(), "address");

    const CitadelPool = await hre.ethers.getContractFactory("CitadelPool");
    const pool = await CitadelPool.attach("");

}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
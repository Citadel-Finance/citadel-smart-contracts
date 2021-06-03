const { parseEther } = require("ethers/utils");

async function main() {

    require('dotenv').config();
    let provider = await ethers.getDefaultProvider("https://data-seed-prebsc-1-s1.binance.org:8545")
    let owner = await new ethers.Wallet(process.env.SECRET_KEY, provider);
    const CitadelFactory = await hre.ethers.getContractFactory("CitadelFactory");
    const factory = await CitadelFactory.attach("0xB4EFA646607F1626A211936493fAb1464Aa328E9");

    await factory.connect(owner).addPool("0x3281b72e55D1Dbe9D63395deDeAe0bbE8B4dC6d9", 1622726505, parseEther(process.env.POOL_TOKENS_PER_BLOCK), parseEther(process.env.POOL_APY_TAX), parseEther(process.env.POOL_PREMIUM_COEF), { gasLimit: 5000000 });
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
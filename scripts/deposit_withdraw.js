const { parseEther } = require("ethers/utils");

async function main() {
    require('dotenv').config();
    [...account] = await ethers.getSigners();
    OutsideToken = await ethers.getContractFactory("OutsideToken");
    CTLToken = await ethers.getContractFactory("CTLToken");
    CitadelFactory = await ethers.getContractFactory("CitadelFactory");
    CitadelPool = await ethers.getContractFactory("CitadelPool");

    outside_token = await OutsideToken.deploy("OUTSIDE", "OUT", 18);
    await outside_token.deployed();
    await outside_token.connect(account[0]).mint(parseEther('1000000'));
    await outside_token.connect(account[0]).transfer(account[1].address, parseEther("100000"));

    ctl_token = await CTLToken.deploy(process.env.TOKEN_NAME, process.env.TOKEN_SYMBOL, process.env.TOKEN_DECIMALS, 0);

    ctl_factory = await CitadelFactory.deploy(ctl_token.address);
    await ctl_factory.deployed();

    await ctl_token.grantRole(await ctl_token.ADMIN_ROLE(), ctl_factory.address);

    let bl_num = await hre.ethers.provider.send("eth_blockNumber");
    let block = await hre.ethers.provider.send("eth_getBlockByNumber", [bl_num, false]);
    start_time = block.timestamp-100;

    await ctl_factory.connect(account[0]).addPool(outside_token.address, parseEther("1500"), parseEther(process.env.POOL_APY_TAX), parseEther(process.env.POOL_PREMIUM_COEF), true);
    let lp_pool_addr = await ctl_factory.connect(account[0]).pools(outside_token.address);
    ctl_pool = await CitadelPool.attach(lp_pool_addr);



    await outside_token.connect(account[0]).approve(lp_pool_addr, parseEther("100000"));
    let start_bl_num = await hre.ethers.provider.send("eth_blockNumber")
    await ctl_pool.connect(account[0]).deposit(parseEther("100000"));

    console.log("account 0 staked 100000:", (await hre.ethers.provider.send("eth_blockNumber")-start_bl_num)/1);
    console.log("account 0 rewards", await ctl_pool.connect(account[0]).availableReward(account[0].address)/1e18);
    console.log("account 0 staked:", (await ctl_pool.connect(account[0]).userStaked(account[0].address)).totalStaked/1e18);
    console.log("account 0 ctl:", await ctl_pool.connect(account[0]).availableCtl(account[0].address)/1e18);
    console.log("account 1 rewards", await ctl_pool.connect(account[1]).availableReward(account[1].address)/1e18);
    console.log("account 1 staked:", (await ctl_pool.connect(account[1]).userStaked(account[1].address)).totalStaked/1e18);
    console.log("account 1 ctl:", await ctl_pool.connect(account[1]).availableCtl(account[1].address)/1e18);
    pool_balance = await outside_token.connect(account[0]).balanceOf(ctl_pool.address);
    console.log("pool_balance:", pool_balance/1e18);

    console.log("\n");
    await ctl_pool.connect(account[0]).withdraw("0x150710544e0d41100000");
    console.log("account 0 withdraw all:", (await hre.ethers.provider.send("eth_blockNumber")-start_bl_num)/1);
    console.log("account 0 rewards", await ctl_pool.connect(account[0]).availableReward(account[0].address)/1e18);
    console.log("account 0 staked:", (await ctl_pool.connect(account[0]).userStaked(account[0].address)).totalStaked/1e18);
    console.log("account 0 ctl:", await ctl_pool.connect(account[0]).availableCtl(account[0].address)/1e18);
    console.log("account 1 rewards", await ctl_pool.connect(account[1]).availableReward(account[1].address)/1e18);
    console.log("account 1 staked:", (await ctl_pool.connect(account[1]).userStaked(account[1].address)).totalStaked/1e18);
    console.log("account 1 ctl:", await ctl_pool.connect(account[1]).availableCtl(account[1].address)/1e18);
    pool_balance = await outside_token.connect(account[0]).balanceOf(ctl_pool.address);
    console.log("pool_balance:", pool_balance/1e18);
    
    console.log("\n");
    await ctl_factory.connect(account[0]).claimAllRewards();
    console.log("account 0 claim all:", (await hre.ethers.provider.send("eth_blockNumber")-start_bl_num)/1);
    console.log("account 0 rewards", await ctl_pool.connect(account[0]).availableReward(account[0].address)/1e18);
    console.log("account 0 staked:", (await ctl_pool.connect(account[0]).userStaked(account[0].address)).totalStaked/1e18);
    console.log("account 0 ctl:", await ctl_pool.connect(account[0]).availableCtl(account[0].address)/1e18);
    console.log("account 1 rewards", await ctl_pool.connect(account[1]).availableReward(account[1].address)/1e18);
    console.log("account 1 staked:", (await ctl_pool.connect(account[1]).userStaked(account[1].address)).totalStaked/1e18);
    console.log("account 1 ctl:", await ctl_pool.connect(account[1]).availableCtl(account[1].address)/1e18);
    pool_balance = await outside_token.connect(account[0]).balanceOf(ctl_pool.address);
    console.log("pool_balance:", pool_balance/1e18);


    console.log("\n");
    await outside_token.connect(account[1]).approve(lp_pool_addr, parseEther("1000"));
    await ctl_pool.connect(account[1]).deposit(parseEther("1000"));
    console.log("account 1 staked 1000:", (await hre.ethers.provider.send("eth_blockNumber")-start_bl_num)/1);
    console.log("account 0 rewards", await ctl_pool.connect(account[0]).availableReward(account[0].address)/1e18);
    console.log("account 0 staked:", (await ctl_pool.connect(account[0]).userStaked(account[0].address)).totalStaked/1e18);
    console.log("account 0 ctl:", await ctl_pool.connect(account[0]).availableCtl(account[0].address)/1e18);
    console.log("account 1 rewards", await ctl_pool.connect(account[1]).availableReward(account[1].address)/1e18);
    console.log("account 1 staked:", (await ctl_pool.connect(account[1]).userStaked(account[1].address)).totalStaked/1e18);
    console.log("account 1 ctl:", await ctl_pool.connect(account[1]).availableCtl(account[1].address)/1e18);
    pool_balance = await outside_token.connect(account[0]).balanceOf(ctl_pool.address);
    console.log("pool_balance:", pool_balance/1e18);


    console.log("\n");
    await ctl_pool.connect(account[1]).withdraw(parseEther("993"));
    console.log("account 1 withraw all:", (await hre.ethers.provider.send("eth_blockNumber")-start_bl_num)/1);
    console.log("account 0 rewards", await ctl_pool.connect(account[0]).availableReward(account[0].address)/1e18);
    console.log("account 0 staked:", (await ctl_pool.connect(account[0]).userStaked(account[0].address)).totalStaked/1e18);
    console.log("account 0 ctl:", await ctl_pool.connect(account[0]).availableCtl(account[0].address)/1e18);
    console.log("account 1 rewards", await ctl_pool.connect(account[1]).availableReward(account[1].address)/1e18);
    console.log("account 1 staked:", (await ctl_pool.connect(account[1]).userStaked(account[1].address)).totalStaked/1e18);
    console.log("account 1 ctl:", await ctl_pool.connect(account[1]).availableCtl(account[1].address)/1e18);
    pool_balance = await outside_token.connect(account[0]).balanceOf(ctl_pool.address);
    console.log("pool_balance:", pool_balance/1e18);

    console.log("\n");
    await ctl_factory.connect(account[1]).claimAllRewards();
    console.log("account 1 claim all rewards:", (await hre.ethers.provider.send("eth_blockNumber")-start_bl_num)/1);
    console.log("account 0 rewards", await ctl_pool.connect(account[0]).availableReward(account[0].address)/1e18);
    console.log("account 0 staked:", (await ctl_pool.connect(account[0]).userStaked(account[0].address)).totalStaked/1e18);
    console.log("account 0 ctl:", await ctl_pool.connect(account[0]).availableCtl(account[0].address)/1e18);
    console.log("account 1 rewards", await ctl_pool.connect(account[1]).availableReward(account[1].address)/1e18);
    console.log("account 1 staked:", (await ctl_pool.connect(account[1]).userStaked(account[1].address)).totalStaked/1e18);
    console.log("account 1 ctl:", await ctl_pool.connect(account[1]).availableCtl(account[1].address)/1e18);
    pool_balance = await outside_token.connect(account[0]).balanceOf(ctl_pool.address);
    console.log("pool_balance:", pool_balance/1e18);

    await ctl_factory.connect(account[1]).claimAllRewards();

    pool_balance = await outside_token.connect(account[0]).balanceOf(ctl_pool.address);
    console.log("pool_balance:", pool_balance/1e18);
    
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
const Web3 = require("web3");
const web3 = new Web3("");
const { expect } = require("chai");
const { ethers } = require("hardhat");
require("@nomiclabs/hardhat-waffle");
const { parseEther, parseUnits } = require("ethers/utils");

const nullstr = "0x0000000000000000000000000000000000000000"
let liquidity_provider;
let lp_pool_owner;
let borrower;
let user1;
let user2;
let user3;
let user4;

ethers.getSigners().then(val => {
    [liquidity_provider, lp_pool_owner, borrower, user1, user2, user3, user4,] = val;
});

describe("Pool integration tests", () => {
    let OutsideToken;
    let CTLToken;
    let CitadelFactory;
    let CitadelPool;
    let FLReceiver;
    let ctl_token;
    let outside_token;
    let outside_token_8;
    let ctl_factory;
    let ctl_pool;
    let ctl_pool_8;
    let fl_receiver;
    let start_time;
    let add_pool_18_bl_num;

    beforeEach(async () => {
        require('dotenv').config();
        OutsideToken = await ethers.getContractFactory("OutsideToken", liquidity_provider);
        CTLToken = await ethers.getContractFactory("CTLToken", lp_pool_owner);
        CitadelFactory = await ethers.getContractFactory("CitadelFactory", lp_pool_owner);
        CitadelPool = await ethers.getContractFactory("CitadelPool", lp_pool_owner);
        FLReceiver = await ethers.getContractFactory("FlashLoanReceiver", borrower);

        outside_token = await OutsideToken.deploy("OUTSIDE", "OUT", 18, parseEther(process.env.TOKEN_TOTAL_SUPPLY));
        await outside_token.deployed();
        await outside_token.connect(liquidity_provider).mint(parseEther('1000000'));

        outside_token_8 = await OutsideToken.deploy("OUTSIDE8", "OUT8", 8, parseUnits(process.env.TOKEN_TOTAL_SUPPLY, 8));
        await outside_token_8.deployed();
        await outside_token_8.connect(liquidity_provider).mint(parseUnits('1000000', 8));

        ctl_token = await CTLToken.deploy(process.env.TOKEN_NAME, process.env.TOKEN_SYMBOL, process.env.TOKEN_DECIMALS, parseEther(process.env.TOKEN_TOTAL_SUPPLY));
        let bl_num = await hre.ethers.provider.send("eth_blockNumber");
        let block = await hre.ethers.provider.send("eth_getBlockByNumber", [bl_num, false]);
        start_time = block.timestamp;

        ctl_factory = await CitadelFactory.deploy(ctl_token.address);
        await ctl_factory.deployed();

        await ctl_token.grantRole(await ctl_token.ADMIN_ROLE(), ctl_factory.address);

        await ctl_factory.addPool(outside_token.address, start_time, parseEther("1000"), parseEther(process.env.POOL_APY_TAX), parseEther(process.env.POOL_PREMIUM_COEF), true);
        add_pool_18_bl_num = await hre.ethers.provider.send("eth_blockNumber");

        let lp_pool_addr = await ctl_factory.pools(outside_token.address);
        ctl_pool = await CitadelPool.attach(lp_pool_addr);

        await ctl_factory.addPool(outside_token_8.address, start_time, parseEther("1000"), parseUnits(process.env.POOL_APY_TAX, 8), parseUnits(process.env.POOL_PREMIUM_COEF, 8), true);
        console.log("add pool 8:", await hre.ethers.provider.send("eth_blockNumber")/1);
        let lp_pool_8_addr = await ctl_factory.pools(outside_token_8.address);
        ctl_pool_8 = await CitadelPool.attach(lp_pool_8_addr);

        fl_receiver = await FLReceiver.deploy(ctl_pool.address);
        await fl_receiver.deployed();
    });

    describe("Deposit, withraw, claiming rewards", () => {
        it("18 decimals", async () => {
            await outside_token.connect(liquidity_provider).transfer(user1.address, parseEther('10000'));
            await outside_token.connect(liquidity_provider).transfer(user2.address, parseEther('10000'));
            await outside_token.connect(liquidity_provider).transfer(user3.address, parseEther('10000'));
            await outside_token.connect(liquidity_provider).transfer(user4.address, parseEther('10000'));

            // 0 day
            //user1 deposited
            await outside_token.connect(user1).approve(ctl_pool.address, parseEther('1000'));
            await ctl_pool.connect(user1).deposit(parseEther('1000'));
            console.log("user1 staked:", (await hre.ethers.provider.send("eth_blockNumber") - add_pool_18_bl_num)/1);

            //common
            await expect(
                await ctl_pool.tps()
            ).to.be.equal(parseEther("0.007049345417925478"));
            await expect(
                await ctl_pool.totalStaked()
            ).to.be.equal(parseEther("993"));
            await expect(
                await ctl_pool.totalProfit()
            ).to.be.equal(parseEther("7"));
            await expect(
                await ctl_pool.ctlTps()
            ).to.be.equal(parseEther("8.056394763343403826"));

            //user1 check
            await expect(
                (await ctl_pool.userStaked(user1.address)).totalStaked
            ).to.be.equal(parseEther('993'));
            await expect(
                await ctl_pool.balanceOf(user1.address)
            ).to.be.equal(parseEther('993'));
            await expect(
                (await ctl_pool.userStaked(user1.address)).missedProfit
            ).to.be.equal(0);
            await expect(
                (await ctl_pool.userStaked(user1.address)).signMissedProfit
            ).to.be.equal(false);
            await expect(
                await ctl_pool.availableReward(user1.address)
            ).to.be.equal(parseEther("6.999999999999999654"));

            await expect(
                await ctl_pool.availableCtl(user1.address)
            ).to.be.equal(parseEther("999.999999999999999654"));


            //user2 deposited
            await outside_token.connect(user2).approve(ctl_pool.address, parseEther('1000'));
            await ctl_pool.connect(user2).deposit(parseEther('1000'));
            console.log("user2 staked:", (await hre.ethers.provider.send("eth_blockNumber") - add_pool_18_bl_num)/1);

            //common
            await expect(
                await ctl_pool.tps()
            ).to.be.equal(parseEther("0.010574018126888217"));
            await expect(
                await ctl_pool.totalStaked()
            ).to.be.equal(parseEther("1986"));
            await expect(
                await ctl_pool.totalProfit()
            ).to.be.equal(parseEther("14"));
            await expect(
                await ctl_pool.ctlTps()
            ).to.be.equal(parseEther("9.063444108761329304"));

            //user2 check
            await expect(
                (await ctl_pool.userStaked(user2.address)).totalStaked
            ).to.be.equal(parseEther('993'));
            await expect(
                await ctl_pool.balanceOf(user2.address)
            ).to.be.equal(parseEther('993'));
            await expect(
                (await ctl_pool.userStaked(user2.address)).missedProfit
            ).to.be.equal(parseEther("6.999999999999999654"));
            await expect(
                (await ctl_pool.userStaked(user2.address)).signMissedProfit
            ).to.be.equal(false);
            await expect(
                await ctl_pool.availableReward(user2.address)
            ).to.be.equal(parseEther("3.499999999999999827"));
            await expect(
                await ctl_pool.availableCtl(user1.address)
            ).to.be.equal(parseEther("1999.999999999999999308"));
            await expect(
                await ctl_pool.availableCtl(user2.address)
            ).to.be.equal(parseEther("499.999999999999999827"));

            /// 1 day
            await hre.ethers.provider.send("evm_increaseTime", [86500]);
            await hre.ethers.provider.send("evm_mine");
            //user3 deposited
            await outside_token.connect(user3).approve(ctl_pool.address, parseEther('2000'));
            await ctl_pool.connect(user3).deposit(parseEther('2000'));
            console.log("user3 staked:", (await hre.ethers.provider.send("eth_blockNumber") - add_pool_18_bl_num)/1);

            //common
            await expect(
                await ctl_pool.tps()
            ).to.be.equal(parseEther("0.014098690835850956"));
            await expect(
                await ctl_pool.totalStaked()
            ).to.be.equal(parseEther("3972"));
            await expect(
                await ctl_pool.totalProfit()
            ).to.be.equal(parseEther("28"));
            await expect(
                await ctl_pool.ctlTps()
            ).to.be.equal(parseEther("9.818731117824773412"));

            //user3 check
            await expect(
                (await ctl_pool.userStaked(user3.address)).totalStaked
            ).to.be.equal(parseEther('1986'));
            await expect(
                await ctl_pool.balanceOf(user3.address)
            ).to.be.equal(parseEther('1986'));
            await expect(
                (await ctl_pool.userStaked(user3.address)).missedProfit
            ).to.be.equal(parseEther("20.999999999999998962"));
            await expect(
                (await ctl_pool.userStaked(user3.address)).signMissedProfit
            ).to.be.equal(false);
            await expect(
                await ctl_pool.availableReward(user3.address)
            ).to.be.equal(parseEther("6.999999999999999654"));

            await expect(
                await ctl_pool.availableCtl(user1.address)
            ).to.be.equal(parseEther("2749.999999999999998552"));
            await expect(
                await ctl_pool.availableCtl(user2.address)
            ).to.be.equal(parseEther("1249.999999999999999071"));
            await expect(
                await ctl_pool.availableCtl(user3.address)
            ).to.be.equal(parseEther("499.999999999999998834"));


            /// 3 day
            await hre.ethers.provider.send("evm_increaseTime", [2 * 86400]);
            //user2 deposited
            await outside_token.connect(user2).approve(ctl_pool.address, parseEther('3000'));
            await ctl_pool.connect(user2).deposit(parseEther('3000'));

            //common
            await expect(
                await ctl_pool.tps()
            ).to.be.equal(parseEther("0.017119838872104732"));
            await expect(
                await ctl_pool.totalStaked()
            ).to.be.equal(parseEther("6951"));
            await expect(
                await ctl_pool.totalProfit()
            ).to.be.equal(parseEther("49"));
            await expect(
                await ctl_pool.ctlTps()
            ).to.be.equal(parseEther("10.106459502229894976"));

            //user2 check
            await expect(
                (await ctl_pool.userStaked(user2.address)).totalStaked
            ).to.be.equal(parseEther('3972'));
            await expect(
                await ctl_pool.balanceOf(user2.address)
            ).to.be.equal(parseEther('3972'));
            await expect(
                (await ctl_pool.userStaked(user2.address)).missedProfit
            ).to.be.equal(parseEther('48.999999999999997578'));
            await expect(
                (await ctl_pool.userStaked(user2.address)).signMissedProfit
            ).to.be.equal(false);
            await expect(
                await ctl_pool.availableReward(user2.address)
            ).to.be.equal(parseEther("18.999999999999997926"));

            /// 5 day
            await hre.ethers.provider.send("evm_increaseTime", [2 * 86400]);
            //user2 withdrew
            await ctl_pool.connect(user2).withdraw(parseEther('1000'));
            await ctl_factory.connect(user2).claimAllRewards();
            //common
            await expect(
                await ctl_pool.tps()
            ).to.be.equal(parseEther("0.017119838872104732"));
            await expect(
                await ctl_pool.totalStaked()
            ).to.be.equal(parseEther("5951"));
            await expect(
                await ctl_pool.totalProfit()
            ).to.be.equal(parseEther("49"));
            await expect(
                await ctl_pool.ctlTps()
            ).to.be.equal(parseEther("10.442537472318955638"));


            //user2 check
            await expect(
                (await ctl_pool.userStaked(user2.address)).totalStaked
            ).to.be.equal(parseEther('2972'));
            await expect(
                await ctl_pool.balanceOf(user2.address)
            ).to.be.equal(parseEther('2972'));
            await expect(
                (await ctl_pool.userStaked(user2.address)).missedProfit
            ).to.be.equal(parseEther("31.880161127895265578"));
            await expect(
                (await ctl_pool.userStaked(user2.address)).signMissedProfit
            ).to.be.equal(false);
            await expect(
                await ctl_pool.availableReward(user2.address)
            ).to.be.equal(0);

            /// 7 day
            await hre.ethers.provider.send("evm_increaseTime", [2 * 86400]);
            //user2 deposited
            await outside_token.connect(user1).approve(ctl_pool.address, parseEther('2000'));
            await ctl_pool.connect(user1).deposit(parseEther('2000'));
            await ctl_factory.connect(user1).claimAllRewards();

            //common
            await expect(
                await ctl_pool.tps()
            ).to.be.equal(parseEther("0.018883729510885127"));
            await expect(
                await ctl_pool.totalStaked()
            ).to.be.equal(parseEther("7937"));
            await expect(
                await ctl_pool.totalProfit()
            ).to.be.equal(parseEther("63"));
            await expect(
                await ctl_pool.ctlTps()
            ).to.be.equal(parseEther("10.946506226256211527"));

            //user1 check
            await expect(
                (await ctl_pool.userStaked(user1.address)).totalStaked
            ).to.be.equal(parseEther('2979'));
            await expect(
                await ctl_pool.balanceOf(user1.address)
            ).to.be.equal(parseEther('2979'));
            await expect(
                (await ctl_pool.userStaked(user1.address)).missedProfit
            ).to.be.equal(parseEther('33.999999999999997752'));
            await expect(
                (await ctl_pool.userStaked(user1.address)).signMissedProfit
            ).to.be.equal(false);
            await expect(
                await ctl_pool.availableReward(user1.address)
            ).to.be.equal(0);

            /// 10 day
            await hre.ethers.provider.send("evm_increaseTime", [3 * 86400]);
            await ctl_pool.connect(user1).withdraw(parseEther('2000'));
            //common
            await expect(
                await ctl_pool.tps()
            ).to.be.equal(parseEther("0.018883729510885127"));
            await expect(
                await ctl_pool.totalStaked()
            ).to.be.equal(parseEther("5937"));
            await expect(
                await ctl_pool.totalProfit()
            ).to.be.equal(parseEther("63"));

            //user1 check
            await expect(
                (await ctl_pool.userStaked(user1.address)).totalStaked
            ).to.be.equal(parseEther('979'));
            await expect(
                await ctl_pool.balanceOf(user1.address)
            ).to.be.equal(parseEther('979'));
            await expect(
                (await ctl_pool.userStaked(user1.address)).missedProfit
            ).to.be.equal(parseEther('3.767459021770256248'));
            await expect(
                (await ctl_pool.userStaked(user1.address)).signMissedProfit
            ).to.be.equal(true);
            await expect(
                await ctl_pool.availableReward(user1.address)
            ).to.be.equal(0);

            /// 11 day
            await hre.ethers.provider.send("evm_increaseTime", [86400]);
            //user2 deposited
            await outside_token.connect(user4).approve(ctl_pool.address, parseEther('600'));
            await ctl_pool.connect(user4).deposit(parseEther('600'));

            //common
            await expect(
                await ctl_pool.tps()
            ).to.be.equal(parseEther("0.019526639136160659"));
            await expect(
                await ctl_pool.totalStaked()
            ).to.be.equal(parseEther("6532.8"));
            await expect(
                await ctl_pool.totalProfit()
            ).to.be.equal(parseEther("67.2"));

            //user1 check
            await expect(
                (await ctl_pool.userStaked(user4.address)).totalStaked
            ).to.be.equal(parseEther('595.8'));
            await expect(
                await ctl_pool.balanceOf(user4.address)
            ).to.be.equal(parseEther('595.8'));
            await expect(
                (await ctl_pool.userStaked(user4.address)).missedProfit
            ).to.be.equal(parseEther('11.250926042585358666'));
            await expect(
                (await ctl_pool.userStaked(user4.address)).signMissedProfit
            ).to.be.equal(false);
            await expect(
                await ctl_pool.availableReward(user4.address)
            ).to.be.equal(parseEther("0.383045554739161966"));


            //transfer LP tokens
            await hre.ethers.provider.send("evm_increaseTime", [86400]);
            await ctl_pool.connect(user3).transfer(user4.address, parseEther('615.66'));

            //common
            await expect(
                await ctl_pool.tps()
            ).to.be.equal(parseEther("0.019526639136160659"));
            await expect(
                await ctl_pool.totalStaked()
            ).to.be.equal(parseEther("6532.8"));
            await expect(
                await ctl_pool.totalProfit()
            ).to.be.equal(parseEther("67.2"));

            //user3 check
            await expect(
                (await ctl_pool.userStaked(user3.address)).totalStaked
            ).to.be.equal(parseEther('1370.34'));
            await expect(
                await ctl_pool.balanceOf(user3.address)
            ).to.be.equal(parseEther('1370.34'));
            await expect(
                (await ctl_pool.userStaked(user3.address)).missedProfit
            ).to.be.equal(parseEther('14.489999999999999284'));
            await expect(
                (await ctl_pool.userStaked(user3.address)).signMissedProfit
            ).to.be.equal(false);
            await expect(
                await ctl_pool.availableReward(user3.address)
            ).to.be.equal(parseEther("12.26813467384639817"));

            //user4 check
            await expect(
                (await ctl_pool.userStaked(user4.address)).totalStaked
            ).to.be.equal(parseEther('1211.46'));
            await expect(
                await ctl_pool.balanceOf(user4.address)
            ).to.be.equal(parseEther('1211.46'));
            await expect(
                (await ctl_pool.userStaked(user4.address)).missedProfit
            ).to.be.equal(parseEther('17.760926042585358344'));
            await expect(
                (await ctl_pool.userStaked(user4.address)).signMissedProfit
            ).to.be.equal(false);
            await expect(
                await ctl_pool.availableReward(user4.address)
            ).to.be.equal(parseEther("5.894816205307833608"));
        });


        it("8 decimals", async () => {
            await outside_token_8.connect(liquidity_provider).transfer(user1.address, parseUnits('10000', 8));
            await outside_token_8.connect(liquidity_provider).transfer(user2.address, parseUnits('10000', 8));
            await outside_token_8.connect(liquidity_provider).transfer(user3.address, parseUnits('10000', 8));
            await outside_token_8.connect(liquidity_provider).transfer(user4.address, parseUnits('10000', 8));

            // 0 day
            //user1 deposited
            await outside_token_8.connect(user1).approve(ctl_pool_8.address, parseUnits('1000', 8));
            await ctl_pool_8.connect(user1).deposit(parseUnits('1000', 8));

            //common
            await expect(
                await ctl_pool_8.tps()
            ).to.be.equal(parseUnits("0.00704934", 8));
            await expect(
                await ctl_pool_8.totalStaked()
            ).to.be.equal(parseUnits("993", 8));
            await expect(
                await ctl_pool_8.totalProfit()
            ).to.be.equal(parseUnits("7", 8));

            //user1 check
            await expect(
                (await ctl_pool_8.userStaked(user1.address)).totalStaked
            ).to.be.equal(parseUnits('993', 8));
            await expect(
                await ctl_pool_8.balanceOf(user1.address)
            ).to.be.equal(parseUnits('993', 8));
            await expect(
                (await ctl_pool_8.userStaked(user1.address)).missedProfit
            ).to.be.equal(0);
            await expect(
                (await ctl_pool_8.userStaked(user1.address)).signMissedProfit
            ).to.be.equal(false);
            await expect(
                await ctl_pool_8.availableReward(user1.address)
            ).to.be.equal(parseUnits("6.99999462", 8));

            //user2 deposited
            await outside_token_8.connect(user2).approve(ctl_pool_8.address, parseUnits('1000', 8));
            await ctl_pool_8.connect(user2).deposit(parseUnits('1000', 8));

            //common
            await expect(
                await ctl_pool_8.tps()
            ).to.be.equal(parseUnits("0.01057401", 8));
            await expect(
                await ctl_pool_8.totalStaked()
            ).to.be.equal(parseUnits("1986", 8));
            await expect(
                await ctl_pool_8.totalProfit()
            ).to.be.equal(parseUnits("14", 8));


            //user2 check
            await expect(
                (await ctl_pool_8.userStaked(user2.address)).totalStaked
            ).to.be.equal(parseUnits('993', 8));
            await expect(
                await ctl_pool_8.balanceOf(user2.address)
            ).to.be.equal(parseUnits('993', 8));
            await expect(
                (await ctl_pool_8.userStaked(user2.address)).missedProfit
            ).to.be.equal(parseUnits("6.99999462", 8));
            await expect(
                (await ctl_pool_8.userStaked(user2.address)).signMissedProfit
            ).to.be.equal(false);
            await expect(
                await ctl_pool_8.availableReward(user2.address)
            ).to.be.equal(parseUnits("3.49999731", 8));

            /// 1 day
            await hre.ethers.provider.send("evm_increaseTime", [86500]);
            await hre.ethers.provider.send("evm_mine");
            //user3 deposited
            await outside_token_8.connect(user3).approve(ctl_pool_8.address, parseUnits('2000', 8));
            await ctl_pool_8.connect(user3).deposit(parseUnits('2000', 8));
            //common
            await expect(
                await ctl_pool_8.tps()
            ).to.be.equal(parseUnits("0.01409868", 8));
            await expect(
                await ctl_pool_8.totalStaked()
            ).to.be.equal(parseUnits("3972", 8));
            await expect(
                await ctl_pool_8.totalProfit()
            ).to.be.equal(parseUnits("28", 8));

            //user3 check
            await expect(
                (await ctl_pool_8.userStaked(user3.address)).totalStaked
            ).to.be.equal(parseUnits('1986', 8));
            await expect(
                await ctl_pool_8.balanceOf(user3.address)
            ).to.be.equal(parseUnits('1986', 8));
            await expect(
                (await ctl_pool_8.userStaked(user3.address)).missedProfit
            ).to.be.equal(parseUnits("20.99998386", 8));
            await expect(
                (await ctl_pool_8.userStaked(user3.address)).signMissedProfit
            ).to.be.equal(false);
            await expect(
                await ctl_pool_8.availableReward(user3.address)
            ).to.be.equal(parseUnits("6.99999462", 8));


            /// 3 day
            await hre.ethers.provider.send("evm_increaseTime", [2 * 86400]);
            //user2 deposited
            await outside_token_8.connect(user2).approve(ctl_pool_8.address, parseUnits('3000', 8));
            await ctl_pool_8.connect(user2).deposit(parseUnits('3000', 8));

            //common
            await expect(
                await ctl_pool_8.tps()
            ).to.be.equal(parseUnits("0.01711982", 8));
            await expect(
                await ctl_pool_8.totalStaked()
            ).to.be.equal(parseUnits("6951", 8));
            await expect(
                await ctl_pool_8.totalProfit()
            ).to.be.equal(parseUnits("49", 8));

            //user2 check
            await expect(
                (await ctl_pool_8.userStaked(user2.address)).totalStaked
            ).to.be.equal(parseUnits('3972', 8));
            await expect(
                await ctl_pool_8.balanceOf(user2.address)
            ).to.be.equal(parseUnits('3972', 8));
            await expect(
                (await ctl_pool_8.userStaked(user2.address)).missedProfit
            ).to.be.equal(parseUnits('48.99996234', 8));
            await expect(
                (await ctl_pool_8.userStaked(user2.address)).signMissedProfit
            ).to.be.equal(false);
            await expect(
                await ctl_pool_8.availableReward(user2.address)
            ).to.be.equal(parseUnits("18.99996270", 8));

            /// 5 day
            await hre.ethers.provider.send("evm_increaseTime", [2 * 86400]);
            //user2 withdrew
            await ctl_pool_8.connect(user2).withdraw(parseUnits('1000', 8));
            await ctl_factory.connect(user2).claimAllRewards();
            //common
            await expect(
                await ctl_pool_8.tps()
            ).to.be.equal(parseUnits("0.01711982", 8));
            await expect(
                await ctl_pool_8.totalStaked()
            ).to.be.equal(parseUnits("5951", 8));
            await expect(
                await ctl_pool_8.totalProfit()
            ).to.be.equal(parseUnits("49", 8));


            //user2 check
            await expect(
                (await ctl_pool_8.userStaked(user2.address)).totalStaked
            ).to.be.equal(parseUnits('2972', 8));
            await expect(
                await ctl_pool_8.balanceOf(user2.address)
            ).to.be.equal(parseUnits('2972', 8));
            await expect(
                (await ctl_pool_8.userStaked(user2.address)).missedProfit
            ).to.be.equal(parseUnits("31.88014234", 8));
            await expect(
                (await ctl_pool_8.userStaked(user2.address)).signMissedProfit
            ).to.be.equal(false);
            await expect(
                await ctl_pool_8.availableReward(user2.address)
            ).to.be.equal(0);

            /// 7 day
            await hre.ethers.provider.send("evm_increaseTime", [2 * 86400]);
            //user2 deposited
            await outside_token_8.connect(user1).approve(ctl_pool_8.address, parseUnits('2000', 8));
            await ctl_pool_8.connect(user1).deposit(parseUnits('2000', 8));
            await ctl_factory.connect(user1).claimAllRewards();

            //common
            await expect(
                await ctl_pool_8.tps()
            ).to.be.equal(parseUnits("0.01888371", 8));
            await expect(
                await ctl_pool_8.totalStaked()
            ).to.be.equal(parseUnits("7937", 8));
            await expect(
                await ctl_pool_8.totalProfit()
            ).to.be.equal(parseUnits("63", 8));

            //user1 check
            await expect(
                (await ctl_pool_8.userStaked(user1.address)).totalStaked
            ).to.be.equal(parseUnits('2979', 8));
            await expect(
                await ctl_pool_8.balanceOf(user1.address)
            ).to.be.equal(parseUnits('2979', 8));
            await expect(
                (await ctl_pool_8.userStaked(user1.address)).missedProfit
            ).to.be.equal(parseUnits('33.99996252', 8));
            await expect(
                (await ctl_pool_8.userStaked(user1.address)).signMissedProfit
            ).to.be.equal(false);
            await expect(
                await ctl_pool_8.availableReward(user1.address)
            ).to.be.equal(0);

            /// 10 day
            await hre.ethers.provider.send("evm_increaseTime", [3 * 86400]);
            await ctl_pool_8.connect(user1).withdraw(parseUnits('2000', 8));
            //common
            await expect(
                await ctl_pool_8.tps()
            ).to.be.equal(parseUnits("0.01888371", 8));
            await expect(
                await ctl_pool_8.totalStaked()
            ).to.be.equal(parseUnits("5937", 8));
            await expect(
                await ctl_pool_8.totalProfit()
            ).to.be.equal(parseUnits("63", 8));

            //user1 check
            await expect(
                (await ctl_pool_8.userStaked(user1.address)).totalStaked
            ).to.be.equal(parseUnits('979', 8));
            await expect(
                await ctl_pool_8.balanceOf(user1.address)
            ).to.be.equal(parseUnits('979', 8));
            await expect(
                (await ctl_pool_8.userStaked(user1.address)).missedProfit
            ).to.be.equal(parseUnits('3.76745748', 8));
            await expect(
                (await ctl_pool_8.userStaked(user1.address)).signMissedProfit
            ).to.be.equal(true);
            await expect(
                await ctl_pool_8.availableReward(user1.address)
            ).to.be.equal(0);

            /// 11 day
            await hre.ethers.provider.send("evm_increaseTime", [86400]);
            //user2 deposited
            await outside_token_8.connect(user4).approve(ctl_pool_8.address, parseUnits('600', 8));
            await ctl_pool_8.connect(user4).deposit(parseUnits('600', 8));

            //common
            await expect(
                await ctl_pool_8.tps()
            ).to.be.equal(parseUnits("0.01952661", 8));
            await expect(
                await ctl_pool_8.totalStaked()
            ).to.be.equal(parseUnits("6532.8", 8));
            await expect(
                await ctl_pool_8.totalProfit()
            ).to.be.equal(parseUnits("67.2", 8));

            //user1 check
            await expect(
                (await ctl_pool_8.userStaked(user4.address)).totalStaked
            ).to.be.equal(parseUnits('595.8', 8));
            await expect(
                await ctl_pool_8.balanceOf(user4.address)
            ).to.be.equal(parseUnits('595.8', 8));
            await expect(
                (await ctl_pool_8.userStaked(user4.address)).missedProfit
            ).to.be.equal(parseUnits('11.25091441', 8));
            await expect(
                (await ctl_pool_8.userStaked(user4.address)).signMissedProfit
            ).to.be.equal(false);
            await expect(
                await ctl_pool_8.availableReward(user4.address)
            ).to.be.equal(parseUnits("0.38303982", 8));


            //transfer LP tokens
            await hre.ethers.provider.send("evm_increaseTime", [86400]);
            await ctl_pool_8.connect(user3).transfer(user4.address, parseUnits('615.66', 8));

            //common
            await expect(
                await ctl_pool_8.tps()
            ).to.be.equal(parseUnits("0.01952661", 8));
            await expect(
                await ctl_pool_8.totalStaked()
            ).to.be.equal(parseUnits("6532.8", 8));
            await expect(
                await ctl_pool_8.totalProfit()
            ).to.be.equal(parseUnits("67.2", 8));

            //user3 check
            await expect(
                (await ctl_pool_8.userStaked(user3.address)).totalStaked
            ).to.be.equal(parseUnits('1370.34', 8));
            await expect(
                await ctl_pool_8.balanceOf(user3.address)
            ).to.be.equal(parseUnits('1370.34', 8));
            await expect(
                (await ctl_pool_8.userStaked(user3.address)).missedProfit
            ).to.be.equal(parseUnits('14.48998887', 8));
            await expect(
                (await ctl_pool_8.userStaked(user3.address)).signMissedProfit
            ).to.be.equal(false);
            await expect(
                await ctl_pool_8.availableReward(user3.address)
            ).to.be.equal(parseUnits("12.26810587", 8));

            //user4 check
            await expect(
                (await ctl_pool_8.userStaked(user4.address)).totalStaked
            ).to.be.equal(parseUnits('1211.46', 8));
            await expect(
                await ctl_pool_8.balanceOf(user4.address)
            ).to.be.equal(parseUnits('1211.46', 8));
            await expect(
                (await ctl_pool_8.userStaked(user4.address)).missedProfit
            ).to.be.equal(parseUnits('17.7609094', 8));
            await expect(
                (await ctl_pool_8.userStaked(user4.address)).signMissedProfit
            ).to.be.equal(false);
            await expect(
                await ctl_pool_8.availableReward(user4.address)
            ).to.be.equal(parseUnits("5.89479755", 8));
        });
    });
});

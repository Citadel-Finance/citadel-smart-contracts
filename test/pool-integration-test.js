const Web3 = require("web3");
const web3 = new Web3("");
const { expect } = require("chai");
const { ethers } = require("hardhat");
require("@nomiclabs/hardhat-waffle");
const { parseEther } = require("ethers/utils");

const nullstr = "0x0000000000000000000000000000000000000000"
const tokensPerBlock = parseEther("1000");
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
    let ctl_factory;
    let ctl_pool;
    let ctl_pool_8;
    let fl_receiver;
    let start_time;

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

        outside_token_8 = await OutsideToken.deploy("OUTSIDE8", "OUT8", 8, parseEther(process.env.TOKEN_TOTAL_SUPPLY));
        await outside_token_8.deployed();
        await outside_token_8.connect(liquidity_provider).mint('100000000000000');

        ctl_token = await CTLToken.deploy(
            process.env.TOKEN_NAME,
            process.env.TOKEN_SYMBOL,
            process.env.TOKEN_DECIMALS,
            parseEther(process.env.TOKEN_TOTAL_SUPPLY)
        );
        let bl_num = await hre.ethers.provider.send("eth_blockNumber");
        let block = await hre.ethers.provider.send("eth_getBlockByNumber", [bl_num, false]);
        start_time = block.timestamp;

        ctl_factory = await CitadelFactory.deploy(ctl_token.address);
        await ctl_factory.deployed();

        await ctl_token.grantRole(await ctl_token.DEFAULT_ADMIN_ROLE(), ctl_factory.address);

        await ctl_factory.addPool(outside_token.address, start_time, tokensPerBlock, parseEther(process.env.POOL_APY_TAX), parseEther(process.env.POOL_PREMIUM_COEF));
        let lp_pool_addr = await ctl_factory.pools(outside_token.address);
        ctl_pool = await CitadelPool.attach(lp_pool_addr);

        await ctl_factory.addPool(outside_token_8.address, start_time, tokensPerBlock, parseEther(process.env.POOL_APY_TAX), parseEther(process.env.POOL_PREMIUM_COEF));
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

            //common
            await expect(
                await ctl_pool.curDay()
            ).to.be.equal(0);
            await expect(
                await ctl_pool.tps()
            ).to.be.equal(parseEther("0.007049345417925478"));
            [sign, value] = await ctl_pool.dailyStaked();
            await expect(sign).to.be.equal(false);
            await expect(value).to.be.equal(parseEther('993'));
            await expect(
                await ctl_pool.totalStaked()
            ).to.be.equal(parseEther("993"));
            await expect(
                await ctl_pool.receiptProfit()
            ).to.be.equal(parseEther("7"));
            await expect(
                await ctl_pool.totalProfit()
            ).to.be.equal(parseEther("7"));

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

            //user2 deposited
            await outside_token.connect(user2).approve(ctl_pool.address, parseEther('1000'));
            await ctl_pool.connect(user2).deposit(parseEther('1000'));

            //common
            await expect(
                await ctl_pool.tps()
            ).to.be.equal(parseEther("0.007049345417925478"));
            [sign, value] = await ctl_pool.dailyStaked();
            await expect(sign).to.be.equal(false);
            await expect(value).to.be.equal(parseEther('1986'));
            await expect(
                await ctl_pool.totalStaked()
            ).to.be.equal(parseEther("1986"));
            await expect(
                await ctl_pool.receiptProfit()
            ).to.be.equal(parseEther("14"));
            await expect(
                await ctl_pool.totalProfit()
            ).to.be.equal(parseEther("14"));


            //user2 check
            await expect(
                (await ctl_pool.userStaked(user2.address)).totalStaked
            ).to.be.equal(parseEther('993'));
            await expect(
                await ctl_pool.balanceOf(user2.address)
            ).to.be.equal(parseEther('993'));
            await expect(
                (await ctl_pool.userStaked(user2.address)).missedProfit
            ).to.be.equal(0);
            await expect(
                (await ctl_pool.userStaked(user2.address)).signMissedProfit
            ).to.be.equal(false);
            await expect(
                await ctl_pool.availableReward(user2.address)
            ).to.be.equal(parseEther("6.999999999999999654"));

            /// 1 day
            await hre.ethers.provider.send("evm_increaseTime", [86500]);
            await hre.ethers.provider.send("evm_mine");
            //user3 deposited
            await outside_token.connect(user3).approve(ctl_pool.address, parseEther('2000'));
            await ctl_pool.connect(user3).deposit(parseEther('2000'));
            //common
            await expect(
                await ctl_pool.curDay()
            ).to.be.equal(1);
            await expect(
                await ctl_pool.tps()
            ).to.be.equal(parseEther("0.010574018126888217"));
            [sign, value] = await ctl_pool.dailyStaked();
            await expect(sign).to.be.equal(false);
            await expect(value).to.be.equal(parseEther('1986'));
            await expect(
                await ctl_pool.totalStaked()
            ).to.be.equal(parseEther("3972"));
            await expect(
                await ctl_pool.receiptProfit()
            ).to.be.equal(parseEther("14"));
            await expect(
                await ctl_pool.totalProfit()
            ).to.be.equal(parseEther("28"));

            //user3 check
            await expect(
                (await ctl_pool.userStaked(user3.address)).totalStaked
            ).to.be.equal(parseEther('1986'));
            await expect(
                await ctl_pool.balanceOf(user3.address)
            ).to.be.equal(parseEther('1986'));
            await expect(
                (await ctl_pool.userStaked(user3.address)).missedProfit
            ).to.be.equal(parseEther("13.999999999999999308"));
            await expect(
                (await ctl_pool.userStaked(user3.address)).signMissedProfit
            ).to.be.equal(false);
            await expect(
                await ctl_pool.availableReward(user3.address)
            ).to.be.equal(parseEther("6.999999999999999654"));


            /// 3 day
            await hre.ethers.provider.send("evm_increaseTime", [2 * 86400]);
            //user2 deposited
            await outside_token.connect(user2).approve(ctl_pool.address, parseEther('3000'));
            await ctl_pool.connect(user2).deposit(parseEther('3000'));

            //common
            await expect(
                await ctl_pool.curDay()
            ).to.be.equal(3);
            await expect(
                await ctl_pool.prevTps()
            ).to.be.equal(parseEther("0.010574018126888217"));
            await expect(
                await ctl_pool.tps()
            ).to.be.equal(parseEther("0.013595166163141993"));
            [sign, value] = await ctl_pool.dailyStaked();
            await expect(sign).to.be.equal(false);
            await expect(value).to.be.equal(parseEther('2979'));
            await expect(
                await ctl_pool.totalStaked()
            ).to.be.equal(parseEther("6951"));
            await expect(
                await ctl_pool.receiptProfit()
            ).to.be.equal(parseEther("21"));
            await expect(
                await ctl_pool.totalProfit()
            ).to.be.equal(parseEther("49"));

            //user2 check
            await expect(
                (await ctl_pool.userStaked(user2.address)).totalStaked
            ).to.be.equal(parseEther('3972'));
            await expect(
                await ctl_pool.balanceOf(user2.address)
            ).to.be.equal(parseEther('3972'));
            await expect(
                (await ctl_pool.userStaked(user2.address)).missedProfit
            ).to.be.equal(parseEther('31.499999999999998443'));
            await expect(
                (await ctl_pool.userStaked(user2.address)).signMissedProfit
            ).to.be.equal(false);
            await expect(
                await ctl_pool.availableReward(user2.address)
            ).to.be.equal(parseEther("22.499999999999997753"));

            /// 5 day
            await hre.ethers.provider.send("evm_increaseTime", [2 * 86400]);
            //user2 withdrew
            await ctl_pool.connect(user2).withdraw(parseEther('1000'));
            await ctl_pool.connect(user2).claimReward(parseEther('20'));
            //common
            await expect(
                await ctl_pool.tps()
            ).to.be.equal(parseEther("0.013595166163141993"));
            [sign, value] = await ctl_pool.dailyStaked();

            await expect(value).to.be.equal(parseEther('1000'));
            await expect(sign).to.be.equal(true);
            await expect(
                await ctl_pool.totalStaked()
            ).to.be.equal(parseEther("5951"));
            await expect(
                await ctl_pool.receiptProfit()
            ).to.be.equal(parseEther("0"));
            await expect(
                await ctl_pool.totalProfit()
            ).to.be.equal(parseEther("49"));


            //user2 check
            await expect(
                (await ctl_pool.userStaked(user2.address)).totalStaked
            ).to.be.equal(parseEther('2972'));
            await expect(
                await ctl_pool.balanceOf(user2.address)
            ).to.be.equal(parseEther('2972'));
            await expect(
                (await ctl_pool.userStaked(user2.address)).missedProfit
            ).to.be.equal(parseEther("17.904833836858005443"));
            await expect(
                (await ctl_pool.userStaked(user2.address)).signMissedProfit
            ).to.be.equal(false);
            await expect(
                await ctl_pool.availableReward(user2.address)
            ).to.be.equal(parseEther("2.499999999999997753"));

            /// 7 day
            await hre.ethers.provider.send("evm_increaseTime", [2 * 86400]);
            //user2 deposited
            await outside_token.connect(user1).approve(ctl_pool.address, parseEther('2000'));
            await ctl_pool.connect(user1).deposit(parseEther('2000'));
            await ctl_pool.connect(user1).claimReward(parseEther('10'));

            //common
            await expect(
                await ctl_pool.curDay()
            ).to.be.equal(7);
            await expect(
                await ctl_pool.prevTps()
            ).to.be.equal(parseEther("0.013595166163141993"));
            await expect(
                await ctl_pool.tps()
            ).to.be.equal(parseEther("0.015359056801922388"));
            [sign, value] = await ctl_pool.dailyStaked();
            await expect(sign).to.be.equal(false);
            await expect(value).to.be.equal(parseEther('1986'));
            await expect(
                await ctl_pool.totalStaked()
            ).to.be.equal(parseEther("7937"));
            await expect(
                await ctl_pool.receiptProfit()
            ).to.be.equal(parseEther("14"));
            await expect(
                await ctl_pool.totalProfit()
            ).to.be.equal(parseEther("63"));

            //user1 check
            await expect(
                (await ctl_pool.userStaked(user1.address)).totalStaked
            ).to.be.equal(parseEther('2979'));
            await expect(
                await ctl_pool.balanceOf(user1.address)
            ).to.be.equal(parseEther('2979'));
            await expect(
                (await ctl_pool.userStaked(user1.address)).missedProfit
            ).to.be.equal(parseEther('26.999999999999998098'));
            await expect(
                (await ctl_pool.userStaked(user1.address)).signMissedProfit
            ).to.be.equal(false);
            await expect(
                await ctl_pool.availableReward(user1.address)
            ).to.be.equal(parseEther("8.754630212926795754"));

            /// 10 day
            await hre.ethers.provider.send("evm_increaseTime", [3 * 86400]);
            await ctl_pool.connect(user1).withdraw(parseEther('2000'));
            //common
            await expect(
                await ctl_pool.curDay()
            ).to.be.equal(10);
            await expect(
                await ctl_pool.prevTps()
            ).to.be.equal(parseEther("0.015359056801922388"));
            await expect(
                await ctl_pool.tps()
            ).to.be.equal(parseEther("0.015359056801922388"));
            [sign, value] = await ctl_pool.dailyStaked();
            await expect(sign).to.be.equal(true);
            await expect(value).to.be.equal(parseEther('2000'));
            await expect(
                await ctl_pool.totalStaked()
            ).to.be.equal(parseEther("5937"));
            await expect(
                await ctl_pool.receiptProfit()
            ).to.be.equal(0);
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
            ).to.be.equal(parseEther('3.718113603844777902'));
            await expect(
                (await ctl_pool.userStaked(user1.address)).signMissedProfit
            ).to.be.equal(true);
            await expect(
                await ctl_pool.availableReward(user1.address)
            ).to.be.equal(parseEther("8.754630212926795754"));

            /// 11 day
            await hre.ethers.provider.send("evm_increaseTime", [86400]);
            //user2 deposited
            await outside_token.connect(user4).approve(ctl_pool.address, parseEther('600'));
            await ctl_pool.connect(user4).deposit(parseEther('600'));

            //common
            await expect(
                await ctl_pool.curDay()
            ).to.be.equal(11);
            await expect(
                await ctl_pool.prevTps()
            ).to.be.equal(parseEther("0.015359056801922388"));
            await expect(
                await ctl_pool.tps()
            ).to.be.equal(parseEther("0.01600196642719792"));
            [sign, value] = await ctl_pool.dailyStaked();
            await expect(sign).to.be.equal(false);
            await expect(value).to.be.equal(parseEther('595.8'));
            await expect(
                await ctl_pool.totalStaked()
            ).to.be.equal(parseEther("6532.8"));
            await expect(
                await ctl_pool.receiptProfit()
            ).to.be.equal(parseEther("4.2"));
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
            ).to.be.equal(parseEther('9.15092604258535877'));
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
                await ctl_pool.curDay()
            ).to.be.equal(12);
            await expect(
                await ctl_pool.prevTps()
            ).to.be.equal(parseEther("0.01600196642719792"));
            await expect(
                await ctl_pool.tps()
            ).to.be.equal(parseEther("0.01600196642719792"));
            [sign, value] = await ctl_pool.dailyStaked();
            await expect(sign).to.be.equal(false);
            await expect(value).to.be.equal(0);
            await expect(
                await ctl_pool.totalStaked()
            ).to.be.equal(parseEther("6532.8"));
            await expect(
                await ctl_pool.receiptProfit()
            ).to.be.equal(0);
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
            ).to.be.equal(parseEther('9.659999999999999523'));
            await expect(
                (await ctl_pool.userStaked(user3.address)).signMissedProfit
            ).to.be.equal(false);
            await expect(
                await ctl_pool.availableReward(user3.address)
            ).to.be.equal(parseEther("12.268134673846398169"));

            //user4 check
            await expect(
                (await ctl_pool.userStaked(user4.address)).totalStaked
            ).to.be.equal(parseEther('1211.46'));
            await expect(
                await ctl_pool.balanceOf(user4.address)
            ).to.be.equal(parseEther('1211.46'));
            await expect(
                (await ctl_pool.userStaked(user4.address)).missedProfit
            ).to.be.equal(parseEther('13.490926042585358555'));
            await expect(
                (await ctl_pool.userStaked(user4.address)).signMissedProfit
            ).to.be.equal(false);
            await expect(
                await ctl_pool.availableReward(user4.address)
            ).to.be.equal(parseEther("5.894816205307833608"));
        });


        it("8 decimals", async () => {

        });
    });


});

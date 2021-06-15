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
const START_BLOCK_OFFSET = 17;

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
    let add_pool_18_bl_num;
    let add_pool_8_bl_num;
    let deploy_ctl_bl_num;
    let start_ctl_bl_num;

    beforeEach(async () => {
        require('dotenv').config();
        OutsideToken = await ethers.getContractFactory("OutsideToken", liquidity_provider);
        CTLToken = await ethers.getContractFactory("CTLToken", lp_pool_owner);
        CitadelFactory = await ethers.getContractFactory("CitadelFactory", lp_pool_owner);
        CitadelPool = await ethers.getContractFactory("CitadelPool", lp_pool_owner);
        FLReceiver = await ethers.getContractFactory("FlashLoanReceiver", borrower);

        outside_token = await OutsideToken.deploy("OUTSIDE", "OUT", 18);
        await outside_token.deployed();
        await outside_token.connect(liquidity_provider).mint(parseEther('1000000'));

        outside_token_8 = await OutsideToken.deploy("OUTSIDE8", "OUT8", 8);
        await outside_token_8.deployed();
        await outside_token_8.connect(liquidity_provider).mint(parseUnits('1000000', 8));

        deploy_ctl_bl_num = await hre.ethers.provider.send("eth_blockNumber") / 1 + 1;
        start_ctl_bl_num = deploy_ctl_bl_num + START_BLOCK_OFFSET;
        ctl_token = await CTLToken.deploy(process.env.TOKEN_NAME, process.env.TOKEN_SYMBOL, process.env.TOKEN_DECIMALS, start_ctl_bl_num);
        start_ctl_bl_num = await ctl_token.startBlock() / 1
        //console.log("start ctl:", await ctl_token.startBlock()/1);
        console.log("start ctl:", await ctl_token.startBlock() - start_ctl_bl_num);


        ctl_factory = await CitadelFactory.deploy(ctl_token.address);
        await ctl_factory.deployed();

        await ctl_token.grantRole(await ctl_token.ADMIN_ROLE(), ctl_factory.address);


        await ctl_factory.addPool(outside_token.address, parseEther("1000"), parseEther(process.env.POOL_APY_TAX), parseEther(process.env.POOL_PREMIUM_COEF), true);
        add_pool_18_bl_num = await hre.ethers.provider.send("eth_blockNumber") / 1;
        console.log("add pool 18:", add_pool_18_bl_num - start_ctl_bl_num);

        let lp_pool_addr = await ctl_factory.pools(outside_token.address);
        ctl_pool = await CitadelPool.attach(lp_pool_addr);
        console.log("pool 18 prev minting block:", await ctl_pool.prevMintingBlock() - start_ctl_bl_num);


        await ctl_factory.addPool(outside_token_8.address, parseEther("1000"), parseUnits(process.env.POOL_APY_TAX, 8), parseUnits(process.env.POOL_PREMIUM_COEF, 8), true);
        add_pool_8_bl_num = await hre.ethers.provider.send("eth_blockNumber") / 1;
        console.log("add pool 8:", add_pool_8_bl_num - start_ctl_bl_num);
        let lp_pool_8_addr = await ctl_factory.pools(outside_token_8.address);
        ctl_pool_8 = await CitadelPool.attach(lp_pool_8_addr);
        console.log("pool 8 prev minting block:", await ctl_pool_8.prevMintingBlock() - start_ctl_bl_num);

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
            console.log("user1 staked 1000:", await hre.ethers.provider.send("eth_blockNumber") / 1 - start_ctl_bl_num);

            //common
            let comm_data = await ctl_pool.getCommonData();
            await expect(
                comm_data.tokensPerStaked
            ).to.be.equal(parseEther("0.007049345417925478"));
            await expect(
                comm_data.totalStaked
            ).to.be.equal(parseEther("993"));
            await expect(
                comm_data.totalProfit
            ).to.be.equal(parseEther("7"));
            await expect(
                comm_data.ctlPerStaked
            ).to.be.equal(0);

            //user1 check
            let user_data = await ctl_pool.getUserData(user1.address);
            await expect(
                user_data.totalStaked
            ).to.be.equal(parseEther('993'));
            await expect(
                await user_data.balanceOf
            ).to.be.equal(parseEther('993'));
            await expect(
                user_data.availableReward
            ).to.be.equal(parseEther("6.999999999999999654"));
            await expect(
                user_data.availableCtl
            ).to.be.equal(0);


            //user2 deposited
            await outside_token.connect(user2).approve(ctl_pool.address, parseEther('1000'));
            await ctl_pool.connect(user2).deposit(parseEther('1000'));
            console.log("user2 staked 1000:", await hre.ethers.provider.send("eth_blockNumber") / 1 - start_ctl_bl_num);

            //common
            comm_data = await ctl_pool.getCommonData();
            await expect(
                comm_data.tokensPerStaked
            ).to.be.equal(parseEther("0.010574018126888217"));
            await expect(
                comm_data.totalStaked
            ).to.be.equal(parseEther("1986"));
            await expect(
                comm_data.totalProfit
            ).to.be.equal(parseEther("14"));
            await expect(
                comm_data.ctlPerStaked
            ).to.be.equal(0);


            //user2 check
            user_data = await ctl_pool.getUserData(user2.address);
            await expect(
                user_data.totalStaked
            ).to.be.equal(parseEther('993'));
            await expect(
                user_data.balanceOf
            ).to.be.equal(parseEther('993'));
            await expect(
                user_data.availableReward
            ).to.be.equal(parseEther("3.499999999999999827"));
            await expect(
                user_data.availableCtl
            ).to.be.equal(parseEther("0"));

            //user1 check
            user_data = await ctl_pool.getUserData(user1.address);
            await expect(
                user_data.availableCtl
            ).to.be.equal(parseEther("0"));

            /// 1 day
            await hre.ethers.provider.send("evm_increaseTime", [86500]);
            await hre.ethers.provider.send("evm_mine");
            //user3 deposited
            await outside_token.connect(user3).approve(ctl_pool.address, parseEther('2000'));
            await ctl_pool.connect(user3).deposit(parseEther('2000'));
            console.log("user3 staked 2000:", await hre.ethers.provider.send("eth_blockNumber") / 1 - start_ctl_bl_num);

            //common
            comm_data = await ctl_pool.getCommonData();
            await expect(
                comm_data.tokensPerStaked
            ).to.be.equal(parseEther("0.014098690835850956"));
            await expect(
                comm_data.totalStaked
            ).to.be.equal(parseEther("3972"));
            await expect(
                comm_data.totalProfit
            ).to.be.equal(parseEther("28"));
            await expect(
                comm_data.ctlPerStaked
            ).to.be.equal(0);

            //user3 check
            user_data = await ctl_pool.getUserData(user3.address);
            await expect(
                user_data.totalStaked
            ).to.be.equal(parseEther('1986'));
            await expect(
                user_data.balanceOf
            ).to.be.equal(parseEther('1986'));
            await expect(
                user_data.availableReward
            ).to.be.equal(parseEther("6.999999999999999654"));
            await expect(
                user_data.availableCtl
            ).to.be.equal(0);


            /// start CTL minting
            /// 3 day
            await hre.ethers.provider.send("evm_increaseTime", [2 * 86400]);
            //user2 deposited
            await outside_token.connect(user2).approve(ctl_pool.address, parseEther('3000'));
            await ctl_pool.connect(user2).deposit(parseEther('3000'));
            console.log("user2 staked 3000:", await hre.ethers.provider.send("eth_blockNumber") / 1 - start_ctl_bl_num);

            //common
            comm_data = await ctl_pool.getCommonData();
            await expect(
                comm_data.tokensPerStaked
            ).to.be.equal(parseEther("0.017119838872104732"));
            await expect(
                comm_data.totalStaked
            ).to.be.equal(parseEther("6951"));
            await expect(
                comm_data.totalProfit
            ).to.be.equal(parseEther("49"));
            await expect(
                await ctl_token.balanceOf(ctl_pool.address)
            ).to.be.equal(parseEther("2000"));
            await expect(
                comm_data.ctlPerStaked
            ).to.be.equal(parseEther("0.395626528557042151"));

            //user2 check
            user_data = await ctl_pool.getUserData(user2.address);
            await expect(
                user_data.totalStaked
            ).to.be.equal(parseEther('3972'));
            await expect(
                await ctl_pool.balanceOf(user2.address)
            ).to.be.equal(parseEther('3972'));
            await expect(
                user_data.availableReward
            ).to.be.equal(parseEther("18.999999999999997926"));
            await expect(
                user_data.availableCtl
            ).to.be.equal(parseEther("821.428571428571425521"));

            user_data = await ctl_pool.getUserData(user1.address);
            await expect(
                user_data.availableCtl
            ).to.be.equal(parseEther("392.857142857142855943"));

            user_data = await ctl_pool.getUserData(user3.address);
            await expect(
                user_data.availableCtl
            ).to.be.equal(parseEther("785.714285714285711886"));


            /// 5 day
            await hre.ethers.provider.send("evm_increaseTime", [2 * 86400]);
            //user2 withdrew
            await ctl_pool.connect(user2).withdraw(parseEther('1000'));
            console.log("user2 withdraw 1000:", await hre.ethers.provider.send("eth_blockNumber") / 1 - start_ctl_bl_num);

            //common
            comm_data = await ctl_pool.getCommonData();
            await expect(
                comm_data.ctlPerStaked
            ).to.be.equal(parseEther("0.563665513601572482"));
            await expect(
                await ctl_token.balanceOf(ctl_pool.address)
            ).to.be.equal(parseEther("3000"));

            user_data = await ctl_pool.getUserData(user1.address);
            await expect(
                user_data.availableCtl
            ).to.be.equal(parseEther("559.719855006361474626"));

            user_data = await ctl_pool.getUserData(user2.address);
            await expect(
                user_data.availableCtl
            ).to.be.equal(parseEther("1320.840434980915569253"));

            user_data = await ctl_pool.getUserData(user3.address);
            await expect(
                user_data.availableCtl
            ).to.be.equal(parseEther("1119.439710012722949252"));



            await ctl_factory.connect(user2).claimAllRewards();
            console.log("user2 claimed rewards:", await hre.ethers.provider.send("eth_blockNumber") / 1 - start_ctl_bl_num);

            //common
            comm_data = await ctl_pool.getCommonData();
            await expect(
                comm_data.tokensPerStaked
            ).to.be.equal(parseEther("0.017119838872104732"));
            await expect(
                comm_data.totalStaked
            ).to.be.equal(parseEther("5951"));
            await expect(
                comm_data.totalProfit
            ).to.be.equal(parseEther("49"));
            await expect(
                comm_data.ctlPerStaked
            ).to.be.equal(parseEther("0.731704498646102813"));
            await expect(
                await ctl_token.balanceOf(ctl_pool.address)
            ).to.be.equal(parseEther("2179.747701466740287015"));


            //user2 check
            user_data = await ctl_pool.getUserData(user2.address);
            await expect(
                user_data.totalStaked
            ).to.be.equal(parseEther('2972'));
            await expect(
                user_data.balanceOf
            ).to.be.equal(parseEther('2972'));
            await expect(
                user_data.availableReward
            ).to.be.equal(0);
            await expect(
                user_data.availableCtl
            ).to.be.equal(0);

            //user1 check
            user_data = await ctl_pool.getUserData(user1.address);
            await expect(
                user_data.availableCtl
            ).to.be.equal(parseEther("726.582567155580093309"));

            //user3 check
            user_data = await ctl_pool.getUserData(user3.address);
            await expect(
                user_data.availableCtl
            ).to.be.equal(parseEther("1453.165134311160186618"));

            /// 7 day
            await hre.ethers.provider.send("evm_increaseTime", [2 * 86400]);
            await hre.ethers.provider.send("evm_mine");
            //user2 deposited
            await outside_token.connect(user1).approve(ctl_pool.address, parseEther('2000'));
            await ctl_pool.connect(user1).deposit(parseEther('2000'));
            console.log("user1 staked 2000:", await hre.ethers.provider.send("eth_blockNumber") / 1 - start_ctl_bl_num);

            //common
            comm_data = await ctl_pool.getCommonData();
            await expect(
                comm_data.totalStaked
            ).to.be.equal(parseEther("7937"));
            await expect(
                comm_data.ctlPerStaked
            ).to.be.equal(parseEther("1.193774657219477447"));

            //user1 check
            user_data = await ctl_pool.getUserData(user1.address);
            await expect(
                user_data.totalStaked
            ).to.be.equal(parseEther('2979'));
            await expect(
                user_data.balanceOf
            ).to.be.equal(parseEther('2979'));
            await expect(
                user_data.availableCtl
            ).to.be.equal(parseEther("1435.638720948788653263"));

            //user2 check
            user_data = await ctl_pool.getUserData(user2.address);
            await expect(
                user_data.availableCtl
            ).to.be.equal(parseEther("1373.272511280069412248"));

            //user3 check
            user_data = await ctl_pool.getUserData(user3.address);
            await expect(
                user_data.availableCtl
            ).to.be.equal(parseEther("2370.836469237882209742"));


            //user1 claimed all rewards
            await ctl_factory.connect(user1).claimAllRewards();
            console.log("user1 claimed rewards:", await hre.ethers.provider.send("eth_blockNumber") / 1 - start_ctl_bl_num);

            //common
            comm_data = await ctl_pool.getCommonData();
            await expect(
                comm_data.tokensPerStaked
            ).to.be.equal(parseEther("0.018883729510885127"));
            await expect(
                comm_data.totalStaked
            ).to.be.equal(parseEther("7937"));
            await expect(
                comm_data.totalProfit
            ).to.be.equal(parseEther("63"));
            await expect(
                comm_data.ctlPerStaked
            ).to.be.equal(parseEther("1.319766845703791419"));
            await expect(
                await ctl_token.balanceOf(ctl_pool.address)
            ).to.be.equal(parseEther("4368.778251023180311164"));

            //user1 check
            user_data = await ctl_pool.getUserData(user1.address);
            await expect(
                user_data.totalStaked
            ).to.be.equal(parseEther('2979'));
            await expect(
                user_data.balanceOf
            ).to.be.equal(parseEther('2979'));
            await expect(
                user_data.availableReward
            ).to.be.equal(0);
            await expect(
                user_data.availableCtl
            ).to.be.equal(0);

            user_data = await ctl_pool.getUserData(user2.address);
            await expect(
                user_data.availableCtl
            ).to.be.equal(parseEther("1747.721295455450537032"));

            user_data = await ctl_pool.getUserData(user3.address);
            await expect(
                user_data.availableCtl
            ).to.be.equal(parseEther("2621.056955567729758134"));

            /////////////////////////////////////////////
            /// 10 day
            await hre.ethers.provider.send("evm_increaseTime", [3 * 86400]);
            await hre.ethers.provider.send("evm_mine");
            await hre.ethers.provider.send("evm_mine");
            await hre.ethers.provider.send("evm_mine");
            await ctl_pool.connect(user1).withdraw(parseEther('2000'));
            console.log("user1 withdraw 2000:", await hre.ethers.provider.send("eth_blockNumber") / 1 - start_ctl_bl_num);

            //common
            comm_data = await ctl_pool.getCommonData();
            await expect(
                comm_data.tokensPerStaked
            ).to.be.equal(parseEther("0.018883729510885127"));
            await expect(
                comm_data.totalStaked
            ).to.be.equal(parseEther("5937"));
            await expect(
                comm_data.totalProfit
            ).to.be.equal(parseEther("63"));
            await expect(
                comm_data.ctlPerStaked
            ).to.be.equal(parseEther("1.866178647808240831"));
            await expect(
                await ctl_token.balanceOf(ctl_pool.address)
            ).to.be.equal(parseEther("8368.778251023180311164"));

            //users
            user_data = await ctl_pool.getUserData(user1.address);
            await expect(
                user_data.totalStaked
            ).to.be.equal(parseEther('979'));
            await expect(
                user_data.balanceOf
            ).to.be.equal(parseEther('979'));
            await expect(
                user_data.availableReward
            ).to.be.equal(0);
            await expect(
                user_data.availableCtl
            ).to.be.equal(parseEther("1290.890285166139808348"));

            user_data = await ctl_pool.getUserData(user2.address);
            await expect(
                user_data.availableCtl
            ).to.be.equal(parseEther("3371.657171309874189496"));

            user_data = await ctl_pool.getUserData(user3.address);
            await expect(
                user_data.availableCtl
            ).to.be.equal(parseEther("3706.230794547166290366"));



            /// 11 day
            await hre.ethers.provider.send("evm_increaseTime", [86400]);
            //user4 deposited
            await outside_token.connect(user4).approve(ctl_pool.address, parseEther('600'));
            await ctl_pool.connect(user4).deposit(parseEther('600'));
            console.log("user4 staked 600:", await hre.ethers.provider.send("eth_blockNumber") / 1 - start_ctl_bl_num);

            //common
            comm_data = await ctl_pool.getCommonData();
            await expect(
                comm_data.tokensPerStaked
            ).to.be.equal(parseEther("0.019526639136160659"));
            await expect(
                comm_data.totalStaked
            ).to.be.equal(parseEther("6532.8"));
            await expect(
                comm_data.totalProfit
            ).to.be.equal(parseEther("67.2"));
            await expect(
                await ctl_token.balanceOf(ctl_pool.address)
            ).to.be.equal(parseEther("10368.778251023180311164"));

            //user1 check
            user_data = await ctl_pool.getUserData(user4.address);
            await expect(
                user_data.totalStaked
            ).to.be.equal(parseEther('595.8'));
            await expect(
                user_data.balanceOf
            ).to.be.equal(parseEther('595.8'));
            await expect(
                user_data.availableReward
            ).to.be.equal(parseEther("0.383045554739161966"));
            await expect(
                user_data.availableCtl
            ).to.be.equal(parseEther("91.201322556943423904"));


            //transfer LP tokens
            await hre.ethers.provider.send("evm_increaseTime", [86400]);
            await ctl_pool.connect(user3).transfer(user4.address, parseEther('615.66'));
            console.log("user3 transfer 615.66 to user4", await hre.ethers.provider.send("eth_blockNumber") / 1 - start_ctl_bl_num);

            //common
            comm_data = await ctl_pool.getCommonData();
            await expect(
                comm_data.tokensPerStaked
            ).to.be.equal(parseEther("0.019526639136160659"));
            await expect(
                comm_data.totalStaked
            ).to.be.equal(parseEther("6532.8"));
            await expect(
                comm_data.totalProfit
            ).to.be.equal(parseEther("67.2"));
            await expect(
                await ctl_token.balanceOf(ctl_pool.address)
            ).to.be.equal(parseEther("11368.778251023180311164"));


            //user3 check
            user_data = await ctl_pool.getUserData(user3.address);
            await expect(
                user_data.totalStaked
            ).to.be.equal(parseEther('1370.34'));
            await expect(
                user_data.balanceOf
            ).to.be.equal(parseEther('1370.34'));
            await expect(
                user_data.availableReward
            ).to.be.equal(parseEther("12.26813467384639817"));
            await expect(
                user_data.availableCtl
            ).to.be.equal(parseEther("3207.638874192511271008"));

            //user4 check
            user_data = await ctl_pool.getUserData(user4.address);
            await expect(
                user_data.totalStaked
            ).to.be.equal(parseEther('1211.46'));
            await expect(
                user_data.balanceOf
            ).to.be.equal(parseEther('1211.46'));
            await expect(
                user_data.availableReward
            ).to.be.equal(parseEther("5.894816205307833608"));
            await expect(
                user_data.availableCtl
            ).to.be.equal(parseEther("1623.515762504725244928"));

            //user1 check
            user_data = await ctl_pool.getUserData(user1.address);
            await expect(
                user_data.availableCtl
            ).to.be.equal(parseEther("1755.506726202606840991"));

            //user2 check
            user_data = await ctl_pool.getUserData(user2.address);
            await expect(
                user_data.availableCtl
            ).to.be.equal(parseEther("4782.116888123336928020"));
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
            console.log("user1 staked 1000:", await hre.ethers.provider.send("eth_blockNumber") / 1 - start_ctl_bl_num);

            //common
            let comm_data_8 = await ctl_pool_8.getCommonData();
            await expect(
                comm_data_8.tokensPerStaked
            ).to.be.equal(parseUnits("0.00704934", 8));
            await expect(
                comm_data_8.totalStaked
            ).to.be.equal(parseUnits("993", 8));
            await expect(
                comm_data_8.totalProfit
            ).to.be.equal(parseUnits("7", 8));
            await expect(
                comm_data_8.ctlPerStaked
            ).to.be.equal(0);

            //user1 check
            let user_data_8 = await ctl_pool_8.getUserData(user1.address);
            await expect(
                user_data_8.totalStaked
            ).to.be.equal(parseUnits('993', 8));
            await expect(
                user_data_8.balanceOf
            ).to.be.equal(parseUnits('993', 8));
            await expect(
                user_data_8.availableReward
            ).to.be.equal(parseUnits("6.99999462", 8));
            await expect(
                user_data_8.availableCtl
            ).to.be.equal(0);

            //user2 deposited
            await outside_token_8.connect(user2).approve(ctl_pool_8.address, parseUnits('1000', 8));
            await ctl_pool_8.connect(user2).deposit(parseUnits('1000', 8));
            console.log("user2 staked 1000:", await hre.ethers.provider.send("eth_blockNumber") / 1 - start_ctl_bl_num);

            //common
            comm_data_8 = await ctl_pool_8.getCommonData();
            await expect(
                comm_data_8.tokensPerStaked
            ).to.be.equal(parseUnits("0.01057401", 8));
            await expect(
                comm_data_8.totalStaked
            ).to.be.equal(parseUnits("1986", 8));
            await expect(
                comm_data_8.totalProfit
            ).to.be.equal(parseUnits("14", 8));
            await expect(
                comm_data_8.ctlPerStaked
            ).to.be.equal(0);


            //user2 check
            user_data_8 = await ctl_pool_8.getUserData(user2.address);
            await expect(
                user_data_8.totalStaked
            ).to.be.equal(parseUnits('993', 8));
            await expect(
                user_data_8.balanceOf
            ).to.be.equal(parseUnits('993', 8));
            await expect(
                user_data_8.availableReward
            ).to.be.equal(parseUnits("3.49999731", 8));
            await expect(
                user_data_8.availableCtl
            ).to.be.equal(parseEther("0"));

            /// 1 day
            await hre.ethers.provider.send("evm_increaseTime", [86500]);
            await hre.ethers.provider.send("evm_mine");
            //user3 deposited
            await outside_token_8.connect(user3).approve(ctl_pool_8.address, parseUnits('2000', 8));
            await ctl_pool_8.connect(user3).deposit(parseUnits('2000', 8));
            console.log("user3 staked 2000:", await hre.ethers.provider.send("eth_blockNumber") / 1 - start_ctl_bl_num);
            //common
            comm_data_8 = await ctl_pool_8.getCommonData();
            await expect(
                comm_data_8.tokensPerStaked
            ).to.be.equal(parseUnits("0.01409868", 8));
            await expect(
                comm_data_8.totalStaked
            ).to.be.equal(parseUnits("3972", 8));
            await expect(
                comm_data_8.totalProfit
            ).to.be.equal(parseUnits("28", 8));
            await expect(
                comm_data_8.ctlPerStaked
            ).to.be.equal(0);

            //user3 check
            user_data_8 = await ctl_pool_8.getUserData(user3.address);
            await expect(
                user_data_8.totalStaked
            ).to.be.equal(parseUnits('1986', 8));
            await expect(
                user_data_8.balanceOf
            ).to.be.equal(parseUnits('1986', 8));
            await expect(
                user_data_8.availableReward
            ).to.be.equal(parseUnits("6.99999462", 8));
            await expect(
                user_data_8.availableCtl
            ).to.be.equal(0);


            /// 3 day
            await hre.ethers.provider.send("evm_increaseTime", [2 * 86400]);
            //user2 deposited
            await outside_token_8.connect(user2).approve(ctl_pool_8.address, parseUnits('3000', 8));
            await ctl_pool_8.connect(user2).deposit(parseUnits('3000', 8));
            console.log("user2 staked 3000:", await hre.ethers.provider.send("eth_blockNumber") / 1 - start_ctl_bl_num);

            //common
            comm_data_8 = await ctl_pool_8.getCommonData();
            await expect(
                comm_data_8.tokensPerStaked
            ).to.be.equal(parseUnits("0.01711982", 8));
            await expect(
                comm_data_8.totalStaked
            ).to.be.equal(parseUnits("6951", 8));
            await expect(
                comm_data_8.totalProfit
            ).to.be.equal(parseUnits("49", 8));
            await expect(
                await ctl_token.balanceOf(ctl_pool_8.address)
            ).to.be.equal(parseEther("2000"));
            await expect(
                comm_data_8.ctlPerStaked
            ).to.be.equal(parseEther("0.395626528557042151"));

            //user2 check
            user_data_8 = await ctl_pool_8.getUserData(user2.address);
            await expect(
                user_data_8.totalStaked
            ).to.be.equal(parseUnits('3972', 8));
            await expect(
                user_data_8.balanceOf
            ).to.be.equal(parseUnits('3972', 8));
            await expect(
                user_data_8.availableReward
            ).to.be.equal(parseUnits("18.99996270", 8));
            await expect(
                user_data_8.availableCtl
            ).to.be.equal(parseEther("821.428571428571425521"));

            user_data_8 = await ctl_pool_8.getUserData(user1.address);
            await expect(
                user_data_8.availableCtl
            ).to.be.equal(parseEther("392.857142857142855943"));

            user_data_8 = await ctl_pool_8.getUserData(user3.address);
            await expect(
                user_data_8.availableCtl
            ).to.be.equal(parseEther("785.714285714285711886"));

            /// 5 day
            await hre.ethers.provider.send("evm_increaseTime", [2 * 86400]);
            //user2 withdrew
            await ctl_pool_8.connect(user2).withdraw(parseUnits('1000', 8));
            console.log("user2 withdraw 1000:", await hre.ethers.provider.send("eth_blockNumber") / 1 - start_ctl_bl_num);

            //common
            comm_data_8 = await ctl_pool_8.getCommonData();
            await expect(
                comm_data_8.ctlPerStaked
            ).to.be.equal(parseEther("0.563665513601572482"));
            await expect(
                await ctl_token.balanceOf(ctl_pool_8.address)
            ).to.be.equal(parseEther("3000"));

            user_data_8 = await ctl_pool_8.getUserData(user1.address);
            await expect(
                user_data_8.availableCtl
            ).to.be.equal(parseEther("559.719855006361474626"));

            user_data_8 = await ctl_pool_8.getUserData(user2.address);
            await expect(
                user_data_8.availableCtl
            ).to.be.equal(parseEther("1320.840434980915569253"));

            user_data_8 = await ctl_pool_8.getUserData(user3.address);
            await expect(
                user_data_8.availableCtl
            ).to.be.equal(parseEther("1119.439710012722949252"));


            await ctl_factory.connect(user2).claimAllRewards();
            console.log("user2 claimed rewards:", await hre.ethers.provider.send("eth_blockNumber") / 1 - start_ctl_bl_num);

            //common
            comm_data_8 = await ctl_pool_8.getCommonData();
            await expect(
                comm_data_8.tokensPerStaked
            ).to.be.equal(parseUnits("0.01711982", 8));
            await expect(
                comm_data_8.totalStaked
            ).to.be.equal(parseUnits("5951", 8));
            await expect(
                comm_data_8.totalProfit
            ).to.be.equal(parseUnits("49", 8));
            await expect(
                comm_data_8.ctlPerStaked
            ).to.be.equal(parseEther("0.731704498646102813"));
            await expect(
                await ctl_token.balanceOf(ctl_pool_8.address)
            ).to.be.equal(parseEther("2179.747701466740287015"));


            //user2 check
            user_data_8 = await ctl_pool_8.getUserData(user2.address);
            await expect(
                user_data_8.totalStaked
            ).to.be.equal(parseUnits('2972', 8));
            await expect(
                user_data_8.balanceOf
            ).to.be.equal(parseUnits('2972', 8));
            await expect(
                user_data_8.availableReward
            ).to.be.equal(0);
            await expect(
                user_data_8.availableCtl
            ).to.be.equal(0);

            //user1 check
            user_data_8 = await ctl_pool_8.getUserData(user1.address);
            await expect(
                user_data_8.availableCtl
            ).to.be.equal(parseEther("726.582567155580093309"));

            //user3 check
            user_data_8 = await ctl_pool_8.getUserData(user3.address);
            await expect(
                user_data_8.availableCtl
            ).to.be.equal(parseEther("1453.165134311160186618"));

            /// 7 day
            await hre.ethers.provider.send("evm_increaseTime", [2 * 86400]);
            await hre.ethers.provider.send("evm_mine");
            //user2 deposited
            await outside_token_8.connect(user1).approve(ctl_pool_8.address, parseUnits('2000', 8));
            await ctl_pool_8.connect(user1).deposit(parseUnits('2000', 8));
            console.log("user1 staked 2000:", await hre.ethers.provider.send("eth_blockNumber") / 1 - start_ctl_bl_num);

            comm_data_8 = await ctl_pool_8.getCommonData();
            await expect(
                comm_data_8.totalStaked
            ).to.be.equal(parseUnits("7937", 8));
            await expect(
                comm_data_8.ctlPerStaked
            ).to.be.equal(parseEther("1.193774657219477447"));

            //user1 check
            user_data_8 = await ctl_pool_8.getUserData(user1.address);
            await expect(
                user_data_8.totalStaked
            ).to.be.equal(parseUnits('2979', 8));
            await expect(
                user_data_8.balanceOf
            ).to.be.equal(parseUnits('2979', 8));
            await expect(
                user_data_8.availableCtl
            ).to.be.equal(parseEther("1435.638720948788653263"));

            //user2 check
            user_data_8 = await ctl_pool_8.getUserData(user2.address);
            await expect(
                user_data_8.availableCtl
            ).to.be.equal(parseEther("1373.272511280069412248"));

            //user3 check
            user_data_8 = await ctl_pool_8.getUserData(user3.address);
            await expect(
                user_data_8.availableCtl
            ).to.be.equal(parseEther("2370.836469237882209742"));


            await ctl_factory.connect(user1).claimAllRewards();
            console.log("user1 claimed rewards:", await hre.ethers.provider.send("eth_blockNumber") / 1 - start_ctl_bl_num);

            //common
            comm_data_8 = await ctl_pool_8.getCommonData();
            await expect(
                comm_data_8.tokensPerStaked
            ).to.be.equal(parseUnits("0.01888371", 8));
            await expect(
                comm_data_8.totalStaked
            ).to.be.equal(parseUnits("7937", 8));
            await expect(
                comm_data_8.totalProfit
            ).to.be.equal(parseUnits("63", 8));
            await expect(
                comm_data_8.ctlPerStaked
            ).to.be.equal(parseEther("1.319766845703791419"));
            await expect(
                await ctl_token.balanceOf(ctl_pool_8.address)
            ).to.be.equal(parseEther("4368.778251023180311164"));

            //user1 check
            user_data_8 = await ctl_pool_8.getUserData(user1.address);
            await expect(
                user_data_8.totalStaked
            ).to.be.equal(parseUnits('2979', 8));
            await expect(
                user_data_8.balanceOf
            ).to.be.equal(parseUnits('2979', 8));
            await expect(
                user_data_8.availableReward
            ).to.be.equal(0);
            await expect(
                user_data_8.availableReward
            ).to.be.equal(0);
            await expect(
                user_data_8.availableCtl
            ).to.be.equal(0);

            user_data_8 = await ctl_pool_8.getUserData(user2.address);
            await expect(
                user_data_8.availableCtl
            ).to.be.equal(parseEther("1747.721295455450537032"));

            user_data_8 = await ctl_pool_8.getUserData(user3.address);
            await expect(
                user_data_8.availableCtl
            ).to.be.equal(parseEther("2621.056955567729758134"));

            /// 10 day
            await hre.ethers.provider.send("evm_increaseTime", [3 * 86400]);
            await hre.ethers.provider.send("evm_mine");
            await hre.ethers.provider.send("evm_mine");
            await hre.ethers.provider.send("evm_mine");
            await ctl_pool_8.connect(user1).withdraw(parseUnits('2000', 8));
            console.log("user1 withdraw 2000:", await hre.ethers.provider.send("eth_blockNumber") / 1 - start_ctl_bl_num);
            //common
            comm_data_8 = await ctl_pool_8.getCommonData();
            await expect(
                comm_data_8.tokensPerStaked
            ).to.be.equal(parseUnits("0.01888371", 8));
            await expect(
                comm_data_8.totalStaked
            ).to.be.equal(parseUnits("5937", 8));
            await expect(
                comm_data_8.totalProfit
            ).to.be.equal(parseUnits("63", 8));
            await expect(
                comm_data_8.ctlPerStaked
            ).to.be.equal(parseEther("1.866178647808240831"));
            await expect(
                await ctl_token.balanceOf(ctl_pool_8.address)
            ).to.be.equal(parseEther("8368.778251023180311164"));

            //user1 check
            user_data_8 = await ctl_pool_8.getUserData(user1.address);
            await expect(
                user_data_8.totalStaked
            ).to.be.equal(parseUnits('979', 8));
            await expect(
                user_data_8.balanceOf
            ).to.be.equal(parseUnits('979', 8));
            await expect(
                user_data_8.availableReward
            ).to.be.equal(0);
            await expect(
                user_data_8.availableCtl
            ).to.be.equal(parseEther("1290.890285166139808348"));

            user_data_8 = await ctl_pool_8.getUserData(user2.address);
            await expect(
                user_data_8.availableCtl
            ).to.be.equal(parseEther("3371.657171309874189496"));

            user_data_8 = await ctl_pool_8.getUserData(user3.address);
            await expect(
                user_data_8.availableCtl
            ).to.be.equal(parseEther("3706.230794547166290366"));

            /// 11 day
            await hre.ethers.provider.send("evm_increaseTime", [86400]);
            //user4 deposited
            await outside_token_8.connect(user4).approve(ctl_pool_8.address, parseUnits('600', 8));
            await ctl_pool_8.connect(user4).deposit(parseUnits('600', 8));
            console.log("user4 staked 600:", await hre.ethers.provider.send("eth_blockNumber") / 1 - start_ctl_bl_num);

            //common
            comm_data_8 = await ctl_pool_8.getCommonData();
            await expect(
                comm_data_8.tokensPerStaked
            ).to.be.equal(parseUnits("0.01952661", 8));
            await expect(
                comm_data_8.totalStaked
            ).to.be.equal(parseUnits("6532.8", 8));
            await expect(
                comm_data_8.totalProfit
            ).to.be.equal(parseUnits("67.2", 8));
            await expect(
                await ctl_token.balanceOf(ctl_pool_8.address)
            ).to.be.equal(parseEther("10368.778251023180311164"));

            //user1 check
            user_data_8 = await ctl_pool_8.getUserData(user4.address);
            await expect(
                user_data_8.totalStaked
            ).to.be.equal(parseUnits('595.8', 8));
            await expect(
                user_data_8.balanceOf
            ).to.be.equal(parseUnits('595.8', 8));
            await expect(
                user_data_8.availableReward
            ).to.be.equal(parseUnits("0.38303982", 8));
            await expect(
                user_data_8.availableCtl
            ).to.be.equal(parseEther("91.201322556943423904"));


            //transfer LP tokens
            await hre.ethers.provider.send("evm_increaseTime", [86400]);
            await ctl_pool_8.connect(user3).transfer(user4.address, parseUnits('615.66', 8));

            //common
            comm_data_8 = await ctl_pool_8.getCommonData();
            await expect(
                comm_data_8.tokensPerStaked
            ).to.be.equal(parseUnits("0.01952661", 8));
            await expect(
                comm_data_8.totalStaked
            ).to.be.equal(parseUnits("6532.8", 8));
            await expect(
                comm_data_8.totalProfit
            ).to.be.equal(parseUnits("67.2", 8));
            await expect(
                await ctl_token.balanceOf(ctl_pool_8.address)
            ).to.be.equal(parseEther("11368.778251023180311164"));

            //user3 check
            user_data_8 = await ctl_pool_8.getUserData(user3.address);
            await expect(
                user_data_8.totalStaked
            ).to.be.equal(parseUnits('1370.34', 8));
            await expect(
                user_data_8.balanceOf
            ).to.be.equal(parseUnits('1370.34', 8));
            await expect(
                user_data_8.availableReward
            ).to.be.equal(parseUnits("12.26810587", 8));
            await expect(
                user_data_8.availableCtl
            ).to.be.equal(parseEther("3207.638874192511271008"));

            //user4 check
            user_data_8 = await ctl_pool_8.getUserData(user4.address);
            await expect(
                user_data_8.totalStaked
            ).to.be.equal(parseUnits('1211.46', 8));
            await expect(
                user_data_8.balanceOf
            ).to.be.equal(parseUnits('1211.46', 8));
            await expect(
                user_data_8.availableReward
            ).to.be.equal(parseUnits("5.89479755", 8));
            await expect(
                user_data_8.availableCtl
            ).to.be.equal(parseEther("1623.515762504725244928"));

            //user1 check
            user_data_8 = await ctl_pool_8.getUserData(user1.address);
            await expect(
                user_data_8.availableCtl
            ).to.be.equal(parseEther("1755.506726202606840991"));

            //user2 check
            user_data_8 = await ctl_pool_8.getUserData(user2.address);
            await expect(
                user_data_8.availableCtl
            ).to.be.equal(parseEther("4782.116888123336928020"));
        });
    });
});

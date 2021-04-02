const Web3 = require("web3");
const web3 = new Web3("");
const { expect, assert } = require("chai");
const { ethers, waffle } = require("hardhat");
require("@nomiclabs/hardhat-waffle");
parseEther = ethers.utils.parseEther;
//ethers.provider.send("evm_setNextBlockTimestamp", [time + 10000]);

const nullstr = "0x0000000000000000000000000000000000000000"
let main_token_owner;
let outside_token_owner;
let lp_pool_owner;
let lp_token_owner;
let borrower;
let user1;
let user2;
let user3;
let user4;
let ololosh;

ethers.getSigners().then(val => {
  [outside_token_owner, lp_token_owner, ololosh, lp_pool_owner, main_token_owner, borrower, user1, user2, user3, user4] = val;
});

describe("Liquidity pool contract", () => {
  let OutsideToken;
  let MainToken;
  let LPPool;
  let LPToken;
  let FLReceiver;
  let main_token;
  let outside_token;
  let lp_pool;
  let fl_receiver;
  beforeEach(async () => {
    require('dotenv').config();
    OutsideToken = await ethers.getContractFactory("CTLToken", outside_token_owner);
    MainToken = await ethers.getContractFactory("CTLToken", main_token_owner);
    LPPool = await ethers.getContractFactory("CitadelPool", lp_pool_owner);
    LPToken = await ethers.getContractFactory("LPToken", lp_token_owner);
    FLReceiver = await ethers.getContractFactory("FlashLoanReceiver", borrower);

    outside_token = await OutsideToken.deploy(
      "OUTSIDE",
      "OUT",
      18,
      parseEther(process.env.TOKEN_TOTAL_SUPPLY)
    );
    await outside_token.connect(outside_token_owner).mint(parseEther('1000000'));

    main_token = await MainToken.deploy(
      process.env.TOKEN_NAME,
      process.env.TOKEN_SYMBOL,
      process.env.TOKEN_DECIMALS,
      parseEther(process.env.TOKEN_TOTAL_SUPPLY)
    );
    var start_time = new Date().getTime();

    lp_pool = await LPPool.deploy(main_token.address, start_time, parseEther('0.007'));

    fl_receiver = await FLReceiver.deploy(lp_pool.address);
    await outside_token.connect(outside_token_owner).transfer(fl_receiver.address, parseEther('1012'));
  });
  describe("Deployment", () => {
    it("Should set the DEFAULT_ADMIN_ROLE and ADMIN_ROLE to creator", async () => {
      var default_admin_role = await lp_pool.DEFAULT_ADMIN_ROLE();
      var admin_role = await lp_pool.ADMIN_ROLE();
      expect(
        await lp_pool.connect(lp_pool_owner).hasRole(default_admin_role, lp_pool_owner.address)
      ).to.equal(true);
      expect(
        await lp_pool.connect(lp_pool_owner).hasRole(admin_role, lp_pool_owner.address)
      ).to.equal(true);
    });
  });

  describe("Settings", () => {

    it("Tokens whitelist may be set only admin", async () => {
      try {
        await lp_pool.connect(outside_token_owner.address).updateWhitelist(outside_token.address, true, parseEther('0.012'));
      }
      catch (e) {
        await expect(e.message).to.include('Pool: Caller is not a admin')
      }
    });

    it("Add token to pool", async () => {
      await lp_pool.connect(lp_pool_owner).updateWhitelist(outside_token.address, true, parseEther('0.012'));

      await expect(
        await lp_pool.connect(lp_pool_owner).isPoolEnabled(outside_token.address)
      ).to.be.equal(true);

      lp_token_address = await lp_pool.connect(lp_pool_owner).getLPToken(outside_token.address);

      await expect(lp_token_address).to.be.properAddress;

      await expect(
        await lp_pool.connect(lp_pool_owner).reversed_whitelist(lp_token_address)
      ).to.be.equal(outside_token.address);

      //check deployed lp-token
      const lp_token = await LPToken.attach(lp_token_address);
      await expect(
        await lp_token.name()
      ).to.be.equal("ct" + await outside_token.name());
      await expect(
        await lp_token.symbol()
      ).to.be.equal("ct" + await outside_token.symbol());
    });

    it("Disable token in pool ", async () => {
      //Add token
      await lp_pool.connect(lp_pool_owner).updateWhitelist(outside_token.address, true, parseEther('0.012'));
      var lp_token_address = await lp_pool.connect(lp_pool_owner).getLPToken(outside_token.address);
      await expect(lp_token_address).to.be.properAddress;
      await expect(
        await lp_pool.connect(lp_pool_owner).reversed_whitelist(lp_token_address)
      ).to.be.equal(outside_token.address);

      //Disable token
      await lp_pool.connect(lp_pool_owner).updateWhitelist(outside_token.address, false, parseEther('0.012'));
      await expect(
        await lp_pool.connect(lp_pool_owner).isPoolEnabled(outside_token.address)
      ).to.be.equal(false);
    });
  });

  describe("Deposit funds", () => {
    it("Deposit invalid token: fail", async () => {
      try {
        await lp_pool.connect(outside_token_owner).deposit(nullstr, parseEther('100'));
      }
      catch (e) {
        await expect(e.message).to.include('Pool: Token is invalid')
      }
    });

    it("Deposit disabled token: fail", async () => {
      await lp_pool.connect(lp_pool_owner).updateWhitelist(outside_token.address, false, parseEther('0.012'));
      try {
        await lp_pool.connect(outside_token_owner).deposit(outside_token.address, parseEther('100'));
      }
      catch (e) {
        await expect(e.message).to.include('Pool: Token is not enabled')
      }
    });

    it("Deposit invalid amount of token: fail", async () => {
      await lp_pool.connect(lp_pool_owner).updateWhitelist(outside_token.address, true, parseEther('0.012'));
      try {
        await lp_pool.connect(outside_token_owner).deposit(outside_token.address, parseEther('0'));
      }
      catch (e) {
        await expect(e.message).to.include('Pool: Amount is invalid')
      }
    });

    it("Deposit not approved token: fail", async () => {
      //LP-pool settings
      await lp_pool.connect(lp_pool_owner).updateWhitelist(outside_token.address, true, parseEther('0.012'));

      try {
        await lp_pool.connect(outside_token_owner).deposit(outside_token.address, parseEther('100'));
      }
      catch (e) {
        await expect(e.message).to.include('BEP20: transfer amount exceeds allowance')
      }
    });

    it("True deposit: success", async () => {
      //LP-pool settings
      await lp_pool.connect(lp_pool_owner).updateWhitelist(outside_token.address, true, parseEther('0.012'));

      //Approve for transfer outside token to LP-pool
      await outside_token.connect(outside_token_owner).approve(lp_pool.address, parseEther('1000'));

      //Outside token transfered to LP-pool address and add stacked
      await lp_pool.connect(outside_token_owner).deposit(outside_token.address, parseEther('1000'));

      //Check staked
      await expect(
        await lp_pool.connect(outside_token_owner).getAccountStacked(outside_token.address)
      ).to.be.equal(parseEther('993'));
      await expect(
        await lp_pool.connect(outside_token_owner).getTotalStacked(outside_token.address)
      ).to.be.equal(parseEther('993'));

      [sign, value] = await lp_pool.connect(outside_token_owner).getDailyStacked(outside_token.address);
      await expect(sign).to.be.equal(false);
      await expect(value).to.be.equal(parseEther('993'));

      [sign, value] = await lp_pool.connect(outside_token_owner).getMissedProfit(outside_token.address);
      await expect(sign).to.be.equal(false);
      await expect(value).to.be.equal(parseEther('0'));

      await expect(
        await lp_pool.connect(outside_token_owner).getAvailableReward(outside_token.address)
      ).to.be.equal(0);
    });
  });

  describe("Withdraw funds", () => {
    it("Withdraw invalid token: fail", async () => {
      try {
        await lp_pool.connect(outside_token_owner).withdraw(nullstr, parseEther('100'));
      }
      catch (e) {
        await expect(e.message).to.include('Pool: Token is invalid')
      }
    });

    it("Withdraw not added token: fail", async () => {
      try {
        await lp_pool.connect(outside_token_owner).withdraw(outside_token.address, parseEther('100'));
      }
      catch (e) {
        await expect(e.message).to.include('Pool: Token is not enabled')
      }
    });

    it("Withdraw invalid amount (0) of token: fail", async () => {
      await lp_pool.connect(lp_pool_owner).updateWhitelist(outside_token.address, true, parseEther('0.012'));
      await outside_token.connect(outside_token_owner).approve(lp_pool.address, parseEther('100'));
      await lp_pool.connect(outside_token_owner).deposit(outside_token.address, parseEther('100'));
      try {
        await lp_pool.connect(outside_token_owner).withdraw(outside_token.address, parseEther('0'));
      }
      catch (e) {
        await expect(e.message).to.include('Pool: Amount is invalid')
      }
    });

    it("Withdraw invalid amount (> deposited) of token: fail", async () => {
      await lp_pool.connect(lp_pool_owner).updateWhitelist(outside_token.address, true, parseEther('0.012'));
      await outside_token.connect(outside_token_owner).approve(lp_pool.address, parseEther('1000'));
      await lp_pool.connect(outside_token_owner).deposit(outside_token.address, parseEther('1000'));
      try {
        await lp_pool.connect(outside_token_owner).withdraw(outside_token.address, parseEther('994'));
      }
      catch (e) {
        await expect(e.message).to.include('Pool: Amount is invalid')
      }
    });

    it("True withdraw: success", async () => {
      await lp_pool.connect(lp_pool_owner).updateWhitelist(outside_token.address, true, parseEther('0.012'));
      //deposit token to  pool
      await outside_token.connect(outside_token_owner).approve(lp_pool.address, parseEther('1000'));
      await lp_pool.connect(outside_token_owner).deposit(outside_token.address, parseEther('1000'));

      //approve lp_token to pool
      lp_token_address = await lp_pool.connect(outside_token_owner).getLPToken(outside_token.address);
      lp_token = await LPToken.attach(lp_token_address);
      await lp_token.connect(outside_token_owner).approve(lp_pool.address, parseEther('100'));

      await lp_pool.connect(outside_token_owner).withdraw(outside_token.address, parseEther('100'));
      //Check staked
      await expect(
        await lp_pool.connect(outside_token_owner).getAccountStacked(outside_token.address)
      ).to.be.equal(parseEther('893'));
      await expect(
        await lp_pool.connect(outside_token_owner).getTotalStacked(outside_token.address)
      ).to.be.equal(parseEther('893'));

      [sign, value] = await lp_pool.connect(outside_token_owner).getDailyStacked(outside_token.address);
      await expect(sign).to.be.equal(false);
      await expect(value).to.be.equal(parseEther('893'));

      [sign, value] = await lp_pool.connect(outside_token_owner).getMissedProfit(outside_token.address);
      await expect(sign).to.be.equal(false);
      await expect(value).to.be.equal(parseEther('0'));

      await expect(
        await lp_pool.connect(outside_token_owner).getAvailableReward(outside_token.address)
      ).to.be.equal(parseEther('0'));
    });
  });

  describe("Flash loan request", () => {
    it("", async () => {
      await lp_pool.connect(lp_pool_owner).updateWhitelist(outside_token.address, true, parseEther('0.012'));
      //deposit token to  pool
      await outside_token.connect(outside_token_owner).approve(lp_pool.address, parseEther('1000'));
      await lp_pool.connect(outside_token_owner).deposit(outside_token.address, parseEther('1000'));
      //993 - staked, 7 - profit
      //

    });

    it("", async () => {
    });

    it("", async () => {
    });
  });
});

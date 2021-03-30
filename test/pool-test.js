const Web3 = require("web3");
const web3 = new Web3("");
const { expect, assert } = require("chai");
const { ethers, waffle } = require("hardhat");
require("@nomiclabs/hardhat-waffle");

const nullstr = "0x0000000000000000000000000000000000000000"
let outside_token_owner;
let lp_pool_owner;
let lp_token_owner;
let user1;
let user2;
let user3;

ethers.getSigners().then(val => {
  [outside_token_owner, lp_token_owner, lp_pool_owner, user1, user2, user3] = val;
});

describe("Liquidity pool contract", () => {
  let OutsideToken;
  let LPPool;
  let LPToken;
  let outside_token;
  let lp_pool;
  beforeEach(async () => {
    require('dotenv').config();
    OutsideToken = await ethers.getContractFactory("CTLToken", outside_token_owner);
    LPPool = await ethers.getContractFactory("CitadelPool", lp_pool_owner);
    LPToken = await ethers.getContractFactory("LPToken", lp_token_owner);
    outside_token = await OutsideToken.deploy(
      process.env.TOKEN_NAME,
      process.env.TOKEN_SYMBOL,
      process.env.TOKEN_DECIMALS,
      web3.utils.toWei(process.env.TOKEN_TOTAL_SUPPLY, "ether")
    );
    lp_pool = await LPPool.deploy();
  });
  describe("Deployment", () => {
    /*it("Should set the DEFAULT_ADMIN_ROLE to creator", async () => {
      var role = await lp_pool.DEFAULT_ADMIN_ROLE();
      var res = await lp_pool.hasRole(role, lp_pool_owner.address);
      console.log(role, lp_pool_owner.address, res);
      expect(res).to.equal(true);
    });*/
  });

  describe("Settings", () => {

    it("Tokens whitelist may be set only admin", async () => {
      try {
        await lp_pool.connect(outside_token_owner.address).updateWhitelist(outside_token.address, true);
      }
      catch (e) {
        await expect(e.message).to.include('Pool: Caller is not a admin')
      }
    });

    it("Add token to whitelist", async () => {
      await lp_pool.connect(lp_pool_owner).updateWhitelist(outside_token.address, true);
      var lp_token_address = await lp_pool.connect(lp_pool_owner).tokenWhitelist(outside_token.address);

      await expect(lp_token_address).to.be.properAddress;

      await expect(
        await lp_pool.connect(lp_pool_owner).reversedWhitelist(lp_token_address)
      ).to.be.equal(outside_token.address);

      const lp_token = await LPToken.attach(lp_token_address);

      await expect(
        await lp_token.name()
      ).to.be.equal("ct" + await outside_token.name());

      await expect(
        await lp_token.symbol()
      ).to.be.equal("ct" + await outside_token.symbol());
    });

    it("Disable token in whitelist ", async () => {
      //Add token
      await lp_pool.connect(lp_pool_owner).updateWhitelist(outside_token.address, true);
      var lp_token_address = await lp_pool.connect(lp_pool_owner).tokenWhitelist(outside_token.address);
      await expect(lp_token_address).to.be.properAddress;
      await expect(
        await lp_pool.connect(lp_pool_owner).reversedWhitelist(lp_token_address)
      ).to.be.equal(outside_token.address);

      //Disable token
      await lp_pool.connect(lp_pool_owner).updateWhitelist(outside_token.address, false);
      lp_token_address = await lp_pool.connect(lp_pool_owner).tokenWhitelist(outside_token.address);
      await expect(lp_token_address).to.be.properAddress;
      await expect(lp_token_address).to.be.equal(nullstr);
    });
  });

  describe("Stake", () => {
    it("Deposit invalid token fail", async () => {
      try {
        await lp_pool.connect(outside_token_owner).deposit(nullstr, 100);
      }
      catch (e) {
        await expect(e.message).to.include('Pool: Token is invalid')
      }
    });

    it("Deposit disabled token fail", async () => {
      await lp_pool.connect(lp_pool_owner).updateWhitelist(outside_token.address, false);
      try {
        await lp_pool.connect(outside_token_owner).deposit(outside_token.address, 100);
      }
      catch (e) {
        await expect(e.message).to.include('Pool: Token is not enabled')
      }
    });

    it("Deposit invalid amount of token", async () => {
      await lp_pool.connect(lp_pool_owner).updateWhitelist(outside_token.address, true);
      try {
        await lp_pool.connect(outside_token_owner).deposit(outside_token.address, 0);
      }
      catch (e) {
        await expect(e.message).to.include('Pool: Amount is invalid')
      }
    });

    it("Deposit not approved token", async () => {
      //LP-pool settings
      await lp_pool.connect(lp_pool_owner).updateWhitelist(outside_token.address, true);

      try {
        await lp_pool.connect(outside_token_owner).deposit(outside_token.address, 100);
      }
      catch (e) {
        await expect(e.message).to.include('BEP20: transfer amount exceeds allowance')
      }
    });

    it("Deposit liquidity", async () => {
      //LP-pool settings
      await lp_pool.connect(lp_pool_owner).updateWhitelist(outside_token.address, true);

      //Approve for transfer outside token to LP-pool
      await outside_token.connect(outside_token_owner).approve(lp_pool.address, 100);

      //Outside token trafered to LP-pool address and add stacked
      await lp_pool.connect(outside_token_owner).deposit(outside_token.address, 100);

      //Check staked
      await expect(
        await lp_pool.connect(outside_token_owner).accountStacked(outside_token.address)
      ).to.be.equal(100);
      await expect(
        await lp_pool.connect(outside_token_owner).totalStacked(outside_token.address)
      ).to.be.equal(100);
      await expect(
        await lp_pool.connect(outside_token_owner).missedProfit(outside_token.address)
      ).to.be.equal(0);
      await expect(
        await lp_pool.connect(outside_token_owner).availableReward(outside_token.address)
      ).to.be.equal(0);
    });
  });
});

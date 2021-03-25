const Web3 = require("web3");
const web3 = new Web3("");
const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
//const { deployContract } = waffle;
const { deployContract } = require("ethereum-waffle");


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
  let lp_token;
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
    lp_token = await LPToken.deploy(
      process.env.LP_TOKEN_NAME,
      process.env.LP_TOKEN_SYMBOL,
      process.env.LP_TOKEN_DECIMALS
    );
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
      await expect(
        await lp_pool.connect(outside_token_owner.address).update_whitelist(outside_token.address)
      ).to.be.reverted;
    });

    it("Tokens whitelist settings", async () => {
      await lp_pool.connect(lp_pool_owner).update_whitelist(outside_token.address);
      lp_token_address = await lp_pool.connect(lp_pool_owner).get_token_whitelist(outside_token.address);

      await expect(lp_token_address).to.be.properAddress;

      await expect(
        await lp_pool.connect(lp_pool_owner).get_reversed_whitelist(lp_token_address)
      ).to.be.equal(outside_token.address);
    });

    /*it("Tokens whitelist two times adding should be reverted", async () => {
      await lp_pool.connect(lp_pool_owner).update_whitelist(outside_token.address);
      await expect(
        await lp_pool.connect(lp_pool_owner).update_whitelist(outside_token.address)
      ).to.be.reverted;
    });*/
  });

  describe("Stake", () => {
    it("Deposit liquidity", async () => {
      //LP-pool settings
      await lp_pool.connect(lp_pool_owner).update_whitelist(outside_token.address);

      //Approve for transfer outside token to LP-pool
      await outside_token.connect(outside_token_owner).approve(lp_pool.address, 100, { from: outside_token_owner.address });

      //Outside token trafered to LP-pool address and add stacked
      await lp_pool.connect(outside_token_owner).deposit(outside_token.address, 100, { from: outside_token_owner.address });

      //Check staked
      await expect(
        await lp_pool.connect(outside_token_owner).get_account_stacked(outside_token.address, { from: outside_token_owner.address })
      ).to.be.equal(100);
    });
  });
  /*
    describe("Quantity of LP token per ether set", () => {
      it("Should 1", async () => {
  
      });
      it("Should 2", async () => {
  
      });
    });
  
    describe("Add liquidity", () => {
      it("Should 1", async () => {
  
      });
      it("Should 2", async () => {
  
      });
    });
    */
});

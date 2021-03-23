const Web3 = require("web3");
const web3 = new Web3("");
const { ethers } = require("hardhat");
const { expect } = require("chai");
//const { isCallTrace } = require("hardhat/internal/hardhat-network/stack-traces/message-trace");


let outside_token_owner;
let lp_pool_owner;
let lp_token_owner;

ethers.getSigners().then(val => {
  [outside_token_owner, lp_token_owner, lp_pool_owner] = val;
});

describe("Liquidity pool contract", () => {
  describe("Deployment", () => {
    /*it("Should set the DEFAULT_ADMIN_ROLE to creator", async () => {
      var role = await lp_pool.DEFAULT_ADMIN_ROLE();
      var res = await lp_pool.hasRole(role, lp_pool_owner.address);
      console.log(role, lp_pool_owner.address, res);
      expect(res).to.equal(true);
    });*/
  });

  describe("Settings", () => {
    /*
    it("Tokens whitelist may be set only admin", async () => {
      await expect(
        await lp_pool.connect(outside_token_owner.address).update_whitelist(outside_token.address, true)
      ).to.be.revertedWith("Caller is not a admin");
    });*/

    it("Tokens whitelist settings", async () => {
      require('dotenv').config();
      const OutsideToken = await ethers.getContractFactory("CTLToken", outside_token_owner);
      const LPPool = await ethers.getContractFactory("CitadelPool", lp_pool_owner);
      const outside_token = await OutsideToken.deploy(
        process.env.TOKEN_NAME,
        process.env.TOKEN_SYMBOL,
        process.env.TOKEN_DECIMALS,
        web3.utils.toWei(process.env.TOKEN_TOTAL_SUPPLY, "ether")
      );
      const lp_pool = await LPPool.deploy();
      await lp_pool.connect(lp_pool_owner).update_whitelist(outside_token.address, true);
      await expect(
        await lp_pool.connect(lp_pool_owner).get_token_whitelist(outside_token.address)
      ).to.be.equal(true);
    });

    /*
    it("LP Token may be set only admin", async () => {
      await expect(
        await lp_pool.connect(outside_token_owner).set_lp_token(lp_token.address)
      ).to.be.revertedWith("Caller is not a admin");
    });*/


    it("LP Token settings", async () => {
      require('dotenv').config();
      const LPPool = await ethers.getContractFactory("CitadelPool", lp_pool_owner);
      const LPToken = await ethers.getContractFactory("LPToken", lp_token_owner);
      const lp_pool = await LPPool.deploy();
      const lp_token = await LPToken.deploy(
        process.env.LP_TOKEN_NAME,
        process.env.LP_TOKEN_SYMBOL,
        process.env.LP_TOKEN_DECIMALS,
        lp_pool.address
      );
      await lp_pool.set_lp_token(lp_token.address);
      await expect(
        await lp_pool.lp_token()
      ).to.be.equal(lp_token.address);
    });
  });

  describe("Stake", () => {
    it("Accounts stacked", async () => {
      require('dotenv').config();
      const OutsideToken = await ethers.getContractFactory("CTLToken", outside_token_owner);
      const LPPool = await ethers.getContractFactory("CitadelPool", lp_pool_owner);
      const LPToken = await ethers.getContractFactory("LPToken", lp_token_owner);
      const outside_token = await OutsideToken.deploy(
        process.env.TOKEN_NAME,
        process.env.TOKEN_SYMBOL,
        process.env.TOKEN_DECIMALS,
        web3.utils.toWei(process.env.TOKEN_TOTAL_SUPPLY, "ether")
      );
      const lp_pool = await LPPool.deploy();
      const lp_token = await LPToken.deploy(
        process.env.LP_TOKEN_NAME,
        process.env.LP_TOKEN_SYMBOL,
        process.env.LP_TOKEN_DECIMALS,
        lp_pool.address
      );

      //LP-pool settings
      await lp_pool.connect(lp_pool_owner).set_lp_token(lp_token.address);
      await lp_pool.connect(lp_pool_owner).update_whitelist(outside_token.address, true);

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
    describe("LP token address set", () => {
      it("Should 1", async () => {
  
      });
      it("Should 2", async () => {
  
      });
    });
  
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

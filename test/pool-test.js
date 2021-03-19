
const Web3 = require("web3");
const web3 = new Web3("");
var expect = require("assert");
const { isCallTrace } = require("hardhat/internal/hardhat-network/stack-traces/message-trace");
const { ethers } = require("hardhat");


describe("Liquidity pool contract", () => {
  let MainToken;
  let main_token;
  let main_token_owner;
  let LPToken;
  let lp_token;
  let lp_token_owner;
  let LPPool;
  let lp_pool;
  let lp_pool_owner;

  beforeEach(async () => {
    require('dotenv').config();
    [main_token_owner, lp_token_owner, lp_pool_owner] = await ethers.getSigners();

    MainToken = await ethers.getContractFactory("CTLToken", main_token_owner);
    LPToken = await ethers.getContractFactory("CTLToken", lp_token_owner);
    LPPool = await ethers.getContractFactory("CitadelPool", lp_pool_owner);

    main_token = await MainToken.deploy(
      process.env.TOKEN_NAME,
      process.env.TOKEN_SYMBOL,
      process.env.TOKEN_DECIMALS,
      web3.utils.toWei(process.env.TOKEN_TOTAL_SUPPLY, "ether")
    );

    lp_token = await LPToken.deploy(
      process.env.LP_TOKEN_NAME,
      process.env.LP_TOKEN_SYMBOL,
      process.env.LP_TOKEN_DECIMALS,
      web3.utils.toWei(process.env.LP_TOKEN_TOTAL_SUPPLY, "ether")
    );

    lp_pool = await LPPool.deploy();

    console.log(
      "Main token address:", main_token.address, "owner:", main_token_owner.address,
      "\nLP token address:", lp_token.address, "owner:", lp_token_owner.address,
      "\nLiquidity pool address:", lp_pool.address, "owner:", lp_pool_owner.address,
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
    /*
    it("Tokens whitelist may be set only admin", async () => {
      await expect(
        await lp_pool.connect(main_token_owner.address).update_whitelist(main_token.address, true)
      ).to.be.revertedWith("Caller is not a admin");
    });

    it("Tokens whitelist may be set only admin", async () => {
      await expect(
        await lp_pool.update_whitelist(main_token.address, true)
      ).to.be.equal(true);
    });

    it("LP Token may be set only admin", async () => {
      await expect(
        await lp_pool.connect(main_token_owner.address).set_lp_token(lp_token.address)
      ).to.be.revertedWith("Caller is not a admin");
    });
    */

    it("LP Token may be set only admin", async () => {
      let pool = await LPPool.attach(lp_pool.address);
      let val = await pool.set_lp_token(lp_token.address);
      //console.log(val);
      expect.strictEqual(val, lp_token.address);
    });
  });
  /*
    describe("Whitelist", () => {
      it("Should 1", async () => {
  
      });
      it("Should 2", async () => {
  
      });
    });
  
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

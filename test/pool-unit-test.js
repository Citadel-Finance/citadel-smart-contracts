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
  [liquidity_provider, lp_pool_owner, borrower, user1, user2, user3, user4] = val;
});

describe("Pool unit test", () => {
  let OutsideToken;
  let CTLToken;
  let CitadelFactory;
  let CitadelPool;
  let FLReceiver;
  let ctl_token;
  let outside_token;
  let ctl_factory;
  let ctl_pool;
  let fl_receiver;
  let start_time;

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

    ctl_token = await CTLToken.deploy(
      process.env.TOKEN_NAME,
      process.env.TOKEN_SYMBOL,
      process.env.TOKEN_DECIMALS,
      0
    );

    ctl_factory = await CitadelFactory.deploy(ctl_token.address);
    await ctl_factory.deployed();

    await ctl_token.grantRole(await ctl_token.ADMIN_ROLE(), ctl_factory.address);

    await ctl_factory.addPool(outside_token.address, tokensPerBlock, parseEther(process.env.POOL_APY_TAX), parseEther(process.env.POOL_PREMIUM_COEF), true);
    let lp_pool_addr = await ctl_factory.pools(outside_token.address);
    ctl_pool = await CitadelPool.attach(lp_pool_addr);

    fl_receiver = await FLReceiver.deploy(ctl_pool.address);
    await fl_receiver.deployed();
  });

  describe("Deployment", () => {
    it("Should set the ADMIN_ROLE to creator", async () => {
      expect(
        await ctl_pool.hasRole(await ctl_pool.ADMIN_ROLE(), lp_pool_owner.address)
      ).to.equal(true);
      common_data = await ctl_pool.getCommonData();
      expect(
        common_data.apyTax
      ).to.equal(parseEther('0.007'));
      expect(
        common_data.premiumCoeff
      ).to.equal(parseEther('0.012'));
      expect(
        common_data.ctlToken
      ).to.equal(ctl_token.address);
    });
  });

  describe("Settings", () => {

    it("Tokens whitelist may be set only admin: fail", async () => {
      try {
        await ctl_factory.connect(liquidity_provider).addPool(outside_token.address, tokensPerBlock, parseEther('0.007'), parseEther('0.012'), true);
      }
      catch (e) {
        await expect(e.message).to.include('CitadelFactory: Caller is not a admin')
      }
    });

    it("Add token to pool", async () => {
      await expect((await ctl_factory.allPools())[0].enabled).to.be.equal(true);
      lp_token_address = await ctl_factory.pools(outside_token.address);
      await expect(lp_token_address).to.be.properAddress;

      //check deployed lp-token
      await expect(
        await ctl_pool.name()
      ).to.be.equal("ct" + await outside_token.name());
      await expect(
        await ctl_pool.symbol()
      ).to.be.equal("ct" + await outside_token.symbol());
      await expect(
        await ctl_pool.decimals()
      ).to.be.equal(await outside_token.decimals());
    });

    it("Disable token in pool", async () => {
      let lp_token_address = await ctl_factory.pools(outside_token.address);
      await expect(lp_token_address).to.be.properAddress;

      //Disable token
      await ctl_factory.connect(lp_pool_owner).disablePool(outside_token.address);
      await expect(
        (await ctl_factory.connect(lp_pool_owner).allPools())[0].enabled
      ).to.be.equal(false);
    });
  });

  describe("Deposit funds", () => {
    it("Deposit disabled token: fail", async () => {
      await ctl_factory.connect(lp_pool_owner).disablePool(outside_token.address);
      try {
        await ctl_pool.connect(liquidity_provider).deposit(parseEther('100'));
      }
      catch (e) {
        await expect(e.message).to.include('Pool: Pool disabled')
      }
    });

    it("Deposit invalid amount of token: fail", async () => {
      try {
        await ctl_pool.connect(liquidity_provider).deposit(parseEther('0'));
      }
      catch (e) {
        await expect(e.message).to.include('Pool: Amount is invalid')
      }
    });

    it("Deposit not approved token: fail", async () => {
      //LP-pool settings
      try {
        await ctl_pool.connect(liquidity_provider).deposit(parseEther('100'));
      }
      catch (e) {
        await expect(e.message).to.include('BEP20: transfer amount exceeds allowance')
      }
    });

    it("True deposit: success", async () => {
      //Approve for transfer outside token to LP-pool
      await outside_token.connect(liquidity_provider).approve(ctl_pool.address, parseEther('1000'));

      //Outside token transfered to LP-pool address and add Staked
      await ctl_pool.connect(liquidity_provider).deposit(parseEther('1000'));

      common_data = await ctl_pool.getCommonData();
      user_data = await ctl_pool.getUserData(liquidity_provider.address);

      //Check staked
      await expect(
        user_data.totalStaked
      ).to.be.equal(parseEther('993'));

      await expect(
        common_data.totalStaked
      ).to.be.equal(parseEther('993'));

      //FIXME: EVM math?
      await expect(
        await ctl_pool.connect(liquidity_provider).availableReward(liquidity_provider.address)
      ).to.be.equal(parseEther("6.999999999999999654"));

      //check lp-token accrual
      await expect(
        await ctl_pool.balanceOf(liquidity_provider.address)
      ).to.be.equal(parseEther('993'));
    });
  });
  describe("Withdraw funds", () => {
    it("Withdraw disabled token: fail", async () => {
      await ctl_factory.connect(lp_pool_owner).disablePool(outside_token.address);
      try {
        await ctl_pool.connect(liquidity_provider).withdraw(parseEther('100'));
      }
      catch (e) {
        await expect(e.message).to.include('Pool: Pool disabled')
      }
    });

    it("Withdraw invalid amount (0) of token: fail", async () => {
      await outside_token.connect(liquidity_provider).approve(ctl_pool.address, parseEther('100'));
      await ctl_pool.connect(liquidity_provider).deposit(parseEther('100'));
      try {
        await ctl_pool.connect(liquidity_provider).withdraw(parseEther('0'));
      }
      catch (e) {
        await expect(e.message).to.include('Pool: Amount is invalid')
      }
    });

    it("Withdraw invalid amount (> deposited) of token: fail", async () => {
      await outside_token.connect(liquidity_provider).approve(ctl_pool.address, parseEther('1000'));
      await ctl_pool.connect(liquidity_provider).deposit(parseEther('1000'));

      //993 - Staked
      try {
        await ctl_pool.connect(liquidity_provider).withdraw(parseEther('994'));
      }
      catch (e) {
        await expect(e.message).to.include('Pool: Amount is invalid')
      }
    });

    it("True withdraw: success", async () => {
      //deposit token to  pool
      await outside_token.connect(liquidity_provider).approve(ctl_pool.address, parseEther('1000'));
      await ctl_pool.connect(liquidity_provider).deposit(parseEther('1000'));

      await ctl_pool.connect(liquidity_provider).withdraw(parseEther('100'));
      common_data = await ctl_pool.getCommonData();
      user_data = await ctl_pool.getUserData(liquidity_provider.address);
      //Check staked
      await expect(
        common_data.totalStaked
      ).to.be.equal(parseEther('893'));

      await expect(
        user_data.totalStaked
      ).to.be.equal(parseEther('893'));

      // FIXME:
      // 893*7/993 = 6,295065458207452165 (6,295065458207451854 in EVM?) ethers
      await expect(
        await ctl_pool.connect(liquidity_provider).availableReward(liquidity_provider.address)
      ).to.be.equal(parseEther("6.999999999999999654"));
    });
  });

  describe("Flash loan request", () => {
    it("Caller is not borrower: fail", async () => {
      try {
        await ctl_pool.connect(borrower).flashLoan(
          fl_receiver.address,
          parseEther("1000"),
          parseEther("12"),
          []
        )
      } catch (e) {
        await expect(e.message).to.include('Pool: Caller is not a borrower')
      }
    });

    it("Borrow disabled token: fail", async () => {
      // Grant role for borrower
      let borrower_role = await ctl_pool.BORROWER_ROLE();
      await ctl_pool.connect(lp_pool_owner).grantRole(borrower_role, borrower.address);

      //Disable token
      await ctl_factory.connect(lp_pool_owner).disablePool(outside_token.address);

      try {
        await ctl_pool.connect(borrower).flashLoan(
          fl_receiver.address,
          parseEther("1000"),
          parseEther("12"),
          []
        )
      } catch (e) {
        await expect(e.message).to.include('Pool: Pool disabled')
      }
    });

    it("Borrow invalid amount (0): fail", async () => {
      // Grant role for borrower
      let borrower_role = await ctl_pool.BORROWER_ROLE();
      await ctl_pool.connect(lp_pool_owner).grantRole(borrower_role, borrower.address);

      try {
        await ctl_pool.connect(borrower).flashLoan(
          fl_receiver.address,
          parseEther("0"),
          parseEther("12"),
          []
        )
      } catch (e) {
        await expect(e.message).to.include('Pool: Amount is invalid')
      }
    });

    it("Borrow invalid amount (> Staked): fail", async () => {
      //deposit token to  pool
      //993 - staked
      await outside_token.connect(liquidity_provider).approve(ctl_pool.address, parseEther('1000'));
      await ctl_pool.connect(liquidity_provider).deposit(parseEther('1000'));

      // Grant role for borrower
      let borrower_role = await ctl_pool.BORROWER_ROLE();
      await ctl_pool.connect(lp_pool_owner).grantRole(borrower_role, borrower.address);

      try {
        await ctl_pool.connect(borrower).flashLoan(
          fl_receiver.address,
          parseEther("994"),
          parseEther("12"),
          []
        )
      } catch (e) {
        await expect(e.message).to.include('Pool: Amount is invalid')
      }
    });

    it("Invalid profit amount (< premium_coeff): fail", async () => {
      //deposit token to  pool
      //993 - staked
      await outside_token.connect(liquidity_provider).approve(ctl_pool.address, parseEther('1000'));
      await ctl_pool.connect(liquidity_provider).deposit(parseEther('1000'));

      // Grant role for borrower
      let borrower_role = await ctl_pool.BORROWER_ROLE();
      await ctl_pool.connect(lp_pool_owner).grantRole(borrower_role, borrower.address);

      //0.012*993 = 11.916
      try {
        await ctl_pool.connect(borrower).flashLoan(
          fl_receiver.address,
          parseEther("993"),
          parseEther("11.915"),
          []
        )
      } catch (e) {
        await expect(e.message).to.include('Pool: Profit amount is invalid')
      }
    });


    it("Flash loan funds: success", async () => {
      //deposit token to  pool
      //1000.994 - staked
      await outside_token.connect(liquidity_provider).approve(ctl_pool.address, parseEther('1008'));
      await ctl_pool.connect(liquidity_provider).deposit(parseEther('1008'));
      // Grant role for borrower
      let borrower_role = await ctl_pool.BORROWER_ROLE();
      await ctl_pool.connect(lp_pool_owner).grantRole(borrower_role, borrower.address);

      // premium from flash loan receiver = 12
      await outside_token.connect(liquidity_provider).transfer(fl_receiver.address, parseEther('12'));

      await ctl_pool.connect(borrower).flashLoan(
        fl_receiver.address,
        parseEther("1000"),
        parseEther("12"),
        []
      );

      // Total profit = 0.007*1008 + 12 = 19.056
      common_data = await ctl_pool.getCommonData();
      await expect(
        common_data.totalProfit
      ).to.be.equal(parseEther("19.056"));
    });
  });

  describe("Claim reward", () => {

    it("Claim reward: success", async () => {
      //deposit token to  pool
      //staked = 993, profit = 7, tps_amount = 7/993
      await outside_token.connect(liquidity_provider).approve(ctl_pool.address, parseEther('1000'));
      await ctl_pool.connect(liquidity_provider).deposit(parseEther('1000'));

      common_data = await ctl_pool.getCommonData();
      user_data = await ctl_pool.getUserData(liquidity_provider.address);

      await expect(
        common_data.totalStaked
      ).to.be.equal(parseEther("993"));

      await expect(
        common_data.totalProfit
      ).to.be.equal(parseEther("7"));

      //FIXME: EVM math
      await expect(
        await ctl_pool.connect(liquidity_provider).availableReward(liquidity_provider.address)
      ).to.be.equal(parseEther("6.999999999999999654"));

      // Grant role for borrower
      let borrower_role = await ctl_pool.BORROWER_ROLE();
      await ctl_pool.connect(lp_pool_owner).grantRole(borrower_role, borrower.address);

      // flash loan premium = 6
      await outside_token.connect(liquidity_provider).transfer(fl_receiver.address, parseEther('6'));
      await ctl_pool.connect(borrower).flashLoan(
        fl_receiver.address,
        parseEther("500"),
        parseEther("6"),
        []
      );

      common_data = await ctl_pool.getCommonData();
      await expect(
        common_data.totalStaked
      ).to.be.equal(parseEther("993"));

      await expect(
        common_data.totalProfit
      ).to.be.equal(parseEther("13"));

      //FIXME: EVM math
      await expect(
        await ctl_pool.connect(liquidity_provider).availableReward(liquidity_provider.address)
      ).to.be.equal(parseEther("12.99999999999999879"));

      await ctl_factory.connect(liquidity_provider).claimAllRewards();

      await expect(
        await ctl_pool.connect(liquidity_provider).availableReward(liquidity_provider.address)
      ).to.be.equal(0);
    })
  });
});
const Web3 = require("web3");
const web3 = new Web3("");
const { expect } = require("chai");
const { ethers } = require("hardhat");
require("@nomiclabs/hardhat-waffle");
const { parseEther } = require("ethers/utils");
//ethers.provider.send("evm_setNextBlockTimestamp", [time + 10000]);
// evm_increaseTime
// evm_mine
// evm_revert
// evm_snapshot
// evm_setNextBlockTimestamp - this method works like evm_increaseTime, but takes the exact timestamp that you want in the next block, and increases the time accordingly.

const nullstr = "0x0000000000000000000000000000000000000000"
let liquidity_provider;
let lp_pool_owner;
let borrower;

ethers.getSigners().then(val => {
  [liquidity_provider, lp_pool_owner, borrower] = val;
});

describe("Liquidity pool contract", () => {
  let OutsideToken;
  let CTLToken;
  let LPPool;
  let LPToken;
  let FLReceiver;
  let ctl_token;
  let outside_token;
  let lp_pool;
  let fl_receiver;
  beforeEach(async () => {
    require('dotenv').config();
    OutsideToken = await ethers.getContractFactory("CTLToken", liquidity_provider);
    CTLToken = await ethers.getContractFactory("CTLToken", lp_pool_owner);
    LPPool = await ethers.getContractFactory("CitadelPool", lp_pool_owner);
    LPToken = await ethers.getContractFactory("LPToken"), lp_pool_owner;
    FLReceiver = await ethers.getContractFactory("FlashLoanReceiver", borrower);

    outside_token = await OutsideToken.deploy(
      "OUTSIDE",
      "OUT",
      18,
      parseEther(process.env.TOKEN_TOTAL_SUPPLY)
    );
    await outside_token.connect(liquidity_provider).mint(parseEther('1000000'));

    ctl_token = await CTLToken.deploy(
      process.env.TOKEN_NAME,
      process.env.TOKEN_SYMBOL,
      process.env.TOKEN_DECIMALS,
      parseEther(process.env.TOKEN_TOTAL_SUPPLY)
    );
    var start_time = new Date().getTime();

    lp_pool = await LPPool.deploy(ctl_token.address, start_time, parseEther('0.007'), parseEther('0.012'));
    await lp_pool.connect(lp_pool_owner).updatePool(outside_token.address, true);

    fl_receiver = await FLReceiver.deploy(lp_pool.address);
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
      expect(
        await lp_pool.connect(lp_pool_owner).apy_tax()
      ).to.equal(parseEther('0.007'));
      expect(
        await lp_pool.connect(lp_pool_owner).premium_coeff()
      ).to.equal(parseEther('0.012'));
      expect(
        await lp_pool.connect(lp_pool_owner).ctl_token()
      ).to.equal(ctl_token.address);
    });
  });

  describe("Settings", () => {

    it("Tokens whitelist may be set only admin", async () => {
      try {
        await lp_pool.connect(liquidity_provider.address).updatePool(outside_token.address, true);
      }
      catch (e) {
        await expect(e.message).to.include('Pool: Caller is not a admin')
      }
    });

    it("Add token to pool", async () => {
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
      var lp_token_address = await lp_pool.connect(lp_pool_owner).getLPToken(outside_token.address);
      await expect(lp_token_address).to.be.properAddress;
      await expect(
        await lp_pool.connect(lp_pool_owner).reversed_whitelist(lp_token_address)
      ).to.be.equal(outside_token.address);

      //Disable token
      await lp_pool.connect(lp_pool_owner).updatePool(outside_token.address, false);
      await expect(
        await lp_pool.connect(lp_pool_owner).isPoolEnabled(outside_token.address)
      ).to.be.equal(false);
    });
  });

  describe("Deposit funds", () => {
    it("Deposit invalid token: fail", async () => {
      try {
        await lp_pool.connect(liquidity_provider).deposit(nullstr, parseEther('100'));
      }
      catch (e) {
        await expect(e.message).to.include('Pool: Token is invalid')
      }
    });

    it("Deposit disabled token: fail", async () => {
      await lp_pool.connect(lp_pool_owner).updatePool(outside_token.address, false);
      try {
        await lp_pool.connect(liquidity_provider).deposit(outside_token.address, parseEther('100'));
      }
      catch (e) {
        await expect(e.message).to.include('Pool: Token is not enabled')
      }
    });

    it("Deposit invalid amount of token: fail", async () => {
      try {
        await lp_pool.connect(liquidity_provider).deposit(outside_token.address, parseEther('0'));
      }
      catch (e) {
        await expect(e.message).to.include('Pool: Amount is invalid')
      }
    });

    it("Deposit not approved token: fail", async () => {
      //LP-pool settings
      try {
        await lp_pool.connect(liquidity_provider).deposit(outside_token.address, parseEther('100'));
      }
      catch (e) {
        await expect(e.message).to.include('BEP20: transfer amount exceeds allowance')
      }
    });

    it("True deposit: success", async () => {
      //Approve for transfer outside token to LP-pool
      await outside_token.connect(liquidity_provider).approve(lp_pool.address, parseEther('1000'));

      //Outside token transfered to LP-pool address and add stacked
      await lp_pool.connect(liquidity_provider).deposit(outside_token.address, parseEther('1000'));

      //Check staked
      await expect(
        await lp_pool.connect(liquidity_provider).getAccountStacked(outside_token.address)
      ).to.be.equal(parseEther('993'));

      await expect(
        await lp_pool.connect(liquidity_provider).getTotalStacked(outside_token.address)
      ).to.be.equal(parseEther('993'));

      [sign, value] = await lp_pool.connect(liquidity_provider).getDailyStacked(outside_token.address);
      await expect(sign).to.be.equal(false);
      await expect(value).to.be.equal(parseEther('993'));


      [sign, value] = await lp_pool.connect(liquidity_provider).getMissedProfit(outside_token.address);
      await expect(sign).to.be.equal(false);
      await expect(value).to.be.equal(parseEther('0'));

      await expect(
        await lp_pool.connect(liquidity_provider).getAvailableReward(outside_token.address) / 1e18
      ).to.be.equal(7);

      //check lp-token accrual
      var lp_token_address = await lp_pool.connect(lp_pool_owner).getLPToken(outside_token.address);
      var lp_token = await LPToken.attach(lp_token_address)
      await expect(
        await lp_token.connect(liquidity_provider).balanceOf(liquidity_provider.address)
      ).to.be.equal(parseEther('993'));
    });
  });
  describe("Withdraw funds", () => {
    it("Withdraw invalid token: fail", async () => {
      try {
        await lp_pool.connect(liquidity_provider).withdraw(nullstr, parseEther('100'));
      }
      catch (e) {
        await expect(e.message).to.include('Pool: Token is invalid')
      }
    });

    it("Withdraw disabled token: fail", async () => {
      await lp_pool.connect(lp_pool_owner).updatePool(outside_token.address, false);
      try {
        await lp_pool.connect(liquidity_provider).withdraw(outside_token.address, parseEther('100'));
      }
      catch (e) {
        await expect(e.message).to.include('Pool: Token is not enabled')
      }
    });

    it("Withdraw invalid amount (0) of token: fail", async () => {
      await outside_token.connect(liquidity_provider).approve(lp_pool.address, parseEther('100'));
      await lp_pool.connect(liquidity_provider).deposit(outside_token.address, parseEther('100'));
      try {
        await lp_pool.connect(liquidity_provider).withdraw(outside_token.address, parseEther('0'));
      }
      catch (e) {
        await expect(e.message).to.include('Pool: Amount is invalid')
      }
    });

    it("Withdraw invalid amount (> deposited) of token: fail", async () => {
      await outside_token.connect(liquidity_provider).approve(lp_pool.address, parseEther('1000'));
      await lp_pool.connect(liquidity_provider).deposit(outside_token.address, parseEther('1000'));

      //993 - stacked
      try {
        await lp_pool.connect(liquidity_provider).withdraw(outside_token.address, parseEther('994'));
      }
      catch (e) {
        await expect(e.message).to.include('Pool: Amount is invalid')
      }
    });

    it("True withdraw: success", async () => {
      //deposit token to  pool
      await outside_token.connect(liquidity_provider).approve(lp_pool.address, parseEther('1000'));
      await lp_pool.connect(liquidity_provider).deposit(outside_token.address, parseEther('1000'));

      //approve lp_token to pool
      lp_token_address = await lp_pool.connect(liquidity_provider).getLPToken(outside_token.address);
      lp_token = await LPToken.attach(lp_token_address);
      await lp_token.connect(liquidity_provider).approve(lp_pool.address, parseEther('100'));

      await lp_pool.connect(liquidity_provider).withdraw(outside_token.address, parseEther('100'));
      //Check staked
      await expect(
        await lp_pool.connect(liquidity_provider).getTotalStacked(outside_token.address)
      ).to.be.equal(parseEther('893'));

      await expect(
        await lp_pool.connect(liquidity_provider).getAccountStacked(outside_token.address)
      ).to.be.equal(parseEther('893'));

      [sign, value] = await lp_pool.connect(liquidity_provider).getDailyStacked(outside_token.address);
      await expect(sign).to.be.equal(false);
      await expect(value).to.be.equal(parseEther('893'));

      //check missed profit
      [sign, value] = await lp_pool.connect(liquidity_provider).getMissedProfit(outside_token.address);
      await expect(sign).to.be.equal(false);
      await expect(value).to.be.equal(parseEther('0'));

      // FIXME:
      // 893*7/993 = 6,295065458207452165 (6,295065458207451854 in EVM?) ethers
      await expect(
        await lp_pool.connect(liquidity_provider).getAvailableReward(outside_token.address)
      ).to.be.equal("6295065458207451854");
    });
  });

  describe("Flash loan request", () => {
    it("Caller is not borrower: fail", async () => {
      try {
        await lp_pool.connect(borrower).flashLoan(
          fl_receiver.address,
          outside_token.address,
          parseEther("1000"),
          parseEther("12"),
          []
        )
      } catch (e) {
        await expect(e.message).to.include('Pool: Caller is not a borrower')
      }
    });

    it("Borrow invalid token: fail", async () => {
      // Grant role for borrower
      var borrower_role = await lp_pool.BORROWER_ROLE();
      await lp_pool.connect(lp_pool_owner).grantRole(borrower_role, borrower.address);
      try {
        await lp_pool.connect(borrower).flashLoan(
          fl_receiver.address,
          nullstr,
          parseEther("1000"),
          parseEther("12"),
          []
        )
      } catch (e) {
        await expect(e.message).to.include('Pool: Token is invalid')
      }
    });

    it("Borrow disabled token: fail", async () => {
      // Grant role for borrower
      var borrower_role = await lp_pool.BORROWER_ROLE();
      await lp_pool.connect(lp_pool_owner).grantRole(borrower_role, borrower.address);

      //Disable token
      await lp_pool.connect(lp_pool_owner).updatePool(outside_token.address, false);

      try {
        await lp_pool.connect(borrower).flashLoan(
          fl_receiver.address,
          outside_token.address,
          parseEther("1000"),
          parseEther("12"),
          []
        )
      } catch (e) {
        await expect(e.message).to.include('Pool: Token is not enabled')
      }
    });

    it("Borrow invalid amount (0): fail", async () => {
      // Grant role for borrower
      var borrower_role = await lp_pool.BORROWER_ROLE();
      await lp_pool.connect(lp_pool_owner).grantRole(borrower_role, borrower.address);

      try {
        await lp_pool.connect(borrower).flashLoan(
          fl_receiver.address,
          outside_token.address,
          parseEther("0"),
          parseEther("12"),
          []
        )
      } catch (e) {
        await expect(e.message).to.include('Pool: Amount is invalid')
      }
    });

    it("Borrow invalid amount (> stacked): fail", async () => {
      //deposit token to  pool
      //993 - staked
      await outside_token.connect(liquidity_provider).approve(lp_pool.address, parseEther('1000'));
      await lp_pool.connect(liquidity_provider).deposit(outside_token.address, parseEther('1000'));

      // Grant role for borrower
      var borrower_role = await lp_pool.BORROWER_ROLE();
      await lp_pool.connect(lp_pool_owner).grantRole(borrower_role, borrower.address);

      try {
        await lp_pool.connect(borrower).flashLoan(
          fl_receiver.address,
          outside_token.address,
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
      await outside_token.connect(liquidity_provider).approve(lp_pool.address, parseEther('1000'));
      await lp_pool.connect(liquidity_provider).deposit(outside_token.address, parseEther('1000'));

      // Grant role for borrower
      var borrower_role = await lp_pool.BORROWER_ROLE();
      await lp_pool.connect(lp_pool_owner).grantRole(borrower_role, borrower.address);

      //0.012*993 = 11.916
      try {
        await lp_pool.connect(borrower).flashLoan(
          fl_receiver.address,
          outside_token.address,
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
      await outside_token.connect(liquidity_provider).approve(lp_pool.address, parseEther('1008'));
      await lp_pool.connect(liquidity_provider).deposit(outside_token.address, parseEther('1008'));
      // Grant role for borrower
      var borrower_role = await lp_pool.BORROWER_ROLE();
      await lp_pool.connect(lp_pool_owner).grantRole(borrower_role, borrower.address);

      // premium from flash loan receiver = 12
      await outside_token.connect(liquidity_provider).transfer(fl_receiver.address, parseEther('12'));

      await lp_pool.connect(borrower).flashLoan(
        fl_receiver.address,
        outside_token.address,
        parseEther("1000"),
        parseEther("12"),
        []
      );

      // Total profit = 0.007*1008 + 12 = 19.056
      await expect(
        await lp_pool.connect(borrower).getTotalProfit(outside_token.address)
      ).to.be.equal(parseEther("19.056"));
    });
  });

  describe("Claim reward", () => {
    it("Claim disabled token: fail", async () => {
      await lp_pool.connect(lp_pool_owner).updatePool(outside_token.address, false);
      try {
        await lp_pool.connect(borrower).claimReward(outside_token.address, parseEther('100'));
      } catch (e) {
        await expect(e.message).to.include('Pool: Token is not enabled');
      };
    });

    it("Claim invalid amount token (0): fail", async () => {
      try {
        await lp_pool.connect(borrower).claimReward(outside_token.address, 0);
      } catch (e) {
        await expect(e.message).to.include("Pool: Amount should be less or equal then available reward");
      };
    });

    it("Claim invalid amount token (> available reward): fail", async () => {
      try {
        await lp_pool.connect(borrower).claimReward(outside_token.address, parseEther('100'));
      } catch (e) {
        await expect(e.message).to.include("Pool: Amount should be less or equal then available reward");
      };
    });

    it("Claim reward: success", async () => {
      //deposit token to  pool
      //staked = 993, profit = 7, tps_amount = 7/993
      await outside_token.connect(liquidity_provider).approve(lp_pool.address, parseEther('1000'));
      await lp_pool.connect(liquidity_provider).deposit(outside_token.address, parseEther('1000'));

      await expect(
        await lp_pool.connect(liquidity_provider).getTotalStacked(outside_token.address)
      ).to.be.equal(parseEther("993"));

      await expect(
        await lp_pool.connect(liquidity_provider).getTotalProfit(outside_token.address)
      ).to.be.equal(parseEther("7"));

      await expect(
        await lp_pool.connect(liquidity_provider).getAvailableReward(outside_token.address)/1e18
      ).to.be.equal(7);

      [sign, missed_profit] = await lp_pool.connect(liquidity_provider).getMissedProfit(outside_token.address);
      await expect(sign).to.be.equal(false);
      await expect(missed_profit).to.be.equal(0);

      // Grant role for borrower
      var borrower_role = await lp_pool.BORROWER_ROLE();
      await lp_pool.connect(lp_pool_owner).grantRole(borrower_role, borrower.address);

      // flash loan premium = 6
      await outside_token.connect(liquidity_provider).transfer(fl_receiver.address, parseEther('6'));
      await lp_pool.connect(borrower).flashLoan(
        fl_receiver.address,
        outside_token.address,
        parseEther("500"),
        parseEther("6"),
        []
      );

      await expect(
        await lp_pool.connect(liquidity_provider).getTotalStacked(outside_token.address)
      ).to.be.equal(parseEther("993"));

      await expect(
        await lp_pool.connect(liquidity_provider).getTotalProfit(outside_token.address)
      ).to.be.equal(parseEther("13"));

      await expect(
        await lp_pool.connect(liquidity_provider).getAvailableReward(outside_token.address)/1e18
      ).to.be.equal(13);

      [sign, missed_profit] = await lp_pool.connect(liquidity_provider).getMissedProfit(outside_token.address);
      await expect(sign).to.be.equal(false);
      await expect(missed_profit).to.be.equal(0);
    })
  });
});

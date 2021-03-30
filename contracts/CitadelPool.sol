// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./interfaces/IBEP20.sol";
import "./interfaces/ILPToken.sol";
import "./interfaces/ICitadelPool.sol";
import "./interfaces/IFlashLoanReceiver.sol";
import "./LPToken.sol";

contract CitadelPool is ICitadelPool, AccessControl {
    using SafeMath for uint256;

    struct LiquidityPool {
        uint256 receipt_profit; //Profit per day
        uint256 total_profit; //Total profit
        uint256 tps_amount; //Tokens per staked amount
        uint256 prev_tps_amount; //Tokens per staked amount for previously day
        uint256 total_stacked; //Balance of tokens
        uint256 daily_stacked; //Balance of tokens for current day
        bool sign_daily_stacked;
    }

    struct Stake {
        uint256 total_stacked;
        uint256 missed_profit;
        uint256 claimed_reward;
        uint256 available_reward;
        bool sign_missed_profit; // 0 - positive, 1 - negative
    }

    struct TokenDetail {
        ILPToken addr;
        bool enabled;
        uint256 cur_day; //Current day from start time
    }

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN");
    bytes32 public constant BORROWER_ROLE = keccak256("BORROWER");

    uint256 public start_time; //Deploy timestamp
    uint256 ape_tax;
    mapping(IBEP20 => TokenDetail) token_whitelist; //Enabled tokens
    mapping(ILPToken => IBEP20) reversed_whitelist;
    mapping(IBEP20 => LiquidityPool) liquidity_pool;
    mapping(IBEP20 => mapping(address => Stake)) user_stacked; //Balance per accounts

    event Deposited(
        address indexed depositor,
        IBEP20 indexed token,
        uint256 amount
    );
    event Withdrew(
        address indexed reciever,
        IBEP20 indexed token,
        uint256 amount
    );
    event FlashLoan(
        address indexed receiver,
        IBEP20 indexed token,
        uint256 amount,
        uint256 premium
    );
    event Rewarded(
        address indexed _borrower,
        IBEP20 indexed token,
        uint256 amount
    );

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(ADMIN_ROLE, _msgSender());
        _setRoleAdmin(ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
        start_time = block.timestamp;
    }

    function tokenWhitelist(IBEP20 token)
        public
        view
        override
        returns (ILPToken)
    {
        if (token_whitelist[token].enabled) {
            return token_whitelist[token].addr;
        }
        return ILPToken(0);
    }

    function reversedWhitelist(ILPToken token)
        public
        view
        override
        returns (IBEP20)
    {
        return reversed_whitelist[token];
    }

    function totalStacked(IBEP20 token) public view override returns (uint256) {
        return liquidity_pool[token].total_stacked;
    }

    function accountStacked(IBEP20 token)
        public
        view
        override
        returns (uint256)
    {
        return user_stacked[token][_msgSender()].total_stacked;
    }

    function missedProfit(IBEP20 token) public view override returns (uint256) {
        return user_stacked[token][_msgSender()].missed_profit;
    }

    function availableReward(IBEP20 token)
        public
        view
        override
        returns (uint256)
    {
        return user_stacked[token][_msgSender()].available_reward;
    }

    function updateWhitelist(IBEP20 token, bool enabled) public override {
        require(
            hasRole(ADMIN_ROLE, _msgSender()),
            "Pool: Caller is not a admin"
        );
        //deploy new LP-token
        if (token_whitelist[token].addr == ILPToken(0)) {
            bytes32 salt = keccak256(abi.encodePacked(token));
            string memory name = string(abi.encodePacked("ctl", token.name()));
            string memory symbol =
                string(abi.encodePacked("ctl", token.symbol()));
            address lp_token =
                address(
                    new LPToken{salt: salt}(name, symbol, 18, address(this))
                );
            token_whitelist[token].addr = ILPToken(lp_token);
            reversed_whitelist[ILPToken(lp_token)] = token;
        }
        token_whitelist[token].enabled = enabled;
    }

    function updateApeTax(uint256 ape_tax_) public override {
        require(
            hasRole(ADMIN_ROLE, _msgSender()),
            "Pool: Caller is not a admin"
        );
        ape_tax = ape_tax_;
    }

    function deposit(IBEP20 token, uint256 amount) public override {
        require(token != IBEP20(0), "Pool: Token is invalid");
        require(token_whitelist[token].enabled, "Pool: Token is not enabled");
        require(amount > 0, "Pool: Amount is invalid");

        token.transferFrom(_msgSender(), address(this), amount);

        LiquidityPool storage pool = liquidity_pool[token];
        Stake storage account = user_stacked[token][_msgSender()];

        pool.total_stacked = pool.total_stacked.add(amount);
        account.total_stacked = account.total_stacked.add(amount);
        add_missed_profit(account, amount.mul(pool.prev_tps_amount).div(1e18));
        calc_available_reward(account, pool.tps_amount);

        //Mint missed amount of lp-tokens
        ILPToken lp_token = token_whitelist[token].addr;
        uint256 lp_balance = lp_token.balanceOf(address(this));
        if (lp_balance < amount) {
            lp_token.mint(amount.sub(lp_balance));
        }
        lp_token.transfer(_msgSender(), amount);
        emit Deposited(_msgSender(), token, amount);
    }

    function withdraw(IBEP20 token, uint256 amount) public override {
        require(token != IBEP20(0), "Pool: Token is invalid");
        ILPToken lp_token = token_whitelist[token].addr;
        require(lp_token != ILPToken(0), "Pool: Token is not enabled"); //Token not added
        Stake storage account = user_stacked[token][_msgSender()];
        require(
            account.total_stacked >= amount && amount > 0,
            "Pool: Amount is invalid"
        );
        require(
            lp_token.transferFrom(_msgSender(), address(this), amount),
            "Pool: Unable to transfer specified amount of LP tokens"
        );
        require(
            token.transfer(_msgSender(), amount),
            "Pool: Unable to transfer specified amount of staking tokens"
        );

        LiquidityPool storage pool = liquidity_pool[token];

        pool.total_stacked = pool.total_stacked.sub(amount);
        account.total_stacked = account.total_stacked.sub(amount);
        sub_missed_profit(account, amount.mul(pool.prev_tps_amount).div(1e18));
        calc_available_reward(account, pool.tps_amount);
        emit Withdrew(_msgSender(), token, amount);
    }

    function claimReward(IBEP20 token, uint256 amount) public override {
        require(token_whitelist[token].enabled, "Pool: Token is not enabled");
        Stake storage account = user_stacked[token][_msgSender()];
        require(
            amount <= account.available_reward,
            "Pool: Amount should be less then available reward"
        );
        account.claimed_reward = account.claimed_reward.add(amount);
        calc_available_reward(account, liquidity_pool[token].tps_amount);
        emit Rewarded(_msgSender(), token, amount);
    }

    // This function called from LP-token contract
    function transferLPtoken(
        address sender,
        address recipient,
        uint256 amount
    ) public override {
        IBEP20 token = reversed_whitelist[ILPToken(_msgSender())];
        require(
            token != IBEP20(0) && token_whitelist[token].enabled,
            "Pool: FORBIDDEN"
        );

        Stake storage account_s = user_stacked[token][sender];
        uint256 percent = amount.mul(1e18).div(account_s.total_stacked);
        uint256 available_reward =
            account_s.available_reward.mul(percent).div(1e18);
        uint256 claimed_reward =
            account_s.claimed_reward.mul(percent).div(1e18);
        uint256 missed_profit = account_s.missed_profit.mul(percent).div(1e18);
        account_s.total_stacked = account_s.total_stacked.sub(amount);
        account_s.available_reward = account_s.available_reward.sub(
            available_reward
        );
        account_s.claimed_reward = account_s.claimed_reward.sub(claimed_reward);
        //FIXME: sign
        account_s.missed_profit = account_s.missed_profit.sub(missed_profit);

        Stake storage account_r = user_stacked[token][recipient];
        account_r.total_stacked = account_r.total_stacked.add(amount);
        account_r.available_reward = account_r.available_reward.add(
            available_reward
        );
        account_r.claimed_reward = account_r.claimed_reward.add(claimed_reward);
        //FIXME: sign
        account_r.missed_profit = account_r.missed_profit.add(missed_profit);
    }

    function flashLoan(
        address receiver,
        IBEP20 token,
        uint256 amount,
        bytes calldata params
    ) public override {
        require(hasRole(BORROWER_ROLE, _msgSender()), "Pool: Caller is not a borrower");
        require(token != IBEP20(0), "Pool: Token is invalid");
        require(token_whitelist[token].enabled, "Pool: Token is not enabled");
        require(
            amount > 0 && amount <= liquidity_pool[token].total_stacked,
            "Pool: Amount is invalid"
        );

        token.transfer(receiver, amount);
        //FIXME: add percent of profit and ape_tax
        uint256 profit_percent = 700;
        uint256 premium = (amount * profit_percent) / 100000;
        IFlashLoanReceiver(receiver).executeOperation(
            token,
            amount,
            premium,
            _msgSender(),
            params
        );
        token.transferFrom(receiver, address(this), amount.add(premium));
        emit FlashLoan(receiver, token, amount, premium);
    }

    function add_profit(IBEP20 token, uint256 amount) internal {
        check_current_day_and_update_pool(token);
        LiquidityPool storage pool = liquidity_pool[token];
        pool.receipt_profit = pool.receipt_profit.add(amount);
        pool.total_profit = pool.total_profit.add(amount);
        pool.tps_amount = pool.tps_amount.add(
            pool.receipt_profit.mul(1e18).div(pool.total_stacked)
        );
    }

    //Receipt profit set in zero and save tps_amount for previous day one times per day
    function check_current_day_and_update_pool(IBEP20 token) internal {
        uint256 day = (block.timestamp.sub(start_time)).div(86400);
        if (token_whitelist[token].cur_day != day) {
            token_whitelist[token].cur_day = day;
            LiquidityPool storage pool = liquidity_pool[token];
            pool.receipt_profit = 0;
            pool.daily_stacked = 0;
            pool.sign_daily_stacked = false;
            pool.prev_tps_amount = pool.tps_amount;
        }
    }

    function sub_missed_profit(Stake storage st, uint256 amount) internal {
        //missed_profit is positive
        if (!st.sign_missed_profit) {
            if (st.missed_profit >= amount) {
                st.missed_profit = st.missed_profit.sub(amount);
            } else {
                st.missed_profit = amount.sub(st.missed_profit);
                st.sign_missed_profit = true;
            }
        } else {
            st.missed_profit = st.missed_profit.add(amount);
        }
    }

    function add_missed_profit(Stake storage st, uint256 amount) internal {
        //missed_profit is negative
        if (st.sign_missed_profit) {
            if (st.missed_profit > amount) {
                st.missed_profit = st.missed_profit.sub(amount);
            } else {
                st.missed_profit = amount.sub(st.missed_profit);
                st.sign_missed_profit = false;
            }
        } else {
            st.missed_profit = st.missed_profit.add(amount);
        }
    }

    function calc_available_reward(Stake storage st, uint256 _tps_amount)
        internal
    {
        st.available_reward = st.total_stacked.mul(_tps_amount).div(1e18).sub(
            st.claimed_reward
        );
        if (!st.sign_missed_profit) {
            st.available_reward = st.available_reward.sub(st.missed_profit);
        } else {
            st.available_reward = st.available_reward.add(st.missed_profit);
        }
    }
}

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

    /**
     * @dev State of liquidity pool
     * @param cur_day Current day from start time
     * @param receipt_profit Profit for current day, is reset to zero every day
     * @param total_profit Total profit
     * @param tps_amount Tokens per staked amount
     * @param prev_tps_amount Tokens per staked amount for previously day
     * @param total_stacked Balance of tokens
     * @param daily_stacked Balance of tokens for current day, is reset to zero every day
     * @param sign_daily_stacked Sign of daily stacked tokens, false - positive, true - negative
     * @param lp_token lp-token address
     * @param enabled true - enable pool, false - disable pool
     */
    struct LiquidityPool {
        uint256 cur_day;
        uint256 receipt_profit;
        uint256 total_profit;
        uint256 tps_amount;
        uint256 prev_tps_amount;
        uint256 total_stacked;
        uint256 daily_stacked;
        ILPToken lp_token;
        bool sign_daily_stacked;
        bool enabled;
    }

    /**
     * @dev State of users stake
     * @param total_stacked Total staked added when funds are deposited, subtracted upon withdrawal
     * @param missed_profit Missed profit increased on deposit_amount*prev_tps_amount when funds are deposited, and decreased when funds are withdrawal
     * @param sign_missed_profit Sign of missed profit amount 0 - positive, 1 - negative
     * @param claimed_reward Total amount of claimed rewards
     * @param available_reward Amount of available rewards
     */
    struct Stake {
        uint256 total_stacked;
        uint256 missed_profit;
        uint256 claimed_reward;
        uint256 available_reward;
        bool sign_missed_profit;
    }

    /// @dev All borrowed and returned funds
    struct AllLoans {
        uint256 borrowed;
        uint256 returned;
    }

    /// @dev Users borrowed and returned funds and added profit
    struct Loan {
        uint256 borrowed;
        uint256 returned;
        uint256 profit;
        bool lock;
    }

    /// @dev roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN");
    bytes32 public constant BORROWER_ROLE = keccak256("BORROWER");

    /// @dev timestamp of pool starting
    uint256 public start_time;

    /// @dev APY tax value multiplied to 1e18
    uint256 public apy_tax;

    /// @dev Minimum premium coefficient of borrowed amount multiplied to 1e18
    uint256 public premium_coeff;

    /// @dev CTL token address
    IBEP20 public ctl_token;

    /// @dev Outside token addresses mapping to liquidity pool state
    mapping(IBEP20 => LiquidityPool) liquidity_pool;

    /// @dev LP-token addresses mapping to outside token addresses
    mapping(ILPToken => IBEP20) public reversed_whitelist;

    /// @dev Stake of users for each token
    mapping(IBEP20 => mapping(address => Stake)) user_stacked;

    //Loans
    mapping(IBEP20 => AllLoans) loans;
    mapping(IBEP20 => mapping(address => Loan)) borrowers_loans;

    /// @dev Event emitted when the depositor sends funds
    event Deposited(
        address indexed depositor,
        IBEP20 indexed token,
        uint256 amount
    );

    /// @dev Event emitted when the depositor received funds
    event Withdrew(
        address indexed receiver,
        IBEP20 indexed token,
        uint256 amount
    );

    /// @dev Event emitted when the borrower has borrowed and repaid funds
    event FlashLoan(
        address indexed receiver,
        IBEP20 indexed token,
        uint256 amount,
        uint256 premium
    );

    /// @dev Event emitted when the depositor claimed rewards
    event Rewarded(
        address indexed _borrower,
        IBEP20 indexed token,
        uint256 amount
    );

    /**
     * @param start_time_ Timestamp of start contract
     * @param apy_tax_ APY tax value
     */
    constructor(
        IBEP20 token,
        uint256 start_time_,
        uint256 apy_tax_,
        uint256 premium_coeff_
    ) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(ADMIN_ROLE, _msgSender());
        _setRoleAdmin(ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
        ctl_token = token;
        start_time = start_time_;
        apy_tax = apy_tax_;
        premium_coeff = premium_coeff_;
    }

    /**
     * @notice Return true if outside BEP20 token is allowed for pool
     * @param token Address of BEP20 token
     */
    function isPoolEnabled(IBEP20 token) public view override returns (bool) {
        return liquidity_pool[token].enabled;
    }

    function getLPToken(IBEP20 token) public view override returns (ILPToken) {
        return liquidity_pool[token].lp_token;
    }

    /**
     * @notice Total staked liquidity
     * @param token Address of BEP20 token
     */
    function getTotalStacked(IBEP20 token)
        public
        view
        override
        returns (uint256)
    {
        return liquidity_pool[token].total_stacked;
    }

    /**
     * @notice Daily staked liquidity
     * @param token Address of BEP20 token
     */
    function getDailyStacked(IBEP20 token)
        public
        view
        override
        returns (bool, uint256)
    {
        return (
            liquidity_pool[token].sign_daily_stacked,
            liquidity_pool[token].daily_stacked
        );
    }

    /**
     * @notice Total profit
     * @param token Address of BEP20 token
     */
    function getTotalProfit(IBEP20 token)
        public
        view
        override
        returns (uint256)
    {
        return liquidity_pool[token].total_profit;
    }

    /**
     * @notice Get liquidity amount staked from account
     * @param token Address of BEP20 token
     */
    function getAccountStacked(IBEP20 token)
        public
        view
        override
        returns (uint256)
    {
        return user_stacked[token][_msgSender()].total_stacked;
    }

    /**
     * @notice Get accounts missed profit
     * @param token Address of BEP20 token
     */
    function getMissedProfit(IBEP20 token)
        public
        view
        override
        returns (bool, uint256)
    {
        return (
            user_stacked[token][_msgSender()].sign_missed_profit,
            user_stacked[token][_msgSender()].missed_profit
        );
    }

    /**
     * @notice Get accounts available rewards
     * @param token Address of BEP20 token
     */
    function getAvailableReward(IBEP20 token)
        public
        view
        override
        returns (uint256)
    {
        return user_stacked[token][_msgSender()].available_reward;
    }

    /**
     * @notice Get accounts available rewards
     * @param token Address of BEP20 token
     */
    function getClaimedReward(IBEP20 token)
        public
        view
        override
        returns (uint256)
    {
        return user_stacked[token][_msgSender()].claimed_reward;
    }

    /**
     * @notice Add token to pool and enable or disable his
     * @param token Address of outside BEP20 token
     * @param enabled true - enabled token, false - disabled
     */
    function updatePool(IBEP20 token, bool enabled) public override {
        require(
            hasRole(ADMIN_ROLE, _msgSender()),
            "Pool: Caller is not a admin"
        );
        //deploy new LP-token
        LiquidityPool storage pool = liquidity_pool[token];
        if (pool.lp_token == ILPToken(0)) {
            bytes32 salt = keccak256(abi.encodePacked(token));
            string memory name = string(abi.encodePacked("ct", token.name()));
            string memory symbol =
                string(abi.encodePacked("ct", token.symbol()));
            address lp_token =
                address(
                    new LPToken{salt: salt}(name, symbol, 18, address(this))
                );
            pool.lp_token = ILPToken(lp_token);
            reversed_whitelist[ILPToken(lp_token)] = token;
        }
        pool.enabled = enabled;
    }

    /**
     * @notice Update APY tax value
     * @param apy_tax_ new APY tax value (multiplied to 1e18)
     */
    function updateApyTax(uint256 apy_tax_) public override {
        require(
            hasRole(ADMIN_ROLE, _msgSender()),
            "Pool: Caller is not a admin"
        );
        apy_tax = apy_tax_;
    }

    /**
     * @notice Update premium coefficient
     * @param premium_coeff_ new premium coefficient value (multiplied to 1e18)
     */
    function updatePremiumCoeff(uint256 premium_coeff_) public override {
        require(
            hasRole(ADMIN_ROLE, _msgSender()),
            "Pool: Caller is not a admin"
        );
        premium_coeff = premium_coeff_;
    }

    /**
     * @notice set address of CTL token contract
     * @param token CTL token address
     */
    function updateCTLTokenAddress(IBEP20 token) public override {
        require(
            hasRole(ADMIN_ROLE, _msgSender()),
            "Pool: Caller is not a admin"
        );
        ctl_token = token;
    }

    /**
     * @notice Stake liquidity to pool
     * @param token Address of BEP20 token
     * @param amount Funds amount
     */
    function deposit(IBEP20 token, uint256 amount) public override {
        require(token != IBEP20(0), "Pool: Token is invalid");
        LiquidityPool storage pool = liquidity_pool[token];
        require(pool.enabled, "Pool: Token is not enabled");
        require(amount > 0, "Pool: Amount is invalid");
        //receive outside tokens
        token.transferFrom(_msgSender(), address(this), amount);

        Stake storage account = user_stacked[token][_msgSender()];

        uint256 premium = (amount.mul(apy_tax)).div(1e18);
        uint256 stacked_amount = amount.sub(premium);
        pool.total_stacked = pool.total_stacked.add(stacked_amount);
        account.total_stacked = account.total_stacked.add(stacked_amount);
        add_daily_stacked(pool, stacked_amount);

        add_missed_profit(
            account,
            stacked_amount.mul(pool.prev_tps_amount).div(1e18)
        );
        calc_available_reward(account, pool.tps_amount);
        add_profit(pool, premium);

        //Mint missed amount of LP-tokens
        uint256 lp_balance = pool.lp_token.balanceOf(address(this));
        if (lp_balance < stacked_amount) {
            pool.lp_token.mint(stacked_amount.sub(lp_balance));
        }
        //send LP-tokens
        pool.lp_token.transfer(_msgSender(), stacked_amount);
        emit Deposited(_msgSender(), token, stacked_amount);
    }

    /**
     * @notice Withdraw funds from pool
     * @param token Address of BEP20 token
     * @param amount Funds amount
     */
    function withdraw(IBEP20 token, uint256 amount) public override {
        require(token != IBEP20(0), "Pool: Token is invalid");
        LiquidityPool storage pool = liquidity_pool[token];

        require(pool.enabled, "Pool: Token is not enabled"); //Token not added
        Stake storage account = user_stacked[token][_msgSender()];
        require(
            account.total_stacked >= amount && amount > 0,
            "Pool: Amount is invalid"
        );
        pool.total_stacked = pool.total_stacked.sub(amount);
        account.total_stacked = account.total_stacked.sub(amount);
        sub_daily_stacked(pool, amount);
        sub_missed_profit(account, amount.mul(pool.prev_tps_amount).div(1e18));
        calc_available_reward(account, pool.tps_amount);
        //receive lp-tokens
        pool.lp_token.transferFrom(_msgSender(), address(this), amount);
        //send outside tokens
        token.transfer(_msgSender(), amount);
        emit Withdrew(_msgSender(), token, amount);
    }

    /**
     * @notice Withdraw rewards from pool in CTL tokens
     * @param token Address of BEP20 token
     * @param amount Rewards amount
     */
    function claimReward(IBEP20 token, uint256 amount) public override {
        LiquidityPool storage pool = liquidity_pool[token];
        require(pool.enabled, "Pool: Token is not enabled");
        Stake storage account = user_stacked[token][_msgSender()];
        require(
            amount <= account.available_reward,
            "Pool: Amount should be less then available reward"
        );
        account.claimed_reward = account.claimed_reward.add(amount);
        calc_available_reward(account, pool.tps_amount);

        //FIXME: calc amount of CTL tokens transferred to liquidity provider
        // reward_amount * coinprice
        uint256 ctl_amount = 0;
        ctl_token.transfer(_msgSender(), ctl_amount);
        emit Rewarded(_msgSender(), token, amount);
    }

    /**
     * @notice Recalc pool state when LP-tokens transferred, this function called from LP-token contract
     * @param sender Senders address of LP-tokens
     * @param recipient Recipient address
     * @param amount Funds amount
     */
    function transferLPtoken(
        address sender,
        address recipient,
        uint256 amount
    ) public override {
        //_msgSender - is LP-token address
        IBEP20 token = reversed_whitelist[ILPToken(_msgSender())];
        require(
            token != IBEP20(0) && liquidity_pool[token].enabled,
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
        account_s.missed_profit = account_s.missed_profit.sub(missed_profit);

        Stake storage account_r = user_stacked[token][recipient];
        account_r.total_stacked = account_r.total_stacked.add(amount);
        account_r.available_reward = account_r.available_reward.add(
            available_reward
        );
        account_r.claimed_reward = account_r.claimed_reward.add(claimed_reward);
        //FIXME: test it!
        if (account_s.sign_missed_profit) {
            sub_missed_profit(account_r, missed_profit);
        } else {
            add_missed_profit(account_r, missed_profit);
        }
    }

    /**
     * @notice Borrowers flash loan request
     * @param receiver Address of flash loan receiver contract
     * @param token Address of requested BEP20 token
     * @param amount Funds amount
     * @param params Parameters for flash loan receiver contract
     */
    function flashLoan(
        address receiver,
        IBEP20 token,
        uint256 amount,
        uint256 premium,
        bytes calldata params
    ) public override {
        require(
            hasRole(BORROWER_ROLE, _msgSender()),
            "Pool: Caller is not a borrower"
        );
        require(token != IBEP20(0), "Pool: Token is invalid");
        LiquidityPool storage pool = liquidity_pool[token];
        require(pool.enabled, "Pool: Token is not enabled");
        Loan storage borrower_loaned = borrowers_loans[token][_msgSender()];
        require(
            amount > 0 && amount <= pool.total_stacked && !borrower_loaned.lock,
            "Pool: Amount is invalid"
        );
        require(
            (premium * 1e18) / amount >= premium_coeff,
            "Pool: Profit amount is invalid"
        );
        borrower_loaned.lock = true;
        loans[token].borrowed = loans[token].borrowed.add(amount);
        borrower_loaned.borrowed = borrower_loaned.borrowed.add(amount);
        token.transfer(receiver, amount);

        IFlashLoanReceiver(receiver).executeOperation(
            token,
            amount,
            premium,
            _msgSender(),
            params
        );

        token.transferFrom(receiver, address(this), amount.add(premium));
        add_profit(pool, premium);
        loans[token].returned = loans[token].returned.add(amount);
        borrower_loaned.returned = borrower_loaned.returned.add(amount);
        borrower_loaned.profit = borrower_loaned.profit.add(premium);
        borrower_loaned.lock = false;
        emit FlashLoan(receiver, token, amount, premium);
    }

    /**
     * @notice Receipt profit set in zero and save tps_amount for previous day one times per day
     * @param pool liquidity pool storage reference
     */
    function check_current_day_and_update_pool(LiquidityPool storage pool)
        internal
    {
        uint256 day = 0;
        if (block.timestamp > start_time) {
            day = (block.timestamp.sub(start_time)).div(86400);
        }
        if (pool.cur_day != day) {
            pool.cur_day = day;
            pool.receipt_profit = 0;
            pool.daily_stacked = 0;
            pool.sign_daily_stacked = false;
            pool.prev_tps_amount = pool.tps_amount;
        }
    }

    /**
     * @notice Function called when borrowers returned premium to liquidity pool
     * @param pool liquidity pool storage reference
     * @param premium premium amount
     */
    function add_profit(LiquidityPool storage pool, uint256 premium) internal {
        check_current_day_and_update_pool(pool);
        pool.receipt_profit = pool.receipt_profit.add(premium);
        pool.total_profit = pool.total_profit.add(premium);
        pool.tps_amount = pool.tps_amount.add(
            pool.receipt_profit.mul(1e18).div(pool.total_stacked)
        );
    }

    /**
     * @notice Recalc missed profit when user deposited or transfered funds
     * @param account Users stake storage reference
     * @param amount Profit amount
     */
    function add_missed_profit(Stake storage account, uint256 amount) internal {
        //missed_profit is negative
        if (account.sign_missed_profit) {
            if (account.missed_profit > amount) {
                account.missed_profit = account.missed_profit.sub(amount);
            } else {
                account.missed_profit = amount.sub(account.missed_profit);
                account.sign_missed_profit = false;
            }
        } else {
            account.missed_profit = account.missed_profit.add(amount);
        }
    }

    /**
     * @notice Recalc missed profit when user withdrawal or transfered funds
     * @param account Users stake storage reference
     * @param amount Profit amount
     */
    function sub_missed_profit(Stake storage account, uint256 amount) internal {
        //missed_profit is positive
        if (!account.sign_missed_profit) {
            if (account.missed_profit >= amount) {
                account.missed_profit = account.missed_profit.sub(amount);
            } else {
                account.missed_profit = amount.sub(account.missed_profit);
                account.sign_missed_profit = true;
            }
        } else {
            account.missed_profit = account.missed_profit.add(amount);
        }
    }

    /**
     * @notice Recalc available rewards when users deposited or withdrawal funds or claimed rewards
     * @param account Users stake storage reference
     * @param tps_amount Current total per staked amount
     */
    function calc_available_reward(Stake storage account, uint256 tps_amount)
        internal
    {
        account.available_reward = account
            .total_stacked
            .mul(tps_amount)
            .div(1e18)
            .sub(account.claimed_reward);
        if (!account.sign_missed_profit) {
            account.available_reward = account.available_reward.sub(
                account.missed_profit
            );
        } else {
            account.available_reward = account.available_reward.add(
                account.missed_profit
            );
        }
    }

    /**
     * @notice Add deposit amount to liquidity pools daily staked
     * @param pool Liquidity pool storage reference
     * @param amount Deposit amount
     */
    function add_daily_stacked(LiquidityPool storage pool, uint256 amount)
        internal
    {
        //daily_stacked is negative
        if (pool.sign_daily_stacked) {
            if (pool.daily_stacked > amount) {
                pool.daily_stacked = pool.daily_stacked.sub(amount);
            } else {
                pool.daily_stacked = amount.sub(pool.daily_stacked);
                pool.sign_daily_stacked = false;
            }
        } else {
            pool.daily_stacked = pool.daily_stacked.add(amount);
        }
    }

    /**
     * @notice Subtract withdraw amount from liquidity pools daily staked
     * @param pool Liquidity pool storage reference
     * @param amount Withdraw amount
     */
    function sub_daily_stacked(LiquidityPool storage pool, uint256 amount)
        internal
    {
        //daily_stacked is positive
        if (!pool.sign_daily_stacked) {
            if (pool.daily_stacked >= amount) {
                pool.daily_stacked = pool.daily_stacked.sub(amount);
            } else {
                pool.daily_stacked = amount.sub(pool.daily_stacked);
                pool.sign_daily_stacked = true;
            }
        } else {
            pool.daily_stacked = pool.daily_stacked.add(amount);
        }
    }
}

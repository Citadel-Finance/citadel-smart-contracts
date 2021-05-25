// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./CTLToken.sol";
import "./interfaces/IBEP20.sol";
import "./interfaces/ICitadelPool.sol";
import "./interfaces/ILPToken.sol";
import "./interfaces/IFlashLoanReceiver.sol";

contract CitadelPool is ILPToken, ICitadelPool, AccessControl {
    using SafeMath for uint256;

    /**
     * @dev State of users stake
     * @param totalStaked Total staked added when funds are deposited, subtracted upon withdrawal
     * @param missedProfit Missed profit increased on deposit_amount*prevTps when funds are deposited, and decreased when funds are withdrawal
     * @param signMissedProfit Sign of missed profit amount 0 - positive, 1 - negative
     * @param claimedReward Total amount of claimed rewards
     */
    struct Stake {
        uint256 totalStaked;
        uint256 missedProfit;
        uint256 claimedReward;
        uint256 missedCtl;
        uint256 claimedCtl;
        bool signMissedProfit;
        bool signMissedCtl;
    }

    /**
     * @dev Loaned and returned funds and added profit
     */
    struct Loan {
        uint256 borrowed;
        uint256 returned;
        uint256 profit;
        bool lock;
    }

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;
    uint256 private _decimals;
    string private _symbol;
    string private _name;
    address private _owner;

    bytes32 public constant BORROWER_ROLE = keccak256("BORROWER");

    /**
     * @dev State of liquidity pool
     */

    /// @dev Current day from start time
    uint256 public curDay;

    /// @dev Pools start time
    uint256 public startTime;

    /// @dev APY tax percent
    uint256 public apyTax;

    /// @dev Profit for current day, is reset to zero every day
    uint256 public receiptProfit;

    /// @dev Total given premium
    uint256 public totalProfit;

    /// @dev Tokens per staked amount
    /// @dev prevTps Tokens per staked amount for previously day
    uint256 public tps;
    uint256 public prevTps;

    /// @dev Balance of tokens
    uint256 public totalStaked;

    /// @dev Balance of tokens for current day, it reset to zero every day
    /// @dev Sign of daily staked tokens, false - positive, true - negative
    uint256 private _dailyStacked;
    bool private _signDailyStacked;

    /// @dev Borrowed and returned funds amount
    uint256 public borrowed;
    uint256 public returned;

    /// @dev Minimal premium percent for borrowers
    uint256 public premiumCoeff;

    /// @dev true - enabled pool, false - disabled pool
    bool public enabled;

    /// @dev Outside token address
    IBEP20 public token;

    /// @dev CTL-token settings
    /// @dev CTL-tokens per staked
    CTLToken public ctlToken;
    uint256 public prevMintingBlock;
    uint256 public tokensPerBlock;
    uint256 public ctlTps;

    mapping(address => Stake) public userStaked;

    mapping(address => Loan) public userLoaned;

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 decimals_,
        IBEP20 token_,
        CTLToken ctlToken_,
        uint256 startTime_,
        uint256 apyTax_,
        uint256 premiumCoeff_,
        uint256 tokensPerBlock_,
        address admin
    ) {
        _name = name_;
        _symbol = symbol_;
        _decimals = decimals_;
        _totalSupply = 0;
        token = token_;
        ctlToken = ctlToken_;
        startTime = startTime_;
        apyTax = apyTax_;
        premiumCoeff = premiumCoeff_;
        tokensPerBlock = tokensPerBlock_;
        enabled = true;
        _owner = msg.sender;
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
        //FIXME: add start block
        prevMintingBlock = block.number;
    }

    /**
     * @dev Returns the bep token owner.
     */
    function getOwner() public view virtual override returns (address) {
        return _owner;
    }

    /**
     * @dev Returns the token decimals.
     */
    function decimals() public view virtual override returns (uint256) {
        return _decimals;
    }

    /**
     * @dev Returns the token symbol.
     */
    function symbol() public view virtual override returns (string memory) {
        return _symbol;
    }

    /**
     * @dev Returns the token name.
     */
    function name() public view virtual override returns (string memory) {
        return _name;
    }

    /**
     * @dev See {BEP20-totalSupply}.
     */
    function totalSupply() public view virtual override returns (uint256) {
        return _totalSupply;
    }

    /**
     * @dev See {BEP20-balanceOf}.
     */
    function balanceOf(address account)
        public
        view
        virtual
        override
        returns (uint256)
    {
        return _balances[account];
    }

    /**
     * @dev See {BEP20-transfer}.
     *
     * Requirements:
     *
     * - `recipient` cannot be the zero address.
     * - the caller must have a balance of at least `amount`.
     */
    function transfer(address recipient, uint256 amount)
        public
        virtual
        override
        returns (bool)
    {
        _transferLPtoken(msg.sender, recipient, amount);
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    /**
     * @notice Recalc pool state when LP-tokens transferred, this function called from LP-token contract
     * @param sender Senders address of LP-tokens
     * @param recipient Recipient address
     * @param amount Funds amount
     */
    function _transferLPtoken(
        address sender,
        address recipient,
        uint256 amount
    ) internal {
        require(enabled, "Pool: Pool disabled");

        Stake storage accountS = userStaked[sender];
        uint256 percent = amount.mul(10**_decimals).div(accountS.totalStaked);
        uint256 claimedReward =
            accountS.claimedReward.mul(percent).div(10**_decimals);
        uint256 missedProfit =
            accountS.missedProfit.mul(percent).div(10**_decimals);
        accountS.totalStaked = accountS.totalStaked.sub(amount);
        accountS.claimedReward = accountS.claimedReward.sub(claimedReward);
        accountS.missedProfit = accountS.missedProfit.sub(missedProfit);

        Stake storage accountR = userStaked[recipient];
        accountR.totalStaked = accountR.totalStaked.add(amount);
        accountR.claimedReward = accountR.claimedReward.add(claimedReward);
        //FIXME: test it!
        if (accountS.signMissedProfit) {
            _subMissedProfit(recipient, missedProfit);
        } else {
            _addMissedProfit(recipient, missedProfit);
        }
    }

    /**
     * @dev See {BEP20-allowance}.
     */
    function allowance(address owner, address spender)
        public
        view
        virtual
        override
        returns (uint256)
    {
        return _allowances[owner][spender];
    }

    /**
     * @dev See {BEP20-approve}.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function approve(address spender, uint256 amount)
        public
        virtual
        override
        returns (bool)
    {
        _approve(msg.sender, spender, amount);
        return true;
    }

    /**
     * @dev See {BEP20-transferFrom}.
     *
     * Emits an {Approval} event indicating the updated allowance. This is not
     * required by the EIP. See the note at the beginning of {BEP20};
     *
     * Requirements:
     * - `sender` and `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `amount`.
     * - the caller must have allowance for `sender`'s tokens of at least
     * `amount`.
     */
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public virtual override returns (bool) {
        _transfer(sender, recipient, amount);
        _approve(
            sender,
            recipient,
            _allowances[sender][msg.sender].sub(
                amount,
                "BEP20: transfer amount exceeds allowance"
            )
        );
        _transferLPtoken(sender, recipient, amount);
        return true;
    }

    /**
     * @dev Atomically increases the allowance granted to `spender` by the caller.
     *
     * This is an alternative to {approve} that can be used as a mitigation for
     * problems described in {BEP20-approve}.
     *
     * Emits an {Approval} event indicating the updated allowance.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function increaseAllowance(address spender, uint256 addedValue)
        public
        override
        returns (bool)
    {
        _approve(
            msg.sender,
            spender,
            _allowances[msg.sender][spender].add(addedValue)
        );
        return true;
    }

    /**
     * @dev Atomically decreases the allowance granted to `spender` by the caller.
     *
     * This is an alternative to {approve} that can be used as a mitigation for
     * problems described in {BEP20-approve}.
     *
     * Emits an {Approval} event indicating the updated allowance.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     * - `spender` must have allowance for the caller of at least
     * `subtractedValue`.
     */
    function decreaseAllowance(address spender, uint256 subtractedValue)
        public
        override
        returns (bool)
    {
        _approve(
            msg.sender,
            spender,
            _allowances[msg.sender][spender].sub(
                subtractedValue,
                "BEP20: decreased allowance below zero"
            )
        );
        return true;
    }

    /** @notice Enable pool for staking and loans
     * The factory owns the pool
     */
    function enable() public override {
        require(msg.sender == _owner, "Pool: FORBIDDEN");
        enabled = true;
    }

    /** @notice Disable pool for staking and loans
     * The Citadel factory owns the pool
     */
    function disable() public override {
        require(msg.sender == _owner, "Pool: FORBIDDEN");
        enabled = false;
    }

    /** @notice Disable pool for staking and loans
     * The Citadel factory owns the pool
     */
    function updateTokensPerBlock(uint256 tokensPerBlock_) public override {
        require(msg.sender == _owner, "Pool: FORBIDDEN");
        tokensPerBlock = tokensPerBlock_;
    }

    /**
     * @notice Daily staked liquidity
     */
    function dailyStacked() public view override returns (bool, uint256) {
        return (_signDailyStacked, _dailyStacked);
    }

    /**
     * @notice Get accounts available rewards
     */
    function availableReward(address user) public view override returns (uint256) {
        Stake storage account = userStaked[user];
        uint256 available_reward =
            account.totalStaked.mul(tps).div(10**_decimals);
        if (!account.signMissedProfit) {
            available_reward = available_reward.sub(account.missedProfit);
        } else {
            available_reward = available_reward.add(account.missedProfit);
        }
        available_reward = available_reward.sub(account.claimedReward);
        return available_reward;
    }

    /**
     * @notice Get accounts available rewards
     */
    function availableCtl(address user) public view override returns (uint256) {
        Stake storage account = userStaked[user];
        uint256 available_reward =
            account.totalStaked.mul(tpsCtl).div(10**ctlToken.decimals());
        if (!account.signMissedCtl) {
            available_reward = available_reward.sub(account.missedCtl);
        } else {
            available_reward = available_reward.add(account.missedCtl);
        }
        available_reward = available_reward.sub(account.claimedCtl);
        return available_reward;
    }

    function updateApyTax(uint256 apyTax_) public override {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Pool: Caller is not a admin"
        );
        apyTax = apyTax_;
    }

    function updatePremiumCoeff(uint256 premiumCoeff_) public override {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Pool: Caller is not a admin"
        );
        premiumCoeff = premiumCoeff_;
    }

    function updateCTLToken(CTLToken ctlToken_) public override {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Pool: Caller is not a admin"
        );
        ctlToken = ctlToken_;
    }

    /**
     * @notice Stake liquidity to pool
     * @param amount Funds amount
     */
    // FIXME: add minting and tps calc for deposit, withdraw, claim and loans
    function deposit(uint256 amount) public override {
        require(enabled, "Pool: Pool disabled");
        require(amount > 0, "Pool: Amount is invalid");

        Stake storage account = userStaked[msg.sender];
        uint256 premium = amount.mul(apyTax).div(10**_decimals);
        uint256 staked = amount.sub(premium);
        totalStaked = totalStaked.add(staked);
        account.totalStaked = account.totalStaked.add(staked);
        _addDailyStacked(staked);
        _addMissedProfit(msg.sender, staked.mul(prevTps).div(10**_decimals));
        _addProfit(premium);

        uint256 minted = ctlToken.mint();
        if (minted > 0) {
            ctlTps = ctlTps.add(
                (minted.sub(tokensPerBlock)).mul(10**_decimals).div(totalStaked)
            );
            _addMissedCtl(msg.sender, staked.mul(ctlTps).div(ctlToken.decimals()));
            ctlTps = ctlTps.add(
                tokensPerBlock.mul(10**_decimals).div(totalStaked)
            );
        }
        prevMintingBlock = block.number;

        token.transferFrom(msg.sender, address(this), amount);
        _mint(msg.sender, staked);
        emit Deposited(msg.sender, token, staked);
    }

    /**
     * @notice Withdraw funds from pool
     * @param amount Funds amount
     */
    function withdraw(uint256 amount) public override {
        require(enabled, "Pool: Pool disabled");
        Stake storage account = userStaked[msg.sender];
        require(
            amount > 0 && amount <= account.totalStaked,
            "Pool: Amount is invalid"
        );
        totalStaked = totalStaked.sub(amount);
        account.totalStaked = account.totalStaked.sub(amount);
        _subDailyStacked(amount);
        _subMissedProfit(msg.sender, amount.mul(prevTps).div(10**_decimals));
        _burn(msg.sender, amount);
        uint256 minted = ctlToken.mint();
        if (minted > 0) {
            ctlTps = ctlTps.add(
                (minted.sub(tokensPerBlock)).mul(10**_decimals).div(totalStaked)
            );
            _subMissedCtl(msg.sender, staked.mul(ctlTps).div(ctlToken.decimals()));
            ctlTps = ctlTps.add(
                tokensPerBlock.mul(10**_decimals).div(totalStaked)
            );
        }
        prevMintingBlock = block.number;

        token.transfer(msg.sender, amount);
        emit Withdrew(msg.sender, token, amount);
    }

    /**
     * @notice Withdraw rewards from pool in CTL tokens
     * @param amount Rewards amount
     */
    function claimReward(uint256 amount) public override {
        require(enabled, "Pool: Pool disabled");
        Stake storage account = userStaked[msg.sender];
        require(
            amount > 0 && amount <= availableReward(msg.sender),
            "Pool: Amount should be less or equal then available reward"
        );
        account.claimedReward = account.claimedReward.add(amount);

        token.transfer(msg.sender, amount);
        emit Rewarded(msg.sender, token, amount);
    }

    /**
     * @notice Withdraw rewards from pool in CTL tokens
     * @param amount Rewards amount
     */
    function claimCtl(uint256 amount) public override {
        require(enabled, "Pool: Pool disabled");
        Stake storage account = userStaked[msg.sender];
        require(
            amount > 0 && amount <= availableCtl(msg.sender),
            "Pool: Amount should be less or equal then available reward"
        );
        account.claimedCtl = account.claimedCtl.add(amount);

        tokenCtl.transfer(msg.sender, amount);
        emit Rewarded(msg.sender, ctlToken, amount);
    }

    /**
     * @notice Borrowers flash loan request
     * @param receiver Address of flash loan receiver contract
     * @param amount Funds amount
     * @param params Parameters for flash loan receiver contract
     */
    function flashLoan(
        address receiver,
        uint256 amount,
        uint256 premium,
        bytes calldata params
    ) public override {
        require(
            hasRole(BORROWER_ROLE, msg.sender),
            "Pool: Caller is not a borrower"
        );
        require(enabled, "Pool: Pool disabled");
        Loan storage loan = userLoaned[msg.sender];
        require(!loan.lock, "Pool: reentrancy guard");
        require(amount > 0 && amount <= totalStaked, "Pool: Amount is invalid");
        require(
            premium.mul(10**_decimals).div(amount) >= premiumCoeff,
            "Pool: Profit amount is invalid"
        );
        loan.lock = true;
        borrowed = borrowed.add(amount);
        loan.borrowed = loan.borrowed.add(amount);

        token.transfer(receiver, amount);
        IFlashLoanReceiver(receiver).executeOperation(
            token,
            amount,
            premium,
            msg.sender,
            params
        );
        token.transferFrom(receiver, address(this), amount.add(premium));

        _addProfit(premium);
        returned = returned.add(amount);
        loan.returned = loan.returned.add(amount);
        loan.profit = loan.profit.add(premium);
        loan.lock = false;
        emit FlashLoan(msg.sender, receiver, amount, premium);
    }

    /**
     * @notice Add deposit amount to liquidity pools daily staked
     * @param amount Deposit amount
     */
    function _addDailyStacked(uint256 amount) internal {
        //dailyStacked is negative
        if (_signDailyStacked) {
            if (_dailyStacked > amount) {
                _dailyStacked = _dailyStacked.sub(amount);
            } else {
                _dailyStacked = amount.sub(_dailyStacked);
                _signDailyStacked = false;
            }
        } else {
            _dailyStacked = _dailyStacked.add(amount);
        }
    }

    /**
     * @notice Subtract withdraw amount from liquidity pools daily staked
     * @param amount Withdraw amount
     */
    function _subDailyStacked(uint256 amount) internal {
        //dailyStacked is positive
        if (!_signDailyStacked) {
            if (_dailyStacked >= amount) {
                _dailyStacked = _dailyStacked.sub(amount);
            } else {
                _dailyStacked = amount.sub(_dailyStacked);
                _signDailyStacked = true;
            }
        } else {
            _dailyStacked = _dailyStacked.add(amount);
        }
    }

    /**
     * @notice Receipt profit set in zero and save tps for previous day one times per day
     */
    function _checkCurrentDayAndUpdatePool() internal {
        uint256 day = 0;
        if (block.timestamp > startTime) {
            day = (block.timestamp.sub(startTime)).div(86400);
        }
        if (curDay != day) {
            curDay = day;
            receiptProfit = 0;
            _dailyStacked = 0;
            _signDailyStacked = false;
            prevTps = tps;
        }
    }

    /**
     * @notice Add profit when premium distributed
     * @param premium premium amount
     */
    function _addProfit(uint256 premium) internal {
        _checkCurrentDayAndUpdatePool();
        receiptProfit = receiptProfit.add(premium);
        totalProfit = totalProfit.add(premium);
        //FIXME: tps = prevTps+receiptProfit/totalStaked or tps += receiptProfit/totalStaked ???
        tps = prevTps.add(receiptProfit.mul(10**_decimals).div(totalStaked));
    }

    /**
     * @notice Recalc missed profit when user deposited or transfered funds
     * @param user Address of account
     * @param amount Profit amount
     */
    function _addMissedProfit(address user, uint256 amount) internal {
        Stake storage account = userStaked[user];
        //missedProfit is negative
        if (account.signMissedProfit) {
            if (account.missedProfit > amount) {
                account.missedProfit = account.missedProfit.sub(amount);
            } else {
                account.missedProfit = amount.sub(account.missedProfit);
                account.signMissedProfit = false;
            }
        } else {
            account.missedProfit = account.missedProfit.add(amount);
        }
    }

    /**
     * @notice Recalc missed profit when user withdrawal or transfered funds
     * @param user Address of account
     * @param amount Profit amount
     */
    function _subMissedProfit(address user, uint256 amount) internal {
        Stake storage account = userStaked[user];
        //missedProfit is positive
        if (!account.signMissedProfit) {
            if (account.missedProfit >= amount) {
                account.missedProfit = account.missedProfit.sub(amount);
            } else {
                account.missedProfit = amount.sub(account.missedProfit);
                account.signMissedProfit = true;
            }
        } else {
            account.missedProfit = account.missedProfit.add(amount);
        }
    }

    /**
     * @notice Recalc missed profit when user deposited or transfered funds
     * @param user Address of account
     * @param amount Profit amount
     */
    function _addMissedCtl(address user, uint256 amount) internal {
        Stake storage account = userStaked[user];
        //missedCtl is negative
        if (account.signMissedCtl) {
            if (account.missedCtl > amount) {
                account.missedCtl = account.missedCtl.sub(amount);
            } else {
                account.missedCtl = amount.sub(account.missedCtl);
                account.signMissedCtl = false;
            }
        } else {
            account.missedCtl = account.missedCtl.add(amount);
        }
    }

    /**
     * @notice Recalc missed profit when user withdrawal or transfered funds
     * @param user Address of account
     * @param amount Profit amount
     */
    function _subMissedCtl(address user, uint256 amount) internal {
        Stake storage account = userStaked[user];
        //missedCtl is positive
        if (!account.signMissedCtl) {
            if (account.missedCtl >= amount) {
                account.missedCtl = account.missedCtl.sub(amount);
            } else {
                account.missedCtl = amount.sub(account.missedCtl);
                account.signMissedCtl = true;
            }
        } else {
            account.missedCtl = account.missedCtl.add(amount);
        }
    }

    /**
     * @dev Moves tokens `amount` from `sender` to `recipient`.
     *
     * This is internal function is equivalent to {transfer}, and can be used to
     * e.g. implement automatic token fees, slashing mechanisms, etc.
     *
     * Emits a {Transfer} event.
     *
     * Requirements:
     *
     * - `sender` cannot be the zero address.
     * - `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `amount`.
     */
    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal virtual {
        require(sender != address(0), "BEP20: transfer from the zero address");
        require(recipient != address(0), "BEP20: transfer to the zero address");

        _balances[sender] = _balances[sender].sub(
            amount,
            "BEP20: transfer amount exceeds balance"
        );
        _balances[recipient] = _balances[recipient].add(amount);
        emit Transfer(sender, recipient, amount);
    }

    /** @dev Creates `amount` tokens and assigns them to `account`, increasing
     * the total supply.
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * Requirements
     *
     * - `to` cannot be the zero address.
     */
    function _mint(address account, uint256 amount) internal virtual {
        require(account != address(0), "BEP20: mint to the zero address");

        _totalSupply = _totalSupply.add(amount);
        _balances[account] = _balances[account].add(amount);
        emit Transfer(address(0), account, amount);
    }

    /**
     * @dev Destroys `amount` tokens from `account`, reducing the
     * total supply.
     *
     * Emits a {Transfer} event with `to` set to the zero address.
     *
     * Requirements
     *
     * - `account` cannot be the zero address.
     * - `account` must have at least `amount` tokens.
     */
    function _burn(address account, uint256 amount) internal virtual {
        require(account != address(0), "BEP20: burn from the zero address");

        _balances[account] = _balances[account].sub(
            amount,
            "BEP20: burn amount exceeds balance"
        );
        _totalSupply = _totalSupply.sub(amount);
        emit Transfer(account, address(0), amount);
    }

    /**
     * @dev Sets `amount` as the allowance of `spender` over the `owner`s tokens.
     *
     * This is internal function is equivalent to `approve`, and can be used to
     * e.g. set automatic allowances for certain subsystems, etc.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `owner` cannot be the zero address.
     * - `spender` cannot be the zero address.
     */
    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        require(owner != address(0), "BEP20: approve from the zero address");
        require(spender != address(0), "BEP20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    /**
     * @dev Destroys `amount` tokens from `account`.`amount` is then deducted
     * from the caller's allowance.
     *
     * See {_burn} and {_approve}.
     */
    function _burnFrom(address account, uint256 amount) internal virtual {
        _burn(account, amount);
        _approve(
            account,
            msg.sender,
            _allowances[account][msg.sender].sub(
                amount,
                "BEP20: burn amount exceeds allowance"
            )
        );
    }
}

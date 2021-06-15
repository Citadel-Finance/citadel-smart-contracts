// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IBEP20.sol";
import "./interfaces/ICTLToken.sol";
import "./interfaces/ICitadelPool.sol";
import "./interfaces/ILPToken.sol";
import "./interfaces/IFlashLoanReceiver.sol";

contract CitadelPool is ILPToken, ICitadelPool, AccessControl {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    bytes32 public constant BORROWER_ROLE = keccak256("BORROWER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /**
     * @dev State of users stake
     * @param totalStaked Total staked added when funds are deposited, subtracted upon withdrawal
     * @param missedProfit Missed profit increased on deposit_amount*previous_tps when funds are deposited, and decreased when funds are withdrawal
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
     * @dev Loaned funds and added profit
     * @param borrowed Funds borrowed by the user
     * @param profit Earned profit
     */
    struct Loan {
        uint256 borrowed;
        uint256 profit;
    }

    struct CommonData {
        uint256 decimals;
        uint256 totalStaked;
        uint256 totalProfit;
        uint256 totalBorrowed;
        uint256 tokensPerBlock;
        uint256 apyTax;
        uint256 premiumCoeff;
        uint256 tokensPerStaked;
        uint256 ctlPerStaked;
        IERC20 token;
        ICTLToken ctlToken;
        bool enabled;
        string name;
        string symbol;
    }

    struct UserData {
        uint256 totalStaked;
        uint256 balanceOf;
        uint256 claimedReward;
        uint256 claimedCtl;
        uint256 availableReward;
        uint256 availableCtl;
        uint256 totalBorrowed;
        uint256 totalProfit;
        bool is_admin;
    }

    struct Top {
        address user;
        uint256 staked;
    }

    uint256 private _totalSupply;
    uint256 private _decimals;
    string private _symbol;
    string private _name;
    address private _owner;
    bool private _lock;
    Top[10] private _topProviders;
    Top[10] private _topKeepers;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    /**
     * @dev State of liquidity pool
     */
    /// @dev APY tax percent
    uint256 private _apyTax;

    /// @dev Total given premium
    uint256 private _totalProfit;

    /// @dev Tokens per staked amount
    uint256 private _tps;

    /// @dev Balance of tokens
    uint256 private _totalStaked;

    /// @dev Balance of tokens for current day, it reset to zero every day
    /// @dev Sign of daily staked tokens, false - positive, true - negative

    /// @dev Borrowed funds amount
    uint256 private _borrowed;

    /// @dev Minimal premium percent for borrowers
    uint256 private _premiumCoeff;

    /// @dev true - enabled pool, false - disabled pool
    bool private _enabled;

    /// @dev Outside token address
    IERC20 private immutable _token;

    /// @dev CTL-token settings
    /// @dev CTL-tokens per staked
    ICTLToken private immutable _ctlToken;

    uint256 private _tokensPerBlock;

    uint256 private _prevMintingBlock;

    uint256 private _ctlTps;

    mapping(address => Stake) public userStaked;

    mapping(address => Loan) public userLoaned;

    constructor(
        address token_,
        address ctlToken_,
        uint256 apyTax_,
        uint256 premiumCoeff_,
        uint256 tokensPerBlock_,
        address admin_,
        bool enabled_
    ) AccessControl() {
        _name = string(abi.encodePacked("ct", IBEP20(token_).name()));
        _symbol = string(abi.encodePacked("ct", IBEP20(token_).symbol()));
        _decimals = IBEP20(token_).decimals();
        _totalSupply = 0;
        _token = IERC20(token_);
        _ctlToken = ICTLToken(ctlToken_);
        _apyTax = apyTax_;
        _premiumCoeff = premiumCoeff_;
        _tokensPerBlock = tokensPerBlock_;
        _enabled = enabled_;
        _owner = msg.sender;
        _setupRole(DEFAULT_ADMIN_ROLE, admin_);
        _setupRole(ADMIN_ROLE, admin_);
        _setRoleAdmin(ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(BORROWER_ROLE, ADMIN_ROLE);
        uint256 ctlStartBlock = ICTLToken(ctlToken_).startBlock();
        if (block.number > ctlStartBlock) {
            _prevMintingBlock = block.number;
        } else {
            _prevMintingBlock = ctlStartBlock;
        }
    }

    modifier onlyEnabled() {
        require(_enabled, "Pool: Pool disabled");
        _;
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
        onlyEnabled
        returns (bool)
    {
        _transferPoolState(msg.sender, recipient, amount);
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    /**
     * @notice Recalc pool state when LP-tokens transferred, this function called from LP-token contract
     * @param sender Senders address of LP-tokens
     * @param recipient Recipient address
     * @param amount Funds amount
     */
    function _transferPoolState(
        address sender,
        address recipient,
        uint256 amount
    ) internal {
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
        uint256 minted = _ctlToken.mint();
        _ctlTps = _ctlTps.add(minted.mul(10**_decimals).div(_totalStaked));
        _prevMintingBlock = block.number;
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
    ) public virtual override onlyEnabled returns (bool) {
        _transferPoolState(sender, recipient, amount);
        _transfer(sender, recipient, amount);
        _approve(
            sender,
            msg.sender,
            _allowances[sender][msg.sender].sub(
                amount,
                "BEP20: transfer amount exceeds allowance"
            )
        );

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
        onlyEnabled
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
        onlyEnabled
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

    /**
     * @notice Get pools common info
     */
    function getCommonData() public view returns (CommonData memory) {
        return
            CommonData({
                decimals: IBEP20(address(_token)).decimals(),
                totalStaked: _totalStaked,
                totalProfit: _totalProfit,
                totalBorrowed: _borrowed,
                tokensPerBlock: _tokensPerBlock,
                apyTax: _apyTax,
                premiumCoeff: _premiumCoeff,
                tokensPerStaked: _tps,
                ctlPerStaked: _ctlTps,
                token: _token,
                ctlToken: _ctlToken,
                enabled: _enabled,
                name: IBEP20(address(_token)).name(),
                symbol: IBEP20(address(_token)).symbol()
            });
    }

    /**
     * @notice Get pools user info
     */
    function getUserData(address user) public view returns (UserData memory) {
        Stake memory st = userStaked[user];
        return
            UserData({
                totalStaked: st.totalStaked,
                balanceOf: _balances[user],
                claimedReward: st.claimedReward,
                claimedCtl: st.claimedCtl,
                availableReward: availableReward(user),
                availableCtl: availableCtl(user),
                totalBorrowed: userLoaned[user].borrowed,
                totalProfit: userLoaned[user].profit,
                is_admin: hasRole(ADMIN_ROLE, user)
            });
    }

    function prevMintingBlock() public view override returns (uint256) {
        return _prevMintingBlock;
    }

    function tokensPerBlock() public view override returns (uint256) {
        return _tokensPerBlock;
    }

    /**
     * @notice get top 5 liquidity providers
     */
    function getTopProviders() public view returns (Top[10] memory) {
        return _topProviders;
    }

    /**
     * @notice get top 5 liquidity providers
     */
    function getTopKeepers() public view returns (Top[10] memory) {
        return _topKeepers;
    }

    function enabled() public view returns (bool) {
        return _enabled;
    }

    /** @notice Enable pool for staking and loans
     * The Citadel factory called this function as owner of the pool
     */
    function enable() public {
        require(msg.sender == _owner, "Pool: FORBIDDEN");
        _enabled = true;
    }

    /** @notice Disable pool for staking and loans
     * The Citadel factory called this function as owner of the pool
     */
    function disable() public {
        require(msg.sender == _owner, "Pool: FORBIDDEN");
        _enabled = false;
    }

    /**
     * @notice Get accounts available rewards
     */
    function availableReward(address user) public view returns (uint256) {
        Stake storage account = userStaked[user];
        uint256 available_reward =
            account.totalStaked.mul(_tps).div(10**_decimals);
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
    function availableCtl(address user) public view returns (uint256) {
        Stake storage account = userStaked[user];
        uint256 available_reward =
            account.totalStaked.mul(_ctlTps).div(10**_decimals);
        if (!account.signMissedCtl) {
            available_reward = available_reward.sub(account.missedCtl);
        } else {
            available_reward = available_reward.add(account.missedCtl);
        }
        available_reward = available_reward.sub(account.claimedCtl);
        return available_reward;
    }

    function updatePool(
        uint256 apyTax_,
        uint256 premiumCoeff_,
        uint256 tokensPerBlock_,
        bool enabled_
    ) public {
        require(hasRole(ADMIN_ROLE, msg.sender), "Pool: Caller is not a admin");
        if (_apyTax != 0) {
            _apyTax = apyTax_;
        }
        if (_premiumCoeff != 0) {
            _premiumCoeff = premiumCoeff_;
        }
        if (tokensPerBlock_ != 0) {
            _tokensPerBlock = tokensPerBlock_;
        }
        _enabled = enabled_;
    }

    /**
     * @notice Stake liquidity to pool
     * @param amount Funds amount
     */
    function deposit(uint256 amount) public onlyEnabled {
        require(amount > 0, "Pool: Amount is invalid");

        Stake storage account = userStaked[msg.sender];
        uint256 premium = amount.mul(_apyTax).div(10**_decimals);
        uint256 staked = amount.sub(premium);
        uint256 oldTotalStaked = _totalStaked;
        _totalStaked = _totalStaked.add(staked);
        account.totalStaked = account.totalStaked.add(staked);
        _totalProfit = _totalProfit.add(premium);

        _addMissedProfit(msg.sender, staked.mul(_tps).div(10**_decimals));

        _tps = _tps.add(premium.mul(10**_decimals).div(_totalStaked));

        uint256 minted = _ctlToken.mint();
        if (minted > 0) {
            _ctlTps = _ctlTps.add(
                (minted.sub(_tokensPerBlock)).mul(10**_decimals).div(
                    oldTotalStaked
                )
            );
            _addMissedCtl(msg.sender, staked.mul(_ctlTps).div(10**_decimals));
            _ctlTps = _ctlTps.add(
                _tokensPerBlock.mul(10**_decimals).div(_totalStaked)
            );
        }
        _prevMintingBlock = block.number;

        _updateTop(_topProviders, account.totalStaked);

        _mint(msg.sender, staked); //Mint and charge LP-tokens

        _token.safeTransferFrom(msg.sender, address(this), amount);

        emit Deposited(block.timestamp, msg.sender, staked);
        emit totalHistory(
            block.timestamp,
            msg.sender,
            _totalStaked,
            _borrowed,
            _totalProfit
        );
    }

    /**
     * @notice Withdraw funds from pool
     * @param amount Funds amount
     */
    function withdraw(uint256 amount) public onlyEnabled {
        Stake storage account = userStaked[msg.sender];
        require(
            amount > 0 && amount <= account.totalStaked,
            "Pool: Amount is invalid"
        );
        uint256 oldTotalStaked = _totalStaked;
        _totalStaked = _totalStaked.sub(amount);
        account.totalStaked = account.totalStaked.sub(amount);
        _subMissedProfit(msg.sender, amount.mul(_tps).div(10**_decimals));

        uint256 minted = _ctlToken.mint();
        if (minted > 0) {
            _ctlTps = _ctlTps.add(
                (minted.sub(_tokensPerBlock)).mul(10**_decimals).div(
                    oldTotalStaked
                )
            );
            _subMissedCtl(msg.sender, amount.mul(_ctlTps).div(10**_decimals));
            if (_totalStaked > 0) {
                _ctlTps = _ctlTps.add(
                    _tokensPerBlock.mul(10**_decimals).div(_totalStaked)
                );
            }
        }
        _prevMintingBlock = block.number;

        _updateTop(_topProviders, account.totalStaked);

        _burn(msg.sender, amount);
        _token.safeTransfer(msg.sender, amount);

        emit Withdrew(block.timestamp, msg.sender, amount);
        emit totalHistory(
            block.timestamp,
            msg.sender,
            _totalStaked,
            _borrowed,
            _totalProfit
        );
    }

    /**
     * @notice Claim all rewards from pool in original tokens
     * @param spender Spender address
     */
    function claimRewards(address spender) public {
        require(
            msg.sender == _owner,
            "Pool: This function must called from factory"
        );
        if (_enabled) {
            uint256 amount = availableReward(spender);
            if (amount > 0) {
                Stake storage account = userStaked[spender];
                account.claimedReward = account.claimedReward.add(amount);
                _token.safeTransfer(spender, amount);

                emit Rewarded(block.timestamp, spender, amount);
                emit totalHistory(
                    block.timestamp,
                    spender,
                    _totalStaked,
                    _borrowed,
                    _totalProfit
                );
            }
        }
    }

    /**
     * @notice Claim all rewards from pool in CTL tokens
     * @param spender Spender address
     */
    function claimCtl(address spender) public {
        require(
            msg.sender == _owner,
            "Pool: This function must called from factory"
        );
        if (_enabled) {
            if (_totalStaked > 0) {
                uint256 minted = _ctlToken.mint();
                _ctlTps = _ctlTps.add(
                    minted.mul(10**_decimals).div(_totalStaked)
                );
                _prevMintingBlock = block.number;
            }
            uint256 amount = availableCtl(spender);
            if (amount > 0) {
                Stake storage account = userStaked[spender];
                account.claimedCtl = account.claimedCtl.add(amount);
                IERC20(address(_ctlToken)).safeTransfer(spender, amount);
                emit Rewarded(block.timestamp, spender, amount);
            }
        }
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
    ) public onlyEnabled {
        require(
            hasRole(BORROWER_ROLE, msg.sender),
            "Pool: Caller is not a borrower"
        );
        Loan storage loan = userLoaned[msg.sender];
        require(!_lock, "Pool: reentrancy guard");
        require(
            amount > 0 && amount <= _totalStaked,
            "Pool: Amount is invalid"
        );
        require(
            premium.mul(10**_decimals).div(amount) >= _premiumCoeff,
            "Pool: Profit amount is invalid"
        );
        _lock = true;
        _borrowed = _borrowed.add(amount);
        loan.borrowed = loan.borrowed.add(amount);
        loan.profit = loan.profit.add(premium);
        _totalProfit = _totalProfit.add(premium);
        _tps = _tps.add(premium.mul(10**_decimals).div(_totalStaked));

        uint256 minted = _ctlToken.mint();
        _ctlTps = _ctlTps.add(minted.mul(10**_decimals).div(_totalStaked));
        _prevMintingBlock = block.number;

        _token.safeTransfer(receiver, amount);
        IFlashLoanReceiver(receiver).executeOperation(
            _token,
            amount,
            premium,
            msg.sender,
            params
        );
        _token.safeTransferFrom(receiver, address(this), amount.add(premium));

        _lock = false;
        emit FlashLoan(block.timestamp, msg.sender, receiver, amount, premium);
        emit totalHistory(
            block.timestamp,
            msg.sender,
            _totalStaked,
            _borrowed,
            _totalProfit
        );
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

    function _updateTop(Top[10] storage array, uint256 amount) internal {
        uint256 _index;
        for (uint256 i = 0; i < array.length; i++) {
            if (array[i].user == msg.sender) {
                _index = i;
                break;
            }
            if (array[i].staked < array[_index].staked) {
                _index = i;
            }
        }
        if (amount > array[_index].staked || msg.sender == array[_index].user) {
            array[_index] = Top({user: msg.sender, staked: amount});
        }
        if (amount == 0) {
            array[_index] = Top({user: address(0), staked: 0});
        }
    }
}

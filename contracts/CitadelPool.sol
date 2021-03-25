// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "./IBEP20.sol";
import "./LPToken.sol";
import "./ILPToken.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract CitadelPool is AccessControl {
    using SafeMath for uint256;

    struct LiquidityPool {
        uint256 receipt_profit; //Profit per day
        uint256 total_profit;
        uint256 tps_amount; //Tokens per staked amount
        uint256 prev_tps_amount; //Tokens per staked amount for previously day
        uint256 total_stacked; //Balance of tokens
        uint256 daily_stacked; //Balance of tokens per day
    }

    struct Stake {
        uint256 total_stacked;
        uint256 missed_profit;
        uint256 claimed_reward;
        uint256 available_reward;
        bool sign_missed_profit; // 0 - positive, 1 - negative
    }

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN");
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER");

    uint256 public start_time; //Deploy timestamp
    uint256 public cur_day; //Current day from start time
    mapping(IBEP20 => ILPToken) token_whitelist; //Enabled tokens
    mapping(ILPToken => IBEP20) reversed_whitelist;
    mapping(IBEP20 => LiquidityPool) liquidity_pool;
    mapping(IBEP20 => mapping(address => Stake)) user_stacked; //Balance per accounts

    event Deposited(
        address indexed _depositor,
        IBEP20 indexed _token,
        uint256 _amount,
        uint256 _mintAmount
    );
    event Withdrew(
        address indexed _reciever,
        IBEP20 indexed _token,
        uint256 _amount
    );
    event Borrowed(
        address indexed _borrower,
        IBEP20 indexed _token,
        uint256 _amount,
        uint256 _fee
    );
    event Profited(
        address indexed _borrower,
        IBEP20 indexed token,
        uint256 amount
    );
    event Rewarded(
        address indexed _borrower,
        IBEP20 indexed token,
        uint256 amount
    );

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        _setRoleAdmin(ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
        start_time = block.timestamp;
        cur_day = 0;
    }

    function get_token_whitelist(IBEP20 token) public view returns (ILPToken) {
        return token_whitelist[token];
    }

    function get_reversed_whitelist(ILPToken token) public view returns (IBEP20) {
        return reversed_whitelist[token];
    }

    function get_total_stacked(IBEP20 token) public view returns (uint256) {
        return liquidity_pool[token].total_stacked;
    }

    function get_account_stacked(IBEP20 token) public view returns (uint256) {
        return user_stacked[token][msg.sender].total_stacked;
    }

    function get_available_reward(IBEP20 token) public view returns (uint256) {
        return user_stacked[token][msg.sender].available_reward;
    }

    function update_whitelist(address token) public {
        require(hasRole(ADMIN_ROLE, msg.sender), "Pool: Caller is not a admin");
        require(
            token_whitelist[IBEP20(token)] == ILPToken(0),
            "Pool: Token already exist on the whitelist"
        );
        bytes32 salt = keccak256(abi.encodePacked(token));
        string memory lp_prefix = "ct";
        string memory name = IBEP20(token).name();
        string memory symbol = IBEP20(token).symbol();
        address lp_token = address(new LPToken{salt: salt}(name, symbol, 18, address(this)));
        token_whitelist[IBEP20(token)] = ILPToken(lp_token);
        reversed_whitelist[ILPToken(lp_token)] = IBEP20(token);
    }

    function deposit(IBEP20 token, uint256 amount) public {
        require(token != IBEP20(0), "Pool: Token is invalid");
        ILPToken lp_token = token_whitelist[token];
        require(lp_token != ILPToken(0), "Pool: Token is not enabled");
        require(amount > 0, "Pool: Amount is invalid");
        require(
            token.transferFrom(msg.sender, address(this), amount),
            "Pool: Unable to transfer specified amount of staking tokens"
        );

        LiquidityPool storage pool = liquidity_pool[token];
        Stake storage account = user_stacked[token][msg.sender];

        pool.total_stacked = pool.total_stacked.add(amount);
        account.total_stacked = account.total_stacked.add(amount);
        add_missed_profit(account, amount.mul(pool.prev_tps_amount).div(1e18));
        calc_available_reward(account, pool.tps_amount);

        //Mint missed amount of lp-tokens
        uint256 lp_balance = lp_token.balanceOf(address(this));
        if (lp_balance < amount) {
            lp_token.mint(amount.sub(lp_balance));
        }
        lp_token.transfer(msg.sender, amount);
        emit Deposited(msg.sender, token, amount, amount);
    }

    function withdraw(IBEP20 token, uint256 amount) public {
        require(token != IBEP20(0), "Pool: Token is invalid");
        ILPToken lp_token = token_whitelist[token];
        require(lp_token != ILPToken(0), "Pool: Token is not enabled");
        Stake storage account = user_stacked[token][msg.sender];
        require(
            account.total_stacked >= amount && amount > 0,
            "Pool: Amount is invalid"
        );
        require(
            lp_token.transferFrom(msg.sender, address(this), amount),
            "Pool: Unable to transfer specified amount of LP tokens"
        );
        require(
            token.transfer(msg.sender, amount),
            "Pool: Unable to transfer specified amount of staking tokens"
        );

        LiquidityPool storage pool = liquidity_pool[token];

        pool.total_stacked = pool.total_stacked.sub(amount);
        account.total_stacked = account.total_stacked.sub(amount);
        sub_missed_profit(account, amount.mul(pool.prev_tps_amount).div(1e18));
        calc_available_reward(account, pool.tps_amount);

        emit Withdrew(msg.sender, token, amount);
    }

    function add_profit(IBEP20 token, uint256 amount) public {
        require(
            token_whitelist[token] != ILPToken(0),
            "Pool: Token is not enabled"
        );
        //Receipt profit set in zero every day
        LiquidityPool storage p = liquidity_pool[token];
        uint256 day = (block.timestamp.sub(start_time)).div(86400);
        if (day != cur_day) {
            cur_day = day;
            p.receipt_profit = 0;
            p.prev_tps_amount = p.tps_amount;
        }
        p.receipt_profit = p.receipt_profit.add(amount);
        p.total_profit = p.total_profit.add(amount);
        p.tps_amount = p.tps_amount.add(
            p.receipt_profit.mul(1e18).div(p.total_stacked)
        );
        emit Profited(msg.sender, token, amount);
    }

    function claim_reward(IBEP20 token, uint256 amount) public {
        require(
            token_whitelist[token] != ILPToken(0),
            "Pool: Token is not enabled"
        );
        Stake storage account = user_stacked[token][msg.sender];
        require(
            amount <= account.available_reward,
            "Pool: Amount should be less then available reward"
        );
        account.claimed_reward = account.claimed_reward.add(amount);
        calc_available_reward(account, liquidity_pool[token].tps_amount);
        emit Rewarded(msg.sender, token, amount);
    }

    function transfer_lp(address sender, address recipient, uint256 amount) public {
        // msg.sender - LP token address
        IBEP20 token = reversed_whitelist[ILPToken(msg.sender)];
        require(token != IBEP20(0), "Pool: FORBIDDEN");

        Stake storage account_s = user_stacked[token][sender];
        uint256 percent = amount.mul(1e18).div(account_s.total_stacked);
        uint256 available_reward = account_s.available_reward.mul(percent).div(1e18);
        uint256 claimed_reward = account_s.claimed_reward.mul(percent).div(1e18);
        uint256 missed_profit = account_s.missed_profit.mul(percent).div(1e18);
        account_s.total_stacked = account_s.total_stacked.sub(amount);
        account_s.available_reward = account_s.available_reward.sub(available_reward);
        account_s.claimed_reward = account_s.claimed_reward.sub(claimed_reward);
        //FIXME: sign
        account_s.missed_profit = account_s.missed_profit.sub(missed_profit);

        Stake storage account_r = user_stacked[token][recipient];
        account_r.total_stacked = account_r.total_stacked.add(amount);
        account_r.available_reward = account_r.available_reward.add(available_reward);
        account_r.claimed_reward = account_r.claimed_reward.add(claimed_reward);
        //FIXME: sign
        account_r.missed_profit = account_r.missed_profit.add(missed_profit);

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

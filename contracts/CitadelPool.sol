// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "./IBEP20.sol";
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

    ILPToken public lp_token; //LP-token address
    uint256 public start_time; //Deploy timestamp
    uint256 public cur_day; //Current day from start time
    mapping(address => bool) token_whitelist; //Enabled tokens
    mapping(address => LiquidityPool) liquidity_pool;
    mapping(address => mapping(address => Stake)) user_stacked; //Balance per accounts

    event Deposited(
        address indexed _depositor,
        address indexed _token,
        uint256 _amount,
        uint256 _mintAmount
    );
    event Withdrew(
        address indexed _reciever,
        address indexed _token,
        uint256 _amount
    );
    event Borrowed(
        address indexed _borrower,
        address indexed _token,
        uint256 _amount,
        uint256 _fee
    );
    event Profited(
        address indexed _borrower,
        address indexed token,
        uint256 amount
    );
    event Rewarded(
        address indexed _borrower,
        address indexed token,
        uint256 amount
    );


    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        _setRoleAdmin(ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
        start_time = block.timestamp;
        cur_day = 0;
    }

    function get_token_whitelist(address token) public view returns (bool) {
        return token_whitelist[token];
    }

    function get_total_stacked(address token) public view returns (uint256) {
        return liquidity_pool[token].total_stacked;
    }

    function get_account_stacked(address token) public view returns (uint256) {
        return user_stacked[token][msg.sender].total_stacked;
    }

    function get_available_reward(address token) public view returns (uint256) {
        return user_stacked[token][msg.sender].available_reward;
    }

    function set_lp_token(address token) public {
        require(hasRole(ADMIN_ROLE, msg.sender), "Caller is not a admin");
        require(token != address(0), "Token address is invalid");
        lp_token = ILPToken(token);
    }

    function update_whitelist(address token, bool enabled) public {
        require(hasRole(ADMIN_ROLE, msg.sender), "Caller is not a admin");
        token_whitelist[token] = enabled;
    }

    function deposit(address token, uint256 amount) public {
        require(token != address(0), "Token is invalid");
        require(token_whitelist[token] == true, "Token is not enabled");
        require(amount > 0, "Amount is invalid");
        require(
            IBEP20(token).transferFrom(msg.sender, address(this), amount),
            "Unable to transfer specified amount of staking tokens"
        );

        LiquidityPool storage p = liquidity_pool[token];
        Stake storage st = user_stacked[token][msg.sender];

        p.total_stacked = p.total_stacked.add(amount);
        st.total_stacked = st.total_stacked.add(amount);
        add_missed_profit(st, amount.mul(p.prev_tps_amount).div(1e18));
        calc_available_reward(st, p.tps_amount);

        //Mint missed amount of lp-tokens
        uint256 lp_balance = lp_token.balanceOf(address(this));
        if (lp_balance < amount) {
            lp_token.mint(amount.sub(lp_balance));
        }
        lp_token.transfer(msg.sender, amount);
        emit Deposited(msg.sender, token, amount, amount);
    }

    function withdraw(address token, uint256 amount) public {
        require(token != address(0), "Token is invalid");
        require(token_whitelist[token] == true, "Token is not enabled");
        require(
            user_stacked[token][msg.sender].total_stacked >= amount &&
                amount > 0,
            "Amount is invalid"
        );
        require(
            lp_token.transferFrom(msg.sender, address(this), amount),
            "Unable to transfer specified amount of LP tokens"
        );
        require(
            IBEP20(token).transfer(msg.sender, amount),
            "Unable to transfer specified amount of staking tokens"
        );

        LiquidityPool storage p = liquidity_pool[token];
        Stake storage st = user_stacked[token][msg.sender];
        p.total_stacked = p.total_stacked.sub(amount);
        st.total_stacked = st.total_stacked.sub(amount);
        sub_missed_profit(st, amount.mul(p.prev_tps_amount).div(1e18));
        calc_available_reward(st, p.tps_amount);

        emit Withdrew(msg.sender, token, amount);
    }

    function add_profit(address token, uint256 amount) public {
        require(token_whitelist[token] == true, "Token is not enabled");
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

    function claim_reward(address token, uint256 amount) public {
        require(token_whitelist[token] == true, "Token is not enabled");
        Stake storage st = user_stacked[token][msg.sender];
        require(
            amount <= st.available_reward,
            "Amount should be less then available reward"
        );
        st.claimed_reward = st.claimed_reward.add(amount);
        calc_available_reward(st, liquidity_pool[token].tps_amount);
        emit Rewarded(msg.sender, token, amount);
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

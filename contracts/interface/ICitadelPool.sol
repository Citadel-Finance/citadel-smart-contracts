// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;
import "./IBEP20.sol";
import "./ILPToken.sol";

interface ICitadelPool {
    function get_token_whitelist(IBEP20 token) external view returns (ILPToken);

    function get_reversed_whitelist(ILPToken token) external view returns (IBEP20);

    function get_total_stacked(IBEP20 token) external view returns (uint256);

    function get_account_stacked(IBEP20 token) external view returns (uint256);

    function get_available_reward(IBEP20 token) external view returns (uint256);

    function update_whitelist(address token) external;

    function deposit(IBEP20 token, uint256 amount) external;

    function withdraw(IBEP20 token, uint256 amount) external;

    function add_profit(IBEP20 token, uint256 amount) external;

    function claim_reward(IBEP20 token, uint256 amount) external;

    function transfer_lp(address sender, address recipient, uint256 amount) external;
}

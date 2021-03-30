// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;
import "./IBEP20.sol";
import "./ILPToken.sol";

interface ICitadelPool {
    function tokenWhitelist(IBEP20 token) external view returns (ILPToken);

    function reversedWhitelist(ILPToken token) external view returns (IBEP20);

    function totalStacked(IBEP20 token) external view returns (uint256);

    function accountStacked(IBEP20 token) external view returns (uint256);

    function missedProfit(IBEP20 token) external view returns (uint256);

    function availableReward(IBEP20 token) external view returns (uint256);

    function updateWhitelist(IBEP20 token, bool enabled) external;

    function updateApeTax(uint256 ape_tax_) external;

    function deposit(IBEP20 token, uint256 amount) external;

    function withdraw(IBEP20 token, uint256 amount) external;

    function claimReward(IBEP20 token, uint256 amount) external;

    function transferLPtoken(address sender, address recipient, uint256 amount) external;

    function flashLoan(address receiver, IBEP20 token, uint256 amount, bytes calldata params) external;
}

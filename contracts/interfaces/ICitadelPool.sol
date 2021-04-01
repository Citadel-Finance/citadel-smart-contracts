// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;
import "./IBEP20.sol";
import "./ILPToken.sol";

interface ICitadelPool {
    function isPoolEnabled(IBEP20 token) external view returns (bool);

    function getLPToken(IBEP20 token) external view returns (ILPToken);

    function getTotalStacked(IBEP20 token) external view returns (uint256);

    function getDailyStacked(IBEP20 token) external view returns (bool, uint256);

    function getTotalProfit(IBEP20 token) external view returns (uint256);

    function getAccountStacked(IBEP20 token) external view returns (uint256);

    function getMissedProfit(IBEP20 token) external view returns (bool, uint256);

    function getAvailableReward(IBEP20 token) external view returns (uint256);

    function getClaimedReward(IBEP20 token) external view returns (uint256);

    function updateWhitelist(IBEP20 token, bool enabled) external;

    function updateApyTax(uint256 ape_tax_) external;

    function updateCTLtoken(IBEP20 token) external;

    function deposit(IBEP20 token, uint256 amount) external;

    function withdraw(IBEP20 token, uint256 amount) external;

    function claimReward(IBEP20 token, uint256 amount) external;

    function transferLPtoken(address sender, address recipient, uint256 amount) external;

    function flashLoan(address receiver, IBEP20 token, uint256 amount, bytes calldata params) external;
}

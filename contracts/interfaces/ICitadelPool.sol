// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;
import "./IBEP20.sol";
import "./ILPToken.sol";
import "../CTLToken.sol";

interface ICitadelPool {
    function dailyStaked() external view returns (bool, uint256);

    function availableReward(address user) external view returns (uint256);

    function availableCtl(address user) external view returns (uint256);

    function enable() external;

    function disable() external;

    function updateTokensPerBlock(uint256 tokensPerBlock_) external;

    function updateApyTax(uint256 apyTax_) external;

    function updatePremiumCoeff(uint256 premiumCoeff_) external;

    function deposit(uint256 amount) external;

    function withdraw(uint256 amount) external;

    function claimReward(uint256 amount) external;

    function claimCtl(uint256 amount) external;

    function flashLoan(
        address receiver,
        uint256 amount,
        uint256 premium,
        bytes calldata params
    ) external;

    /// @dev Event emitted when the depositor sends funds
    event Deposited(
        uint256 date,
        address indexed depositor,
        IBEP20 indexed token,
        uint256 amount
    );

    /// @dev Event emitted when the depositor received funds
    event Withdrew(
        uint256 date,
        address indexed receiver,
        IBEP20 indexed token,
        uint256 amount
    );

    /// @dev Event emitted when the depositor claimed rewards
    event Rewarded(uint256 date, address indexed borrower, IBEP20 indexed token, uint256 amount);

    /// @dev Event emitted when the borrower has borrowed and repaid funds
    event FlashLoan(
        uint256 date,
        address indexed user,
        address indexed receiver,
        uint256 amount,
        uint256 premium
    );
}

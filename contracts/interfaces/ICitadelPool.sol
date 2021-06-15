// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

interface ICitadelPool {

    function prevMintingBlock() external view returns (uint256);

    function tokensPerBlock() external view returns (uint256);

        /// @dev Event emitted when the depositor sends funds
    event Deposited(
        uint256 date,
        address indexed user,
        uint256 amount
    );

    /// @dev Event emitted when the depositor received funds
    event Withdrew(
        uint256 date,
        address indexed user,
        uint256 amount
    );

    /// @dev Event emitted when the depositor claimed rewards
    event Rewarded(
        uint256 date,
        address indexed user,
        uint256 amount
    );

    /// @dev Event emitted when the borrower has borrowed and repaid funds
    event FlashLoan(
        uint256 date,
        address indexed user,
        address indexed receiver,
        uint256 amount,
        uint256 premium
    );

    /// @dev Event emitted for diagram drawing
    event totalHistory(
        uint256 date,
        address indexed user,
        uint256 totalDeposited,
        uint256 totalBorrowed,
        uint256 totalProfit
    );

}

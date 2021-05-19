// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "../interfaces/IBEP20.sol";

interface IFlashLoanReceiver {
    function executeOperation(
        IBEP20 token,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}

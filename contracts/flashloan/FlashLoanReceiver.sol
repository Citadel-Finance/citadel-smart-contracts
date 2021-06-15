// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IFlashLoanReceiver.sol";

/** 
    !!!
    Never keep funds permanently on your FlashLoanReceiverBase contract as they could be 
    exposed to a 'griefing' attack, where the stored funds are used by an attacker.
    !!!
 */
contract FlashLoanReceiver is IFlashLoanReceiver {
    using SafeMath for uint256;

    address public immutable pool;

    constructor(address pool_) {
        pool = pool_;
    }

    /**
        This function is called after your contract has received the flash loaned amount
     */
    function executeOperation(
        IERC20 token,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) public override returns (bool) {
        //
        // This contract now has the funds requested.
        // Your logic goes here.
        //

        // At the end of your logic above, this contract owes
        // the flashloaned amounts + premiums.
        // Therefore ensure your contract has enough to repay
        // these amounts.

        // Approve the Pool contract allowance to *pull* the owed amount
        uint256 amountOwing = amount.add(premium);
        token.approve(address(pool), amountOwing);
        return true;
    }
}

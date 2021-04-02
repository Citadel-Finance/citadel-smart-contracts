// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../interfaces/IFlashLoanReceiver.sol";
import "../interfaces/ICitadelPool.sol";
import "../interfaces/IBEP20.sol";

/** 
    !!!
    Never keep funds permanently on your FlashLoanReceiverBase contract as they could be 
    exposed to a 'griefing' attack, where the stored funds are used by an attacker.
    !!!
 */
contract FlashLoanReceiver is IFlashLoanReceiver {
    using SafeMath for uint256;

    ICitadelPool public immutable pool;

    constructor(ICitadelPool pool_) {
        pool = pool_;
    }

    /**
        This function is called after your contract has received the flash loaned amount
     */
    function executeOperation(
        IBEP20 token,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
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

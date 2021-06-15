// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;

interface IBEP20 {
    /**
     * @dev Returns the name of the token
     * OPTIONAL - This method can be used to improve usability, but interfaces and other contracts MUST NOT expect these values to be present
     */
    function name() external view returns (string memory);

    /**
     * @dev Returns the symbol of the token. E.g. “HIX”.
     * This method can be used to improve usability
     * NOTE - This method is optional in EIP20. In BEP20, this is a required method.
     * Tokens which don’t implement this method will never flow across the Binance Chain and Binance Smart Chain
     */
    function symbol() external view returns (string memory);

    /**
     * @dev Returns the number of decimals the token uses - e.g. 8, means to divide the token amount by 100000000 to get its user representation.
     * This method can be used to improve usability
     * NOTE - This method is optional in EIP20. In BEP20, this is a required method.
     * Tokens which don’t implement this method will never flow across the Binance Chain and Binance Smart Chain.
     */
    function decimals() external view returns (uint256);

    /**
     * @dev Returns the bep20 token owner which is necessary for binding with bep2 token.
     * NOTE - This is an extended method of EIP20. 
     * Tokens which don’t implement this method will never flow across the Binance Chain and Binance Smart Chain.
     */
    function getOwner() external view returns (address);
}

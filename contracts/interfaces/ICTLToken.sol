// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;

interface ICTLToken {

    function mint() external returns (uint256);

    function stopMint() external returns (bool);

    function startMint() external returns (bool);

    function startBlock() external view returns(uint256);

}

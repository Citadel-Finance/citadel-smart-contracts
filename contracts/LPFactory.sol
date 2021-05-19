// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./interfaces/IBEP20.sol";
import "./LPToken.sol";

contract LPFactory is AccessControl {
    using Address for address;
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN");

    IBEP20 public ctlToken;

    constructor(IBEP20 ctlToken_) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        _setRoleAdmin(ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
        ctlToken = ctlToken_;
    }

    mapping(IBEP20 => LPToken) public pools;

    function addPool(
        IBEP20 token,
        uint256 startTime,
        uint256 apyTax,
        uint256 premium
    ) public {
        require(
            hasRole(ADMIN_ROLE, msg.sender),
            "LPFactory: Caller is not a admin"
        );
        require(
            address(token).isContract(),
            "LPFactory: Given address is not contract"
        );
        require(
            pools[token] == LPToken(0),
            "LPFactory: LP for this token already exist"
        );
        bytes32 salt = keccak256(abi.encodePacked(token));
        string memory name = string(abi.encodePacked("ct", token.name()));
        string memory symbol = string(abi.encodePacked("ct", token.symbol()));
        LPToken pool =
            new LPToken{salt: salt}(
                name,
                symbol,
                token.decimals(),
                token,
                ctlToken,
                startTime,
                apyTax,
                premium
            );
        pools[token] = pool;
        emit Created(token, pool);
    }

    function disablePool(IBEP20 token) public {
        require(
            hasRole(ADMIN_ROLE, msg.sender),
            "LPFactory: Caller is not a admin"
        );
        pools[token].disable();
    }

    function enablePool(IBEP20 token) public {
        require(
            hasRole(ADMIN_ROLE, msg.sender),
            "LPFactory: Caller is not a admin"
        );
        pools[token].enable();
    }

    /**
     * @notice Return true if outside BEP20 token is allowed for pool
     * @param token Address of BEP20 token
     */
    function isPoolEnabled(IBEP20 token) public view returns (bool) {
        return pools[token].enabled();
    }

    event Created(IBEP20 token, LPToken pool);
}

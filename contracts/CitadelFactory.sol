// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./interfaces/IBEP20.sol";
import "./CitadelPool.sol";
import "./CTLToken.sol";

contract CitadelFactory is AccessControl {
    using Address for address;

    struct PoolInfo {
        CitadelPool pool;
        IBEP20 token;
    }

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    CTLToken public ctlToken;
    mapping(IBEP20 => CitadelPool) public pools;
    PoolInfo[] _poolList;

    constructor(CTLToken ctlToken_) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        _setRoleAdmin(ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
        ctlToken = ctlToken_;
    }

    function addPool(
        IBEP20 token,
        uint256 startTime,
        uint256 tokensPerBlock,
        uint256 apyTax,
        uint256 premiumCoeff
    ) public {
        require(
            hasRole(ADMIN_ROLE, msg.sender),
            "CitadelFactory: Caller is not a admin"
        );
        require(
            pools[token] == CitadelPool(0),
            "CitadelFactory: LP for this token already exist"
        );
        require(
            address(token).isContract(),
            "CitadelFactory: Given address is not contract"
        );

        bytes32 salt = keccak256(abi.encodePacked(token));
        string memory name = string(abi.encodePacked("ct", token.name()));
        string memory symbol = string(abi.encodePacked("ct", token.symbol()));
        CitadelPool pool =
            new CitadelPool{salt: salt}(
                name,
                symbol,
                token.decimals(),
                token,
                ctlToken,
                startTime,
                apyTax,
                premiumCoeff,
                tokensPerBlock,
                msg.sender
            );
        pools[token] = pool;
        _poolList.push(PoolInfo({pool: pool, token: token}));
        ctlToken.grantRole(ctlToken.MINTER_ROLE(), address(pool));
        emit Created(token, pool);
    }

    function disablePool(IBEP20 token) public {
        require(
            hasRole(ADMIN_ROLE, msg.sender),
            "CitadelFactory: Caller is not a admin"
        );
        pools[token].disable();
    }

    function enablePool(IBEP20 token) public {
        require(
            hasRole(ADMIN_ROLE, msg.sender),
            "CitadelFactory: Caller is not a admin"
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

    /**
     * @notice Return all pools info
     */
    function allPools() public view returns (PoolInfo[] memory) {
        return _poolList;
    }

    event Created(IBEP20 token, CitadelPool pool);
}

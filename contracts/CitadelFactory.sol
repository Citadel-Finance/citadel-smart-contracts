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
    using SafeMath for uint256;

    struct Pools {
        CitadelPool pool;
        IBEP20 token;
    }

    struct PoolInfo {
        CitadelPool pool;
        IBEP20 token;
        bool enabled;
        uint256 availableReward;
        uint256 availableCtl;
        bool isAdmin;
    }

    struct RewardInfo {
        uint256 availableReward;
        uint256 availableCtl;
    }

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    CTLToken public ctlToken;
    mapping(IBEP20 => CitadelPool) public pools;
    Pools[] _poolList;

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
        uint256 premiumCoeff,
        bool enabled
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

        if(startTime==0) {
            startTime = block.timestamp;
        }

        bytes32 salt = keccak256(abi.encodePacked(token));
        CitadelPool pool =
            new CitadelPool{salt: salt}(
                token,
                ctlToken,
                startTime,
                apyTax,
                premiumCoeff,
                tokensPerBlock,
                msg.sender,
                enabled
            );
        pools[token] = pool;
        _poolList.push(Pools({pool: pool, token: token}));
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

    function isAdmin(address user) public view returns (bool) {
        return hasRole(ADMIN_ROLE, user);
    }

    /**
     * @notice Return all pools info
     */
    function allPools() public view returns (PoolInfo[] memory) {
        PoolInfo[] memory _poolInfo = new PoolInfo[](_poolList.length);
        for (uint256 i = 0; i < _poolList.length; i++) {
            _poolInfo[i] = PoolInfo({
                pool: _poolList[i].pool,
                token: _poolList[i].token,
                enabled: _poolList[i].pool.enabled(),
                availableReward: _poolList[i].pool.availableReward(msg.sender),
                availableCtl: _poolList[i].pool.availableCtl(msg.sender),
                isAdmin: _poolList[i].pool.hasRole(_poolList[i].pool.ADMIN_ROLE(), msg.sender)
            });
        }
        return _poolInfo;
    }

    function totalAvailableReward() public view returns (RewardInfo memory) {
        RewardInfo memory _rewardInfo;
        for (uint256 i = 0; i < _poolList.length; i++) {
            _rewardInfo.availableReward = _rewardInfo.availableReward.add(_poolList[i].pool.availableReward(msg.sender));
            _rewardInfo.availableCtl = _rewardInfo.availableCtl.add(_poolList[i].pool.availableCtl(msg.sender));
        }
        return _rewardInfo;
    }

    event Created(IBEP20 token, CitadelPool pool);
}

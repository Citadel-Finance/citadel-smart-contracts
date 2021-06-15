// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./CitadelPool.sol";

contract CitadelFactory is AccessControl {
    using Address for address;
    using SafeMath for uint256;

    struct PoolInfo {
        CitadelPool pool;
        address token;
        bool enabled;
    }

    struct PoolRewards {
        CitadelPool pool;
        uint256 decimals;
        string symbol;
        uint256 availableReward;
        uint256 availableCtl;
        bool isAdmin;
        bool isBorrower;
    }

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BORROWER_ROLE = keccak256("BORROWER_ROLE");

    /// @dev CTL-token address
    address public ctlToken;

    /// @dev
    mapping(address => CitadelPool) public pools;
    address[] _poolList;

    constructor(address ctlToken_) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        _setRoleAdmin(ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
        ctlToken = ctlToken_;
    }

    function addPool(
        address token,
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
            "CitadelFactory: Pool for this token already exist"
        );
        require(
            token.isContract(),
            "CitadelFactory: Given address is not contract"
        );

        bytes32 salt = keccak256(abi.encodePacked(token));
        CitadelPool pool =
            new CitadelPool{salt: salt}(
                token,
                ctlToken,
                apyTax,
                premiumCoeff,
                tokensPerBlock,
                msg.sender,
                enabled
            );
        pools[token] = pool;
        _poolList.push(token);
        AccessControl(ctlToken).grantRole(MINTER_ROLE, address(pool));
        emit Created(token, pool);
    }

    function disablePool(address token) public {
        require(
            hasRole(ADMIN_ROLE, msg.sender),
            "CitadelFactory: Caller is not a admin"
        );
        pools[token].disable();
    }

    function enablePool(address token) public {
        require(
            hasRole(ADMIN_ROLE, msg.sender),
            "CitadelFactory: Caller is not a admin"
        );
        pools[token].enable();
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
                pool: pools[_poolList[i]],
                token: _poolList[i],
                enabled: pools[_poolList[i]].enabled()
            });
        }
        return _poolInfo;
    }

    function poolsAvailableReward(address user)
        public
        view
        returns (PoolRewards[] memory)
    {
        PoolRewards[] memory _poolRewards = new PoolRewards[](_poolList.length);
        for (uint256 i = 0; i < _poolList.length; i++) {
            _poolRewards[i] = PoolRewards({
                pool: pools[_poolList[i]],
                decimals: pools[_poolList[i]].decimals(),
                symbol: pools[_poolList[i]].symbol(),
                availableReward: pools[_poolList[i]].availableReward(user),
                availableCtl: pools[_poolList[i]].availableCtl(user),
                isAdmin: pools[_poolList[i]].hasRole(ADMIN_ROLE, user),
                isBorrower: pools[_poolList[i]].hasRole(BORROWER_ROLE, user)
            });
        }
        return _poolRewards;
    }

    function totalAvailableReward(address user) public view returns (uint256) {
        uint256 availableCtl;
        for (uint256 i = 0; i < _poolList.length; i++) {
            availableCtl = availableCtl.add(
                pools[_poolList[i]].availableCtl(user)
            );
        }
        return availableCtl;
    }

    function claimAllRewards() public {
        for (uint256 i = 0; i < _poolList.length; i++) {
            pools[_poolList[i]].claimRewards(msg.sender);
            pools[_poolList[i]].claimCtl(msg.sender);
        }
    }

    event Created(address token, CitadelPool pool);
}

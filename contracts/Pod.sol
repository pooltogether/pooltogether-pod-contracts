pragma solidity ^0.5.12;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/introspection/IERC1820Registry.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/IERC777Recipient.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/ERC777.sol";
import "@kleros/kleros/contracts/data-structures/SortitionSumTreeFactory.sol";
import "@pooltogether/pooltogether-contracts/contracts/UniformRandomNumber.sol";
import "@pooltogether/pooltogether-contracts/contracts/MCDAwarePool.sol";
import "./BalanceManager.sol";

/**
 * Exchange rate == tokens / collateral.  So Given collateral Y the tokens = rate * collateral
 * Determining the underlying collateral given tokens would be tokens / rate
 */
contract Pod is ERC777, BalanceManager, IERC777Recipient {
  uint256 internal constant BASE_EXCHANGE_RATE_MANTISSA = 1e24;

  // keccak256("ERC777TokensRecipient")
  bytes32 constant internal TOKENS_RECIPIENT_INTERFACE_HASH =
      0xb281fc8c12954d22544db45de3159a39272895b169a852b314f9cc762e44c53b;

  IERC1820Registry constant internal ERC1820_REGISTRY = IERC1820Registry(0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24);

  /**
   * Event emitted when a user or operator redeems tokens
   */
  event Redeemed(address indexed operator, address indexed from, uint256 amount, bytes data, bytes operatorData);

  MCDAwarePool public pool;

  function initialize(
    MCDAwarePool _pool
  ) public initializer {
    require(address(_pool) != address(0), "Pod/pool-def");
    initializeBalanceManager(BASE_EXCHANGE_RATE_MANTISSA);
    pool = _pool;
    ERC1820_REGISTRY.setInterfaceImplementer(address(this), TOKENS_RECIPIENT_INTERFACE_HASH, address(this));
  }

  function tokensReceived(
    address, // operator
    address from,
    address, // to address can't be anything but us because we don't implement ERC1820ImplementerInterface
    uint256 amount,
    bytes calldata,
    bytes calldata
  ) external {
    // if this is a transfer from the pool
    if (msg.sender == address(pool.poolToken())) {
      depositCollateralInstant(from, amount, pool.currentOpenDrawId());
    }
  }

  function balanceOfUnderlying(address user) public view returns (uint256) {
    return balanceOfUnderlying(user, pool.currentOpenDrawId());
  }

  /**
    * @dev See {IERC777-operatorBurn}.
    *
    * This contract does not support burning.  Redeem must be called.
    */
  function operatorBurn(address, uint256, bytes memory, bytes memory) public {
    revert("Pod/no-op");
  }

  /**
    * @dev See {IERC777-burn}.
    *
    * This contract does not support burning.  Redeem must be called.
    */
  function burn(uint256, bytes memory) public {
    revert("Pod/no-op");
  }

  /**
    */
  function operatorRedeem(address account, uint256 amount, bytes calldata data, bytes calldata operatorData) external {
    require(isOperatorFor(msg.sender, account), "Pod/not-op");
    _redeem(msg.sender, account, amount, data, operatorData);
  }

  function redeem(uint256 amount, bytes calldata data) external {
    _redeem(msg.sender, msg.sender, amount, data, "");
  }

  // upon reward, batch mint tokens.
  function rewarded(uint256, uint256) public {
    collateralChanged(pool.committedBalanceOf(address(this)) - pendingCollateralSupply, pool.currentOpenDrawId());
  }

  /**
    * @dev Redeems tokens for the underlying asset.
    * @param operator address operator requesting the operation
    * @param from address token holder address
    * @param amount uint256 amount of tokens to redeem
    * @param data bytes extra information provided by the token holder
    * @param operatorData bytes extra information provided by the operator (if any)
    */
  function _redeem(
      address operator,
      address from,
      uint256 amount,
      bytes memory data,
      bytes memory operatorData
  )
      private
  {
      consolidateSupply(pool.currentOpenDrawId());
      consolidateBalanceOf(from, pool.currentOpenDrawId());
      uint256 poolTokens = underlyingValue(amount);
      pool.withdrawCommittedDeposit(poolTokens);
      pool.token().transfer(from, poolTokens);

      emit Redeemed(operator, from, amount, data, operatorData);

      _burn(operator, from, amount, data, operatorData);
  }

  function consolidatedSupply() internal view returns (uint256) {
    return ERC777.totalSupply();
  }

  function consolidatedBalanceOf(address a) internal view returns (uint256) {
    return ERC777.balanceOf(a);
  }

  function _mintTo(address addr, uint256 tokens) internal {
    _mint(address(this), addr, tokens, "", "");
  }

  function _transferTo(address from, address to, uint256 amount) internal {
    _send(
      address(this),
      from,
      to,
      amount,
      "",
      "",
      true
    );
  }

  modifier onlyPoolToken() {
    require(msg.sender == address(pool.poolToken()), "Pod/only-pool-token");
    _;
  }
}
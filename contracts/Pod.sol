pragma solidity ^0.5.12;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/introspection/IERC1820Registry.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/IERC777Recipient.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/ERC777.sol";
import "@kleros/kleros/contracts/data-structures/SortitionSumTreeFactory.sol";
import "@pooltogether/pooltogether-contracts/contracts/UniformRandomNumber.sol";
import "@pooltogether/pooltogether-contracts/contracts/MCDAwarePool.sol";
import "@pooltogether/pooltogether-contracts/contracts/IRewardListener.sol";

import "./ScheduledBalance.sol";
import "./ExchangeRateTracker.sol";

/**
 * Exchange rate == tokens / collateral.  So Given collateral Y the tokens = rate * collateral
 * Determining the underlying collateral given tokens would be tokens / rate
 */
contract Pod is ERC777, IERC777Recipient, IRewardListener {
  using ScheduledBalance for ScheduledBalance.State;

  using ExchangeRateTracker for ExchangeRateTracker.State;

  uint256 internal constant BASE_EXCHANGE_RATE_MANTISSA = 1e24;

  // keccak256("PoolTogetherRewardListener")
  bytes32 constant internal REWARD_LISTENER_INTERFACE_HASH =
      0x68f03b0b1a978ee238a70b362091d993343460bc1a2830ab3f708936d9f564a4;

  // keccak256("ERC777TokensRecipient")
  bytes32 constant internal TOKENS_RECIPIENT_INTERFACE_HASH =
      0xb281fc8c12954d22544db45de3159a39272895b169a852b314f9cc762e44c53b;

  IERC1820Registry constant internal ERC1820_REGISTRY = IERC1820Registry(0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24);

  /**
   * Event emitted when a user or operator redeems tokens to the backing collateral
   */
  event Redeemed(address indexed operator, address indexed from, uint256 amount, uint256 collateral, bytes data, bytes operatorData);

  /**
   * Event emitted when a user or operator redeems tokens to the backing collateral
   */
  event RedeemedToPool(address indexed operator, address indexed from, uint256 amount, uint256 collateral, bytes data, bytes operatorData);

  event CollateralizationChanged(uint256 indexed timestamp, uint256 tokens, uint256 collateral, uint256 mantissa);

  event Deposited(address indexed operator, address indexed from, uint256 collateral, bytes data, bytes operatorData);

  ScheduledBalance.State internal scheduledSupply;
  mapping(address => ScheduledBalance.State) internal scheduledBalances;
  ExchangeRateTracker.State internal exchangeRateTracker;
  MCDAwarePool public pool;

  function initialize(
    MCDAwarePool _pool
  ) public initializer {
    require(address(_pool) != address(0), "Pod/pool-def");
    exchangeRateTracker.initialize(BASE_EXCHANGE_RATE_MANTISSA);
    pool = _pool;
    ERC1820_REGISTRY.setInterfaceImplementer(address(this), TOKENS_RECIPIENT_INTERFACE_HASH, address(this));
    ERC1820_REGISTRY.setInterfaceImplementer(address(this), REWARD_LISTENER_INTERFACE_HASH, address(this));
  }

  function operatorDeposit(address user, uint256 amount) external {
    _deposit(msg.sender, user, amount);
  }

  function deposit(uint256 amount) external {
    _deposit(msg.sender, msg.sender, amount);
  }

  function _deposit(
    address operator,
    address from,
    uint256 amount
  ) internal {
    consolidateBalanceOf(from);
    pool.token().transferFrom(operator, address(this), amount);
    pool.token().approve(address(pool), amount);
    pool.depositPool(amount);
    uint256 openDrawId = pool.currentOpenDrawId();
    scheduledSupply.deposit(amount, openDrawId);
    scheduledBalances[from].deposit(amount, openDrawId);
    emit Deposited(operator, operator, amount, "", "");
  }

  function tokensReceived(
    address operator, // operator
    address from,
    address, // to address can't be anything but us because we don't implement ERC1820ImplementerInterface
    uint256 amount,
    bytes calldata,
    bytes calldata
  ) external {
    // if this is a transfer of pool tickets
    if (msg.sender == address(pool.poolToken())) {
      // convert to shares
      consolidateBalanceOf(from);
      uint256 tokens = exchangeRateTracker.collateralToTokenValue(amount);
      _mint(address(this), from, tokens, "", "");
    } else {
      // The only other allowed tokens are ones we operate
      require(operator == address(this), "Pod/unknown-token");
    }
  }

  function balanceOfUnderlying(address user) public view returns (uint256) {
    return exchangeRateTracker.tokenToCollateralValue(balanceOf(user));
  }

  function balanceOf(address tokenHolder) public view returns (uint256) {
    (uint256 balance, uint256 drawId) = scheduledBalances[tokenHolder].consolidatedBalanceInfo(pool.currentOpenDrawId());
    return super.balanceOf(tokenHolder).add(
      exchangeRateTracker.collateralToTokenValue(
        balance,
        drawId
      )
    );
  }

  function pendingDeposit(address user) public view returns (uint256) {
    return scheduledBalances[user].unconsolidatedBalance(pool.currentOpenDrawId());
  }

  function totalSupply() public view returns (uint256) {
    (uint256 balance, uint256 drawId) = scheduledSupply.consolidatedBalanceInfo(pool.currentOpenDrawId());
    return super.totalSupply().add(
      exchangeRateTracker.collateralToTokenValue(
        balance,
        drawId
      )
    );
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

  // upon reward, batch mint tokens.
  function rewarded(address, uint256 winnings, uint256 drawId) external {
    require(msg.sender == address(pool), "Pod/only-pool");
    uint256 tokens = totalSupply();
    uint256 collateral = exchangeRateTracker.tokenToCollateralValue(tokens).add(winnings);
    if (tokens > 0) {
      uint256 mantissa = exchangeRateTracker.collateralizationChanged(tokens, collateral, drawId.add(1));
      emit CollateralizationChanged(drawId, tokens, collateral, mantissa);
    }
  }

  function currentExchangeRateMantissa() external view returns (uint256) {
    return exchangeRateTracker.currentExchangeRateMantissa();
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
      internal
  {
      consolidateBalanceOf(from);
      uint256 collateral = exchangeRateTracker.tokenToCollateralValue(amount);
      pool.withdrawCommittedDeposit(collateral);
      pool.token().transfer(from, collateral);
      emit Redeemed(operator, from, amount, collateral, data, operatorData);
      _burn(operator, from, amount, data, operatorData);
  }

  function operatorRedeemToPool(address account, uint256 amount, bytes calldata data, bytes calldata operatorData) external {
    require(isOperatorFor(msg.sender, account), "Pod/not-op");
    _redeemToPool(msg.sender, account, amount, data, operatorData);
  }

  function redeemToPool(uint256 amount, bytes calldata data) external {
    _redeemToPool(msg.sender, msg.sender, amount, data, "");
  }

  function _redeemToPool(
    address operator,
    address from,
    uint256 amount,
    bytes memory data,
    bytes memory operatorData
  ) internal {
    consolidateBalanceOf(from);
    uint256 collateral = exchangeRateTracker.tokenToCollateralValue(amount);
    pool.poolToken().transfer(from, collateral);
    emit RedeemedToPool(operator, from, amount, collateral, data, operatorData);
    _burn(operator, from, amount, data, operatorData);
  }

  function consolidateSupply() internal {
    uint256 openDrawId = pool.currentOpenDrawId();
    (uint256 balance, uint256 drawId) = scheduledSupply.consolidatedBalanceInfo(openDrawId);
    uint256 tokens = exchangeRateTracker.collateralToTokenValue(balance, drawId);
    if (tokens > 0) {
      scheduledSupply.clearConsolidated(openDrawId);
      _mint(address(this), address(this), tokens, "", "");
    }
  }

  function consolidateBalanceOf(address user) internal {
    consolidateSupply();
    uint256 openDrawId = pool.currentOpenDrawId();
    (uint256 balance, uint256 drawId) = scheduledBalances[user].consolidatedBalanceInfo(openDrawId);
    uint256 tokens = exchangeRateTracker.collateralToTokenValue(balance, drawId);
    if (tokens > 0) {
      scheduledBalances[user].clearConsolidated(openDrawId);
      _send(address(this), address(this), user, tokens, "", "", true);
    }
  }
}

pragma solidity ^0.5.12;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/introspection/IERC1820Registry.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/IERC777Recipient.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/ERC777.sol";
import "@kleros/kleros/contracts/data-structures/SortitionSumTreeFactory.sol";
import "@pooltogether/pooltogether-contracts/contracts/UniformRandomNumber.sol";
import "@pooltogether/pooltogether-contracts/contracts/MCDAwarePool.sol";
import "./FixedPoint.sol";

/**
 * Exchange rate == tokens / collateral.  So Given collateral Y the tokens = rate * collateral
 * Determining the underlying collateral given tokens would be tokens / rate
 */
contract Pod is ERC777, FixedPoint, IERC777Recipient {
  using SortitionSumTreeFactory for SortitionSumTreeFactory.SortitionSumTrees;

  uint256 internal constant BASE_EXCHANGE_RATE_MANTISSA = 1e24;

  // keccak256("ERC777TokensRecipient")
  bytes32 constant internal TOKENS_RECIPIENT_INTERFACE_HASH =
      0xb281fc8c12954d22544db45de3159a39272895b169a852b314f9cc762e44c53b;

  // keccak256("PoolTogether.Pod.Balances")
  bytes32 constant internal USER_BALANCES_TREE_KEY =
    0xe87f5959295843da84ea16aab2e10c52ce215bac03ee37185b919b28a5d93e7b;

  uint256 constant internal NODES_PER_BRANCH = 10;

  /**
   * Event emitted when a user or operator redeems tokens
   */
  event Redeemed(address indexed operator, address indexed from, uint256 amount, bytes data, bytes operatorData);

  MCDAwarePool public pool;
  SortitionSumTreeFactory.SortitionSumTrees sumTrees;

  function initialize(
    MCDAwarePool _pool
  ) public initializer {
    require(address(_pool) != address(0), "Pod/pool-def");
    pool = _pool;
    _erc1820.setInterfaceImplementer(address(this), TOKENS_RECIPIENT_INTERFACE_HASH, address(this));
    sumTrees.createTree(USER_BALANCES_TREE_KEY, NODES_PER_BRANCH);
  }

  function tokensReceived(
    address, // operator
    address from,
    address, // to address can't be anything but us because we don't implement ERC1820ImplementerInterface
    uint256 amount,
    bytes calldata,
    bytes calldata
  ) external onlyPoolToken {
    Fixed18 memory rate = _exchangeRateLessCollateral(amount);
    uint256 tokens = multiplyUint(rate, amount);
    _mint(address(this), from, tokens, "", "");
  }

  function balanceOfUnderlying(address user) public view returns (uint256) {
    return _underlyingValue(balanceOf(user));
  }

  function exchangeRate() public view returns (uint256) {
    return _exchangeRate().mantissa;
  }

  function _exchangeRate() internal view returns (Fixed18 memory) {
    return _exchangeRateLessCollateral(0);
  }

  function _exchangeRateLessCollateral(uint256 amount) internal view returns (Fixed18 memory) {
    Fixed18 memory rate;
    uint256 supply = totalSupply();
    if (supply == 0) {
      rate = newFixed(BASE_EXCHANGE_RATE_MANTISSA);
    } else {
      uint256 totalCollateral = pool.committedBalanceOf(address(this));
      if (amount != 0) {
        totalCollateral = totalCollateral.sub(amount);
      }
      rate = newFixed(supply, totalCollateral);
    }
    return rate;
  }

  function _underlyingValue(uint256 tokens) internal view returns (uint256) {
    return divideUintByFixed(tokens, _exchangeRate());
  }

  /**
    * @dev See {IERC777-operatorBurn}.
    *
    * This contract does not support burning.  Redeem must be called.
    */
  function operatorBurn(address, uint256, bytes calldata, bytes calldata) external {
    revert("Pod/no-op");
  }

  /**
    * @dev See {IERC777-burn}.
    *
    * This contract does not support burning.  Redeem must be called.
    */
  function burn(uint256, bytes calldata) external {
    revert("Pod/no-op");
  }

  /**
    */
  function operatorRedeem(address account, uint256 amount, bytes calldata data, bytes calldata operatorData) external {
    require(isOperatorFor(msg.sender, account), "Pod/not-op");
    _redeem(msg.sender, account, amount, data, operatorData);
  }

  /**
    */
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
      private
  {
      require(from != address(0), "Pod/from-zero");

      _callTokensToSend(operator, from, address(0), amount, data, operatorData);

      uint256 poolTokens = _underlyingValue(amount);

      // Update state variables
      _subBalance(from, amount, "ERC777: redeem amount exceeds balance");

      pool.withdrawCommittedDeposit(poolTokens);
      pool.token().transfer(from, poolTokens);

      emit Redeemed(operator, from, amount, data, operatorData);
      emit Transfer(from, address(0), amount);
  }

  /**
    * @dev Returns the amount of tokens owned by an account (`tokenHolder`).
    */
  function balanceOf(address tokenHolder) public view returns (uint256) {
    bytes32 key = bytes32(uint256(tokenHolder));
    return sumTrees.stakeOf(USER_BALANCES_TREE_KEY, key);
  }

  function _addBalance(address account, uint256 amount) internal {
    bytes32 key = bytes32(uint256(account));
    uint256 balance = sumTrees.stakeOf(USER_BALANCES_TREE_KEY, key);
    balance = balance.add(amount);
    sumTrees.set(USER_BALANCES_TREE_KEY, balance, key);
  }

  function _subBalance(address account, uint256 amount, string memory message) internal {
    bytes32 key = bytes32(uint256(account));
    uint256 balance = sumTrees.stakeOf(USER_BALANCES_TREE_KEY, key);
    balance = balance.sub(amount, message);
    sumTrees.set(USER_BALANCES_TREE_KEY, balance, key);
  }

  /**
    * @notice Selects an address by indexing into the committed tokens using the passed token.
    * If there is no committed supply, the zero address is returned.
    * @param _token The token index to select
    * @return The selected address
    */
  function draw(uint256 _token) public view returns (address) {
    // If there is no one to select, just return the zero address
    if (totalSupply() == 0) {
        return address(0);
    }
    require(_token < totalSupply(), "Pool/ineligible");
    bytes32 account = sumTrees.draw(USER_BALANCES_TREE_KEY, _token);
    return address(uint256(account));
  }

  /**
    * @notice Selects an address using the entropy as an index into the committed tokens
    * The entropy is passed into the UniformRandomNumber library to remove modulo bias.
    * @param _entropy The random entropy to use
    * @return The selected address
    */
  function drawWithEntropy(bytes32 _entropy) public view returns (address) {
    uint256 bound = totalSupply();
    address selected;
    if (bound == 0) {
        selected = address(0);
    } else {
        selected = draw(UniformRandomNumber.uniform(uint256(_entropy), bound));
    }
    return selected;
  }

  /**
    * @dev See {IERC777-totalSupply}.
    */
  function totalSupply() public view returns (uint256) {
    return sumTrees.total(USER_BALANCES_TREE_KEY);
  }

  function _mintSupply(uint256) internal {}

  modifier onlyPoolToken() {
    require(msg.sender == address(pool.poolToken()), "Pod/only-pool-token");
    _;
  }
}
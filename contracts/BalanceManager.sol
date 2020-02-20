pragma solidity ^0.5.12;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "./FixedPoint.sol";
import "./DrawExchangeRates.sol";

contract BalanceManager is Initializable, FixedPoint {
  using DrawExchangeRates for DrawExchangeRates.DrawExchangeRate[];
  using SafeMath for uint256;

  mapping(address => uint256) public pendingCollateralBalances;
  mapping(address => uint256) public pendingCollateralDrawIds;

  uint256 public pendingCollateralSupply;
  uint256 public pendingDrawId;

  DrawExchangeRates.DrawExchangeRate[] exchangeRates;

  event CollateralChanged(uint256 indexed openDrawId, uint256 collateral, uint256 tokenSupply, uint256 exchangeRateMantissa);

  function initializeBalanceManager(uint256 baseExchangeRateMantissa) public initializer {
    exchangeRates.push(DrawExchangeRates.DrawExchangeRate(0, newFixed(baseExchangeRateMantissa)));
  }

  function depositCollateral(address user, uint256 collateral, uint256 openDrawId) public {
    require(openDrawId >= pendingDrawId, "BalanceManager/later-draw");
    consolidateSupply(openDrawId);
    consolidateBalanceOf(user, openDrawId);

    pendingCollateralBalances[user] = pendingCollateralBalances[user].add(collateral);
    if (pendingCollateralDrawIds[user] != openDrawId) {
      pendingCollateralDrawIds[user] = openDrawId;
    }

    pendingCollateralSupply = pendingCollateralSupply.add(collateral);
    if (pendingDrawId != openDrawId) {
      pendingDrawId = openDrawId;
    }
  }

  function depositCollateralInstant(address user, uint256 collateral, uint256 openDrawId) public {
    require(openDrawId >= pendingDrawId, "BalanceManager/later-draw");
    consolidateSupply(openDrawId);
    consolidateBalanceOf(user, openDrawId);
    uint256 tokens = multiplyUint(currentExchangeRate(), collateral);
    _mintTo(user, tokens);
  }

  // When collateral changes, we need to recompute the exchange rate
  function collateralChanged(uint256 collateral, uint256 openDrawId) public {
    require(openDrawId >= pendingDrawId, "BalanceManager/later-draw");

    // consolidated any collateralChanged draw collateral
    consolidateSupply(openDrawId);

    uint256 tokens = totalSupply(openDrawId);

    Fixed18 memory rate;
    if (tokens > 0) {
      // Calculate the new exchange rate
      rate = newFixed(tokens, collateral);
      exchangeRates.push(DrawExchangeRates.DrawExchangeRate(openDrawId, rate));
    } else {
      rate = currentExchangeRate();
    }

    emit CollateralChanged(openDrawId, collateral, tokens, rate.mantissa);
  }

  function unconsolidatedBalanceOf(address user, uint256 openDrawId) public view returns (uint256) {
    uint256 amount = pendingCollateralBalances[user];
    uint256 drawId = pendingCollateralDrawIds[user];
    uint256 balance = 0;
    if (drawId > 0 && drawId < openDrawId) {
      uint256 exchangeRateIndex = findExchangeRateIndex(drawId);
      DrawExchangeRates.DrawExchangeRate storage rate = exchangeRates[exchangeRateIndex];
      balance = multiplyUint(rate.exchangeRate, amount);
    }
    return balance;
  }

  function unconsolidatedSupply(uint256 openDrawId) public view returns (uint256) {
    uint256 supply = 0;
    if (pendingDrawId < openDrawId) {
      supply = multiplyUint(currentExchangeRate(), pendingCollateralSupply);
    }
    return supply;
  }

  /**
    * @dev Returns the amount of tokens owned by an account (`tokenHolder`).
    */
  function balanceOf(address tokenHolder, uint256 openDrawId) public view returns (uint256) {
    return consolidatedBalanceOf(tokenHolder) + unconsolidatedBalanceOf(tokenHolder, openDrawId);
  }

  function balanceOfUnderlying(address user, uint256 openDrawId) public view returns (uint256) {
    return underlyingValue(balanceOf(user, openDrawId));
  }

  function underlyingValue(uint256 tokens) public view returns (uint256) {
    return divideUintByFixed(tokens, currentExchangeRate());
  }

  function totalSupply(uint256 openDrawId) public view returns (uint256) {
    return consolidatedSupply() + unconsolidatedSupply(openDrawId);
  }

  function currentExchangeRateMantissa() public view returns (uint256) {
    return exchangeRates[exchangeRates.length - 1].exchangeRate.mantissa;
  }

  function currentExchangeRate() internal view returns (Fixed18 storage) {
    return exchangeRates[exchangeRates.length - 1].exchangeRate;
  }

  function findExchangeRateIndex(uint256 drawId) internal view returns (uint256) {
    return exchangeRates.search(drawId);
  }

  function consolidateBalanceOf(address user, uint256 openDrawId) internal {
    uint256 amount = pendingCollateralBalances[user];
    uint256 drawId = pendingCollateralDrawIds[user];
    // if the draw has been committed, then convert using the rate and tokenize
    if (drawId > 0 && drawId < openDrawId) {
      uint256 exchangeRateIndex = findExchangeRateIndex(drawId);
      DrawExchangeRates.DrawExchangeRate storage rate = exchangeRates[exchangeRateIndex];
      uint256 tokens = multiplyUint(rate.exchangeRate, amount);
      _transferTo(address(this), user, tokens);
      delete pendingCollateralBalances[user];
      delete pendingCollateralDrawIds[user];
    }
  }

  function consolidateSupply(uint256 openDrawId) internal {
    if (pendingDrawId < openDrawId) {
      uint256 tokens = multiplyUint(currentExchangeRate(), pendingCollateralSupply);
      // Update state variables
      _mintTo(address(this), tokens);
      pendingDrawId = 0;
      pendingCollateralSupply = 0;
    }
  }

  function consolidatedSupply() internal view returns (uint256);
  function consolidatedBalanceOf(address a) internal view returns (uint256);
  function _mintTo(address addr, uint256 tokens) internal;
  function _transferTo(address from, address to, uint256 amount) internal;
}
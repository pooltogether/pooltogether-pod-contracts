pragma solidity ^0.5.12;

import "./FixedPoint.sol";

library ExchangeRateTracker {
  struct ExchangeRate {
    uint256 timestamp;
    FixedPoint.Fixed18 exchangeRate;
  }

  struct State {
    ExchangeRate[] exchangeRates;
  }

  function initialize(State storage self, uint256 baseExchangeRateMantissa) internal {
    self.exchangeRates.length = 0;
    self.exchangeRates.push(ExchangeRate(0, FixedPoint.Fixed18(baseExchangeRateMantissa)));
  }

  // When collateral changes, we need to recompute the exchange rate
  function collateralizationChanged(State storage self, uint256 tokens, uint256 collateral, uint256 timestamp) internal returns (uint256) {
    // Calculate the new exchange rate
    FixedPoint.Fixed18 memory rate = FixedPoint.Fixed18(FixedPoint.calculateMantissa(tokens, collateral));
    self.exchangeRates.push(ExchangeRate(timestamp, rate));
    return rate.mantissa;
  }

  function tokenToCollateralValue(State storage self, uint256 tokens) internal view returns (uint256) {
    return FixedPoint.divideUintByFixed(tokens, currentExchangeRate(self));
  }

  function collateralToTokenValue(State storage self, uint256 collateral) internal view returns (uint256) {
    return FixedPoint.multiplyUint(currentExchangeRate(self), collateral);
  }

  function tokenToCollateralValue(State storage self, uint256 tokens, uint256 timestamp) internal view returns (uint256) {
    uint256 exchangeRateIndex = search(self, timestamp);
    return FixedPoint.divideUintByFixed(tokens, self.exchangeRates[exchangeRateIndex].exchangeRate);
  }

  function collateralToTokenValue(State storage self, uint256 collateral, uint256 timestamp) internal view returns (uint256) {
    uint256 exchangeRateIndex = search(self, timestamp);
    return FixedPoint.multiplyUint(self.exchangeRates[exchangeRateIndex].exchangeRate, collateral);
  }

  function currentExchangeRateMantissa(State storage self) internal view returns (uint256) {
    return self.exchangeRates[self.exchangeRates.length - 1].exchangeRate.mantissa;
  }

  function currentExchangeRate(State storage self) internal view returns (FixedPoint.Fixed18 storage) {
    return self.exchangeRates[self.exchangeRates.length - 1].exchangeRate;
  }

  function search(State storage self, uint256 drawId) internal view returns (uint256) {
    require(self.exchangeRates.length > 0, "ExchangeRates/empty");
    require(drawId >= self.exchangeRates[0].timestamp, "ExchangeRates/bounds");

    uint256 lowerBound = 0;
    uint256 upperBound = self.exchangeRates.length;

    while (lowerBound < upperBound - 1) {
        uint256 midPoint = lowerBound + (upperBound - lowerBound) / 2;

        if (drawId < self.exchangeRates[midPoint].timestamp) {
          upperBound = midPoint;
        } else {
          lowerBound = midPoint;
        }
    }

    return upperBound - 1;
  }
}
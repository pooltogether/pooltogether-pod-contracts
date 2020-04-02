/**
Copyright 2020 PoolTogether Inc.

This file is part of PoolTogether.

PoolTogether is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation under version 3 of the License.

PoolTogether is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with PoolTogether.  If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity 0.5.12;

import "./FixedPoint.sol";

/**
 * @author Brendan Asselstine
 * @notice Tracks exchange rate history for a token and its backing collateral.
 *
 * Users can query the historic exchange rate using a timestamp in O(log(n)) time.
 */
library ExchangeRateTracker {

  /**
   * The struct for a single exchange rate in time
   */
  struct ExchangeRate {
    uint256 timestamp;
    FixedPoint.Fixed18 exchangeRate;
  }

  /**
   * The struct that contains the complete history of rates.  This library should be attached to this struct.
   */
  struct State {
    ExchangeRate[] exchangeRates;
  }

  /**
   * Initializes the data structure.
   *
   * @param self The State struct
   * @param baseExchangeRateMantissa The starting exchange rate for the token
   */
  function initialize(State storage self, uint256 baseExchangeRateMantissa) internal {
    require(baseExchangeRateMantissa > 0, "ExchangeRateTracker/non-zero");
    require(self.exchangeRates.length == 0, "ExchangeRateTracker/init-prev");
    self.exchangeRates.push(ExchangeRate(0, FixedPoint.Fixed18(baseExchangeRateMantissa)));
  }

  /**
   * Add a new exchange rate to the history.
   *
   * The exchange rate is added by declaring the token supply, amount of collateral and timestamp.
   * The timestamp must be strictly greater than or equal to the last timestamp to ensure correct ordering.
   *
   * @param self The State struct
   * @param tokens The new token supply
   * @param collateral The amount of backing collateral
   * @param timestamp The time at which the change occurred
   * @return The new exchange rate mantissa
   */
  function collateralizationChanged(
    State storage self,
    uint256 tokens,
    uint256 collateral,
    uint256 timestamp
  ) internal returns (uint256) {
    wasInitialized(self);
    require(self.exchangeRates[self.exchangeRates.length - 1].timestamp <= timestamp, "ExchangeRateTracker/too-early");
    FixedPoint.Fixed18 memory rate = FixedPoint.Fixed18(FixedPoint.calculateMantissa(tokens, collateral));
    self.exchangeRates.push(ExchangeRate(timestamp, rate));
    return rate.mantissa;
  }

  /**
   * Calculates the current collateral value of the given token amount.
   *
   * @param self The State struct
   * @param tokens The token amount
   * @return The collateral value of the tokens
   */
  function tokenToCollateralValue(State storage self, uint256 tokens) internal view returns (uint256) {
    return FixedPoint.divideUintByFixed(tokens, currentExchangeRate(self));
  }

  /**
   * Calculates the current token value of the given collateral amount
   *
   * @param self The State struct
   * @param collateral The collateral amount
   * @return The token value of the collateral
   */
  function collateralToTokenValue(State storage self, uint256 collateral) internal view returns (uint256) {
    return FixedPoint.multiplyUint(currentExchangeRate(self), collateral);
  }

  /**
   * Calculates the collateral value of the given token amount at the specified timestamp.
   *
   * @param self The State struct
   * @param tokens The token amount
   * @param timestamp The timestamp of the rate to use for conversion
   * @return The collateral value of the given tokens at the given timestamp
   */
  function tokenToCollateralValueAt(State storage self, uint256 tokens, uint256 timestamp) internal view returns (uint256) {
    uint256 exchangeRateIndex = search(self, timestamp);
    return FixedPoint.divideUintByFixed(tokens, self.exchangeRates[exchangeRateIndex].exchangeRate);
  }

  /**
   * Calculates the token value of the given collateral amount at the specified timestamp.
   *
   * @param self The State struct
   * @param collateral The collateral amount
   * @param timestamp The timestamp of the rate to use for conversion
   * @return The token value of the given collateral at the given timestamp
   */
  function collateralToTokenValueAt(State storage self, uint256 collateral, uint256 timestamp) internal view returns (uint256) {
    uint256 exchangeRateIndex = search(self, timestamp);
    return FixedPoint.multiplyUint(self.exchangeRates[exchangeRateIndex].exchangeRate, collateral);
  }

  /**
   * Returns the current exchange rate as a FixedPoint.Fixed18 struct
   *
   * @param self The State struct
   * @return The current exchange rate as a FixedPoint.Fixed18 struct
   */
  function currentExchangeRate(State storage self) internal view returns (FixedPoint.Fixed18 storage) {
    wasInitialized(self);
    return self.exchangeRates[self.exchangeRates.length - 1].exchangeRate;
  }

  /**
   * Searches for the historic exchange rate at the given timestamp.
   *
   * The algorithm will return the index of the *last* exchange rate whose timestamp is less than or equal to the given timestamp.
   *
   * @param self The State struct
   * @param timestamp The timestamp to search for
   * @return The index of the exchange rate that was in effect at the given timestamp
   */
  function search(State storage self, uint256 timestamp) internal view returns (uint256) {
    wasInitialized(self);

    uint256 lowerBound = 0;
    uint256 upperBound = self.exchangeRates.length;

    while (lowerBound < upperBound - 1) {
        uint256 midPoint = lowerBound + (upperBound - lowerBound) / 2;

        if (timestamp < self.exchangeRates[midPoint].timestamp) {
          upperBound = midPoint;
        } else {
          lowerBound = midPoint;
        }
    }

    return upperBound - 1;
  }

  function wasInitialized(State storage self) internal view {
    require(self.exchangeRates.length > 0, "ExchangeRateTracker/not-init");
  }
}

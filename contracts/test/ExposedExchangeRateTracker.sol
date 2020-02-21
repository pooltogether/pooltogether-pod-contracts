pragma solidity ^0.5.12;

import "../ExchangeRateTracker.sol";
import "../FixedPoint.sol";

contract ExposedExchangeRateTracker {
  using ExchangeRateTracker for ExchangeRateTracker.State;

  ExchangeRateTracker.State state;

  function search(uint256 drawId) external view returns (uint256) {
    return state.search(drawId);
  }

  function setExchangeRateTracker(uint256[] calldata drawIds) external {
    state.exchangeRates.length = 0;
    for (uint256 i = 0; i < drawIds.length; i++) {
      state.exchangeRates.push(ExchangeRateTracker.ExchangeRate(drawIds[i], FixedPoint.Fixed18(0)));
    }
  }

  function get(uint256 index) external view returns (uint256) {
    return state.exchangeRates[index].timestamp;
  }
}
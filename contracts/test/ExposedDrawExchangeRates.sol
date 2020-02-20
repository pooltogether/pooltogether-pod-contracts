pragma solidity ^0.5.12;

import "../DrawExchangeRates.sol";
import "../FixedPoint.sol";

contract ExposedDrawExchangeRates {
  using DrawExchangeRates for DrawExchangeRates.DrawExchangeRate[];

  DrawExchangeRates.DrawExchangeRate[] rates;

  function search(uint256 drawId) external view returns (uint256) {
    return rates.search(drawId);
  }

  function setDrawExchangeRates(uint256[] calldata drawIds) external {
    rates.length = 0;
    for (uint256 i = 0; i < drawIds.length; i++) {
      rates.push(DrawExchangeRates.DrawExchangeRate(drawIds[i], FixedPoint.Fixed18(0)));
    }
  }

  function get(uint256 index) external view returns (uint256) {
    return rates[index].rewardedDrawId;
  }
}
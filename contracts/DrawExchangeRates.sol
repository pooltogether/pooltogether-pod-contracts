pragma solidity ^0.5.12;

import "./FixedPoint.sol";

library DrawExchangeRates {
  struct DrawExchangeRate {
    uint256 rewardedDrawId;
    FixedPoint.Fixed18 exchangeRate;
  }

  function search(DrawExchangeRate[] storage self, uint256 drawId) internal view returns (uint256) {
    require(self.length > 0, "DrawExchangeRates/empty");
    require(drawId >= self[0].rewardedDrawId, "DrawExchangeRates/bounds");

    uint256 lowerBound = 0;
    uint256 upperBound = self.length;

    while (lowerBound < upperBound - 1) {
        uint256 midPoint = lowerBound + (upperBound - lowerBound) / 2;

        if (drawId < self[midPoint].rewardedDrawId) {
          upperBound = midPoint;
        } else {
          lowerBound = midPoint;
        }
    }

    return upperBound - 1;
  }
}

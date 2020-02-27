pragma solidity ^0.5.12;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

library SupplyBuffer {
  using SafeMath for uint256;

  struct State {
    uint256 consolidatedDrawsTotal;
    uint256 lastDrawTotal;
    uint256 lastDrawId;
  }

  function deposit(State storage self, uint256 amount, uint256 drawId) internal {
    require(drawId >= self.lastDrawId, "SupplyBuffer/draw-old");
    if (self.lastDrawId == drawId) {
      self.lastDrawTotal = self.lastDrawTotal.add(amount);
    } else {
      self.consolidatedDrawsTotal = self.consolidatedDrawsTotal.add(self.lastDrawTotal);
      self.lastDrawTotal = amount;
      self.lastDrawId = drawId;
    }
  }

  function withdraw(State storage self, uint256 amount) internal {
    if (self.lastDrawTotal >= amount) {
      self.lastDrawTotal = self.lastDrawTotal.sub(amount);
    } else {
      uint256 remainder = amount.sub(self.lastDrawTotal);
      delete self.lastDrawTotal;
      self.consolidatedDrawsTotal = self.consolidatedDrawsTotal.sub(remainder);
    }
  }

  /**
   * Because deposits() occur on the open draw, we know that the drawId passed to committedSupply() will always be greater than
   * or equal to the lastDrawId.
   */
  function committedSupply(State storage self, uint256 openDrawId) internal view returns (uint256) {
    require(openDrawId >= self.lastDrawId, "SupplyBuffer/draw-old");
    uint256 result = self.consolidatedDrawsTotal;
    if (self.lastDrawId < openDrawId) {
      result = result.add(self.lastDrawTotal);
    }
    return result;
  }

  function clearCommitted(State storage self, uint256 openDrawId) internal returns (uint256) {
    require(openDrawId >= self.lastDrawId, "SupplyBuffer/draw-old");
    if (self.lastDrawId < openDrawId) {
      delete self.lastDrawId;
      delete self.lastDrawTotal;
    }
    delete self.consolidatedDrawsTotal;
  }
}

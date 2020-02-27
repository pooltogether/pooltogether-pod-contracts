pragma solidity ^0.5.12;

import "../SupplyBuffer.sol";

contract ExposedSupplyBuffer {
  using SupplyBuffer for SupplyBuffer.State;

  SupplyBuffer.State supplyBuffer;

  function deposit(uint256 amount, uint256 drawId) external {
    supplyBuffer.deposit(amount, drawId);
  }

  function withdraw(uint256 amount) external {
    supplyBuffer.withdraw(amount);
  }

  /**
   * Because deposits() occur on the open draw, we know that the drawId passed to committedSupply() will always be greater than
   * or equal to the lastDrawId.
   */
  function committedSupply(uint256 openDrawId) external view returns (uint256) {
    return supplyBuffer.committedSupply(openDrawId);
  }

  function clearCommitted(uint256 openDrawId) external returns (uint256) {
    supplyBuffer.clearCommitted(openDrawId);
  }
}

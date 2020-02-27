pragma solidity ^0.5.12;

import "../BalanceBuffer.sol";

contract ExposedBalanceBuffer {
  using BalanceBuffer for BalanceBuffer.State;

  BalanceBuffer.State balanceBuffer;

  function deposit(address user, uint256 amount, uint256 drawId) external {
    balanceBuffer.deposit(user, amount, drawId);
  }

  function withdraw(address user, uint256 amount) external {
    balanceBuffer.withdraw(user, amount);
  }

  function committedBalanceOf(address user, uint256 openDrawId) external view returns (uint256) {
    return balanceBuffer.committedBalanceOf(user, openDrawId);
  }

  function openBalanceOf(address user, uint256 drawId) external view returns (uint256) {
    return balanceBuffer.openBalanceOf(user, drawId);
  }

  function clearCommitted(address user, uint256 drawId) external returns (uint256) {
    balanceBuffer.clearCommitted(user, drawId);
  }
}
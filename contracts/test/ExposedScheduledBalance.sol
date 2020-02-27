pragma solidity ^0.5.12;

import "../ScheduledBalance.sol";

contract ExposedScheduledBalance {
  using ScheduledBalance for ScheduledBalance.State;

  ScheduledBalance.State scheduledBalance;

  function deposit(uint256 amount, uint256 currentTimestamp) external {
    scheduledBalance.deposit(amount, currentTimestamp);
  }

  function withdrawUnconsolidated(uint256 amount, uint256 currentTimestamp) external {
    scheduledBalance.withdrawUnconsolidated(amount, currentTimestamp);
  }

  function consolidatedBalance(uint256 currentTimestamp) external view returns (uint256) {
    return scheduledBalance.consolidatedBalance(currentTimestamp);
  }

  function unconsolidatedBalance(uint256 currentTimestamp) external view returns (uint256) {
    return scheduledBalance.unconsolidatedBalance(currentTimestamp);
  }

  function clearConsolidated(uint256 currentTimestamp) external returns (uint256) {
    scheduledBalance.clearConsolidated(currentTimestamp);
  }
}
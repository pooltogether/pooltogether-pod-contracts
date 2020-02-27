pragma solidity ^0.5.12;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

/**
 * Library for tracking deposits with respect to time.
 *
 * This library separates deposits into consolidated balances and unconsolidated balances.
 *
 * A user's consolidated balance is the sum of all of their deposits previous to a given timestamp.
 *
 * A user's unconsolidated balance is the sum of all of their deposits at or after a given timestamp.
 *
 * The word "timestamp" is used here because time always moves forward.  However, the value used for the timestamps
 * can be any granularity needed.
 */
library ScheduledBalance {
  using SafeMath for uint256;

  /**
   * The structure containing a user's consolidated balance and their most recent deposit.
   */
  struct State {
    uint256 previousBalance;
    uint256 previousTimestamp;
    uint256 lastBalance;
    uint256 lastTimestamp;
  }

  /**
   * Deposit for a user.
   *
   * The current timestamp must be equal or greater than the last deposit timestamp.
   *
   * If the current timestamp is greater than the last deposit timestamp, all existing
   * deposit are consolidated and this deposit is set as the last.
   * If the current timestamp is equal to the last deposit timestamp, it is merely added to the last deposit self.
   *
   * @param self The ScheduledBalance.State struct
   * @param amount The amount to deposit
   * @param currentTimestamp The current timestamp.
   */
  function deposit(State storage self, uint256 amount, uint256 currentTimestamp) internal {
    require(currentTimestamp >= self.lastTimestamp, "ScheduledBalance/backwards");
    if (self.lastTimestamp == currentTimestamp) {
      self.lastBalance = self.lastBalance.add(amount);
    } else {
      self.previousBalance = self.previousBalance.add(self.lastBalance);
      self.previousTimestamp = self.lastTimestamp;
      self.lastBalance = amount;
      self.lastTimestamp = currentTimestamp;
    }
  }

  function withdrawUnconsolidated(State storage self, uint256 amount, uint256 timestamp) internal {
    if (self.lastTimestamp == timestamp) {
      require(amount <= self.lastBalance, "ScheduledBalance/insuff");
      self.lastBalance = self.lastBalance.sub(amount);
    } else { // unconsolidated must be zero
      require(amount == 0, "ScheduledBalance/insuff");
    }
  }

  function consolidatedBalance(State storage self, uint256 currentTimestamp) internal view returns (uint256) {
    (uint256 balance,) = consolidatedBalanceInfo(self, currentTimestamp);
    return balance;
  }

  function consolidatedBalanceInfo(
    State storage self,
    uint256 currentTimestamp
  ) internal view returns (uint256 balance, uint256 timeslot) {
    require(currentTimestamp >= self.lastTimestamp, "ScheduledBalance/backwards");
    balance = self.previousBalance;
    timeslot = self.previousTimestamp;
    if (self.lastTimestamp < currentTimestamp) {
      balance = balance.add(self.lastBalance);
      timeslot = self.lastTimestamp;
    }
    return (balance, timeslot);
  }

  function unconsolidatedBalance(State storage self, uint256 currentTimestamp) internal view returns (uint256) {
    require(currentTimestamp >= self.lastTimestamp, "ScheduledBalance/backwards");
    uint256 result;
    if (currentTimestamp == self.lastTimestamp) {
      result = result.add(self.lastBalance);
    }
    return result;
  }

  function clearConsolidated(State storage self, uint256 currentTimestamp) internal returns (uint256) {
    require(currentTimestamp >= self.lastTimestamp, "ScheduledBalance/backwards");
    if (self.lastTimestamp < currentTimestamp) {
      delete self.lastTimestamp;
      delete self.lastBalance;
    }
    delete self.previousBalance;
    delete self.previousTimestamp;
  }
}
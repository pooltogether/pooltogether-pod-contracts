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

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

/**
 * @author Brendan Asselstine
 * @notice Library for tracking deposits with respect to time.
 *
 * This library separates deposits into consolidated balances and unconsolidated balances.
 *
 * The consolidated balance is the sum of all deposits previous to a given timestamp.
 *
 * The unconsolidated balance is the sum of all deposits at or after a given timestamp.
 *
 * The word "timestamp" is used here because time always moves forward.  However, the value used for the timestamps
 * could have any granularity.
 */
library ScheduledBalance {
  using SafeMath for uint256;

  /**
   * The structure containing a user's previously consolidated balance and their most recent deposit.
   */
  struct State {
    uint256 previousBalance;
    uint256 previousTimestamp;
    uint256 lastBalance;
    uint256 lastTimestamp;
  }

  /**
   * Deposits the given amount.
   *
   * The provided timestamp *must* be the same or later than the last deposit timestamp.
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

  /**
   * Withdraws the given amount from the unconsolidated deposits.
   *
   * The given timestamp is used to check the unconsolidated balance.
   *
   * @param self The State struct
   * @param amount The amount to withdraw
   * @param timestamp The current timestamp
   */
  function withdrawUnconsolidated(State storage self, uint256 amount, uint256 timestamp) internal {
    if (self.lastTimestamp == timestamp) {
      require(amount <= self.lastBalance, "ScheduledBalance/insuff");
      self.lastBalance = self.lastBalance.sub(amount);
    } else { // unconsolidated must be zero
      require(amount == 0, "ScheduledBalance/insuff");
    }
  }

  /**
   * Returns the consolidated balance as of the given timestamp.
   *
   * Any deposits made prior to the given timestamp are considered "consolidated"
   *
   * @param self The State struct
   * @param currentTimestamp The current timestamp
   * @return The consolidate balance
   */
  function consolidatedBalance(State storage self, uint256 currentTimestamp) internal view returns (uint256) {
    (uint256 balance,) = consolidatedBalanceInfo(self, currentTimestamp);
    return balance;
  }

  /**
   * Returns the consolidated balance and timestamp as of the given timestamp.
   *
   * Any deposits made prior to the given timestamp are considered "consolidated".
   *
   * The provided timestamp *must* be the same or later than the last deposit timestamp.
   *
   * This function will return a tuple of the consolidated balance, and the timestamp of
   * it's last deposit.
   *
   * @param self The State struct
   * @param currentTimestamp The current timestamp
   * @return A tuple (balance, timestamp) of the consolidate balance and last deposit time
   */
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

  /**
   * Returns the unconsolidated balance as of the given timestamp.
   *
   * Any deposits made on or after the given timestamp will be returned as the unconsolidated balance
   *
   * @param self The State struct
   * @param currentTimestamp The current time
   */
  function unconsolidatedBalance(State storage self, uint256 currentTimestamp) internal view returns (uint256) {
    require(currentTimestamp >= self.lastTimestamp, "ScheduledBalance/backwards");
    uint256 result;
    if (currentTimestamp == self.lastTimestamp) {
      result = result.add(self.lastBalance);
    }
    return result;
  }

  /**
   * Zeroes out the consolidated balance give the current timestamp.
   *
   * Any balance before the given timestamp will be zeroed out.
   *
   * @param self The State struct
   * @param currentTimestamp The current time
   */
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
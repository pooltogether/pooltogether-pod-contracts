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
 * This library allows a user to "schedule" a deposit.  The deposit will be valid on and after a given timestamp.
 *
 * The word "timestamp" is used here because time always moves forward.  However, the value used for the timestamps
 * could have any granularity.  In the Pod, we're passing draw ids.
 *
 * The contract only stores the deposit for a particular timestamp.  If a subsequent deposit is made with a later timestamp,
 * that deposit replaces the current deposit.
 */
library ScheduledBalance {
  using SafeMath for uint256;

  /**
   * The structure containing a user's scheduled balance.
   */
  struct State {
    uint256 lastDeposit;
    uint256 lastTimestamp;
  }

  /**
   * Schedules a deposit for the given amount at the given timestamp.
   *
   * The timestamp must be greater than or equal to the previous deposit's timestamp.
   *
   * If the timestamp matches the previous deposit, the deposits are added.  Otherwise, the new deposit amount and timestamp replaces the old ones.
   *
   * @param self The ScheduledBalance.State struct
   * @param amount The amount to deposit
   * @param currentTimestamp The current timestamp.
   */
  function deposit(State storage self, uint256 amount, uint256 currentTimestamp) internal {
    require(currentTimestamp >= self.lastTimestamp, "ScheduledBalance/backwards");
    if (self.lastTimestamp == currentTimestamp) {
      self.lastDeposit = self.lastDeposit.add(amount);
    } else {
      self.lastDeposit = amount;
      self.lastTimestamp = currentTimestamp;
    }
  }

  /**
   * Withdraws the given amount from the deposit.
   *
   * @param self The State struct
   * @param amount The amount to withdraw
   */
  function withdraw(State storage self, uint256 amount) internal {
    require(amount <= self.lastDeposit, "ScheduledBalance/insuff");
    self.lastDeposit = self.lastDeposit.sub(amount);
  }

  /**
   * Returns the balance as of the given timestamp.
   *
   * If the deposit occured prior to the timestamp it is included.  Zero otherwise.
   *
   * @param self The State struct
   * @param currentTimestamp The current timestamp
   * @return The balance at the given time
   */
  function balanceAt(State storage self, uint256 currentTimestamp) internal view returns (uint256) {
    (uint256 balance,) = balanceInfoAt(self, currentTimestamp);
    return balance;
  }

  /**
   * Returns the balance at the given timestamp.
   *
   * If the deposit is before the timestamp, zero is returned for both the deposit and timestamp.
   * If the balance is on or after the timestamp then the deposit and it's timestamp are returned.
   *
   * @param self The State struct
   * @param currentTimestamp The current timestamp
   * @return A tuple (uint256 balance, uint256 timestamp) of the balance at the given time.
   */
  function balanceInfoAt(
    State storage self,
    uint256 currentTimestamp
  ) internal view returns (uint256 balance, uint256 timestamp) {
    if (self.lastTimestamp <= currentTimestamp) {
      balance = self.lastDeposit;
      timestamp = self.lastTimestamp;
    }
    return (balance, timestamp);
  }

  /**
   * Completely zeroes out the deposit and timestamp.
   *
   * @param self The State struct
   */
  function withdrawAll(State storage self) internal {
    delete self.lastTimestamp;
    delete self.lastDeposit;
  }
}

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

import "../ScheduledBalance.sol";

contract ExposedScheduledBalance {
  using ScheduledBalance for ScheduledBalance.State;

  ScheduledBalance.State scheduledBalance;

  function deposit(uint256 amount, uint256 currentTimestamp) external {
    scheduledBalance.deposit(amount, currentTimestamp);
  }

  function withdraw(uint256 amount) external {
    scheduledBalance.withdraw(amount);
  }

  function balanceAt(uint256 currentTimestamp) external view returns (uint256) {
    return scheduledBalance.balanceAt(currentTimestamp);
  }

  function withdrawAll() external returns (uint256) {
    scheduledBalance.withdrawAll();
  }
}
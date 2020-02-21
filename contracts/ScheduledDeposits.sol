pragma solidity ^0.5.12;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

library ScheduledDeposits {
  using SafeMath for uint256;

  struct State {
    mapping(address => uint256) pendingDepositAmounts;
    mapping(address => uint256) pendingDepositTimestamps;

    uint256 pendingSupplyAmount;
    uint256 pendingSupplyTimestamp;
  }

  function depositAt(State storage self, address user, uint256 amount, uint256 timestamp) internal {
    require(self.pendingDepositTimestamps[user] == 0, "ScheduledDeposits/deposit-exists");

    self.pendingDepositAmounts[user] = self.pendingDepositAmounts[user].add(amount);
    self.pendingDepositTimestamps[user] = timestamp;

    self.pendingSupplyAmount = self.pendingSupplyAmount.add(amount);
    self.pendingSupplyTimestamp = timestamp;
  }

  function withdraw(State storage self, address user, uint256 amount) internal {
    require(self.pendingDepositAmounts[user] >= amount, "ScheduledDeposits/insuff");

    self.pendingDepositAmounts[user] = self.pendingDepositAmounts[user].sub(amount);
    self.pendingSupplyAmount = self.pendingSupplyAmount.sub(amount);
  }

  function balanceBefore(State storage self, address user, uint256 timestamp) internal view returns (uint256) {
    uint256 drawId = self.pendingDepositTimestamps[user];
    uint256 balance = 0;
    if (drawId > 0 && drawId < timestamp) {
      balance = self.pendingDepositAmounts[user];
    }
    return balance;
  }

  function supplyBefore(State storage self, uint256 timestamp) internal view returns (uint256) {
    uint256 supply = 0;
    if (self.pendingSupplyTimestamp < timestamp) {
      supply = self.pendingSupplyAmount;
    }
    return supply;
  }

  function balanceAfter(State storage self, address user, uint256 timestamp) internal view returns (uint256) {
    uint256 drawId = self.pendingDepositTimestamps[user];
    uint256 balance = 0;
    if (drawId > 0 && drawId >= timestamp) {
      balance = self.pendingDepositAmounts[user];
    }
    return balance;
  }

  function supplyAfter(State storage self, uint256 timestamp) internal view returns (uint256) {
    uint256 supply = 0;
    if (self.pendingSupplyTimestamp >= timestamp) {
      supply = self.pendingSupplyAmount;
    }
    return supply;
  }

  function clearBalance(State storage self, address user) internal {
    delete self.pendingDepositAmounts[user];
    delete self.pendingDepositTimestamps[user];
  }

  function clearSupply(State storage self) internal {
    self.pendingSupplyTimestamp = 0;
    self.pendingSupplyAmount = 0;
  }
}

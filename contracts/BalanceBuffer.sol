pragma solidity ^0.5.12;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

library BalanceBuffer {
  using SafeMath for uint256;

  struct Balance {
    uint256 consolidatedBalance;
    uint256 consolidatedDrawId;
    uint256 lastBalance;
    uint256 lastDrawId;
  }

  struct State {
    mapping(address => Balance) balances;
  }

  function deposit(State storage self, address user, uint256 amount, uint256 openDrawId) internal {
    Balance storage balance = self.balances[user];
    require(openDrawId >= balance.lastDrawId, "BalanceBuffer/draw-old");
    if (balance.lastDrawId == openDrawId) {
      balance.lastBalance = balance.lastBalance.add(amount);
    } else {
      balance.consolidatedBalance = balance.consolidatedBalance.add(balance.lastBalance);
      balance.consolidatedDrawId = openDrawId;
      balance.lastBalance = amount;
      balance.lastDrawId = openDrawId;
    }
  }

  function withdraw(State storage self, address user, uint256 amount) internal {
    Balance storage balance = self.balances[user];
    if (balance.lastBalance >= amount) {
      balance.lastBalance = balance.lastBalance.sub(amount);
    } else {
      uint256 remainder = amount.sub(balance.lastBalance);
      delete balance.lastBalance;
      balance.consolidatedBalance = balance.consolidatedBalance.sub(remainder);
    }
  }

  function committedBalanceOf(State storage self, address user, uint256 openDrawId) internal view returns (uint256) {
    (uint256 balance,) = committedBalanceInfo(self, user, openDrawId);
    return balance;
  }

  function committedBalanceDrawId(State storage self, address user, uint256 openDrawId) internal view returns (uint256) {
    (, uint256 drawId) = committedBalanceInfo(self, user, openDrawId);
    return drawId;
  }

  function committedBalanceInfo(State storage self, address user, uint256 openDrawId) internal view returns (uint256 balance, uint256 drawId) {
    Balance storage bal = self.balances[user];
    require(openDrawId >= bal.lastDrawId, "BalanceBuffer/draw-old");
    balance = bal.consolidatedBalance;
    drawId = bal.consolidatedDrawId;
    if (bal.lastDrawId < openDrawId) {
      balance = balance.add(bal.lastBalance);
      drawId = bal.lastDrawId;
    }
    return (balance, drawId);
  }

  function openBalanceOf(State storage self, address user, uint256 openDrawId) internal view returns (uint256) {
    Balance storage balance = self.balances[user];
    require(openDrawId >= balance.lastDrawId, "BalanceBuffer/draw-old");
    uint256 result;
    if (openDrawId == balance.lastDrawId) {
      result = result.add(balance.lastBalance);
    }
    return result;
  }

  function clearCommitted(State storage self, address user, uint256 openDrawId) internal returns (uint256) {
    Balance storage balance = self.balances[user];
    require(openDrawId >= balance.lastDrawId, "BalanceBuffer/draw-old");
    if (balance.lastDrawId < openDrawId) {
      delete balance.lastDrawId;
      delete balance.lastBalance;
    }
    delete balance.consolidatedBalance;
    delete balance.consolidatedDrawId;
  }
}
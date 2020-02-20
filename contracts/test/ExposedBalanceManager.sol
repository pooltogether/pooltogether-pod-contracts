pragma solidity ^0.5.12;

import "../BalanceManager.sol";

contract ExposedBalanceManager is BalanceManager {
  uint256 public _tokenSupply;
  mapping(address => uint256) _tokenBalances;

  function consolidatedSupply() internal view returns (uint256) {
    return _tokenSupply;
  }

  function consolidatedBalanceOf(address a) internal view returns (uint256) {
    return _tokenBalances[a];
  }

  function _mintTo(address addr, uint256 tokens) internal {
    _tokenSupply = _tokenSupply.add(tokens);
    _tokenBalances[addr] = _tokenBalances[addr].add(tokens);
  }

  function _transferTo(address from, address to, uint256 amount) internal {
    _tokenBalances[from] = _tokenBalances[from].sub(amount);
    _tokenBalances[to] = _tokenBalances[to].add(amount);
  }
}
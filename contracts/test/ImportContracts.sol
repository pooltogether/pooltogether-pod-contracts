pragma solidity ^0.5.0;

import "@pooltogether/pooltogether-contracts/contracts/test/Token.sol";
import "@pooltogether/pooltogether-contracts/contracts/test/CErc20Mock.sol";
import "@pooltogether/pooltogether-contracts/contracts/RecipientWhitelistPoolToken.sol";

/**
 * @dev These contracts just exists so that Truffle pulls in the imported contracts
 */

contract ImportContracts2 is RecipientWhitelistPoolToken {}

contract ImportContracts is Token, CErc20Mock {}
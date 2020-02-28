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

pragma solidity ^0.5.0;

import "@pooltogether/pooltogether-contracts/contracts/test/Token.sol";
import "@pooltogether/pooltogether-contracts/contracts/test/CErc20Mock.sol";
import "@pooltogether/pooltogether-contracts/contracts/test/ERC777Mintable.sol";
import "@pooltogether/pooltogether-contracts/contracts/RecipientWhitelistPoolToken.sol";

/**
 * @dev These contracts just exists so that Truffle pulls in the imported contracts
 */

contract ImportContracts2 is RecipientWhitelistPoolToken {}

contract Import777 is ERC777Mintable {}

contract ImportContracts is Token, CErc20Mock {}
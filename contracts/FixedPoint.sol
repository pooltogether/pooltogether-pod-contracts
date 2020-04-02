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
 * @notice Provides basic fixed point math calculations.
 *
 * This library calculates integer fractions by scaling values by 1e18 then performing standard integer math.
 */
library FixedPoint {
  using SafeMath for uint256;

  // The scale to use for fixed point numbers.  Same as Ether for simplicity.
  uint256 public constant SCALE = 1e18;

  /**
   * A struct representing a fixed point 18 mantissa (ie Ether).
   */
  struct Fixed18 {
    uint256 mantissa;
  }

  /**
   * Calculates a Fixed18 mantissa given the numerator and denominator
   *
   * The mantissa = (numerator * 1e18) / denominator
   *
   * @param numerator The mantissa numerator
   * @param denominator The mantissa denominator
   * @return The mantissa of the fraction
   */
  function calculateMantissa(uint256 numerator, uint256 denominator) public pure returns (uint256) {
    uint256 mantissa = numerator.mul(SCALE);
    mantissa = mantissa.div(denominator);
    return mantissa;
  }

  /**
   * Multiplies a Fixed18 number by an integer.
   *
   * @param f The Fixed18 number
   * @param b The whole integer to multiply
   * @return An integer that is the result of multiplying the params.
   */
  function multiplyUint(Fixed18 storage f, uint256 b) public view returns (uint256) {
    uint256 result = f.mantissa.mul(b);
    result = result.div(SCALE);
    return result;
  }

  /**
   * Divides an integer by a Fixed18 number.
   *
   * @param dividend The integer to divide
   * @param divisor The Fixed18 number to act as the divisor
   * @return An integer that is the result of dividing an integer by a Fixed18 number
   */
  function divideUintByFixed(uint256 dividend, Fixed18 storage divisor) public view returns (uint256) {
    return divideUintByMantissa(dividend, divisor.mantissa);
  }

  /**
   * Divides an integer by a fixed point 18 mantissa
   *
   * @param dividend The integer to divide
   * @param mantissa The fixed point 18 number to serve as the divisor
   * @return An integer that is the result of dividing an integer by a fixed point 18 mantissa
   */
  function divideUintByMantissa(uint256 dividend, uint256 mantissa) public pure returns (uint256) {
    uint256 result = SCALE.mul(dividend);
    result = result.div(mantissa);
    return result;
  }
}

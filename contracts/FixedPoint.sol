pragma solidity ^0.5.12;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

// See https://accu.org/index.php/journals/1717
library FixedPoint {
  using SafeMath for uint256;

  uint256 public constant SCALE = 1e18;

  struct Fixed18 {
    uint256 mantissa;
  }

  function calculateMantissa(uint256 numerator, uint256 denominator) public pure returns (uint256) {
    uint256 mantissa = numerator.mul(SCALE);
    mantissa = mantissa.div(denominator);
    return mantissa;
  }

  function multiplyUint(Fixed18 storage f, uint256 b) public view returns (uint256) {
    uint256 result = f.mantissa.mul(b);
    result = result.div(SCALE);
    return result;
  }

  function divideUintByFixed(uint256 dividend, Fixed18 storage divisor) public view returns (uint256) {
    return divideUintByMantissa(dividend, divisor.mantissa);
  }

  function divideUintByMantissa(uint256 dividend, uint256 mantissa) public pure returns (uint256) {
    uint256 result = SCALE.mul(dividend);
    result = result.div(mantissa);
    return result;
  }
}

pragma solidity ^0.6.4;

import "../Pod.sol";

contract PodHarness is Pod {

    function setTimelockBalance(address _user, uint256 _balance) external {
        timelockBalance[_user] = _balance;
    }

    function setUnlockTimestamp(address _user, uint256 _timestamp) external {
        unlockTimestamp[_user] = _timestamp;
    }

    function getTicketSharesForTest(uint256 _amount) external view returns (uint256 shares) {
        return FixedPoint.divideUintByMantissa(_amount, exchangeRateMantissa());
    }
}

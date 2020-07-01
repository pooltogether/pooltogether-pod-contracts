pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/introspection/IERC1820Registry.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@opengsn/gsn/contracts/BaseRelayRecipient.sol";

import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@pooltogether/pooltogether-contracts/contracts/external/openzeppelin/ProxyFactory.sol";
import "@pooltogether/pooltogether-contracts/contracts/modules/yield-service/YieldServiceInterface.sol";
import "@pooltogether/pooltogether-contracts/contracts/modules/ticket/Ticket.sol";
import "@pooltogether/pooltogether-contracts/contracts/modules/timelock/Timelock.sol";
import "@pooltogether/pooltogether-contracts/contracts/Constants.sol";

contract PodToken is Initializable, ERC20UpgradeSafe, BaseRelayRecipient {
    using SafeMath for uint256;

    // Address of the Controller Pod
    address public pod;

    modifier onlyPod() {
      require(_msgSender() == pod, "PodToken: only pod");
      _;
    }

    //
    // Initialization
    //

    function initialize(
        string calldata _name,
        string calldata _symbol,
        address _trustedForwarder,
        address _pod
    )
        external
        initializer
    {
        __ERC20_init(_name, _symbol);
        trustedForwarder = _trustedForwarder;
        pod = _pod;
    }

    //
    // Pod Only
    //

    function mint(address _to, uint256 _amount) external onlyPod {
        _mint(_to, _amount);
    }

    function burnFrom(address _from, uint256 _amount) external onlyPod {
        _burn(_from, _amount);
    }

    //
    // Internal/Private
    //

    function _msgSender() internal override(BaseRelayRecipient, ContextUpgradeSafe) view returns (address payable) {
        return BaseRelayRecipient._msgSender();
    }
}

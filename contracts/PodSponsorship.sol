pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/ERC777.sol";
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


contract PodSponsorship is Initializable, ReentrancyGuardUpgradeSafe, ERC777UpgradeSafe, BaseRelayRecipient {
    using SafeMath for uint256;

    event SponsorshipMinted(address indexed pod, address indexed to, uint256 amount);
    event SponsorshipBurned(address indexed pod, address indexed from, uint256 amount);

    uint256 internal constant INITIAL_EXCHANGE_RATE_MANTISSA = 1 ether;

    // Address of the Sponsored Pod
    address public sponsoredPod;

    modifier onlyPod() {
      require(_msgSender() == sponsoredPod, "PodSponsorship: only pod");
      _;
    }

    //
    // Initialization
    //

    function initialize(
        string memory _name,
        string memory _symbol,
        address _trustedForwarder,
        address _pod
    ) 
        public 
        initializer 
    {
        __ReentrancyGuard_init();
        address[] memory _defaultOperators;
        __ERC777_init(_name, _symbol, _defaultOperators);
        trustedForwarder = _trustedForwarder;
        sponsoredPod = _pod;
    }

    //
    // Pod Only
    //

    function mint(address _to, uint256 _amount) public onlyPod {
        _mint(_to, _amount);
    }

    function burn(address _from, uint256 _amount) public onlyPod {
        _burn(_from, _amount);
    }

    //
    // Internal/Private
    //

    function _mint(address _to, uint256 _amount) internal virtual {
        super._mint(_to, _amount, "", "");
    }

    function _burn(address _from, uint256 _amount) internal virtual {
        super._burn(_from, _amount, "", "");
    }

    function _msgSender() internal override(BaseRelayRecipient, ContextUpgradeSafe) virtual view returns (address payable) {
        return BaseRelayRecipient._msgSender();
    }
}

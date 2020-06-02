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


contract Pod is Initializable, ReentrancyGuardUpgradeSafe, ERC777UpgradeSafe, BaseRelayRecipient {
    using SafeMath for uint256;

    event PodDeposit(address indexed from, uint256 amount, uint256 shares);
    event PodRedeemed(address indexed to, uint256 amount, uint256 shares, uint256 tickets);
    event PodRedeemedWithTimelock(address indexed to, uint256 timestamp, uint256 amountRedeemed, uint256 shares, uint256 tickets);

    uint256 internal constant INITIAL_EXCHANGE_RATE_MANTISSA = 1 ether;

    // Module-Manager for the Prize Pool
    address public prizePoolManager;

    // Timelocked Tokens
    mapping (address => uint256) internal timelockBalance;
    mapping (address => uint256) internal unlockTimestamp;

    //
    // Initialization
    //

    function initialize(
        string memory _name,
        string memory _symbol,
        address _trustedForwarder,
        address _prizePoolManager
    ) 
        public 
        initializer 
    {
        __ReentrancyGuard_init();
        address[] memory _defaultOperators;
        __ERC777_init(_name, _symbol, _defaultOperators);
        trustedForwarder = _trustedForwarder;
        prizePoolManager = _prizePoolManager;
    }

    //
    // Public/External
    //

    function balanceOfUnderlying(address _user) external view returns (uint256) {
        return FixedPoint.multiplyUintByMantissa(balanceOf(_user), exchangeRateMantissa());
    }

    function getTimelockBalance(address _user) external view returns (uint256) {
        return timelockBalance[_user];
    }

    function getUnlockTimestamp(address _user) external view returns (uint256) {
        return unlockTimestamp[_user];
    }

    function deposit(uint256 _amount) external nonReentrant returns (uint256) {
        address _sender = _msgSender();
        Ticket _ticket = ticket();
        IERC20 _assetToken = yieldService().token();

        // Collect collateral from caller
        _assetToken.transferFrom(_sender, address(this), _amount);

        // Calculate 
        uint256 _shares = FixedPoint.divideUintByMantissa(_amount, exchangeRateMantissa());

        // Transfer collateral to Prize Pool for Tickets
        _assetToken.approve(address(_ticket), _amount);
        _ticket.mintTickets(_amount);

        // Mint Pod-Shares
        _mint(_sender, _shares);

        // Log event
        emit PodDeposit(_sender, _amount, _shares);

        // Return the amount of Shares transferred
        return _shares;
    }

    function redeemSharesInstantly(uint256 _shares) external nonReentrant returns (uint256) {
        address _sender = _msgSender();
        require(balanceOf(_sender) >= _shares, "Pod: Insufficient share balance");

        // Redeem Shares for Assets (less the Fairness-Fee)
        uint256 _tickets = FixedPoint.divideUintByMantissa(_shares, exchangeRateMantissa());
        uint256 _assets = ticket().redeemTicketsInstantly(_tickets);

        // Burn the Pod-Shares
        _burn(_sender, _shares);

        // Transfer Redeemed Assets to Caller
        yieldService().token().transfer(_sender, _assets);

        // Log event
        emit PodRedeemed(_sender, _assets, _shares, _tickets);

        // Return the amount of Assets transferred
        return _assets;
    }

    function redeemSharesWithTimelock(uint256 _shares) external nonReentrant returns (uint256) {
        address _sender = _msgSender();
        require(balanceOf(_sender) >= _shares, "Pod: Insufficient share balance");

        // Redeem Pod-Shares for Tickets (less the Fairness-Fee)
        uint256 _tickets = FixedPoint.divideUintByMantissa(_shares, exchangeRateMantissa());
        uint256 _timestamp = ticket().redeemTicketsWithTimelock(_tickets);

        // Sweep Previously Unlocked Assets for Caller
        uint256 _assetsRedeemed = sweepForUser(_sender);

        // Mint timelock pseudo-tokens for Caller
        timelockBalance[_sender] = _tickets.add(timelockBalance[_sender]);

        // Set Timestamp for Caller
        unlockTimestamp[_sender] = _timestamp;

        // Burn Pod-Share tokens
        _burn(_sender, _shares);

        // Log event
        emit PodRedeemedWithTimelock(_sender, _timestamp, _assetsRedeemed, _shares, _tickets);

        // Return amount of unlocked assets redeemed during sweep
        return _assetsRedeemed;
    }


    function sweepForUser(address _user) public returns (uint256) {
        IERC20 _assetToken = yieldService().token();

        // Sweep the Pool for this Pod (contract receives asset-tokens)
        address[] memory _pod = new address[](1);
        _pod[0] = address(this);
        timelock().sweep(_pod);

        // Transfer any unlocked assets
        uint256 _userBalance;
        if (unlockTimestamp[_user] <= block.timestamp) {
            _userBalance = timelockBalance[_user];

            // Burn timelock pseudo-tokens
            timelockBalance[_user] = 0;

            // Transfer user's balance of asset tokens
            _assetToken.transfer(_user, _userBalance);
        }

        // Return amount of assets transferred
        return _userBalance;
    }

    function exchangeRateMantissa() public view returns (uint256) {
        if (totalSupply() == 0) {
            return INITIAL_EXCHANGE_RATE_MANTISSA;
        } else {
            uint256 collateral = ticket().balanceOf(address(this));
            return FixedPoint.calculateMantissa(collateral, totalSupply());
        }
    }

    function calculateSharesOnDeposit(uint256 _amount) external view returns (uint256) {
        // New Shares = Deposit * (existing shares / total tickets)
        return FixedPoint.divideUintByMantissa( 
            _amount,
            exchangeRateMantissa()
        );
        // uint256 collateral = ticket().balanceOf(address(this));
        // return FixedPoint.multiplyUintByMantissa(
        //   FixedPoint.divideUintByMantissa(
        //     totalSupply(),
        //     collateral
        //   ),
        //   _amount
        // );
    }    
    
    function calculateTicketsOnRedeem(uint256 _shares) external view returns (uint256) {
        // Tickets = (redeem shares / total shares) * Total Tickets
        return FixedPoint.multiplyUintByMantissa(
            _shares, 
            exchangeRateMantissa()
        );
        // uint256 collateral = ticket().balanceOf(address(this));
        // return FixedPoint.multiplyUintByMantissa(
        //   FixedPoint.divideUintByMantissa(
        //     _shares,
        //     totalSupply()
        //   ),
        //   collateral
        // );
    }

    function ticket() public view returns (Ticket) {
        return Ticket(Constants.REGISTRY.getInterfaceImplementer(prizePoolManager, Constants.TICKET_INTERFACE_HASH));
    }


    function timelock() public view returns (Timelock) {
        return Timelock(Constants.REGISTRY.getInterfaceImplementer(prizePoolManager, Constants.TIMELOCK_INTERFACE_HASH));
    }

    function yieldService() public view returns (YieldServiceInterface) {
        return YieldServiceInterface(Constants.REGISTRY.getInterfaceImplementer(prizePoolManager, Constants.YIELD_SERVICE_INTERFACE_HASH));
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

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

import "./PodSponsorship.sol";

contract Pod is Initializable, ReentrancyGuardUpgradeSafe, ERC777UpgradeSafe, BaseRelayRecipient {
    using SafeMath for uint256;

    // Tickets
    event PodDeposit(address indexed operator, address indexed receiver, uint256 amount, uint256 shares);
    event PodRedeemed(address indexed operator, address indexed receiver, uint256 amount, uint256 shares, uint256 tickets);
    event PodRedeemedWithTimelock(address indexed operator, address indexed receiver, uint256 timestamp, uint256 amount, uint256 shares, uint256 tickets);

    // Sponsorships
    event PodSponsored(address indexed operator, address indexed receiver, uint256 amount);
    event PodSponsorRedeemed(address indexed operator, address indexed receiver, uint256 tokens, uint256 assets);
    event PodSponsorRedeemedWithTimelock(address indexed operator, address indexed receiver,  uint256 timestamp, uint256 tokens, uint256 assets);

    // Default Exchange-Rate
    uint256 internal constant INITIAL_EXCHANGE_RATE_MANTISSA = 1 ether;

    // Module-Manager for the Prize Pool
    address public prizePoolManager;

    // Sponsorship Tokens
    PodSponsorship public podSponsorship;

    // Timelocked Tokens
    mapping (address => uint256) internal timelockBalance;   // asset collateral
    mapping (address => uint256) internal unlockTimestamp;

    //
    // Initialization
    //

    function initialize(
        string memory _name,
        string memory _symbol,
        address _trustedForwarder,
        address _prizePoolManager,
        address _podSponsorship
    ) 
        public 
        initializer 
    {
        __ReentrancyGuard_init();
        address[] memory _defaultOperators;
        __ERC777_init(_name, _symbol, _defaultOperators);
        trustedForwarder = _trustedForwarder;
        prizePoolManager = _prizePoolManager;
        podSponsorship = PodSponsorship(_podSponsorship);
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

    function mintShares(address _receiver, uint256 _amount) external nonReentrant returns (uint256) {
        // Buy Tickets for caller
        address _sender = _msgSender();
        _buyTickets(_sender, _amount);

        // Calculate & Mint Pod-Shares
        uint256 _shares = FixedPoint.divideUintByMantissa(_amount, exchangeRateMantissa());
        _mint(_receiver, _shares);

        // Log event
        emit PodDeposit(_sender, _receiver, _amount, _shares);
        return _shares;
    }

    function redeemSharesInstantly(address _from, uint256 _shares) external nonReentrant returns (uint256) {
        address _sender = _msgSender();
        require(_sender == _from || isOperatorFor(_sender, _from), "Pod: Invalid operator");
        require(balanceOf(_from) >= _shares, "Pod: Insufficient share balance");

        // Redeem Shares for Assets (less the Fairness-Fee)
        uint256 _tickets = FixedPoint.divideUintByMantissa(_shares, exchangeRateMantissa());
        uint256 _assets = ticket().redeemTicketsInstantly(_tickets);

        // Burn the Pod-Shares
        _burn(_from, _shares);

        // Transfer Redeemed Assets to Receiver
        yieldService().token().transfer(_from, _assets);

        // Log event
        emit PodRedeemed(_sender, _from, _assets, _shares, _tickets);
        return _assets;
    }

    function redeemSharesWithTimelock(address _from, uint256 _shares) external nonReentrant returns (uint256) {
        address _sender = _msgSender();
        require(_sender == _from || isOperatorFor(_sender, _from), "Pod: Invalid operator");
        require(balanceOf(_from) >= _shares, "Pod: Insufficient share balance");

        // Sweep Previously Unlocked Assets for Caller
        uint256 _assets = sweepForUser(_from);

        // Redeem Pod-Shares with Timelock
        uint256 _tickets = FixedPoint.divideUintByMantissa(_shares, exchangeRateMantissa());
        uint256 _timestamp = _redeemTicketsWithTimelock(_from, _tickets);

        // Burn Pod-Share tokens
        _burn(_from, _shares);

        // Transfer any funds that are already unlocked
        if (_timestamp <= block.timestamp) {
          _assets = _assets.add(sweepForUser(_from));
        }

        // Log event
        emit PodRedeemedWithTimelock(_sender, _from, _timestamp, _assets, _shares, _tickets);
        return _assets;
    }

    function mintSponsorship(address _receiver, uint256 _amount) external nonReentrant {
        // Buy Tickets for caller
        address _sender = _msgSender();
        _buyTickets(_sender, _amount);

        // Mint Sponsorship Tokens equal to Amount of Collateral supplied
        podSponsorship.mint(_receiver, _amount);

        // Log event
        emit PodSponsored(_sender, _receiver, _amount);
    }

    function redeemSponsorshipInstantly(address _from, uint256 _sponsorshipTokens) external nonReentrant returns (uint256) {
        address _sender = _msgSender();
        require(_sender == _from || isOperatorFor(_sender, _from), "Pod: Invalid operator");
        uint256 _balance = podSponsorship.balanceOf(_from);
        require(_balance >= _sponsorshipTokens, "Pod: Insufficient sponsorship balance");

        // Redeem Sponsorship Tokens for Assets (less the Fairness-Fee)
        uint256 _assets = ticket().redeemTicketsInstantly(_sponsorshipTokens);

        // Burn the Sponsorship Tokens
        podSponsorship.burn(_from, _sponsorshipTokens);

        // Transfer Redeemed Assets to Caller
        yieldService().token().transfer(_from, _assets);

        // Log event
        emit PodSponsorRedeemed(_sender, _from, _sponsorshipTokens, _assets);
        return _assets;
    }

    function redeemSponsorshipWithTimelock(address _from, uint256 _sponsorshipTokens) external nonReentrant returns (uint256) {
        address _sender = _msgSender();
        require(_sender == _from || isOperatorFor(_sender, _from), "Pod: Invalid operator");
        uint256 _balance = podSponsorship.balanceOf(_from);
        require(_balance >= _sponsorshipTokens, "Pod: Insufficient sponsorship balance");

        // Sweep Previously Unlocked Assets for Caller
        uint256 _assets = sweepForUser(_from);

        // Redeem Sponsorship Tokens with Timelock
        uint256 _timestamp = _redeemTicketsWithTimelock(_from, _sponsorshipTokens);

        // Burn the Sponsorship Tokens
        podSponsorship.burn(_from, _sponsorshipTokens);

        // Transfer any funds that are already unlocked
        if (_timestamp <= block.timestamp) {
          _assets = _assets.add(sweepForUser(_from));
        }

        // Log event
        emit PodSponsorRedeemedWithTimelock(_sender, _from, _timestamp, _sponsorshipTokens, _assets);
        return _assets;
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
    }    
    
    function calculateTicketsOnRedeem(uint256 _shares) external view returns (uint256) {
        // Tickets = (redeem shares / total shares) * Total Tickets
        return FixedPoint.multiplyUintByMantissa(
            _shares, 
            exchangeRateMantissa()
        );
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

    function _buyTickets(address _sender, uint256 _amount) internal {
        Ticket _ticket = ticket();
        IERC20 _assetToken = yieldService().token();

        // Collect collateral from caller
        _assetToken.transferFrom(_sender, address(this), _amount);

        // Transfer collateral to Prize Pool for Tickets
        _assetToken.approve(address(_ticket), _amount);
        _ticket.mintTickets(_amount);
    }

    function _redeemTicketsWithTimelock(address _sender, uint256 _amount) internal returns (uint256) {
        uint256 _timestamp = ticket().redeemTicketsWithTimelock(_amount);

        // Mint timelock pseudo-tokens for Caller
        timelockBalance[_sender] = _amount.add(timelockBalance[_sender]);
        unlockTimestamp[_sender] = _timestamp;

        return _timestamp;
    }

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

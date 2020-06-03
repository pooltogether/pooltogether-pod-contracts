pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@pooltogether/pooltogether-contracts/contracts/external/openzeppelin/ProxyFactory.sol";
import "./PodSponsor.sol";

contract PodSponsorFactory is Initializable, ProxyFactory {

    PodSponsor internal sponsorshipTemplate;

    event PodSponsorCreated(address indexed token, address indexed pod);

    /// @dev Initializes the Sponsorship-Factory and creates the Sponsorship-Template
    function initialize() 
        public 
        initializer 
    {
        sponsorshipTemplate = new PodSponsor();
    }

    /// @notice Creates a new Sponsorship Token
    /// @param _name The name of the Sponsorship Token
    /// @param _symbol The Symbol for the Sponsorship Token
    /// @param _trustedForwarder The Trusted-Forwarder for Meta-Txs
    /// @param _pod  The address to the Sponsored Pod Contract
    /// @return The address of the newly created Sponsorship Token
    function createSponsorship(
        string memory _name,
        string memory _symbol,
        address _trustedForwarder,
        address _pod
    ) 
        public 
        returns (PodSponsor) 
    {
        // Create Sponsorship Token from Template
        PodSponsor token = PodSponsor(deployMinimal(address(sponsorshipTemplate), ""));
        token.initialize(_name, _symbol, _trustedForwarder, _pod);

        // Log Creation Event
        emit PodSponsorCreated(address(token), _pod);
        
        return sponsorshipTemplate;
    }
}

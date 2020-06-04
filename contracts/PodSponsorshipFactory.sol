pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@pooltogether/pooltogether-contracts/contracts/external/openzeppelin/ProxyFactory.sol";
import "./PodSponsorship.sol";

contract PodSponsorshipFactory is Initializable, ProxyFactory {

    PodSponsorship internal sponsorshipTemplate;

    /// @dev Initializes the Sponsorship-Factory and creates the Sponsorship-Template
    function initialize() 
        public 
        initializer 
    {
        sponsorshipTemplate = new PodSponsorship();
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
        returns (PodSponsorship) 
    {
        // Create Sponsorship Token from Template
        PodSponsorship token = PodSponsorship(deployMinimal(address(sponsorshipTemplate), ""));
        token.initialize(_name, _symbol, _trustedForwarder, _pod);
        return sponsorshipTemplate;
    }
}

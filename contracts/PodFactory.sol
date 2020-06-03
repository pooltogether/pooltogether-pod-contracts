pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@pooltogether/pooltogether-contracts/contracts/external/openzeppelin/ProxyFactory.sol";

import "./PodSponsorshipFactory.sol";
import "./PodSponsorship.sol";
import "./Pod.sol";

contract PodFactory is Initializable, ProxyFactory {

    Pod internal podTemplate;

    event PodCreated(address indexed podAddress, address indexed prizePoolManager);

    /// @dev Initializes the Pod-Factory and creates the Pod-Template
    function initialize() 
        public 
        initializer 
    {
        podTemplate = new Pod();
    }

    /// @notice Creates a new Pod
    /// @param _name The name of the Pod
    /// @param _symbol The Symbol for the Pod
    /// @param _trustedForwarder The Trusted-Forwarder for Meta-Txs
    /// @param _prizePoolManager  The address to the Prize Pool Manager Contract
    /// @param _podSponsorFactory  The address to the Pod-Sponsorship Token Factory
    /// @return The address of the newly created Pod
    function createPod(
        string memory _name,
        string memory _symbol,
        address _trustedForwarder,
        address _prizePoolManager,
        address _podSponsorFactory
    ) 
        public 
        returns (Pod) 
    {
        // Create Pod from Template
        Pod pod = Pod(deployMinimal(address(podTemplate), ""));

        // Create Pod-Sponsorship Token for this specific Pod
        PodSponsorship podSponsorToken = PodSponsorshipFactory(_podSponsorFactory).createSponsorship("Pod-Sponsor", "PSPON", _trustedForwarder, address(pod));

        // Initialize new Pod and link the Sponsorship Token
        pod.initialize(_name, _symbol, _trustedForwarder, _prizePoolManager, address(podSponsorToken));

        // Log Creation Event
        emit PodCreated(address(pod), _prizePoolManager);
        
        return podTemplate;
    }
}

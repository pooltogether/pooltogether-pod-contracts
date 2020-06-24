pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@pooltogether/pooltogether-contracts/contracts/external/openzeppelin/ProxyFactory.sol";

import "./PodTokenFactory.sol";
import "./PodToken.sol";
import "./Pod.sol";

contract PodFactory is Initializable, ProxyFactory {

    Pod internal podTemplate;
    PodTokenFactory internal tokenFactory;

    event PodCreated(address indexed podAddress, address indexed prizePoolManager);

    /// @dev Initializes the Pod-Factory and creates the Pod-Template
    function initialize(
        address _podTokenFactory
    ) 
        external 
        initializer 
    {
        podTemplate = new Pod();
        tokenFactory = PodTokenFactory(_podTokenFactory);
    }

    /// @notice Creates a new Pod
    /// @param _podSharesTokenName The name of the Pod-Shares Token
    /// @param _podSharesTokenSymbol The Symbol for the Pod-Shares Token
    /// @param _podSponsorTokenName The name of the Sponsorship Token
    /// @param _podSponsorTokenSymbol The Symbol for the Sponsorship Token
    /// @param _trustedForwarder The Trusted-Forwarder for Meta-Txs
    /// @param _prizePoolManager  The address to the Prize Pool Manager Contract
    /// @return The address of the newly created Pod
    function createPod(
        string calldata _podSharesTokenName,
        string calldata _podSharesTokenSymbol,
        string calldata _podSponsorTokenName,
        string calldata _podSponsorTokenSymbol,
        address _trustedForwarder,
        address _prizePoolManager
    ) 
        external 
        returns (Pod) 
    {
        // Create Pod from Template
        Pod pod = Pod(deployMinimal(address(podTemplate), ""));

        // Create Pod-Shares Token for this specific Pod
        PodToken podSharesToken = tokenFactory.createToken(_podSharesTokenName, _podSharesTokenSymbol, _trustedForwarder, address(pod));

        // Create Pod-Sponsorship Token for this specific Pod
        PodToken podSponsorToken = tokenFactory.createToken(_podSponsorTokenName, _podSponsorTokenSymbol, _trustedForwarder, address(pod));

        // Initialize new Pod and link the Sponsorship Token
        pod.initialize(_trustedForwarder, _prizePoolManager, address(podSharesToken), address(podSponsorToken));

        // Log Creation Event
        emit PodCreated(address(pod), _prizePoolManager);
        
        return podTemplate;
    }
}

pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@pooltogether/pooltogether-contracts/contracts/external/openzeppelin/ProxyFactory.sol";
import "./PodToken.sol";

contract PodTokenFactory is Initializable, ProxyFactory {

    PodToken internal tokenTemplate;

    /// @dev Initializes the Sponsorship-Factory and creates the Sponsorship-Template
    function initialize() 
        external 
        initializer 
    {
        tokenTemplate = new PodToken();
    }

    /// @notice Creates a new Pod Token
    /// @param _name The name of the Token
    /// @param _symbol The Symbol for the Token
    /// @param _trustedForwarder The Trusted-Forwarder for Meta-Txs
    /// @param _pod  The address to the Pod Contract
    /// @return The address of the newly created Token
    function createToken(
        string memory _name,
        string memory _symbol,
        address _trustedForwarder,
        address _pod
    ) 
        public 
        returns (PodToken)
    {
        // Create Sponsorship Token from Template
        PodToken token = PodToken(deployMinimal(address(tokenTemplate), ""));
        token.initialize(_name, _symbol, _trustedForwarder, _pod);
        return token;
    }
}

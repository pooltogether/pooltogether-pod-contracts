const { usePlugin } = require("@nomiclabs/buidler/config");
usePlugin("@nomiclabs/buidler-waffle");
usePlugin("buidler-gas-reporter");
usePlugin("solidity-coverage");
usePlugin("@nomiclabs/buidler-etherscan");

module.exports = {
  solc: {
    version: "0.6.4",
    optimizer: {
      enabled: false,
      runs: 200
    },
    evmVersion: "istanbul"
  },
  paths: {
    artifacts: "./build"
  },
  etherscan: {
    // The url for the Etherscan API you want to use.
    // For example, here we're using the one for the Ropsten test network
    url: process.env.ETHERSCAN_API_URL,
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: process.env.ETHERSCAN_API_KEY
  },
  networks: {
    buidlerevm: {
      allowUnlimitedContractSize: true,
      blockGasLimit: 20000000,
      gas: 20000000
    },
    coverage: {
      url: 'http://127.0.0.1:8555',
      gas: 20000000
    },
    local: {
      url: 'http://127.0.0.1:' + process.env.LOCAL_BUIDLEREVM_PORT,
      gas: 20000000,
      blockGasLimit: 20000000
    },
    // kovan: {
    //   accounts: {
    //     mnemonic: process.env.HDWALLET_MNEMONIC
    //   },
    //   url: process.env.INFURA_PROVIDER_URL_KOVAN,
    //   chainId: 42
    // },
  },
  gasReporter: {
    currency: 'USD',
    gasPrice: 1,
    outputFile: './gas-usage-report.log',
    noColors: true,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    excludeContracts: [
      'test/ERC20Mintable.sol'
    ],
    enabled: (process.env.REPORT_GAS) ? true : false
  }
};

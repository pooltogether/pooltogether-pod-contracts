'use strict';

var HDWalletProvider = require("truffle-hdwallet-provider")

const isCoverage = process.env.COVERAGE === 'true'

module.exports = {
  networks: {
    local: {
      host: 'localhost',
      port: 8545,
      gas: 6999999,
      gasPrice: 1 * 1000000000,
      network_id: '*'
    },

    // mainnet: {
    //   provider: () => new HDWalletProvider(
    //     process.env.HDWALLET_MNEMONIC,
    //     process.env.INFURA_PROVIDER_URL_MAINNET,
    //     0,
    //     3
    //   ),
    //   skipDryRun: true,
    //   network_id: 1,
    //   gas: 5000000
    //   // gasPrice: 11.101 * 1000000000
    // },

    mainnet_fork: {
      provider: () => new HDWalletProvider(
        process.env.HDWALLET_MNEMONIC,
        process.env.LOCALHOST_URL,
        0,
        3
      ),
      gas: 7000000,
      network_id: 999
      // gasPrice: 11.101 * 1000000000
    },

    kovan: {
      provider: () => new HDWalletProvider(
        process.env.HDWALLET_MNEMONIC,
        process.env.INFURA_PROVIDER_URL_KOVAN,
        0,
        3
      ),
      skipDryRun: true,
      network_id: 42
    }
  },

  plugins: ["solidity-coverage"],

  compilers: {
    solc: {
      version: "0.5.12",
      settings: {
        evmVersion: 'constantinpole'
      }
    }
  },

  // optimization breaks code coverage
  solc: {
    optimizer: {
      enabled: !isCoverage,
      runs: 200
    }
  },

  mocha: isCoverage ? {
    reporter: 'mocha-junit-reporter',
  } : {
    reporter: 'eth-gas-reporter',
    reporterOptions : {
      currency: 'USD',
      gasPrice: 10
    }
  }
};

# Pods

Pods allow users to pool their tickets together in PoolTogether.  They can exchange their tickets for Pod shares.

If you'd like to deploy Pods and a mock Pool so you can play with them try the [PoolTogether Mock](https://github.com/pooltogether/pooltogether-contracts-mock).

# Ethereum Networks

## Mainnet

| Contract      | Address (proxy)   | Address (implementation) | Code Version |
| -------       | --------          | ----------- | ----------- |
| DaiPod    | [0x9F4C5D8d9BE360DF36E67F52aE55C1B137B4d0C4](https://kovan.etherscan.io/address/0x9F4C5D8d9BE360DF36E67F52aE55C1B137B4d0C4) | [0x23AA976A4413aC655a237Ff01083D62B0C4971e4](https://kovan.etherscan.io/address/0x23AA976A4413aC655a237Ff01083D62B0C4971e4) | v0.3.1 |
| UsdcPod    | [0x6F5587E191C8b222F634C78111F97c4851663ba4](https://kovan.etherscan.io/address/0x6F5587E191C8b222F634C78111F97c4851663ba4) | [0xec6DAc8357245808608aACF97346762468e550A3](https://kovan.etherscan.io/address/0xec6DAc8357245808608aACF97346762468e550A3) | v0.3.1 |

## Kovan

| Contract      | Address (proxy)   | Address (implementation) |
| -------       | --------          | ----------- |
| DaiPod    | [0xc2A8F46b2991F322ce233360Bcf15375EB792223](https://kovan.etherscan.io/address/0xc2A8F46b2991F322ce233360Bcf15375EB792223) | [0xE8309a662C45CEaF5e9f52610B87A03d3A3C4C24](https://kovan.etherscan.io/address/0xE8309a662C45CEaF5e9f52610B87A03d3A3C4C24) |
| UsdcPod    | [0xbACF2e665B37F713C159705F59f5349F78858C2d](https://kovan.etherscan.io/address/0xbACF2e665B37F713C159705F59f5349F78858C2d) | [0xec6DAc8357245808608aACF97346762468e550A3](https://kovan.etherscan.io/address/0xec6DAc8357245808608aACF97346762468e550A3) |

# Development

## Setup

Clone the repo and then install deps:

```
$ yarn
```

Copy over .envrc and allow [direnv](https://direnv.net/):

```
$ cp .envrc.example .envrc
$ direnv allow
```

## Tests

Run tests:

```
$ yarn test
```

## Coverage 

Run coverage:

```
$ yarn coverage
```

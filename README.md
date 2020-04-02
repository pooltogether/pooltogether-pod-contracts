# Pods

Pods allow users to pool their tickets together in PoolTogether.  They can exchange their tickets for Pod shares.

If you'd like to deploy Pods and a mock Pool so you can play with them try the [PoolTogether Mock](https://github.com/pooltogether/pooltogether-contracts-mock).

# Ethereum Networks

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

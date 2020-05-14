# Pods

Pods allow users to pool their tickets together in PoolTogether.  They can exchange their tickets for Pod shares.

If you'd like to deploy Pods and a mock Pool so you can play with them try the [PoolTogether Mock](https://github.com/pooltogether/pooltogether-contracts-mock).

# Ethereum Networks

## Mainnet

| Contract      | Address (proxy)   | Address (implementation) | Code Version |
| -------       | --------          | ----------- | ----------- |
| DaiPod    | [0x9F4C5D8d9BE360DF36E67F52aE55C1B137B4d0C4](https://etherscan.io/address/0x9F4C5D8d9BE360DF36E67F52aE55C1B137B4d0C4) | [0x23AA976A4413aC655a237Ff01083D62B0C4971e4](https://etherscan.io/address/0x23AA976A4413aC655a237Ff01083D62B0C4971e4) | v0.3.2 |
| UsdcPod    | [0x6F5587E191C8b222F634C78111F97c4851663ba4](https://etherscan.io/address/0x6F5587E191C8b222F634C78111F97c4851663ba4) | [0xec6DAc8357245808608aACF97346762468e550A3](https://etherscan.io/address/0xec6DAc8357245808608aACF97346762468e550A3) | v0.3.2 |

## Kovan

| Contract      | Address (proxy)   | Address (implementation) |
| -------       | --------          | ----------- |
| DaiPod    | [0x395fcB67ff8fdf5b9e2AeeCc02Ef7A8DE87a6677](https://kovan.etherscan.io/address/0x395fcB67ff8fdf5b9e2AeeCc02Ef7A8DE87a6677) | [0x3fe4bf988948888F52a548d179140F6Aee01ABaA](https://kovan.etherscan.io/address/0x3fe4bf988948888F52a548d179140F6Aee01ABaA) |
| UsdcPod    | [0x9191Fd9f29cbbE73bA0e1B8959eC89Bc780e598b](https://kovan.etherscan.io/address/0x9191Fd9f29cbbE73bA0e1B8959eC89Bc780e598b) | [0xa2dA6860897aAB3b90384d150c9655a6356d0832](https://kovan.etherscan.io/address/0xa2dA6860897aAB3b90384d150c9655a6356d0832) |

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

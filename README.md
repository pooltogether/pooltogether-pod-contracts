# Pods

Pods allow users to pool their tickets together in PoolTogether.  They can exchange their tickets for Pod shares.

If you'd like to deploy Pods and a mock Pool so you can play with them try the [PoolTogether Mock](https://github.com/pooltogether/pooltogether-contracts-mock).

# Ethereum Networks

## Kovan

| Contract      | Address (proxy)   | Address (implementation) |
| -------       | --------          | ----------- |
| PoolDaiPod    | [0xc2A8F46b2991F322ce233360Bcf15375EB792223](https://kovan.etherscan.io/address/0xc2A8F46b2991F322ce233360Bcf15375EB792223) | [0xae3C0ca8f3D923301cBcfafEcC1da7D2897cc3F6](https://kovan.etherscan.io/address/0xae3C0ca8f3D923301cBcfafEcC1da7D2897cc3F6) |

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

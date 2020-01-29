# Pods

Pods allow users to pool their tickets together in PoolTogether.  They can exchange their tickets for Pod shares.

# Setup

Clone the repo and then install deps:

```
$ yarn
```

Copy over .envrc and allow [direnv](https://direnv.net/):

```
$ cp .envrc.example .envrc
$ direnv allow
```

Start the local Ethereum node using `ganache-cli`:

```
$ yarn start
```

Now deploy the contracts locally:

```
$ yarn migrate
```

To destroy your local deployment, run:

```
$ yarn reset
```

*Note: If you changed the mnemonic, you should update the ADMIN_ADDRESS variable in `.envrc` with another address (I use the second address listed when `ganache-cli` starts).*

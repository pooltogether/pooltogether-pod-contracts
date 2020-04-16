#!/usr/bin/env node
const chalk = require('chalk')
const { buildContext } = require('oz-console')
const commander = require('commander');
const { migrate } = require('./migrate')
const { runShell } = require('./runShell')

const program = new commander.Command()
program.option('-n --network [network]', 'select the network.', 'local')
program.option('-v --verbose', 'make all commands verbose', () => true)
program.option('-f --force', 'force the OpenZeppelin push command', () => true)
program.parse(process.argv)

let consoleNetwork, networkConfig, ozNetworkName

console.log(program.network)

switch (program.network) {
  case 'mainnet_fork':
    // runShell(`cp .openzeppelin/mainnet.json .openzeppelin/dev-999.json`)
    // runShell(`cp .oz-migrate/mainnet .oz-migrate/mainnet_fork`)
    // The network that the oz-console app should talk to.  (should really just use the ozNetworkName)
    consoleNetwork = process.env.LOCALHOST_URL

    // The OpenZeppelin SDK network name
    ozNetworkName = 'mainnet_fork'

    // The OpenZeppelin SDK network config that oz-console should use as reference
    networkConfig = '.openzeppelin/dev-999.json'
    break
  case 'mainnet':
    // The network that the oz-console app should talk to.  (should really just use the ozNetworkName)
    consoleNetwork = 'mainnet'

    // The OpenZeppelin SDK network name
    ozNetworkName = 'mainnet'

    // The OpenZeppelin SDK network config that oz-console should use as reference
    networkConfig = '.openzeppelin/mainnet.json'
    break
  case 'kovan':
    // The network that the oz-console app should talk to.  (should really just use the ozNetworkName)
    consoleNetwork = 'kovan'
    // The OpenZeppelin SDK network name
    ozNetworkName = 'kovan'
    // The OpenZeppelin SDK network config that oz-console should use as reference
    networkConfig = '.openzeppelin/kovan.json'
    break
  default:
    // The network that the oz-console app should talk to.  (should really just use the ozNetworkName)
    consoleNetwork = 'http://localhost:8545'

    // The OpenZeppelin SDK network name
    ozNetworkName = 'local'

    // The OpenZeppelin SDK network config that oz-console should use as reference
    networkConfig = '.openzeppelin/dev-1234.json'
    break
}

console.log(chalk.green(`Selected network is ${ozNetworkName}`))

function loadContext() {
  return buildContext({
    projectConfig: '.openzeppelin/project.json',
    network: consoleNetwork,
    networkConfig,
    directory: 'build/contracts',
    verbose: program.verbose,
    mnemonic: process.env.HDWALLET_MNEMONIC
  })
}

const ozOptions = program.verbose ? '' : '-s'

async function runMigrate() {
  const context = loadContext()

  context.reload = function () {
    const newContext = loadContext()
    Object.assign(context, newContext)
  }

  await migrate(context, ozNetworkName, ozOptions)
}

runMigrate().catch(error => {
  console.error(`Could not migrate: ${error.message}`, error)
})

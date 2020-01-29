#!/usr/bin/env node
const { Project } = require('oz-migrate')
const chalk = require('chalk')
const chai = require('chai')
const { runShell } = require('./runShell')

async function migrate(context, ozNetworkName, ozOptions = '') {
  console.log(chalk.yellow('Starting migration...'))

  const project = new Project('.oz-migrate')
  const migration = await project.migrationForNetwork(ozNetworkName)

  let poolDai
  if (ozNetworkName === 'mainnet') {
    poolDai = '0x29fe7D60DdF151E5b52e5FAB4f1325da6b2bD958'
  } else if (ozNetworkName === 'kovan') { //assume mainnet
    poolDai = '0xC3a62C8Af55c59642071bC171Ebd05Eb2479B663'
  } else {
    poolDai = process.env.POOL_DAI_ADDRESS_LOCALHOST
  }

  runShell(`oz session ${ozOptions} --network ${ozNetworkName} --from ${process.env.ADMIN_ADDRESS} --expires 3600 --timeout 600`)

  console.log(chalk.green('Starting Pod deployment'))

  await migration.migrate(10, async () => {
    runShell(`oz create Pod --init initialize --args ${poolDai}`)
    context.reload()
  })

  console.log(chalk.green('Done!'))
}

module.exports = {
  migrate
}

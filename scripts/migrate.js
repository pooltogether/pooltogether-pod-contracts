#!/usr/bin/env node
const { Project } = require('@pooltogether/oz-migrate')
const chalk = require('chalk')
const { runShell } = require('./runShell')

async function migrate(context, ozNetworkName, ozOptions = '') {
  console.log(chalk.yellow('Starting migration...'))

  const project = new Project('.oz-migrate')
  const migration = await project.migrationForNetwork(ozNetworkName)

  let poolDai, poolUsdc
  if (ozNetworkName === 'mainnet' || ozNetworkName === 'mainnet_fork') {
    poolDai = '0x29fe7D60DdF151E5b52e5FAB4f1325da6b2bD958'
    poolUsdc = '0x0034Ea9808E620A0EF79261c51AF20614B742B24'
  } else if (ozNetworkName === 'kovan') { //assume mainnet
    poolDai = '0xC3a62C8Af55c59642071bC171Ebd05Eb2479B663'
    poolUsdc = '0xa0B2A98d0B769886ec06562ee9bB3572Fa4f3aAb'
  } else {
    throw new Error(`Unknown network: ${ozNetworkName}`)
  }

  runShell(`oz session ${ozOptions} --network ${ozNetworkName} --from ${process.env.ADMIN_ADDRESS} --expires 3600 --timeout 600`)

  await migration.migrate(10, async () => {
    console.log(chalk.green('Starting DaiPod deployment...'))
    runShell(`oz create DaiPod --init initialize --args ${poolDai}`)
    context.reload()
  })

  await migration.migrate(20, async () => {
    console.log(chalk.green('Starting UsdcPod deployment...'))
    runShell(`oz create UsdcPod --init initialize --args ${poolUsdc}`)
    context.reload()
  })

  console.log(chalk.green('Done!'))
}

module.exports = {
  migrate
}

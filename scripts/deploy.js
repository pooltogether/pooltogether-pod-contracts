const { ethers } = require('@nomiclabs/buidler')
const fs = require('fs')

const _deploymentsFile = `${__dirname}/../deployments.json`

const _addDeployData = (deployData, contractName, contractInstance) => {
  const chainId = contractInstance.provider._network.chainId
  deployData[chainId] = deployData[chainId] || {}
  deployData[chainId][contractName] = {
    txHash:     contractInstance.deployTransaction.hash,
    address:    contractInstance.address,
    chainId:    chainId,
    abi:        contractInstance.interface.abi,
  }
}

const _readDeploymentsFile = () => {
  let raw = fs.readFileSync(_deploymentsFile, {encoding: 'utf8', flag: 'a+'})
  raw = Buffer.from(raw).toString()
  if (!raw.length) { raw = '{}' }
  return JSON.parse(raw)
}

const _writeDeploymentsFile = (deployData) => {
  fs.writeFileSync(_deploymentsFile, JSON.stringify(deployData, null, '\t'), {encoding: 'utf8', flag: 'w+'})
}

async function main() {
  // Get Contract Artifacts
  const PodSponsorshipFactory = await ethers.getContractFactory('PodSponsorshipFactory')
  const PodFactory = await ethers.getContractFactory('PodFactory')

  console.log("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
  console.log("PoolTogether Pods - Contract Deploy Script")
  console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n")

  // Deploy PodSponsorshipFactory
  console.log("Deploying PodSponsorshipFactory...")
  const podSponsorshipFactory = await PodSponsorshipFactory.deploy()
  await podSponsorshipFactory.deployed()

  // Deploy PodFactory
  console.log("Deploying PodFactory...")
  const podFactory = await PodFactory.deploy()
  await podFactory.deployed()

  // Display Contract Addresses
  console.log("\nContract Deployments Complete!\nAdresses:\n")
  console.log("PodSponsorshipFactory:", podSponsorshipFactory.address)
  console.log("PodFactory:           ", podFactory.address)
  console.log("\n\n")

  // Output Deployments file preserving existing data
  let deployData = _readDeploymentsFile()
  _addDeployData(deployData, 'PodSponsorshipFactory', podSponsorshipFactory)
  _addDeployData(deployData, 'PodFactory', podFactory)
  _writeDeploymentsFile(deployData)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })

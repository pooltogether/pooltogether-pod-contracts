const buidler = require('./helpers/buidler')

const { deployContract, deployMockContract } = require('ethereum-waffle')
const { expect } = require('chai')
const { deploy1820 } = require('deploy-eip-1820')

const PodFactory = require('../build/PodFactory.json')
const PodTokenFactory = require('../build/PodTokenFactory.json')

const debug = require('debug')('PodFactory.test')
const txOverrides = { gasLimit: 20000000 }

const _findLog = (logs, eventName) => {
  return logs.find((el) => (el && el['name'] === eventName))
}

describe('PodFactory Contract', function () {
  let wallet
  let podFactory
  let tokenFactory

  const POOL = {
    address: '0x1337c0d31337c0D31337C0d31337c0d31337C0d3'
  };
  const POD = {
    podSharesTokenName: 'Pod',
    podSharesTokenSymbol: 'POD',
    podSponsorTokenName: 'Sponsor',
    podSponsorTokenSymbol: 'SPON',
    forwarder: '0x1337c0d31337c0D31337C0d31337c0d31337C0d3',
    sharesToken: '0x1111111111111111111111111111111111111111',
    sponsorshipToken: '0x2222222222222222222222222222222222222222',
  };

  beforeEach(async () => {
    [wallet] = await buidler.ethers.getSigners()
    // debug({wallet})

    debug('deploying 1820...')
    registry = await deploy1820(wallet)

    debug('mocking PodTokenFactory...')
    tokenFactory = await deployMockContract(wallet, PodTokenFactory.abi, txOverrides)
    await tokenFactory.mock.createToken.returns(POD.sharesToken)

    // Contract(s) under Test
    debug('deploying PodFactory...')
    podFactory = await deployContract(wallet, PodFactory, [], txOverrides)
    debug('initializing...')
    await podFactory.initialize(tokenFactory.address)
  })

  describe('createPod()', function () {
    it('Should create functional Pods', async function () {
      // Create a new Pod with a Pool Address
      const result = await podFactory.createPod(
        POD.podSharesTokenName, 
        POD.podSharesTokenSymbol, 
        POD.podSponsorTokenName, 
        POD.podSponsorTokenSymbol, 
        POD.forwarder, 
        POOL.address
      )
      debug({ result })

      // Get a Receipt of the Transaction in order to verify Event Logs
      const receipt = await buidler.ethers.provider.getTransactionReceipt(result.hash)
      debug({ receipt })

      const logs = receipt.logs.map((log) => podFactory.interface.parseLog(log))
      debug({ logs })

      // Confirm Creation Event
      const expectedLog = _findLog(logs, 'PodCreated')
      expect(expectedLog).to.exist;
      expect(expectedLog.values.prizePoolManager).to.equal(POOL.address)

      // Confirm valid Pod contract
      let pod = await buidler.ethers.getContractAt('Pod', expectedLog.values.podAddress, wallet)
      expect(await pod.prizePoolManager()).to.equal(POOL.address)
    })
  })
})




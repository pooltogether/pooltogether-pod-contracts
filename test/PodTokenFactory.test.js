const buidler = require('./helpers/buidler')

const { deployContract, deployMockContract } = require('ethereum-waffle')
const { expect } = require('chai')
const { deploy1820 } = require('deploy-eip-1820')

const PodTokenFactory = require('../build/PodTokenFactory.json')
const PodToken = require('../build/PodToken.json')

const debug = require('debug')('PodTokenFactory.test')
const txOverrides = { gasLimit: 20000000 }

const _findLog = (logs, eventName) => {
  return logs.find((el) => (el && el['name'] === eventName))
}

describe('PodTokenFactory Contract', function () {
  let wallet
  let tokenFactory
  let podToken

  const TOKEN = {
    name: 'Pod Token',
    symbol: 'PTOKEN',
    forwarder: '0x1337c0d31337c0D31337C0d31337c0d31337C0d3',
    podToken: '',
    pod: '0x1337c0d31337c0D31337C0d31337c0d31337C0d3',
  };

  beforeEach(async () => {
    [wallet] = await buidler.ethers.getSigners()
    debug({ wallet })

    debug('deploying 1820...')
    registry = await deploy1820(wallet)

    debug('mocking PodToken...')
    podToken = await deployMockContract(wallet, PodToken.abi, txOverrides)
    TOKEN.podToken = podToken.address

    debug('mocking return values...')
    await podToken.mock.initialize.returns()

    // Contract(s) under Test
    debug('deploying PodTokenFactory...')
    tokenFactory = await deployContract(wallet, PodTokenFactory, [], txOverrides)
    debug('initializing...')
    await tokenFactory.initialize()
  })

  describe('createSponsorship()', function () {
    it('Should create functional Sponsorship Tokens', async function () {
      // Create a new Sponsorship Token & confirm event
      const result = await tokenFactory.createToken(TOKEN.name, TOKEN.symbol, TOKEN.forwarder, TOKEN.pod)
      debug({ result })

      // Get a Receipt of the Transaction in order to verify Event Logs
      const receipt = await buidler.ethers.provider.getTransactionReceipt(result.hash)
      debug({ receipt })

      const logs = receipt.logs.map((log) => tokenFactory.interface.parseLog(log))
      debug({ logs })

      // Confirm Creation Event
      const expectedLog = _findLog(logs, 'ProxyCreated')
      expect(expectedLog).to.exist;

      // Confirm valid PodToken Token contract
      let token = await buidler.ethers.getContractAt('PodToken', expectedLog.values.proxy, wallet)
      expect(await token.pod()).to.equal(TOKEN.pod)
    })
  })
})




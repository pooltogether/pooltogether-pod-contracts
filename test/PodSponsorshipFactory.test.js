const buidler = require('./helpers/buidler')

const { deployContract, deployMockContract } = require('ethereum-waffle')
const { expect } = require('chai')
const { deploy1820 } = require('deploy-eip-1820')

const PodSponsorshipFactory = require('../build/PodSponsorshipFactory.json')
const PodSponsorship = require('../build/PodSponsorship.json')

const debug = require('debug')('PodSponsorshipFactory.test')
const txOverrides = { gasLimit: 20000000 }

const _findLog = (logs, eventName) => {
  return logs.find((el) => (el && el['name'] === eventName))
}

describe('PodSponsorshipFactory Contract', function () {
  let wallet
  let sponsorshipFactory
  let podSponsorship

  const SPONSOR = {
    name: 'Pod Sponsor',
    symbol: 'PSPON',
    forwarder: '0x1337c0d31337c0D31337C0d31337c0d31337C0d3',
    podSponsorship: '',
    pod: '0x1337c0d31337c0D31337C0d31337c0d31337C0d3',
  };

  beforeEach(async () => {
    [wallet] = await buidler.ethers.getSigners()
    debug({ wallet })

    debug('deploying 1820...')
    registry = await deploy1820(wallet)

    debug('mocking PodSponsorship...')
    podSponsorship = await deployMockContract(wallet, PodSponsorship.abi, txOverrides)
    SPONSOR.podSponsorship = podSponsorship.address

    debug('mocking return values...')
    await podSponsorship.mock.initialize.returns()

    // Contract(s) under Test
    debug('deploying PodSponsorFactory...')
    sponsorshipFactory = await deployContract(wallet, PodSponsorshipFactory, [], txOverrides)
    debug('initializing...')
    await sponsorshipFactory.initialize()
  })

  describe('createSponsorship()', function () {
    it('Should create functional Sponsorship Tokens', async function () {
      // Create a new Sponsorship Token & confirm event
      const result = await sponsorshipFactory.createSponsorship(SPONSOR.name, SPONSOR.symbol, SPONSOR.forwarder, SPONSOR.pod)
      debug({ result })

      // Get a Receipt of the Transaction in order to verify Event Logs
      const receipt = await buidler.ethers.provider.getTransactionReceipt(result.hash)
      debug({ receipt })

      const logs = receipt.logs.map((log) => sponsorshipFactory.interface.parseLog(log))
      debug({ logs })

      // Confirm Creation Event
      const expectedLog = _findLog(logs, 'PodSponsorshipCreated')
      expect(expectedLog).to.exist;
      expect(expectedLog.values.pod).to.equal(SPONSOR.pod)

      // Confirm valid PodSponsorship Token contract
      let token = await buidler.ethers.getContractAt('PodSponsorship', expectedLog.values.token, wallet)
      expect(await token.sponsoredPod()).to.equal(SPONSOR.pod)
    })
  })
})




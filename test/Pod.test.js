
const buidler = require('./helpers/buidler')
const { expect, use } = require('chai')
const { ethers } = buidler // require('ethers')
const { getCurrentBlockTime } = require('./helpers/blockTime')
const { increaseTime } = require('./helpers/increaseTime')

const { deployMockModule, Constants } = require('@pooltogether/pooltogether-contracts')
const { deployContract, deployMockContract, solidity, MockProvider } = require('ethereum-waffle')
const { deploy1820 } = require('deploy-eip-1820')

const ModuleManagerHarness = require('@pooltogether/pooltogether-contracts/build/ModuleManagerHarness.json')
const Ticket = require('@pooltogether/pooltogether-contracts/build/Ticket.json')
const Timelock = require('@pooltogether/pooltogether-contracts/build/Timelock.json')
const PeriodicPrizePool = require('@pooltogether/pooltogether-contracts/build/PeriodicPrizePool.json')
const CompoundYieldService = require('@pooltogether/pooltogether-contracts/build/CompoundYieldService.json')
const ERC20Mintable = require('@pooltogether/pooltogether-contracts/build/ERC20Mintable.json')

const LogParser = require('./helpers/logParser')
const getIterable = require('./helpers/iterable')

const Pod = require('../build/Pod.json')
const PodHarness = require('../build/PodHarness.json')
const PodToken = require('../build/PodToken.json')

const toWei = ethers.utils.parseEther
const toEther = ethers.utils.formatEther
const debug = require('debug')('Pod.test')
const txOverrides = { gasLimit: 20000000 }




const _mintSharesInPod = (pod) =>
  async (amount, operator, reciever) =>
    await _depositAssetsIntoPod('mintShares', pod, amount, operator, reciever)

const _mintSponsorshipInPod = (pod) =>
  async (amount, operator, reciever) =>
    await _depositAssetsIntoPod('mintSponsorship', pod, amount, operator, reciever)

const _depositAssetsIntoPod = async (method, pod, amount, operator, reciever = {}) => {
  // Perform Deposit of Assets
  const operatorAddress = operator._address || operator.address
  const recieverAddress = reciever._address || reciever.address || operatorAddress
  const result = await pod.connect(operator)[method](recieverAddress, amount)
  const receipt = await buidler.ethers.provider.getTransactionReceipt(result.hash)
  return { result, receipt }
}




use(solidity)

describe('Pod Contract', function () {
  let wallet
  let otherWallet
  let manager
  let registry
  let pod
  let prizePool
  let token
  let sharesToken
  let sponsorshipToken
  let mintShares
  let mintSponsorship

  const POD = {
    name: 'Pod',
    symbol: 'POD',
    forwarder: '0x1337c0d31337c0D31337C0d31337c0d31337C0d3',
  };

  const _findLog = (receipt, eventName) => {
    const logs = receipt.logs.map((log) => pod.interface.parseLog(log))
    return logs.find((el) => (el && el['name'] === eventName))
  }

  beforeEach(async () => {
    [wallet, otherWallet] = await buidler.ethers.getSigners()

    // [wallet, otherWallet] = new MockProvider().getWallets()

    debug('creating manager and registry...')
    manager = await deployContract(wallet, ModuleManagerHarness, [], txOverrides)
    await manager.initialize()
    registry = await deploy1820(wallet)

    debug('mocking PeriodicPrizePool...')
    prizePool = await deployMockModule(wallet, manager, PeriodicPrizePool.abi, Constants.PRIZE_POOL_INTERFACE_HASH)

    debug('mocking CompoundYieldService...')
    yieldService = await deployMockModule(wallet, manager, CompoundYieldService.abi, Constants.YIELD_SERVICE_INTERFACE_HASH)

    debug('mocking Timelock...')
    timelock = await deployMockModule(wallet, manager, Timelock.abi, Constants.TIMELOCK_INTERFACE_HASH)

    debug('mocking ERC20Mintable...')
    token = await deployMockContract(wallet, ERC20Mintable.abi, txOverrides)

    debug('mocking Ticket...')
    ticket = await deployMockModule(wallet, manager, Ticket.abi, Constants.TICKET_INTERFACE_HASH)

    debug('mocking Pod Shares Token...')
    sharesToken = await deployMockContract(wallet, PodToken.abi, txOverrides)

    debug('mocking Pod Sponsorship Token...')
    sponsorshipToken = await deployMockContract(wallet, PodToken.abi, txOverrides)

    debug('deploying Pod...')
    pod = await deployContract(wallet, PodHarness, [], txOverrides)
    podLog = LogParser(pod)

    debug('mocking return values...')
    await yieldService.mock.token.returns(token.address)
    await token.mock.transferFrom.returns(true)
    await token.mock.transfer.returns(true)
    await token.mock.approve.returns(true)
    await token.mock.mint.returns(true)
    await timelock.mock.sweep.withArgs([pod.address]).returns(toWei('0'))

    debug('initializing Pod...')
    await pod.initialize(POD.forwarder, manager.address, sharesToken.address, sponsorshipToken.address)

    // Minting functions for Pod
    mintShares = _mintSharesInPod(pod)
    mintSponsorship = _mintSponsorshipInPod(pod)
  })

  describe('prizePool()', function () {
    it('should return the ModuleManager address for the Prize Pool', async function () {
      expect(await pod.prizePoolManager()).to.equal(manager.address)
    })
  })

  describe('initialize()', () => {
    it('should set the params', async () => {
      expect(await pod.podShares()).to.equal(sharesToken.address)
      expect(await pod.podSponsorship()).to.equal(sponsorshipToken.address)
      expect(await pod.getTrustedForwarder()).to.equal(POD.forwarder)
    })
  })

  describe('balanceOfUnderlying()', function () {
    it('should return the amount of Assets deposited by the user', async function () {
      const startAmount = toWei('1000')
      const prizeAmount = toWei('1000')
      const firstAmount = toWei('100')   // 10% of Pod
      const secondAmount = toWei('250')  // 25% of Pod
      const thirdAmount = toWei('500')   // 50% of Pod

      // No Prize Yet; Shares and Ticket Balances match
      await sharesToken.mock.totalSupply.returns(startAmount)
      await ticket.mock.balanceOf.withArgs(pod.address).returns(startAmount)

      // Test Balance Before Prize (minted 1:1)
      await sharesToken.mock.balanceOf.withArgs(wallet._address).returns(firstAmount)
      expect(await pod.balanceOfUnderlying(wallet._address)).to.equal(firstAmount)

      // Simulate Prize; increase Tickets across Shares
      await ticket.mock.balanceOf.withArgs(pod.address).returns(startAmount.add(prizeAmount))

      // Test Balance After Prize
      await sharesToken.mock.balanceOf.withArgs(wallet._address).returns(firstAmount)
      expect(await pod.balanceOfUnderlying(wallet._address)).to.equal(firstAmount.mul(2))

      await sharesToken.mock.balanceOf.withArgs(wallet._address).returns(secondAmount)
      expect(await pod.balanceOfUnderlying(wallet._address)).to.equal(secondAmount.mul(2))

      await sharesToken.mock.balanceOf.withArgs(wallet._address).returns(thirdAmount)
      expect(await pod.balanceOfUnderlying(wallet._address)).to.equal(thirdAmount.mul(2))

      // Test Deposits After Prize
      expect(await pod.calculateSharesOnDeposit(firstAmount)).to.equal(firstAmount.div(2))
      expect(await pod.calculateSharesOnDeposit(secondAmount)).to.equal(secondAmount.div(2))
      expect(await pod.calculateSharesOnDeposit(thirdAmount)).to.equal(thirdAmount.div(2))
    })
  })



















  //
  // Mint/Redeem Pod-Shares
  //






















  describe('mintShares()', function () {
    it('should accept asset-tokens from user and deposit into prize-pool', async function () {
      const amountToDeposit = toWei('10')

      // Mocks for Deposit
      await sharesToken.mock.totalSupply.returns(toWei('0'))
      await sharesToken.mock.mint.returns()
      await ticket.mock.mintTickets.withArgs(amountToDeposit).returns()

      // Perform Deposit
      debug('depositing assets...')
      const { receipt } = await mintShares(amountToDeposit, wallet)
      debug({ receipt })

      // Confirm Pod-Shares were minted to user
      // expect('mint').to.be.calledOnContractWith(sharesToken, [wallet._address, amountToDeposit])

      // Confirm Deposit Event
      podLog.confirmEventLog(receipt, 'PodDeposit', {
        operator: wallet._address,
        receiver: wallet._address,
        amount: amountToDeposit,
        shares: amountToDeposit,
      })
    })

    it('should accept asset-tokens from operator and deposit into prize-pool for user', async function () {
      const amountToDeposit = toWei('10')
      const operator = wallet
      const receiver = otherWallet

      // Mocks for Deposit
      await sharesToken.mock.totalSupply.returns(toWei('0'))
      await sharesToken.mock.mint.returns()
      await ticket.mock.mintTickets.withArgs(amountToDeposit).returns()

      // Perform Deposit
      debug('depositing assets for user...')
      const { receipt } = await mintShares(amountToDeposit, operator, receiver)
      debug({ receipt })

      // Confirm Pod-Shares were minted to user not operator
      // expect('mint').to.be.calledOnContractWith(sharesToken, [receiver._address, amountToDeposit])

      // Confirm Deposit Event
      podLog.confirmEventLog(receipt, 'PodDeposit', {
        operator: operator._address,
        receiver: receiver._address,
        amount: amountToDeposit,
        shares: amountToDeposit,
      })
    })

    // TODO:
    //   1. Have "Bob" buy tickets
    //   2. Have the Pod win
    //   3. Have "Alice" buy tickets"
    //   4. Now assert that Alice's underlying balance matches her deposit
    it('should calculate shares accurately when depositing assets into the pool')
  })











  describe('redeemSharesInstantly()', () => {
    it('should prevent a user from redeeming more shares than they hold', async () => {
      const userShares = toWei('10')

      debug('redeeming excessive shares...')
      await sharesToken.mock.balanceOf.withArgs(wallet._address).returns(userShares)
      await expect(pod.redeemSharesInstantly(userShares.mul(2)))
        .to.be.revertedWith('Pod: Insufficient share balance')
    })

    it('should allow a user to pay to redeem their pod-shares instantly', async () => {
      const userShares = toWei('10')

      // Mock Pod-Shares/Tickets
      await sharesToken.mock.balanceOf.withArgs(wallet._address).returns(userShares)
      await sharesToken.mock.totalSupply.returns(userShares)
      await sharesToken.mock.burnFrom.withArgs(wallet._address, userShares).returns()
      await ticket.mock.balanceOf.withArgs(pod.address).returns(userShares)
      // should return userShares minus a small fee
      await ticket.mock.redeemTicketsInstantly.withArgs(userShares).returns(userShares.sub(100))

      // Redeem Pod-Shares
      debug('redeeming shares...')
      const result = await pod.redeemSharesInstantly(userShares)
      const receipt = await buidler.ethers.provider.getTransactionReceipt(result.hash)

      // Confirm Redeem Event
      const expectedLog = podLog.confirmEventLog(receipt, 'PodRedeemed', {
        operator: wallet._address,
        receiver: wallet._address,
        shares: userShares,
        tickets: userShares,
      })
      // debug({ expectedLog })

      // Confirm Fee has been taken
      let fee = userShares.sub(expectedLog.values.amount)
      expect(fee.gt(ethers.utils.bigNumberify('0'))).to.be.true
      expect(expectedLog.values.amount.add(fee)).to.equal(userShares)
    })
  })










  describe('operatorRedeemSharesInstantly()', () => {
    it('should prevent an operator from redeeming more shares than a user holds', async () => {
      const userShares = toWei('10')
      const operator = wallet
      const receiver = otherWallet

      debug('redeeming excessive shares...')
      await sharesToken.mock.allowance.withArgs(receiver._address, operator._address).returns(userShares.mul(2))
      await sharesToken.mock.balanceOf.withArgs(receiver._address).returns(userShares)
      await expect(pod.connect(operator).operatorRedeemSharesInstantly(receiver._address, userShares.mul(2)))
        .to.be.revertedWith('Pod: Insufficient share balance');
    })

    it('should allow an operator to pay to redeem pod-shares instantly for a user', async () => {
      const userShares = toWei('10')
      const operator = wallet
      const receiver = otherWallet

      // Mock Pod-Shares/Tickets
      await sharesToken.mock.allowance.withArgs(receiver._address, operator._address).returns(userShares)
      await sharesToken.mock.balanceOf.withArgs(receiver._address).returns(userShares)
      await sharesToken.mock.totalSupply.returns(userShares)
      await sharesToken.mock.burnFrom.withArgs(receiver._address, userShares).returns()
      await ticket.mock.balanceOf.withArgs(pod.address).returns(userShares)
      // should return userShares minus a small fee
      await ticket.mock.redeemTicketsInstantly.withArgs(userShares).returns(userShares.sub(100))

      // Redeem Pod-Shares
      debug('redeeming shares...')
      const result = await pod.connect(operator).operatorRedeemSharesInstantly(receiver._address, userShares)
      const receipt = await buidler.ethers.provider.getTransactionReceipt(result.hash)

      // Confirm Redeem Event
      const expectedLog = podLog.confirmEventLog(receipt, 'PodRedeemed', {
        operator: operator._address,
        receiver: receiver._address,
        shares: userShares,
        tickets: userShares,
      })
      // debug({ expectedLog })

      // Confirm Fee has been taken
      let fee = userShares.sub(expectedLog.values.amount)
      expect(fee.gt(ethers.utils.bigNumberify('0'))).to.be.true
      expect(expectedLog.values.amount.add(fee)).to.equal(userShares)
    })

    it('should disallow anyone other than the operator to redeem pod-shares instantly', async () => {
      // Try to Redeem Pod-Shares
      debug('unauthorized user attempting to redeem shares...')
      await sharesToken.mock.allowance.withArgs(wallet._address, otherWallet._address).returns(toWei('0'))
      await expect(pod.connect(otherWallet).operatorRedeemSharesInstantly(wallet._address, toWei('100')))
        .to.be.revertedWith('Pod/exceeds-allowance');
    })
  })









  describe('redeemSharesWithTimelock()', () => {
    it('should prevent a user from redeeming more shares than they hold', async () => {
      const userShares = toWei('10')

      debug('redeeming excessive shares...')
      await sharesToken.mock.balanceOf.withArgs(wallet._address).returns(userShares)
      await expect(pod.redeemSharesWithTimelock(userShares.mul(2)))
        .to.be.revertedWith('Pod: Insufficient share balance');
    })

    it('should allow a user to redeem their pod-shares with a timelock on the assets', async () => {
      const userShares = toWei('10')
      const prizeEndTime = (await getCurrentBlockTime()) + 1000

      // Mock Pod-Shares/Tickets
      await sharesToken.mock.balanceOf.withArgs(wallet._address).returns(userShares)
      await sharesToken.mock.totalSupply.returns(userShares)
      await sharesToken.mock.burnFrom.withArgs(wallet._address, userShares).returns()
      // await timelock.mock.sweep.withArgs([pod.address]).returns(userShares)
      await ticket.mock.balanceOf.withArgs(pod.address).returns(userShares)
      await ticket.mock.redeemTicketsWithTimelock.withArgs(userShares).returns(prizeEndTime)

      // Redeem Pod-Shares with Timelock
      debug('redeeming shares with timelock...')
      const result = await pod.redeemSharesWithTimelock(userShares)
      const receipt = await buidler.ethers.provider.getTransactionReceipt(result.hash)

      // Confirm timelocked tokens were minted to user
      expect(await pod.getTimelockBalance(wallet._address)).to.equal(userShares)

      // Confirm Redeem Event
      const expectedLog = podLog.confirmEventLog(receipt, 'PodRedeemedWithTimelock', {
        operator: wallet._address,
        receiver: wallet._address,
        timestamp: prizeEndTime,
        amount: toWei('0'),  // No funds swept
        shares: userShares,
        tickets: userShares,
      })
      // debug({ expectedLog })
    })

    it('should allow a user to redeem their pod-shares without a timelock if they have credit', async () => {
      const userShares = toWei('10')
      const timeBasedCredit = 100
      const prizeEndTime = (await getCurrentBlockTime()) - timeBasedCredit

      // Mock Pod-Shares/Tickets
      await sharesToken.mock.balanceOf.withArgs(wallet._address).returns(userShares)
      await sharesToken.mock.totalSupply.returns(userShares)
      await sharesToken.mock.burnFrom.withArgs(wallet._address, userShares).returns()
      // await timelock.mock.sweep.withArgs([pod.address]).returns(userShares)
      await ticket.mock.balanceOf.withArgs(pod.address).returns(userShares)
      await ticket.mock.redeemTicketsWithTimelock.withArgs(userShares).returns(prizeEndTime)

      // Redeem Timelocked Pod-Shares with Credit
      debug('redeeming timelocked shares with credit...')
      const result = await pod.redeemSharesWithTimelock(userShares)
      const receipt = await buidler.ethers.provider.getTransactionReceipt(result.hash)

      // Confirm NO timelocked tokens were minted to user
      expect(await pod.getTimelockBalance(wallet._address)).to.equal(toWei('0'))

      // Confirm Redeem Event
      const expectedLog = podLog.confirmEventLog(receipt, 'PodRedeemedWithTimelock', {
        operator: wallet._address,
        receiver: wallet._address,
        timestamp: prizeEndTime,
        amount: userShares,  // Assets redeemed instantly from sweep
        shares: userShares,
        tickets: userShares,
      })
      // debug({ expectedLog })
    })
  })












  describe('operatorRedeemSharesWithTimelock()', () => {
    it('should prevent an operator from redeeming more shares than a user holds', async () => {
      const userShares = toWei('10')
      const operator = wallet
      const receiver = otherWallet

      debug('redeeming excessive shares for user...')
      await sharesToken.mock.allowance.withArgs(receiver._address, operator._address).returns(userShares.mul(2))
      await sharesToken.mock.balanceOf.withArgs(receiver._address).returns(userShares)
      await expect(pod.connect(operator).operatorRedeemSharesWithTimelock(receiver._address, userShares.mul(2)))
        .to.be.revertedWith('Pod: Insufficient share balance');
    })

    it('should allow an operator to redeem pod-shares with a timelock on the assets for a user', async () => {
      const userShares = toWei('10')
      const prizeEndTime = (await getCurrentBlockTime()) + 1000
      const operator = wallet
      const receiver = otherWallet

      // Mock Pod-Shares/Tickets
      await sharesToken.mock.allowance.withArgs(receiver._address, operator._address).returns(userShares)
      await sharesToken.mock.balanceOf.withArgs(receiver._address).returns(userShares)
      await sharesToken.mock.totalSupply.returns(userShares)
      await sharesToken.mock.burnFrom.withArgs(receiver._address, userShares).returns()
      // await timelock.mock.sweep.withArgs([pod.address]).returns(userShares)
      await ticket.mock.balanceOf.withArgs(pod.address).returns(userShares)
      await ticket.mock.redeemTicketsWithTimelock.withArgs(userShares).returns(prizeEndTime)

      // Redeem Pod-Shares with Timelock
      debug('redeeming shares with timelock...')
      const result = await pod.connect(operator).operatorRedeemSharesWithTimelock(receiver._address, userShares)
      const receipt = await buidler.ethers.provider.getTransactionReceipt(result.hash)

      // Confirm timelocked tokens were minted to user
      expect(await pod.getTimelockBalance(receiver._address)).to.equal(userShares)

      // Confirm timelock duration
      expect(await pod.getUnlockTimestamp(receiver._address)).to.equal(prizeEndTime)

      // Confirm Redeem Event
      const expectedLog = podLog.confirmEventLog(receipt, 'PodRedeemedWithTimelock', {
        operator: operator._address,
        receiver: receiver._address,
        timestamp: prizeEndTime,
        amount: toWei('0'),  // No funds swept
        shares: userShares,
        tickets: userShares,
      })
      // debug({ expectedLog })
    })

    it('should disallow anyone other than the operator to redeem pod-shares with a timelock', async () => {
      // Try to Redeem Pod-Shares
      debug('unauthorized user attempting to redeem shares...')
      await sharesToken.mock.allowance.withArgs(wallet._address, otherWallet._address).returns(toWei('0'))
      await expect(pod.connect(otherWallet).operatorRedeemSharesWithTimelock(wallet._address, toWei('100')))
        .to.be.revertedWith('Pod/exceeds-allowance');
    })
  })


















  //
  // Mint/Redeem Sponsorship Tokens
  //


















  describe('mintSponsorship()', () => {
    it('should allow a user to sponsor the pod receiving sponsorship tokens', async () => {
      const amountToDeposit = toWei('10')

      // Mocks for Sponsorship
      await sponsorshipToken.mock.totalSupply.returns(toWei('0'))
      await sponsorshipToken.mock.mint.returns()
      await ticket.mock.mintTickets.withArgs(amountToDeposit).returns()

      // Perform Sponsorship
      debug('depositing assets...')
      const { receipt } = await mintSponsorship(amountToDeposit, wallet)
      debug({ receipt })

      // Confirm Pod-Shares were minted to user
      // expect('mint').to.be.calledOnContractWith(sponsorshipToken, [wallet._address, amountToDeposit])

      // Confirm Sponsorship Event
      podLog.confirmEventLog(receipt, 'PodSponsored', {
        operator: wallet._address,
        receiver: wallet._address,
        amount: amountToDeposit,
      })
    })

    it('should allow an operator to sponsor the pod for a user who receives sponsorship tokens', async () => {
      const amountToDeposit = toWei('10')
      const operator = wallet
      const receiver = otherWallet

      // Mocks for Sponsorship
      await sponsorshipToken.mock.totalSupply.returns(toWei('0'))
      await sponsorshipToken.mock.mint.returns()
      await ticket.mock.mintTickets.withArgs(amountToDeposit).returns()

      // Perform Sponsorship
      debug('depositing assets...')
      const { receipt } = await mintSponsorship(amountToDeposit, operator, receiver)
      debug({ receipt })

      // Confirm Pod-Shares were minted to user
      // expect('mint').to.be.calledOnContractWith(sponsorshipToken, [receiver._address, amountToDeposit])

      // Confirm Sponsorship Event
      podLog.confirmEventLog(receipt, 'PodSponsored', {
        operator: operator._address,
        receiver: receiver._address,
        amount: amountToDeposit,
      })
    })
  })






  describe('redeemSponsorshipInstantly()', () => {
    it('should prevent a user from redeeming more sponsorship tokens than they hold', async () => {
      const userTokens = toWei('10')

      debug('redeeming excessive sponsorship tokens...')
      await sponsorshipToken.mock.balanceOf.withArgs(wallet._address).returns(userTokens)
      await expect(pod.redeemSponsorshipInstantly(userTokens.mul(2)))
        .to.be.revertedWith('Pod: Insufficient sponsorship balance');
    })

    it('should allow a user to redeem sponsorship tokens for their underlying assets instantly', async () => {
      const userTokens = toWei('10')

      // Mock Pod-Sponsorship/Tickets
      await sponsorshipToken.mock.balanceOf.withArgs(wallet._address).returns(userTokens)
      await sponsorshipToken.mock.totalSupply.returns(userTokens)
      await sponsorshipToken.mock.burnFrom.withArgs(wallet._address, userTokens).returns()
      await ticket.mock.balanceOf.withArgs(pod.address).returns(userTokens)
      // should return userTokens minus a small fee
      await ticket.mock.redeemTicketsInstantly.withArgs(userTokens).returns(userTokens.sub(100))

      // Redeem Pod-Sponsorship
      debug('redeeming sponsorship tokens...')
      const result = await pod.redeemSponsorshipInstantly(userTokens)
      const receipt = await buidler.ethers.provider.getTransactionReceipt(result.hash)

      // Confirm Redeem Event
      const expectedLog = podLog.confirmEventLog(receipt, 'PodSponsorRedeemed', {
        operator: wallet._address,
        receiver: wallet._address,
        tokens: userTokens,
      })
      // debug({ expectedLog })

      // Confirm Fee has been taken
      let fee = userTokens.sub(expectedLog.values.assets)
      expect(fee.gt(ethers.utils.bigNumberify('0'))).to.be.true
      expect(expectedLog.values.assets.add(fee)).to.equal(userTokens)
    })
  })






  describe('operatorRedeemSponsorshipInstantly()', () => {
    it('should prevent an operator from redeeming more sponsorship tokens than a user holds', async () => {
      const userTokens = toWei('10')
      const operator = wallet
      const receiver = otherWallet

      debug('redeeming excessive sponsorship tokens...')
      await sponsorshipToken.mock.allowance.withArgs(receiver._address, operator._address).returns(userTokens.mul(2))
      await sponsorshipToken.mock.balanceOf.withArgs(receiver._address).returns(userTokens)
      await expect(pod.connect(operator).operatorRedeemSponsorshipInstantly(receiver._address, userTokens.mul(2)))
        .to.be.revertedWith('Pod: Insufficient sponsorship balance');
    })

    it('should allow an operator to redeem sponsorship tokens for their underlying assets instantly for a user', async () => {
      const userTokens = toWei('10')
      const operator = wallet
      const receiver = otherWallet

      // Mock Pod-Shares/Tickets
      await sponsorshipToken.mock.allowance.withArgs(receiver._address, operator._address).returns(userTokens)
      await sponsorshipToken.mock.balanceOf.withArgs(receiver._address).returns(userTokens)
      await sponsorshipToken.mock.totalSupply.returns(userTokens)
      await sponsorshipToken.mock.burnFrom.withArgs(receiver._address, userTokens).returns()
      await ticket.mock.balanceOf.withArgs(pod.address).returns(userTokens)
      // should return userTokens minus a small fee
      await ticket.mock.redeemTicketsInstantly.withArgs(userTokens).returns(userTokens.sub(100))

      // Redeem Pod-Sponsorship
      debug('redeeming shares...')
      const result = await pod.connect(operator).operatorRedeemSponsorshipInstantly(receiver._address, userTokens)
      const receipt = await buidler.ethers.provider.getTransactionReceipt(result.hash)

      // Confirm Redeem Event
      const expectedLog = podLog.confirmEventLog(receipt, 'PodSponsorRedeemed', {
        operator: operator._address,
        receiver: receiver._address,
        tokens: userTokens,
      })
      // debug({ expectedLog })

      // Confirm Fee has been taken
      let fee = userTokens.sub(expectedLog.values.assets)
      expect(fee.gt(ethers.utils.bigNumberify('0'))).to.be.true
      expect(expectedLog.values.assets.add(fee)).to.equal(userTokens)
    })

    it('should disallow anyone other than operator to redeem sponsorship tokens instantly', async () => {
      // Try to Redeem Pod-Shares
      debug('unauthorized user attempting to redeem sponsorship tokens...')
      await sponsorshipToken.mock.allowance.withArgs(wallet._address, otherWallet._address).returns(toWei('0'))
      await expect(pod.connect(otherWallet).operatorRedeemSponsorshipInstantly(wallet._address, toWei('100')))
        .to.be.revertedWith('Pod/exceeds-allowance');
    })
  })









  describe('redeemSponsorshipWithTimelock()', () => {
    it('should prevent a user from redeeming more sponsorship tokens than they hold', async () => {
      const userTokens = toWei('10')

      debug('redeeming excessive shares...')
      await sponsorshipToken.mock.balanceOf.withArgs(wallet._address).returns(userTokens)
      await expect(pod.redeemSponsorshipWithTimelock(userTokens.mul(2)))
        .to.be.revertedWith('Pod: Insufficient sponsorship balance');
    })

    it('should allow a user to redeem sponsorship tokens with a timelock on the assets', async () => {
      const userTokens = toWei('10')
      const prizeEndTime = (await getCurrentBlockTime()) + 1000

      // Mock Pod-Shares/Tickets
      await sponsorshipToken.mock.balanceOf.withArgs(wallet._address).returns(userTokens)
      await sponsorshipToken.mock.totalSupply.returns(userTokens)
      await sponsorshipToken.mock.burnFrom.withArgs(wallet._address, userTokens).returns()
      // await timelock.mock.sweep.withArgs([pod.address]).returns(userTokens)
      await ticket.mock.balanceOf.withArgs(pod.address).returns(userTokens)
      await ticket.mock.redeemTicketsWithTimelock.withArgs(userTokens).returns(prizeEndTime)

      // Redeem Pod-Shares with Timelock
      debug('redeeming shares with timelock...')
      const result = await pod.redeemSponsorshipWithTimelock(userTokens)
      const receipt = await buidler.ethers.provider.getTransactionReceipt(result.hash)

      // Confirm timelocked tokens were minted to user
      expect(await pod.getTimelockBalance(wallet._address)).to.equal(userTokens)

      // Confirm Redeem Event
      const expectedLog = podLog.confirmEventLog(receipt, 'PodSponsorRedeemedWithTimelock', {
        operator: wallet._address,
        receiver: wallet._address,
        timestamp: prizeEndTime,
        assets: toWei('0'),  // No funds swept
        tokens: userTokens,
      })
      // debug({ expectedLog })
    })

    it('should allow a user to redeem their sponsorship tokens without a timelock if they have credit', async () => {
      const userTokens = toWei('10')
      const timeBasedCredit = 100
      const prizeEndTime = (await getCurrentBlockTime()) - timeBasedCredit

      // Mock Pod-Shares/Tickets
      await sponsorshipToken.mock.balanceOf.withArgs(wallet._address).returns(userTokens)
      await sponsorshipToken.mock.totalSupply.returns(userTokens)
      await sponsorshipToken.mock.burnFrom.withArgs(wallet._address, userTokens).returns()
      // await timelock.mock.sweep.withArgs([pod.address]).returns(userTokens)
      await ticket.mock.balanceOf.withArgs(pod.address).returns(userTokens)
      await ticket.mock.redeemTicketsWithTimelock.withArgs(userTokens).returns(prizeEndTime)

      // Redeem Timelocked Pod-Shares with Credit
      debug('redeeming timelocked sponsorship tokens with credit...')
      const result = await pod.redeemSponsorshipWithTimelock(userTokens)
      const receipt = await buidler.ethers.provider.getTransactionReceipt(result.hash)

      // Confirm NO timelocked tokens were minted to user
      expect(await pod.getTimelockBalance(wallet._address)).to.equal(toWei('0'))

      // Confirm Redeem Event
      const expectedLog = podLog.confirmEventLog(receipt, 'PodSponsorRedeemedWithTimelock', {
        operator: wallet._address,
        receiver: wallet._address,
        timestamp: prizeEndTime,
        assets: userTokens,  // Assets redeemed instantly from sweep
        tokens: userTokens,
      })
      // debug({ expectedLog })
    })
  })













  describe('operatorRedeemSponsorshipWithTimelock()', () => {
    it('should prevent an operator from redeeming more sponsorship tokens than a user holds', async () => {
      const userTokens = toWei('10')
      const operator = wallet
      const receiver = otherWallet

      debug('redeeming excessive shares for user...')
      await sponsorshipToken.mock.allowance.withArgs(receiver._address, operator._address).returns(userTokens.mul(2))
      await sponsorshipToken.mock.balanceOf.withArgs(receiver._address).returns(userTokens)
      await expect(pod.connect(operator).operatorRedeemSponsorshipWithTimelock(receiver._address, userTokens.mul(2)))
        .to.be.revertedWith('Pod: Insufficient sponsorship balance');
    })

    it('should allow an operator to redeem sponsorship tokens with a timelock on the assets for a user', async () => {
      const userTokens = toWei('10')
      const prizeEndTime = (await getCurrentBlockTime()) + 1000
      const operator = wallet
      const receiver = otherWallet

      // Mock Pod-Shares/Tickets
      await sponsorshipToken.mock.allowance.withArgs(receiver._address, operator._address).returns(userTokens)
      await sponsorshipToken.mock.balanceOf.withArgs(receiver._address).returns(userTokens)
      await sponsorshipToken.mock.totalSupply.returns(userTokens)
      await sponsorshipToken.mock.burnFrom.withArgs(receiver._address, userTokens).returns()
      // await timelock.mock.sweep.withArgs([pod.address]).returns(userTokens)
      await ticket.mock.balanceOf.withArgs(pod.address).returns(userTokens)
      await ticket.mock.redeemTicketsWithTimelock.withArgs(userTokens).returns(prizeEndTime)

      // Redeem Sponsorship with Timelock
      debug('redeeming shares with timelock...')
      const result = await pod.connect(operator).operatorRedeemSponsorshipWithTimelock(receiver._address, userTokens)
      const receipt = await buidler.ethers.provider.getTransactionReceipt(result.hash)

      // Confirm timelocked tokens were minted to user
      expect(await pod.getTimelockBalance(receiver._address)).to.equal(userTokens)

      // Confirm timelock duration
      expect(await pod.getUnlockTimestamp(receiver._address)).to.equal(prizeEndTime)

      // Confirm Redeem Event
      const expectedLog = podLog.confirmEventLog(receipt, 'PodSponsorRedeemedWithTimelock', {
        operator: operator._address,
        receiver: receiver._address,
        timestamp: prizeEndTime,
        assets: toWei('0'),  // No funds swept
        tokens: userTokens,
      })
      // debug({ expectedLog })
    })

    it('should disallow anyone other than the operator to redeem sponsorship tokens with a timelock', async () => {
      // Try to Redeem Pod-Shares
      debug('unauthorized user attempting to redeem sponsorship tokens...')
      await sponsorshipToken.mock.allowance.withArgs(wallet._address, otherWallet._address).returns(toWei('0'))
      await expect(pod.connect(otherWallet).operatorRedeemSponsorshipWithTimelock(wallet._address, toWei('100')))
        .to.be.revertedWith('Pod/exceeds-allowance');
    })
  })











  //
  // Sweep & Exchange Rate
  //

  describe('sweepForUser()', () => {
    it('should allow anyone to sweep the pod for multiple users', async () => {
      const numAccounts = 5
      const iterableAccounts = getIterable(await buidler.ethers.getSigners(), numAccounts)
      const accountAddresses = []
      const blockTime = await getCurrentBlockTime()
      const unlockTime = 100
      const amountToDeposit = toWei('10')
      const ticketTotal = amountToDeposit.mul(numAccounts)

      // Preset the Timelock Balance/Timestamp
      for await (let user of iterableAccounts()) {
        await pod.setUnlockTimestamp(user._address, blockTime + unlockTime) // Timelocked
        await pod.setTimelockBalance(user._address, amountToDeposit)
        accountAddresses.push(user._address)
      }

      // Attempt to Sweep early BEFORE Redeeming for All Users
      debug('Sweeping early BEFORE redeem...')
      debug({accountAddresses})
      let result = await pod.sweepForUsers(accountAddresses)
      let receipt = await buidler.ethers.provider.getTransactionReceipt(result.hash)
      podLog.confirmEventLog(receipt, 'PodSwept', {
        total: toWei('0'),  // No funds swept
      })

      // Increase time to release the locked assets
      await increaseTime(unlockTime * 2)

      // Attempt to Sweep for all Users
      debug('Sweeping for all users...')
      result = await pod.sweepForUsers(accountAddresses)
      receipt = await buidler.ethers.provider.getTransactionReceipt(result.hash)
      podLog.confirmEventLog(receipt, 'PodSwept', {
        total: ticketTotal
      })

      // Confirm everything was swept properly
      for await (let user of iterableAccounts()) {
        expect(await pod.getTimelockBalance(user._address)).to.equal(toWei('0'))
      }
    })
  })












  // describe('Exchange Rates', () => {
  //   it('should calculate accurate exchange rates', async () => {
  //     const accounts = await buidler.ethers.getSigners()
  //     let podCollateral = toWei('50')
  //     let depositAmount = toWei('10')
  //     let prizeAmount = toWei('20')
  //     let sharesAfterPrize = toWei('8')
  //     let ticketsAfterPrize = toWei('12.5')
  //     let userShares
  //     let userTickets
  //     let userIndex

  //     // Give the Pod an existing balance
  //     await ticket.mock.balanceOf.withArgs(pod.address).returns(toWei('0'))
  //     await ticket.mock.mintTickets.withArgs(podCollateral).returns()
  //     debug('prefunding pod...')
  //     await mintShares(podCollateral, accounts[9])

  //     //
  //     //  Step 1 - Deposits before Prize
  //     //

  //     // Deposit for User 1
  //     userIndex = 0
  //     await ticket.mock.balanceOf.withArgs(pod.address).returns(podCollateral)
  //     await ticket.mock.mintTickets.withArgs(depositAmount).returns()
  //     debug(`depositing assets for User #${userIndex + 1}...`)
  //     expect(await pod.calculateSharesOnDeposit(depositAmount)).to.equal(depositAmount)
  //     await mintShares(depositAmount, accounts[userIndex])

  //     // Confirm Balance
  //     userShares = await pod.balanceOf(accounts[userIndex]._address)
  //     debug({ userShares: toEther(userShares) })
  //     expect(userShares).to.equal(depositAmount)
  //     podCollateral = podCollateral.add(depositAmount)


  //     // Deposit for User 2
  //     userIndex = 1
  //     await ticket.mock.balanceOf.withArgs(pod.address).returns(podCollateral)
  //     await ticket.mock.mintTickets.withArgs(depositAmount).returns()
  //     debug(`depositing assets for User #${userIndex + 1}...`)
  //     expect(await pod.calculateSharesOnDeposit(depositAmount)).to.equal(depositAmount)
  //     await mintShares(depositAmount, accounts[userIndex])

  //     // Confirm Balance
  //     userShares = await pod.balanceOf(accounts[userIndex]._address)
  //     debug({ userShares: toEther(userShares) })
  //     expect(userShares).to.equal(depositAmount)
  //     podCollateral = podCollateral.add(depositAmount)


  //     // Deposit for User 3
  //     userIndex = 2
  //     await ticket.mock.balanceOf.withArgs(pod.address).returns(podCollateral)
  //     await ticket.mock.mintTickets.withArgs(depositAmount).returns()
  //     debug(`depositing assets for User #${userIndex + 1}...`)
  //     expect(await pod.calculateSharesOnDeposit(depositAmount)).to.equal(depositAmount)
  //     await mintShares(depositAmount, accounts[userIndex])

  //     // Confirm Balance
  //     userShares = await pod.balanceOf(accounts[userIndex]._address)
  //     debug({ userShares: toEther(userShares) })
  //     expect(userShares).to.equal(depositAmount)
  //     podCollateral = podCollateral.add(depositAmount)

  //     //
  //     //  Step 2 - Award Prize to Pod
  //     //

  //     // Simulate Pod Prize by increasing Pod Balance
  //     debug('Simulating Prize to Pod...')
  //     podCollateral = podCollateral.add(prizeAmount)

  //     //
  //     //  Step 3 - Deposits after Prize
  //     //

  //     // Deposit for User 4
  //     userIndex = 3
  //     await ticket.mock.balanceOf.withArgs(pod.address).returns(podCollateral)
  //     await ticket.mock.mintTickets.withArgs(depositAmount).returns()
  //     debug(`depositing assets for User #${userIndex + 1}...`)
  //     expect(await pod.calculateSharesOnDeposit(depositAmount)).to.equal(sharesAfterPrize)
  //     await mintShares(depositAmount, accounts[userIndex])

  //     // Confirm Balance
  //     userShares = await pod.balanceOf(accounts[userIndex]._address)
  //     debug({ userShares: toEther(userShares) })
  //     expect(userShares).to.equal(sharesAfterPrize)
  //     podCollateral = podCollateral.add(depositAmount)


  //     // Deposit for User 5
  //     userIndex = 4
  //     await ticket.mock.balanceOf.withArgs(pod.address).returns(podCollateral)
  //     await ticket.mock.mintTickets.withArgs(depositAmount).returns()
  //     debug(`depositing assets for User #${userIndex + 1}...`)
  //     expect(await pod.calculateSharesOnDeposit(depositAmount)).to.equal(sharesAfterPrize)
  //     await mintShares(depositAmount, accounts[userIndex])

  //     // Confirm Balance
  //     userShares = await pod.balanceOf(accounts[userIndex]._address)
  //     debug({ userShares: toEther(userShares) })
  //     expect(userShares).to.equal(sharesAfterPrize)
  //     podCollateral = podCollateral.add(depositAmount)

  //     //
  //     //  Step 4 - Redeem after Prize
  //     //

  //     await ticket.mock.balanceOf.withArgs(pod.address).returns(podCollateral)

  //     // Calculate Redeem for User 1 to 3
  //     userIndex = 0
  //     debug(`calculating redeem assets for User #1-3...`)
  //     userTickets = await pod.calculateTicketsOnRedeem(depositAmount)
  //     debug({ userTickets: toEther(userTickets) })
  //     expect(userTickets).to.equal(ticketsAfterPrize)

  //     // Calculate Redeem for User 4 to 5
  //     userIndex = 3
  //     debug(`calculating redeem assets for User #4-5...`)
  //     userTickets = await pod.calculateTicketsOnRedeem(sharesAfterPrize)
  //     debug({ userTickets: toEther(userTickets) })
  //     expect(userTickets).to.equal(depositAmount)
  //   })
  // })
})

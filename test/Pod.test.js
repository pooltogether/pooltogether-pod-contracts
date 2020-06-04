const buidler = require('./helpers/buidler')
const { increaseTime } = require('./helpers/increaseTime')
const { deployMockModule, Constants } = require('@pooltogether/pooltogether-contracts')

const { deployContract, deployMockContract, MockProvider } = require('ethereum-waffle')
const { deploy1820 } = require('deploy-eip-1820')
const { ethers } = require('ethers')
const { expect } = require('chai')

const ModuleManagerHarness = require('@pooltogether/pooltogether-contracts/build/ModuleManagerHarness.json')
const Ticket = require('@pooltogether/pooltogether-contracts/build/Ticket.json')
const Timelock = require('@pooltogether/pooltogether-contracts/build/Timelock.json')
const PeriodicPrizePool = require('@pooltogether/pooltogether-contracts/build/PeriodicPrizePool.json')
const CompoundYieldService = require('@pooltogether/pooltogether-contracts/build/CompoundYieldService.json')
const ERC20Mintable = require('@pooltogether/pooltogether-contracts/build/ERC20Mintable.json')

const Pod = require('../build/Pod.json')
const PodSponsorship = require('../build/PodSponsorship.json')

const toWei = ethers.utils.parseEther
const toEther = ethers.utils.formatEther
const debug = require('debug')('Pod.test')
const txOverrides = { gasLimit: 20000000 }

const _depositAssetsIntoPod = async (pod, amount, account) => {
  // Perform Deposit of Assets
  let result
  if (!!account) {
    result = await pod.connect(account).deposit(amount)
  } else {
    result = await pod.deposit(amount)
  }
  const receipt = await buidler.ethers.provider.getTransactionReceipt(result.hash)
  return { result, receipt }
}

describe('Pod Contract', function () {
  let wallet
  let otherWallet
  let pod
  let prizePool
  let token
  let sponsorship

  const MGR = {
    address: ''
  };
  const POD = {
    name: 'Pod',
    symbol: 'POD',
    forwarder: '0x1337c0d31337c0D31337C0d31337c0d31337C0d3',
    sponsorshipToken: '',
  };

  const _findLog = (receipt, eventName) => {
    const logs = receipt.logs.map((log) => pod.interface.parseLog(log))
    return logs.find((el) => (el && el['name'] === eventName))
  }

  beforeEach(async () => {
    [wallet, otherWallet] = await buidler.ethers.getSigners()

    debug('creating manager and registry...')
    manager = await deployContract(wallet, ModuleManagerHarness, [], txOverrides)
    await manager.initialize()
    registry = await deploy1820(wallet)
    MGR.address = manager.address;

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

    debug('mocking PodSponsorship...')
    sponsorship = await deployMockContract(wallet, PodSponsorship.abi, txOverrides)
    POD.sponsorshipToken = sponsorship.address

    debug('mocking return values...')
    await yieldService.mock.token.returns(token.address)
    await token.mock.transferFrom.returns(true)
    await token.mock.transfer.returns(true)
    await token.mock.approve.returns(true)
    await token.mock.mint.returns(true)

    debug('deploying Pod...')
    pod = await deployContract(wallet, Pod, [], txOverrides)

    debug('initializing Pod...')
    await pod.initialize(POD.name, POD.symbol, POD.forwarder, MGR.address, POD.sponsorshipToken)
  })

  describe('prizePool()', function () {
    it('should return the ModuleManager address for the Prize Pool', async function () {
      expect(await pod.prizePoolManager()).to.equal(MGR.address)
    })
  })

  describe('initialize()', () => {
    it('should set the params', async () => {
      expect(await pod.name()).to.equal(POD.name)
      expect(await pod.symbol()).to.equal(POD.symbol)
      expect(await pod.getTrustedForwarder()).to.equal(POD.forwarder)
    })
  })

  describe('balanceOfUnderlying()', function () {
    it('should return the amount of Assets deposited by the user', async function () {
      const firstAmount = toWei('15')
      const secondAmount = toWei('25')
      const thirdAmount = toWei('150')

      // First Deposit (first wallet)
      await ticket.mock.balanceOf.withArgs(pod.address).returns(toWei('0'))
      await ticket.mock.mintTickets.withArgs(firstAmount).returns()
      await pod.deposit(firstAmount)
      expect(await pod.balanceOf(wallet._address)).to.equal(firstAmount)

      // Total Supply
      expect(await pod.totalSupply()).to.equal(firstAmount)

      // Second Deposit (second wallet)
      await ticket.mock.balanceOf.withArgs(pod.address).returns(firstAmount)
      await ticket.mock.mintTickets.withArgs(secondAmount).returns()
      await pod.connect(otherWallet).deposit(secondAmount)
      expect(await pod.balanceOf(otherWallet._address)).to.equal(secondAmount)

      // Total Supply
      expect(await pod.totalSupply()).to.equal(firstAmount.add(secondAmount))

      // Third Deposit (first wallet)
      await ticket.mock.balanceOf.withArgs(pod.address).returns(firstAmount.add(secondAmount))
      await ticket.mock.mintTickets.withArgs(thirdAmount).returns()
      await pod.deposit(thirdAmount)
      expect(await pod.balanceOf(wallet._address)).to.equal(firstAmount.add(thirdAmount))

      // Total Supply
      expect(await pod.totalSupply()).to.equal(firstAmount.add(secondAmount).add(thirdAmount))
    })
  })

  describe('deposit()', function () {
    it('should accept asset-tokens from user and deposit into prize-pool', async function () {
      const amountToDeposit = toWei('10')

      // Confirm initial Pod balance
      await token.mock.balanceOf.withArgs(wallet._address).returns(toWei('0'))
      expect(await pod.balanceOfUnderlying(wallet._address)).to.equal(toWei('0'))

      // Mocks for Deposit
      await token.mock.balanceOf.withArgs(MGR.address).returns(amountToDeposit)
      await ticket.mock.mintTickets.withArgs(amountToDeposit).returns()

      // Perform Deposit
      debug('depositing assets...')
      const { receipt } = await _depositAssetsIntoPod(pod, amountToDeposit)
      debug({ receipt })

      // Confirm assets were moved to Prize Pool
      expect(await token.balanceOf(MGR.address)).to.equal(amountToDeposit)

      // Confirm Pod-Shares were minted to user
      expect(await pod.balanceOf(wallet._address)).to.equal(amountToDeposit) // Minted 1:1 on first deposit

      // Confirm Deposit Event
      const expectedLog = _findLog(receipt, 'PodDeposit')
      expect(expectedLog).to.exist;
      expect(expectedLog.values.from).to.equal(wallet._address)
      expect(expectedLog.values.amount).to.equal(amountToDeposit)
      expect(expectedLog.values.shares).to.equal(amountToDeposit)
    })
  })

  describe('redeemSharesInstantly()', () => {
    it('should allow a user to pay to redeem their pod-shares instantly', async () => {
      const amountToDeposit = toWei('10')

      // Confirm initial Wallet balance
      await token.mock.balanceOf.withArgs(wallet._address).returns(toWei('0'))
      expect(await pod.balanceOfUnderlying(wallet._address)).to.equal(toWei('0'))

      // Mocks for Deposit
      await token.mock.balanceOf.withArgs(MGR.address).returns(amountToDeposit)
      await ticket.mock.mintTickets.withArgs(amountToDeposit).returns()

      // Perform Deposit
      debug('depositing assets...')
      await _depositAssetsIntoPod(pod, amountToDeposit)

      // Track amount of Pod-Shares to be Redeemed
      await token.mock.balanceOf.withArgs(wallet._address).returns(amountToDeposit)
      const userShares = await pod.balanceOf(wallet._address)
      const userAssets = await token.balanceOf(wallet._address)
      debug({
        userShares: toEther(userShares),
        userAssets: toEther(userAssets)
      })

      debug('increasing time...')
      await increaseTime(4)

      // Try to Redeem too many Pod-Shares
      debug('redeeming excessive shares...')
      await expect(pod.redeemSharesInstantly(userShares.mul(2)))
        .to.be.revertedWith('Pod: Insufficient share balance');

      // Redeem Pod-Shares
      debug('redeeming shares...')
      await ticket.mock.redeemTicketsInstantly.withArgs(userShares).returns(userAssets.sub(100))
      await ticket.mock.balanceOf.withArgs(pod.address).returns(userShares)
      const result = await pod.redeemSharesInstantly(userShares)
      const receipt = await buidler.ethers.provider.getTransactionReceipt(result.hash)

      // Confirm Redeem Event
      const expectedLog = _findLog(receipt, 'PodRedeemed')
      expect(expectedLog).to.exist;
      expect(expectedLog.values.to).to.equal(wallet._address)
      debug({ expectedLog })

      // Confirm Fee has been taken
      let fee = userShares.sub(expectedLog.values.amount)
      debug({ fee })
      expect(fee.gt(ethers.utils.bigNumberify('0'))).to.be.true

      // Confirm Shares Burned
      expect(await pod.balanceOf(wallet._address)).to.equal(toWei('0'))

      // Confirm Event Values
      expect(expectedLog.values.amount.add(fee)).to.equal(amountToDeposit)
      expect(expectedLog.values.shares).to.equal(amountToDeposit)
      expect(expectedLog.values.tickets).to.equal(amountToDeposit)
    })
  })

  describe('redeemSharesWithTimelock()', () => {
    it('should allow a user to redeem their pod-shares with a timelock on the assets', async () => {
      const amountToDeposit = toWei('10')

      // Confirm initial Wallet balance
      await token.mock.balanceOf.withArgs(wallet._address).returns(toWei('0'))
      expect(await pod.balanceOfUnderlying(wallet._address)).to.equal(toWei('0'))

      // Mocks for Deposit
      await token.mock.balanceOf.withArgs(MGR.address).returns(amountToDeposit)
      await ticket.mock.mintTickets.withArgs(amountToDeposit).returns()

      // Perform Deposit
      debug('depositing assets...')
      await _depositAssetsIntoPod(pod, amountToDeposit)

      // Track amount of Pod-Shares to be Redeemed
      await token.mock.balanceOf.withArgs(wallet._address).returns(amountToDeposit)
      const userShares = await pod.balanceOf(wallet._address)
      const userAssets = await token.balanceOf(wallet._address)
      debug({
        userShares: toEther(userShares),
        userAssets: toEther(userAssets)
      })

      const block = await buidler.ethers.provider.getBlockNumber()
      const blockTime = (await buidler.ethers.provider.getBlock(block)).timestamp
      const prizeEndTime = blockTime + 10
      debug({ blockTime, prizeEndTime })

      // Try to Redeem too many Pod-Shares
      debug('redeeming excessive shares...')
      await expect(pod.redeemSharesWithTimelock(userShares.mul(2)))
        .to.be.revertedWith('Pod: Insufficient share balance');

      // Redeem Pod-Shares with Timelock
      debug('redeeming shares with timelock...')
      await ticket.mock.redeemTicketsWithTimelock.withArgs(userShares).returns(prizeEndTime)
      await ticket.mock.balanceOf.withArgs(pod.address).returns(userShares)
      await timelock.mock.sweep.withArgs([pod.address]).returns(userAssets)

      const result = await pod.redeemSharesWithTimelock(userShares)
      const receipt = await buidler.ethers.provider.getTransactionReceipt(result.hash)

      // Confirm Shares Burned
      expect(await pod.balanceOf(wallet._address)).to.equal(toWei('0'))

      // Confirm timelocked tokens were minted to user
      expect(await pod.getTimelockBalance(wallet._address)).to.equal(amountToDeposit)

      // Confirm timelock duration
      expect(await pod.getUnlockTimestamp(wallet._address)).to.equal(prizeEndTime)

      // Confirm Redeem Event
      const expectedLog = _findLog(receipt, 'PodRedeemedWithTimelock')
      expect(expectedLog).to.exist;
      expect(expectedLog.values.to).to.equal(wallet._address)
      debug({ expectedLog })

      // Confirm Event Values
      expect(expectedLog.values.timestamp).to.equal(prizeEndTime)
      expect(expectedLog.values.amountRedeemed).to.equal(toWei('0'))
      expect(expectedLog.values.shares).to.equal(amountToDeposit)
      expect(expectedLog.values.tickets).to.equal(amountToDeposit)
    })
  })

  describe('sweepForUser()', () => {
    it('should allow a user to redeem their unlocked assets', async () => {
      const amountToDeposit = toWei('10')
      const amountToRedeem = toWei('4')
      const remainderToRedeem = toWei('6')

      // Mocks for Deposit
      await token.mock.balanceOf.withArgs(MGR.address).returns(amountToDeposit)
      await ticket.mock.mintTickets.withArgs(amountToDeposit).returns()

      // Perform Deposit
      debug('depositing assets...')
      await _depositAssetsIntoPod(pod, amountToDeposit)

      // Track amount of Pod-Shares to be Redeemed
      await token.mock.balanceOf.withArgs(wallet._address).returns(amountToDeposit)
      const userShares = await pod.balanceOf(wallet._address)
      const userAssets = await token.balanceOf(wallet._address)
      debug({
        userShares: toEther(userShares),
        userAssets: toEther(userAssets)
      })

      const block = await buidler.ethers.provider.getBlockNumber()
      const blockTime = (await buidler.ethers.provider.getBlock(block)).timestamp
      const prizeEndTime = blockTime + 10
      debug({ blockTime, prizeEndTime })
      prizePool.mock.prizePeriodEndAt.returns(prizeEndTime)

      //
      // First Redeem
      //
      // Redeem Pod-Shares with Timelock
      debug('redeeming shares with timelock BEFORE currentPrize')
      await ticket.mock.redeemTicketsWithTimelock.withArgs(amountToRedeem).returns(prizeEndTime)
      await ticket.mock.balanceOf.withArgs(pod.address).returns(userShares)
      await timelock.mock.sweep.withArgs([pod.address]).returns(toWei('0')) // First call sweeps nothing

      let result = await pod.redeemSharesWithTimelock(amountToRedeem)
      let receipt = await buidler.ethers.provider.getTransactionReceipt(result.hash)

      // Confirm shares burned & timelocked tokens minted
      expect(await pod.getTimelockBalance(wallet._address)).to.equal(amountToRedeem)
      expect(await pod.balanceOf(wallet._address)).to.equal(remainderToRedeem)

      // Confirm Redeem Event
      let expectedLog = _findLog(receipt, 'PodRedeemedWithTimelock')
      expect(expectedLog).to.exist;
      expect(expectedLog.values.amountRedeemed).to.equal(toWei('0'))

      // Increase time to release the locked assets
      await increaseTime(20)

      //
      // Second Redeem
      //
      // Redeem Pod-Shares with Timelock
      debug('redeeming shares with timelock AFTER currentPrize')
      await ticket.mock.redeemTicketsWithTimelock.withArgs(remainderToRedeem).returns(prizeEndTime + 1000)
      await ticket.mock.balanceOf.withArgs(pod.address).returns(remainderToRedeem)
      await timelock.mock.sweep.withArgs([pod.address]).returns(amountToRedeem) // Second call sweeps last amount redeemed

      result = await pod.redeemSharesWithTimelock(remainderToRedeem)
      receipt = await buidler.ethers.provider.getTransactionReceipt(result.hash)

      // Confirm shares burned & timelocked tokens minted
      expect(await pod.getTimelockBalance(wallet._address)).to.equal(remainderToRedeem)
      expect(await pod.balanceOf(wallet._address)).to.equal(toWei('0'))

      // Confirm Redeem Event
      expectedLog = _findLog(receipt, 'PodRedeemedWithTimelock')
      expect(expectedLog).to.exist;
      expect(expectedLog.values.to).to.equal(wallet._address)
      debug({ expectedLog })

      // Confirm the user received the unlocked assets
      expect(expectedLog.values.amountRedeemed).to.equal(amountToRedeem)
    })
  })


  describe('Exchange Rates', () => {
    it('should calculate accurate exchange rates', async () => {
      const accounts = await buidler.ethers.getSigners()
      let podCollateral = toWei('50')
      let depositAmount = toWei('10')
      let prizeAmount = toWei('20')
      let sharesAfterPrize = toWei('8')
      let ticketsAfterPrize = toWei('12.5')
      let userShares
      let userTickets
      let userIndex

      // Give the Pod an existing balance
      await ticket.mock.balanceOf.withArgs(pod.address).returns(toWei('0'))
      await ticket.mock.mintTickets.withArgs(podCollateral).returns()
      debug('prefunding pod...')
      await _depositAssetsIntoPod(pod, podCollateral, accounts[9])

      //
      //  Step 1 - Deposits before Prize
      //

      // Deposit for User 1
      userIndex = 0
      await ticket.mock.balanceOf.withArgs(pod.address).returns(podCollateral)
      await ticket.mock.mintTickets.withArgs(depositAmount).returns()
      debug(`depositing assets for User #${userIndex + 1}...`)
      expect(await pod.calculateSharesOnDeposit(depositAmount)).to.equal(depositAmount)
      await _depositAssetsIntoPod(pod, depositAmount, accounts[userIndex])

      // Confirm Balance
      userShares = await pod.balanceOf(accounts[userIndex]._address)
      debug({ userShares: toEther(userShares) })
      expect(userShares).to.equal(depositAmount)
      podCollateral = podCollateral.add(depositAmount)


      // Deposit for User 2
      userIndex = 1
      await ticket.mock.balanceOf.withArgs(pod.address).returns(podCollateral)
      await ticket.mock.mintTickets.withArgs(depositAmount).returns()
      debug(`depositing assets for User #${userIndex + 1}...`)
      expect(await pod.calculateSharesOnDeposit(depositAmount)).to.equal(depositAmount)
      await _depositAssetsIntoPod(pod, depositAmount, accounts[userIndex])

      // Confirm Balance
      userShares = await pod.balanceOf(accounts[userIndex]._address)
      debug({ userShares: toEther(userShares) })
      expect(userShares).to.equal(depositAmount)
      podCollateral = podCollateral.add(depositAmount)


      // Deposit for User 3
      userIndex = 2
      await ticket.mock.balanceOf.withArgs(pod.address).returns(podCollateral)
      await ticket.mock.mintTickets.withArgs(depositAmount).returns()
      debug(`depositing assets for User #${userIndex + 1}...`)
      expect(await pod.calculateSharesOnDeposit(depositAmount)).to.equal(depositAmount)
      await _depositAssetsIntoPod(pod, depositAmount, accounts[userIndex])

      // Confirm Balance
      userShares = await pod.balanceOf(accounts[userIndex]._address)
      debug({ userShares: toEther(userShares) })
      expect(userShares).to.equal(depositAmount)
      podCollateral = podCollateral.add(depositAmount)

      //
      //  Step 2 - Award Prize to Pod
      //

      // Simulate Pod Prize by increasing Pod Balance
      debug('Simulating Prize to Pod...')
      podCollateral = podCollateral.add(prizeAmount)

      //
      //  Step 3 - Deposits after Prize
      //

      // Deposit for User 4
      userIndex = 3
      await ticket.mock.balanceOf.withArgs(pod.address).returns(podCollateral)
      await ticket.mock.mintTickets.withArgs(depositAmount).returns()
      debug(`depositing assets for User #${userIndex + 1}...`)
      expect(await pod.calculateSharesOnDeposit(depositAmount)).to.equal(sharesAfterPrize)
      await _depositAssetsIntoPod(pod, depositAmount, accounts[userIndex])

      // Confirm Balance
      userShares = await pod.balanceOf(accounts[userIndex]._address)
      debug({ userShares: toEther(userShares) })
      expect(userShares).to.equal(sharesAfterPrize)
      podCollateral = podCollateral.add(depositAmount)


      // Deposit for User 5
      userIndex = 4
      await ticket.mock.balanceOf.withArgs(pod.address).returns(podCollateral)
      await ticket.mock.mintTickets.withArgs(depositAmount).returns()
      debug(`depositing assets for User #${userIndex + 1}...`)
      expect(await pod.calculateSharesOnDeposit(depositAmount)).to.equal(sharesAfterPrize)
      await _depositAssetsIntoPod(pod, depositAmount, accounts[userIndex])

      // Confirm Balance
      userShares = await pod.balanceOf(accounts[userIndex]._address)
      debug({ userShares: toEther(userShares) })
      expect(userShares).to.equal(sharesAfterPrize)
      podCollateral = podCollateral.add(depositAmount)

      //
      //  Step 4 - Redeem after Prize
      //

      await ticket.mock.balanceOf.withArgs(pod.address).returns(podCollateral)

      // Calculate Redeem for User 1 to 3
      userIndex = 0
      debug(`calculating redeem assets for User #1-3...`)
      userTickets = await pod.calculateTicketsOnRedeem(depositAmount)
      debug({ userTickets: toEther(userTickets) })
      expect(userTickets).to.equal(ticketsAfterPrize)

      // Calculate Redeem for User 4 to 5
      userIndex = 3
      debug(`calculating redeem assets for User #4-5...`)
      userTickets = await pod.calculateTicketsOnRedeem(sharesAfterPrize)
      debug({ userTickets: toEther(userTickets) })
      expect(userTickets).to.equal(depositAmount)
    })
  })
})




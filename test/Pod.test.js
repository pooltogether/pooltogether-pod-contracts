const toWei = require('./helpers/toWei')
const chai = require('./helpers/chai')
const PoolContext = require('./helpers/PoolContext')
const Token = artifacts.require('Token.sol')
const Pod = artifacts.require('Pod.sol')
const PodContext = require('./helpers/PodContext')
const BN = require('bn.js')
const {
  ZERO_ADDRESS
} = require('./helpers/constants')

const tenMillion = toWei('10000000')

contract('Pod', (accounts) => {
  const [owner, admin, user1, user2, user3] = accounts

  let pod
  let token, registry, pool, poolToken

  let poolContext = new PoolContext({ web3, artifacts, accounts })
  let podContext = new PodContext({ artifacts, poolContext })

  beforeEach(async () => {
    await poolContext.init()
    token = poolContext.token
    registry = poolContext.registry
    moneyMarket = poolContext.moneyMarket
    pool = await poolContext.createPool(new BN('0'))
    poolToken = await poolContext.createToken()
    pod = await podContext.createPod()
  })

  async function printPending() {
    let pendingSupply = (await pod.pendingSupply()).toString()
    let pendingDrawId = (await pod.pendingDrawId()).toString()
    console.log({ 
      pendingSupply, pendingDrawId
    })
  }

  async function printLast(address) {
    let lastDeposit = (await pod.lastDeposits(address)).toString()
    let lastDrawId = (await pod.lastDrawIds(address)).toString()
    console.log({ 
      lastDeposit, lastDrawId
    })
  }

  /**
   * 1. Deposits into the pool
   * 2. Rewards the pool
   * 3. Transfers tickets to pod
   * 
   * Once this function is complete, the pod will have tickets
   * 
   * @param {*} amount 
   * @param {*} user 
   * @param {*} options 
   */
  async function depositDrawTransfer(amount, user, options = {}) {
    const prize = options.prize || toWei('2')

    // deposit into pool
    await poolContext.depositPool(amount, { from: user })

    let committedDrawId = await pool.currentCommittedDrawId()
    let openDrawId = await pool.currentOpenDrawId()

    // commit and mint tickets
    await podContext.nextDraw({ prize })

    const { logs } = await poolToken.transfer(pod.address, amount, { from: user })

    const Minted = logs.slice().reverse().find((value => value.event === 'Minted'))

    chai.expect(Minted.event).to.equal('Minted')
    chai.expect(Minted.args.operator).to.equal(pod.address)
    chai.expect(Minted.args.to).to.equal(user)
    chai.expect(Minted.args.amount).to.not.equal('0')
  }

  async function depositPod(amount, options) {
    await token.approve(pod.address, amount, options)
    await pod.deposit(amount, [], options)
  }

  describe('tokensReceived()', () => {
    it('should not accept from strange tokens', async () => {
      let token = await poolContext.new777Token()

      await chai.assert.isRejected(token.send(pod.address, toWei('100'), []), /Pod\/unknown-token/)
    })
  })

  describe('initialize()', () => {
    it('should not allow null pool', async () => {
      let pod = await podContext.createPodNoInit()
      await chai.assert.isRejected(pod.initialize(ZERO_ADDRESS), /Pod\/pool-def/)
    })

    it('should initialize the contract properly', async () => {
      assert.equal(await pod.pool(), pool.address)
      assert.equal(await registry.getInterfaceImplementer(pod.address, web3.utils.soliditySha3('ERC777TokensRecipient')), pod.address)
      assert.equal(await registry.getInterfaceImplementer(pod.address, web3.utils.soliditySha3('PoolTogetherRewardListener')), pod.address)
    })
  })

  describe('currentExchangeRateMantissa()', () => {
    it('should default to one million', async () => {
      assert.equal(await pod.currentExchangeRateMantissa(), toWei('1000000'))
    })
  })

  describe('tokensReceived()', () => {
    it('should accept pool tokens', async () => {
      const amount = toWei('10')

      await depositDrawTransfer(amount, user1)

      // now should have 10 million tokens
      assert.equal(await pod.balanceOf(user1), tenMillion)
      assert.equal(await pod.totalSupply(), tenMillion)

      assert.equal(await pool.committedBalanceOf(pod.address), amount)
    })

    it('should mint everyone the same number', async () => {
      const amount = toWei('10')

      // deposit into pool
      await poolContext.depositPool(amount, { from: user1 })
      // deposit into pool
      await poolContext.depositPool(amount, { from: user2 })

      // commit and mint tickets
      await podContext.nextDraw()

      // transfer into pod
      await poolToken.transfer(pod.address, amount, { from: user1 })

      // transfer into pod
      await poolToken.transfer(pod.address, amount, { from: user2 })

      // both should have 10 million tokens
      assert.equal(await pod.balanceOf(user1), tenMillion)
      assert.equal(await pod.balanceOf(user2), tenMillion)
    })

    it('should calculate the exchange rate when there are winnings', async () => {
      const amount = toWei('10')

      // deposit, commit and transfer
      await depositDrawTransfer(amount, user1)

      // deposit, reward, and transfer.
      await depositDrawTransfer(amount, user2)

      assert.equal(await pod.balanceOf(user1), tenMillion)

      // console.log({ exchangeRate: (await pod.currentExchangeRateMantissa()).toString() })

      assert.equal((await pod.balanceOfUnderlying(user1)).toString(), toWei('12'))
      assert.equal((await pod.balanceOfUnderlying(user2)).toString(), toWei('10'))
      assert.equal((await pool.committedBalanceOf(pod.address)), toWei('22'))

      // deposit, reward, and transfer.
      await depositDrawTransfer(amount, user3)

      // now 12/22 = 0.545454545...
      // and 10/22 = 0.454545454...
      // How the prize of 2 dai splits between two:
      // 2 * 12 / 22 = 1.0909090909090909...
      // 2 * 10 / 22 = 0.9090909090909090...

      assert.equal((await pod.balanceOfUnderlying(user1)).toString(), '13090909090909090909')
      assert.equal((await pod.balanceOfUnderlying(user2)).toString(), '10909090909090909090')
      assert.equal((await pod.balanceOfUnderlying(user3)).toString(), toWei('10'))
      assert.equal((await pool.committedBalanceOf(pod.address)), toWei('34'))
    })
  })

  describe('operatorDeposit()', () => {
    it('should allow an operator to deposit on behalf of a user', async () => {
      const amount = toWei('10')
      await token.approve(pod.address, amount, { from: user1 })
      await pod.operatorDeposit(user1, amount, [], [], { from: user2 })
      assert.equal(await pod.pendingDeposit(user1), amount)
      assert.equal(await pod.balanceOf(user1), '0')
    })
  })

  describe('rewarded()', () => {
    it('can only be called by the pool', async () => {
      chai.assert.isRejected(pod.rewarded(user1, toWei('10'), '1'), /Pod\/only-pool/)
    })
  })

  describe('withdrawPendingDeposit', () => {
    it('should transfer the tokens back', async () => {
      const amount = web3.utils.toBN(toWei('10'))
      await token.approve(pod.address, amount, { from: user1 })
      await pod.deposit(amount, [], { from: user1 })

      const tokenBalanceBefore = await token.balanceOf(user1)
      const { logs } = await pod.withdrawPendingDeposit(amount, [], { from: user1 })

      const PendingDepositWithdrawn = logs.find(log => log.event === 'PendingDepositWithdrawn')
      chai.assert.isDefined(PendingDepositWithdrawn)
      assert.equal(PendingDepositWithdrawn.args.operator, user1)
      assert.equal(PendingDepositWithdrawn.args.from, user1)
      assert.equal(PendingDepositWithdrawn.args.collateral, amount.toString())

      const tokenBalanceAfter = await token.balanceOf(user1)
  
      assert.equal(tokenBalanceBefore.add(amount).toString(), tokenBalanceAfter.toString())

      assert.equal(await pod.pendingDeposit(user1), '0')
      assert.equal(await pod.balanceOf(user1), '0')

      assert.equal(await pool.committedBalanceOf(pod.address), '0')
      assert.equal(await pool.openBalanceOf(pod.address), '0')
    })

    it('should reject when insufficient funds', async () => {
      const amount = web3.utils.toBN(toWei('10'))
      await token.approve(pod.address, amount, { from: user1 })
      await pod.deposit(amount, [], { from: user1 })

      const tooMuch = web3.utils.toBN(toWei('11'))
      await chai.assert.isRejected(pod.withdrawPendingDeposit(tooMuch, [], { from: user1 }), /ScheduledBalance\/insuff/)
    })

    it('should support partial withdrawals', async () => {
      const amount = web3.utils.toBN(toWei('10'))
      await token.approve(pod.address, amount, { from: user1 })
      await pod.deposit(amount, [], { from: user1 })

      const tokenBalanceBefore = await token.balanceOf(user1)
      const lesserAmount = web3.utils.toBN(toWei('4'))
      const { logs } = await pod.withdrawPendingDeposit(lesserAmount, [], { from: user1 })

      const PendingDepositWithdrawn = logs.find(log => log.event === 'PendingDepositWithdrawn')
      chai.assert.isDefined(PendingDepositWithdrawn)
      assert.equal(PendingDepositWithdrawn.args.operator, user1)
      assert.equal(PendingDepositWithdrawn.args.from, user1)
      assert.equal(PendingDepositWithdrawn.args.collateral, lesserAmount.toString())

      const tokenBalanceAfter = await token.balanceOf(user1)
  
      assert.equal(tokenBalanceBefore.add(lesserAmount).toString(), tokenBalanceAfter.toString())

      assert.equal(await pod.pendingDeposit(user1), toWei('6'))
      assert.equal(await pod.balanceOf(user1), '0')
      assert.equal(await pool.committedBalanceOf(pod.address), '0')
      assert.equal(await pool.openBalanceOf(pod.address), toWei('6'))
    })

    it('should not interfere with the supply', async () => {
      const amount = web3.utils.toBN(toWei('10'))

      await token.approve(pod.address, amount, { from: user1 })
      await pod.deposit(amount, [], { from: user1 })

      // commit the tickets
      await podContext.nextDraw({ prize: toWei('0') })

      // award
      await podContext.nextDraw({ prize: toWei('2') })

      const amount2 = web3.utils.toBN(toWei('12'))

      // deposit for user2
      await token.approve(pod.address, amount2, { from: user2 })
      await pod.deposit(amount2, [], { from: user2 })

      // deposit for user3
      await token.approve(pod.address, amount2, { from: user3 })
      await pod.deposit(amount2, [], { from: user3 })

      // withdraw for user3, user 2 should be unaffected
      await pod.withdrawPendingDeposit(amount2, [], { from: user3 })

      // commit tickets
      await podContext.nextDraw({ prize: toWei('0') })

      // mutual award
      await podContext.nextDraw({ prize: toWei('2') })

      assert.equal((await pod.balanceOfUnderlying(user1)).toString(), toWei('13'))
      assert.equal((await pod.balanceOfUnderlying(user2)).toString(), toWei('13'))
    })
  })

  describe('send()', () => {
    it('should allow the user to send tokens that have not yet minted', async () => {
      const amount = web3.utils.toBN(toWei('10'))
      const shareAmount = web3.utils.toBN(toWei('10000000'))

      await token.approve(pod.address, amount, { from: user1 })
      await pod.deposit(amount, [], { from: user1 })

      // commit the tickets
      await podContext.nextDraw({ prize: toWei('0') })

      await pod.send(user2, shareAmount, [], { from: user1 })
    })
  })

  describe('operatorSend()', () => {
    it('should allow an operator to send tokens that have not yet minted', async () => {
      const amount = web3.utils.toBN(toWei('10'))
      const shareAmount = web3.utils.toBN(toWei('10000000'))

      await pod.authorizeOperator(user2, { from: user1 })

      await token.approve(pod.address, amount, { from: user1 })
      await pod.deposit(amount, [], { from: user1 })

      // commit the tickets
      await podContext.nextDraw({ prize: toWei('0') })

      await pod.operatorSend(user1, user2, shareAmount, [], [], { from: user2 })
    })
  })

  describe('transfer()', () => {
    it('should allow a user to transfer tokens that have not yet minted', async () => {
      const amount = web3.utils.toBN(toWei('10'))
      const shareAmount = web3.utils.toBN(toWei('10000000'))

      await token.approve(pod.address, amount, { from: user1 })
      await pod.deposit(amount, [], { from: user1 })

      // commit the tickets
      await podContext.nextDraw({ prize: toWei('0') })

      await pod.transfer(user2, shareAmount, { from: user1 })
    })
  })

  describe('transferFrom()', () => {
    it('should allow an operator to transfer tokens that have not yet minted', async () => {
      const amount = web3.utils.toBN(toWei('10'))
      const shareAmount = web3.utils.toBN(toWei('10000000'))

      await pod.approve(user2, shareAmount, { from: user1 })

      await token.approve(pod.address, amount, { from: user1 })
      await pod.deposit(amount, [], { from: user1 })

      // commit the tickets
      await podContext.nextDraw({ prize: toWei('0') })

      await pod.transferFrom(user1, user3, shareAmount, { from: user2 })
    })
  })

  describe('operatorWithdrawPendingDeposit', () => {
    it('should disallow non-operators', async () => {
      const amount = web3.utils.toBN(toWei('10'))
      await token.approve(pod.address, amount, { from: user1 })
      await pod.deposit(amount, [], { from: user1 })
      await chai.assert.isRejected(pod.operatorWithdrawPendingDeposit(user1, amount, [], [], { from: user2 }), /Pod\/not-op/)
    })

    it('should allow operators', async () => {
      await pod.authorizeOperator(user2, { from: user1 })
      const amount = web3.utils.toBN(toWei('10'))
      await token.approve(pod.address, amount, { from: user1 })
      await pod.deposit(amount, [], { from: user1 })
      const { logs } = await pod.operatorWithdrawPendingDeposit(user1, amount, [], [], { from: user2 })

      const PendingDepositWithdrawn = logs.find(log => log.event === 'PendingDepositWithdrawn')
      chai.assert.isDefined(PendingDepositWithdrawn)
      assert.equal(PendingDepositWithdrawn.args.operator, user2)

      assert.equal(await pod.pendingDeposit(user1), toWei('0'))
      assert.equal(await pool.openBalanceOf(pod.address), toWei('0'))
    })
  })

  describe('tokenToCollateralValue()', () => {
    it('should return an amount calculated from the exchange rate', async () => {
      const amount = toWei('10')

      // first deposit
      await token.approve(pod.address, amount, { from: user1 })
      await pod.deposit(amount, [], { from: user1 })
      
      // commit first, commit second, then reward and double the value of shares
      await podContext.nextDraw({ prize: toWei('0') })
      await podContext.nextDraw({ prize: toWei('0') })
      await podContext.nextDraw({ prize: toWei('10') })

      // one share is now worth two dai
      assert.equal((await pod.tokenToCollateralValue(toWei('1000000'))).toString(), toWei('2'))
    })
  })

  describe('collateralToTokenValue()', () => {
    it('should return an amount calculated from the exchange rate', async () => {
      const amount = toWei('10')

      // first deposit
      await token.approve(pod.address, amount, { from: user1 })
      await pod.deposit(amount, [], { from: user1 })
      
      // commit first, commit second, then reward and double the value of shares
      await podContext.nextDraw({ prize: toWei('0') })
      await podContext.nextDraw({ prize: toWei('0') })
      await podContext.nextDraw({ prize: toWei('10') })

      // one share is now worth two dai
      assert.equal((await pod.collateralToTokenValue(toWei('2'))).toString(), toWei('1000000'))
    })
  })

  describe('totalPendingDeposits()', () => {
    it('should include all deposits from all users', async () => {
      const amount = toWei('10')
      
      await token.approve(pod.address, amount, { from: user1 })
      await pod.deposit(amount, [], { from: user1 })

      await token.approve(pod.address, amount, { from: user2 })
      await pod.deposit(amount, [], { from: user2 })

      assert.equal(await pod.totalPendingDeposits(), toWei('20'))
    })
  })

  describe('withdrawAndRedeemCollateral()', () => {
    it('should allow the user to withdraw their pending', async () => {
      const amount = toWei('10')
      
      await token.approve(pod.address, amount, { from: user1 })
      await pod.deposit(amount, [], { from: user1 })

      await pod.withdrawAndRedeemCollateral(amount, { from: user1 })

      assert.equal(await pod.pendingDeposit(user1), '0')
    })

    it('should allow the user to withdraw their tokens', async () => {
      const amount = toWei('10')
      
      await token.approve(pod.address, amount, { from: user1 })
      await pod.deposit(amount, [], { from: user1 })

      // commit
      await podContext.nextDraw()

      await pod.withdrawAndRedeemCollateral(amount, { from: user1 })

      assert.equal(await pod.balanceOfUnderlying(user1), '0')
    })

    it('should allow a user to withdraw both', async () => {
      const amount = toWei('10')
      
      await token.approve(pod.address, amount, { from: user1 })
      await pod.deposit(amount, [], { from: user1 })

      // commit
      await podContext.nextDraw()

      await token.approve(pod.address, amount, { from: user1 })
      await pod.deposit(amount, [], { from: user1 })

      await pod.withdrawAndRedeemCollateral(toWei('20'), { from: user1 })

      assert.equal(await pod.balanceOfUnderlying(user1), '0')
    })
  })

  describe('send', () => {
    it('should be able to send to any contract', async () => {
      const amount = toWei('10')

      // deposit
      await token.approve(pod.address, amount, { from: user1 })
      await pod.deposit(amount, [], { from: user1 })
      
      // commit
      await podContext.nextDraw()

      await pod.send(token.address, amount, [], { from: user1 })

      assert.equal(await pod.balanceOf(token.address), amount)
    })
  })

  describe('operatorWithdrawAndRedeemCollateral()', () => {
    it('should not allow a non-authorized user', async () => {
      await chai.assert.isRejected(pod.operatorWithdrawAndRedeemCollateral(user1, toWei('20'), { from: user2 }), /Pod\/not-op/)
    })

    it('should allow an operator to withdraw', async () => {
      const amount = toWei('10')
      
      await pod.authorizeOperator(user2, { from: user1 })

      await token.approve(pod.address, amount, { from: user1 })
      await pod.deposit(amount, [], { from: user1 })

      await pod.operatorWithdrawAndRedeemCollateral(user1, amount, { from: user2 })

      assert.equal(await pod.balanceOfUnderlying(user1), '0')
    })
  })

  describe('deposit()', () => {
    it('should allow a user to deposit into the pod', async () => {
      const amount = toWei('10')
      await token.approve(pod.address, amount, { from: user1 })
      const { logs } = await pod.deposit(amount, [], { from: user1 })

      let deposited = logs.find(log => log.event === 'Deposited')
      chai.assert.isDefined(deposited)
      assert.equal(deposited.args.operator, user1)
      assert.equal(deposited.args.from, user1)
      assert.equal(deposited.args.collateral, amount)
      assert.equal(deposited.args.drawId, '1')

      assert.equal(await pod.pendingDeposit(user1), amount)
      assert.equal(await pod.balanceOf(user1), '0')
    })

    it('should convert their deposit to tickets on next draw', async () => {
      const amount = toWei('10')
      await token.approve(pod.address, amount, { from: user1 })
      await pod.deposit(amount, [], { from: user1 })
      await podContext.nextDraw({ prize: toWei('2') })
      assert.equal(await pod.pendingDeposit(user1), '0')
      assert.equal(await pod.balanceOfUnderlying(user1), amount)
    })

    it('should reward only those who are committed', async () => {
      const amount = toWei('10')

      // first deposit
      await token.approve(pod.address, amount, { from: user1 })
      await pod.deposit(amount, [], { from: user1 })

      assert.equal((await pod.balanceOf(user1)).toString(), '0')
      
      // commit
      await podContext.nextDraw()

      assert.equal((await pod.balanceOf(user1)).toString(), tenMillion)
      
      // second user deposit is open at time of reward
      await token.approve(pod.address, amount, { from: user2 })
      await pod.deposit(amount, [], { from: user2 })

      // reward
      await podContext.nextDraw({ prize: toWei('2') })

      assert.equal((await pod.balanceOf(user1)).toString(), tenMillion)
      assert.equal((await pod.currentExchangeRateMantissa()).toString(), '833333333333333333333333')

      // first user should have prize
      assert.equal((await pod.balanceOfUnderlying(user1)).toString(), toWei('12'))
      // second user should simply have entered
      assert.equal((await pod.balanceOfUnderlying(user2)).toString(), toWei('10'))
    })

    it('should retain a history of exchange rates for old deposits', async () => {
      const amount = toWei('10')

      // first deposit
      await depositPod(amount, { from: user1 })
      
      // commit
      await podContext.nextDraw()

      assert.equal((await pod.totalSupply()).toString(), tenMillion)
      assert.equal((await pod.balanceOfUnderlying(user1)).toString(), toWei('10'))

      // second deposit, should split remaining winnings evenly
      await depositPod(toWei('12'), { from: user2 })

      // reward
      await podContext.nextDraw({ prize: toWei('2') })

      assert.equal((await pod.balanceOfUnderlying(user1)).toString(), toWei('12'))
      assert.equal((await pod.balanceOfUnderlying(user2)).toString(), toWei('12'))

      // reward
      await podContext.nextDraw({ prize: toWei('2') })

      // assert.equal((await pod.totalSupply()).toString(), tenMillion)
      assert.equal((await pod.balanceOfUnderlying(user1)).toString(), toWei('13'))
      assert.equal((await pod.balanceOfUnderlying(user2)).toString(), toWei('13'))

      // reward
      await podContext.nextDraw({ prize: toWei('2') })
      
      // assert.equal((await pod.totalSupply()).toString(), tenMillion)
      assert.equal((await pod.balanceOfUnderlying(user1)).toString(), toWei('14'))
      assert.equal((await pod.balanceOfUnderlying(user2)).toString(), toWei('14'))
    })
  })

  describe('redeem', () => {
    it('should allow a user to redeem all of their tokens', async () => {
      const amount = toWei('10')
      // deposit, reward, and transfer.
      await depositDrawTransfer(amount, user1)
      // user1 now has ten million pod shares
      assert.equal((await pod.balanceOf(user1)).toString(), tenMillion)
      
      let tokenBalanceBefore = await token.balanceOf(user1)
      await pod.redeem(tenMillion, [], { from: user1 })
      let tokenBalanceAfter = await token.balanceOf(user1)
      
      // have all of their dai
      assert.equal(tokenBalanceAfter.sub(tokenBalanceBefore).toString(), '10000000000000000000')

      // have zero pod tokens
      assert.equal((await pod.balanceOf(user1)).toString(), '0')
    })

    it('should allow a user to redeem zero tokens', async () => {
      // Ensure committed draw
      await podContext.nextDraw()

      let tokenBalanceBefore = await token.balanceOf(user1)
      await pod.redeem('0', [], { from: user1 })
      let tokenBalanceAfter = await token.balanceOf(user1)
      assert.equal(tokenBalanceAfter.sub(tokenBalanceBefore).toString(), '0')
    })
  })

  describe('operatorRedeem', () => {
    it('should fail if the user is not an operator', async () => {
      const amount = toWei('10')
      // deposit, reward, and transfer.
      await depositDrawTransfer(amount, user1)

      await chai.assert.isRejected(pod.operatorRedeem(user1, await pod.balanceOf(user1), [], [], { from: user2 }), /Pod\/not-op/)
    })

    it('should allow an operator to redeem on behalf of a user', async () => {
      const amount = toWei('10')
      // deposit, reward, and transfer.
      await depositDrawTransfer(amount, user1)

      await pod.authorizeOperator(user2, { from: user1 })

      let balanceBefore = await token.balanceOf(user1)
      await pod.operatorRedeem(user1, await pod.balanceOf(user1), [], [], { from: user2 })
      let balanceAfter = await token.balanceOf(user1)
      assert.equal(balanceAfter.sub(balanceBefore).toString(), toWei('10'))
    })
  })

  describe('operatorRedeemToPool()', () => {
    it('should allow an operator to transfer', async () => {

      const amount = toWei('10')
      await depositPod(amount, { from: user1 })

      // now commit
      await podContext.nextDraw()

      const balance = await pod.balanceOf(user1)

      // non operators can't
      await chai.assert.isRejected(pod.operatorRedeemToPool(user1, balance, [], []), /Pod\/not-op/)

      await pod.authorizeOperator(user2, { from: user1 })

      // redeem to pool
      await pod.operatorRedeemToPool(user1, balance, [], [], { from: user2 })

      assert.equal((await pod.balanceOf(user1)).toString(), '0')
      assert.equal((await pool.committedBalanceOf(user1)).toString(), amount)
    })
  })

  describe('redeemToPool()', () => {
    it('should not allow a user to transfer unless they have tokens', async () => {
      const amount = toWei('10')
      await depositPod(amount, { from: user1 })
      await chai.assert.isRejected(pod.redeemToPool('1', { from: user1 }))
    })

    it('should allow a user to transfer', async () => {
      const amount = toWei('10')
      await depositPod(amount, { from: user1 })

      // now commit
      await podContext.nextDraw()

      // redeem to pool
      await pod.redeemToPool(await pod.balanceOf(user1), [], { from: user1 })

      assert.equal((await pod.balanceOf(user1)).toString(), '0')
      assert.equal((await pool.committedBalanceOf(user1)).toString(), amount)
    })

    it('should allow a user to partially transfer', async () => {

      const amount = toWei('10')

      await depositPod(amount, { from: user1 })

      // now commit
      await podContext.nextDraw()

      // deposit again!
      await depositPod(amount, { from: user1 })

      // now commit and reward.  no prize
      await podContext.nextDraw({ prize: '0' })

      // redeem half of their tokens to the pool
      await pod.redeemToPool(tenMillion, [], { from: user1 })

      // should still have half
      assert.equal((await pod.balanceOf(user1)).toString(), tenMillion)
      // and some pool tickets
      assert.equal((await pool.committedBalanceOf(user1)).toString(), amount)
    })
  })

  describe('operatorBurn()', () => {
    it('should revert', async () => {
      await chai.assert.isRejected(pod.operatorBurn(user1, toWei('10'), [], []), /Pod\/no-op/)
    })
  })

  describe('burn()', () => {
    it('should revert', async () => {
      await chai.assert.isRejected(pod.burn(toWei('10'), []), /Pod\/no-op/)
    })
  })
})

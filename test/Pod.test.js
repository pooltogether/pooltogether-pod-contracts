const toWei = require('./helpers/toWei')
const chai = require('./helpers/chai')
const PoolContext = require('./helpers/PoolContext')
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

    // console.log({ prize, committedDrawId })

    // let totalSupply = (await pod.totalSupply()).toString()
    // let committedSupply = (await pool.committedSupply()).toString()
    // let pendingCollateralSupply = (await pod.pendingCollateralSupply()).toString()

    // console.log({ totalSupply, committedSupply, pendingCollateralSupply })

    await pod.rewarded(prize, openDrawId)

    // transfer into pod
    const { logs } = await poolToken.transfer(pod.address, amount, { from: user })

    const Minted = logs.slice().reverse().find((value => value.event === 'Minted'))

    chai.expect(Minted.event).to.equal('Minted')
    chai.expect(Minted.args.operator).to.equal(pod.address)
    chai.expect(Minted.args.to).to.equal(user)
    chai.expect(Minted.args.amount).to.not.equal('0')
  }

  describe('initialize()', () => {
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

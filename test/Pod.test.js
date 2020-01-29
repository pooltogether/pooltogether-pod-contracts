const toWei = require('./helpers/toWei')
const chai = require('./helpers/chai')
const PoolContext = require('./helpers/PoolContext')
const Pod = artifacts.require('Pod.sol')
const PodContext = require('./helpers/PodContext')
const BN = require('bn.js')
const {
  ZERO_ADDRESS
} = require('./helpers/constants')

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

  async function depositDrawTransfer(amount, user, options = {}) {
    // deposit into pool
    await poolContext.depositPool(amount, { from: user })
    // commit and mint tickets
    await podContext.nextDraw({ prize: options.prize || toWei('2') })
    // transfer into pod
    await poolToken.transfer(pod.address, amount, { from: user })

    const [ Minted ] = await pod.getPastEvents('Minted')

    chai.expect(Minted.event).to.equal('Minted')
    chai.expect(Minted.args.operator).to.equal(pod.address)
    chai.expect(Minted.args.to).to.equal(user)
    chai.expect(Minted.args.amount).to.not.equal('0')
  }

  describe('initialize()', () => {
    beforeEach(async () => {
      pod = await Pod.new()
    })

    it('should initialize the contract properly', async () => {
      await pod.initialize(pool.address)
      assert.equal(await pod.pool(), pool.address)
      assert.equal(await registry.getInterfaceImplementer(pod.address, web3.utils.soliditySha3('ERC777TokensRecipient')), pod.address)
    })
  })

  describe('with initialized pod', () => {
    beforeEach(async () => {
      pod = await podContext.createPod()
    })

    describe('exchangeRate()', () => {
      it('should default to one million', async () => {
        assert.equal(await pod.exchangeRate(), toWei('1000000'))
      })
    })

    describe('tokensReceived()', () => {
      it('should accept pool tokens', async () => {
        const amount = toWei('10')

        await depositDrawTransfer(amount, user1)

        // now should have 10 million tokens
        const tenMillion = toWei('10000000')
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

        const tenMillion = toWei('10000000')
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

        const tenMillion = toWei('10000000')
        assert.equal(await pod.balanceOf(user1), tenMillion)

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
        // deposit, reward, and transfer.
        await depositDrawTransfer(amount, user2)
        // deposit, reward, and transfer.
        await depositDrawTransfer(amount, user3)

        let balanceBefore = await token.balanceOf(user1)
        await pod.redeem(await pod.balanceOf(user1), [], { from: user1 })
        let balanceAfter = await token.balanceOf(user1)
        assert.equal(balanceAfter.sub(balanceBefore).toString(), '13090909090909090909')

        balanceBefore = await token.balanceOf(user2)
        await pod.redeem(await pod.balanceOf(user2), [], { from: user2 })
        balanceAfter = await token.balanceOf(user2)
        assert.equal(balanceAfter.sub(balanceBefore).toString(), '10909090909090909090')

        // now just user3 is left.
        await podContext.nextDraw({ prize: toWei('2') })
        // they should have just won 2 dai

        balanceBefore = await token.balanceOf(user3)
        await pod.redeem(await pod.balanceOf(user3), [], { from: user3 })
        balanceAfter = await token.balanceOf(user3)
        assert.equal(balanceAfter.sub(balanceBefore).toString(), '12000000000000000001')
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

    describe('draw()', () => {
      it('should return the zero address if no one exists', async () => {
        assert.equal(await pod.draw(14), ZERO_ADDRESS)
      })
    })

    describe('drawWithEntropy()', () => {
      it('should return the zero address if no one exists', async () => {
        assert.equal(await pod.drawWithEntropy(web3.utils.randomHex(32)), ZERO_ADDRESS)
      })

      it('should allow a user to be selected', async () => {
        const amount = toWei('10')
        await depositDrawTransfer(amount, user1)
        assert.equal(await pod.drawWithEntropy(web3.utils.randomHex(32)), user1)
      })
    })
  })
})

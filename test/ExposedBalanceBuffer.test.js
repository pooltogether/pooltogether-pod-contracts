const ExposedBalanceBuffer = artifacts.require('ExposedBalanceBuffer.sol')
// const toWei = require('./helpers/toWei')
const chai = require('./helpers/chai')

contract('BalanceBuffer', (accounts) => {

  let [user1, user2, user3, user4] = accounts

  let balanceBuffer

  beforeEach(async () => {
    balanceBuffer = await ExposedBalanceBuffer.new()
  })

  describe('deposit()', () => {
    it('should allow a user to deposit', async () => {
      await balanceBuffer.deposit(user1, '2', '1')
      chai.assert.equal(await balanceBuffer.committedBalanceOf(user1, '1'), '0')
      chai.assert.equal(await balanceBuffer.openBalanceOf(user1, '1'), '2')
      chai.assert.equal(await balanceBuffer.openBalanceOf(user1, '2'), '0')
    })

    it('should allow a user to deposit more than once to the same draw', async () => { 
      await balanceBuffer.deposit(user1, '2', '1')
      await balanceBuffer.deposit(user1, '3', '1')
      chai.assert.equal(await balanceBuffer.committedBalanceOf(user1, '1'), '0')
      chai.assert.equal(await balanceBuffer.openBalanceOf(user1, '1'), '5')
    })

    it('should allow a user to deposit more than once to different draws', async () => { 
      await balanceBuffer.deposit(user1, '2', '1')
      await balanceBuffer.deposit(user1, '3', '3')
      chai.assert.equal(await balanceBuffer.committedBalanceOf(user1, '3'), '2')
      chai.assert.equal(await balanceBuffer.committedBalanceOf(user1, '4'), '5')
      chai.assert.equal(await balanceBuffer.openBalanceOf(user1, '3'), '3')
      chai.assert.equal(await balanceBuffer.openBalanceOf(user1, '4'), '0')
    })

    it('should not allow deposits in the past', async () => { 
      await balanceBuffer.deposit(user1, '2', '2')
      await chai.assert.isRejected(balanceBuffer.deposit(user1, '3', '1'), /BalanceBuffer\/draw-old/)
    })
  })

  describe('withdraw()', () => {
    it('should withdraw a users recent balance', async () => {
      await balanceBuffer.deposit(user1, '2', '1')
      await balanceBuffer.withdraw(user1, '2')
      assert.equal(await balanceBuffer.committedBalanceOf(user1, '5'), '0')
    })

    it('should withdraw a users most recent and previous balance', async () => {
      await balanceBuffer.deposit(user1, '2', '1')
      await balanceBuffer.deposit(user1, '3', '2')
      await balanceBuffer.withdraw(user1, '5')
      assert.equal(await balanceBuffer.committedBalanceOf(user1, '5'), '0')
    })

    it('should withdraw partial amounts', async () => {
      // first withdraw only the latest deposit
      await balanceBuffer.deposit(user1, '2', '1')
      await balanceBuffer.deposit(user1, '3', '2')
      await balanceBuffer.withdraw(user1, '3')
      assert.equal(await balanceBuffer.committedBalanceOf(user1, '5'), '2')

      // now deposit again
      await balanceBuffer.deposit(user1, '3', '2')
      assert.equal(await balanceBuffer.committedBalanceOf(user1, '5'), '5')

      // now withdraw everything and partial first deposit
      await balanceBuffer.withdraw(user1, '4')
      assert.equal(await balanceBuffer.committedBalanceOf(user1, '5'), '1')
    })
  })

  describe('clearCommitted()', () => {
    it('should erase all committed amounts', async () => {
      await balanceBuffer.deposit(user1, '2', '1')
      await balanceBuffer.deposit(user1, '3', '2')

      await balanceBuffer.clearCommitted(user1, '4')

      assert.equal(await balanceBuffer.committedBalanceOf(user1, '5'), '0')
    })

    it('should ignore the open amount', async () => {
      await balanceBuffer.deposit(user1, '2', '1')
      await balanceBuffer.deposit(user1, '3', '2')
      await balanceBuffer.clearCommitted(user1, '2')
      assert.equal(await balanceBuffer.committedBalanceOf(user1, '5'), '3')
    })
  })
})

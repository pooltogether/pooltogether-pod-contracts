const ExposedScheduledBalance = artifacts.require('ExposedScheduledBalance.sol')
// const toWei = require('./helpers/toWei')
const chai = require('./helpers/chai')

contract('ScheduledBalance', (accounts) => {

  let [user1, user2, user3, user4] = accounts

  let scheduledBalance

  beforeEach(async () => {
    scheduledBalance = await ExposedScheduledBalance.new()
  })

  describe('deposit()', () => {
    it('should allow a user to deposit', async () => {
      await scheduledBalance.deposit('2', '1')
      chai.assert.equal(await scheduledBalance.balanceAt('0'), '0')
      chai.assert.equal(await scheduledBalance.balanceAt('1'), '2')
    })

    it('should allow a user to deposit more than once to the same time', async () => { 
      await scheduledBalance.deposit('2', '1')
      await scheduledBalance.deposit('3', '1')
      chai.assert.equal(await scheduledBalance.balanceAt('0'), '0')
      chai.assert.equal(await scheduledBalance.balanceAt('1'), '5')
    })

    it('should allow a user to deposit more than once to different draws', async () => { 
      await scheduledBalance.deposit('2', '1')
      // previous balance is overwritten, as '3' is now the current time
      await scheduledBalance.deposit('3', '3')
      chai.assert.equal(await scheduledBalance.balanceAt('2'), '0')
      chai.assert.equal(await scheduledBalance.balanceAt('3'), '3')
    })

    it('should not allow deposits in the past', async () => { 
      await scheduledBalance.deposit('2', '2')
      await chai.assert.isRejected(scheduledBalance.deposit('3', '1'), /ScheduledBalance\/backwards/)
    })
  })

  describe('withdraw()', () => {
    it('should withdraw a users recent balance', async () => {
      await scheduledBalance.deposit('3', '2')
      await scheduledBalance.withdraw('3')
      assert.equal(await scheduledBalance.balanceAt('2'), '0')
    })

    it('should allow a partial withdrawal', async () => {
      await scheduledBalance.deposit('3', '2')
      await scheduledBalance.withdraw('2')
      assert.equal(await scheduledBalance.balanceAt('2'), '1')
    })

    it('should disallow withdrawals greater than balance', async () => {
      await scheduledBalance.deposit('3', '2')
      await chai.assert.isRejected(scheduledBalance.withdraw('4'), /ScheduledBalance\/insuff/)
    })

    it('should be cool when amount is zero', async () => {
      await scheduledBalance.deposit('2', '1')
      await scheduledBalance.withdraw('0')
      assert.equal(await scheduledBalance.balanceAt('1'), '2')
    })
  })

  describe('withdrawAll()', () => {
    it('should withdraw all amounts', async () => {
      await scheduledBalance.deposit('2', '1')
      await scheduledBalance.deposit('3', '2')

      await scheduledBalance.withdrawAll()

      assert.equal(await scheduledBalance.balanceAt('5'), '0')
    })
  })
})

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
      chai.assert.equal(await scheduledBalance.consolidatedBalance('1'), '0')
      chai.assert.equal(await scheduledBalance.unconsolidatedBalance('1'), '2')
      chai.assert.equal(await scheduledBalance.unconsolidatedBalance('2'), '0')
    })

    it('should allow a user to deposit more than once to the same draw', async () => { 
      await scheduledBalance.deposit('2', '1')
      await scheduledBalance.deposit('3', '1')
      chai.assert.equal(await scheduledBalance.consolidatedBalance('1'), '0')
      chai.assert.equal(await scheduledBalance.unconsolidatedBalance('1'), '5')
    })

    it('should allow a user to deposit more than once to different draws', async () => { 
      await scheduledBalance.deposit('2', '1')
      await scheduledBalance.deposit('3', '3')
      chai.assert.equal(await scheduledBalance.consolidatedBalance('3'), '2')
      chai.assert.equal(await scheduledBalance.consolidatedBalance('4'), '5')
      chai.assert.equal(await scheduledBalance.unconsolidatedBalance('3'), '3')
      chai.assert.equal(await scheduledBalance.unconsolidatedBalance('4'), '0')
    })

    it('should not allow deposits in the past', async () => { 
      await scheduledBalance.deposit('2', '2')
      await chai.assert.isRejected(scheduledBalance.deposit('3', '1'), /ScheduledBalance\/backwards/)
    })
  })

  describe('withdrawUnconsolidated()', () => {
    it('should withdraw a users recent balance', async () => {
      await scheduledBalance.deposit('2', '1')
      await scheduledBalance.deposit('3', '2')
      await scheduledBalance.withdrawUnconsolidated('3', '2')
      assert.equal(await scheduledBalance.unconsolidatedBalance('2'), '0')
    })

    it('should allow a partial withdrawal', async () => {
      await scheduledBalance.deposit('2', '1')
      await scheduledBalance.deposit('3', '2')
      await scheduledBalance.withdrawUnconsolidated('2', '2')
      assert.equal(await scheduledBalance.unconsolidatedBalance('2'), '1')
    })

    it('should disallow withdrawals greater than balance', async () => {
      await scheduledBalance.deposit('2', '1')
      await scheduledBalance.deposit('3', '2')
      await chai.assert.isRejected(scheduledBalance.withdrawUnconsolidated('4', '2'), /ScheduledBalance\/insuff/)
    })

    it('should disallow when in future', async () => {
      await scheduledBalance.deposit('2', '1')
      await chai.assert.isRejected(scheduledBalance.withdrawUnconsolidated('4', '2'), /ScheduledBalance\/insuff/)
    })

    it('should be cool when its the future but amount is zero', async () => {
      await scheduledBalance.deposit('2', '1')
      await scheduledBalance.withdrawUnconsolidated('0', '2')
      assert.equal(await scheduledBalance.unconsolidatedBalance('2'), '0')
    })
  })

  describe('clearConsolidated()', () => {
    it('should require a timestamp no earlier than the last', async () => {
      await scheduledBalance.deposit('2', '1')
      await chai.assert.isRejected(scheduledBalance.clearConsolidated('0'), /ScheduledBalance\/backwards/)
    })

    it('should erase all committed amounts', async () => {
      await scheduledBalance.deposit('2', '1')
      await scheduledBalance.deposit('3', '2')

      await scheduledBalance.clearConsolidated('4')

      assert.equal(await scheduledBalance.consolidatedBalance('5'), '0')
    })

    it('should ignore the open amount', async () => {
      await scheduledBalance.deposit('2', '1')
      await scheduledBalance.deposit('3', '2')
      await scheduledBalance.clearConsolidated('2')
      assert.equal(await scheduledBalance.consolidatedBalance('5'), '3')
    })
  })
})

const ExposedSupplyBuffer = artifacts.require('ExposedSupplyBuffer.sol')
// const toWei = require('./helpers/toWei')
const chai = require('./helpers/chai')

contract('SupplyBuffer', (accounts) => {

  let [user1, user2, user3, user4] = accounts

  let supplyBuffer

  beforeEach(async () => {
    supplyBuffer = await ExposedSupplyBuffer.new()
  })

  describe('deposit()', () => {
    it('should allow deposits', async () => {
      await supplyBuffer.deposit('2', '1')
      chai.assert.equal(await supplyBuffer.committedSupply('1'), '0')
      chai.assert.equal(await supplyBuffer.committedSupply('2'), '2')
    })

    it('should allow deposits more than once to the same draw', async () => { 
      await supplyBuffer.deposit('2', '1')
      await supplyBuffer.deposit('3', '1')
      chai.assert.equal(await supplyBuffer.committedSupply('1'), '0')
    })

    it('should allow deposits more than once to different draws', async () => { 
      await supplyBuffer.deposit('2', '1')
      await supplyBuffer.deposit('3', '3')
      chai.assert.equal(await supplyBuffer.committedSupply('3'), '2')
      chai.assert.equal(await supplyBuffer.committedSupply('4'), '5')
    })

    it('should not allow deposits in the past', async () => { 
      await supplyBuffer.deposit('2', '2')
      await chai.assert.isRejected(supplyBuffer.deposit('3', '1'), /SupplyBuffer\/draw-old/)
    })
  })

  describe('withdraw()', () => {
    it('should withdraw a users recent balance', async () => {
      await supplyBuffer.deposit('2', '1')
      await supplyBuffer.withdraw('2')
      assert.equal(await supplyBuffer.committedSupply('5'), '0')
    })

    it('should withdraw a users most recent and previous balance', async () => {
      await supplyBuffer.deposit('2', '1')
      await supplyBuffer.deposit('3', '2')
      await supplyBuffer.withdraw('5')
      assert.equal(await supplyBuffer.committedSupply('5'), '0')
    })

    it('should withdraw partial amounts', async () => {
      // first withdraw only the latest deposit
      await supplyBuffer.deposit('2', '1')
      await supplyBuffer.deposit('3', '2')
      await supplyBuffer.withdraw('3')
      assert.equal(await supplyBuffer.committedSupply('5'), '2')

      // now deposit again
      await supplyBuffer.deposit('3', '2')
      assert.equal(await supplyBuffer.committedSupply('5'), '5')

      // now withdraw everything and partial first deposit
      await supplyBuffer.withdraw('4')
      assert.equal(await supplyBuffer.committedSupply('5'), '1')
    })
  })

  describe('clearCommitted()', () => {
    it('should erase all committed amounts', async () => {
      await supplyBuffer.deposit('2', '1')
      await supplyBuffer.deposit('3', '2')

      await supplyBuffer.clearCommitted('4')

      assert.equal(await supplyBuffer.committedSupply('5'), '0')
    })

    it('should ignore the open amount', async () => {
      await supplyBuffer.deposit('2', '1')
      await supplyBuffer.deposit('3', '2')
      await supplyBuffer.clearCommitted('2')
      assert.equal(await supplyBuffer.committedSupply('5'), '3')
    })
  })
})

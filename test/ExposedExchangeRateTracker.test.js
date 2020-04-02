const ExposedExchangeRateTracker = artifacts.require('ExposedExchangeRateTracker.sol')
const ExchangeRateTracker = artifacts.require('ExchangeRateTracker.sol')
const FixedPoint = artifacts.require('FixedPoint.sol')
const chai = require('./helpers/chai')
const toWei = require('./helpers/toWei')

contract('DrawExchangeRates', () => {

  let fixedPoint, exchangeRateTracker, exchangeRates

  beforeEach(async () => {
    fixedPoint = await FixedPoint.new()
    exchangeRateTracker = await ExchangeRateTracker.new()
    ExposedExchangeRateTracker.link('FixedPoint', fixedPoint.address)
    ExposedExchangeRateTracker.link('ExchangeRateTracker', exchangeRateTracker.address)
    exchangeRates = await ExposedExchangeRateTracker.new()
    await exchangeRates.initialize(toWei('1'))
  })

  describe('initialize()', () => {
    it('requires base mantissa greater than zero', async () => {
      exchangeRates = await ExposedExchangeRateTracker.new()
      await chai.assert.isRejected(exchangeRates.initialize(0), /ExchangeRateTracker\/non-zero/)
    })

    it('cannot be called twice', async () => {
      exchangeRates = await ExposedExchangeRateTracker.new()
      await exchangeRates.initialize(1)
      await chai.assert.isRejected(exchangeRates.initialize(1), /ExchangeRateTracker\/init-prev/)
    })
  })

  describe('tokenToCollateralValue()', () => {
    beforeEach(async () => {
      await exchangeRates.collateralizationChanged(2, 1, 2)
      await exchangeRates.collateralizationChanged(3, 1, 4)
    })

    it('should calculate correctly', async () => {
      // with no timestamp, should be current
      chai.assert.equal(await exchangeRates.tokenToCollateralValue(90), '30')

      // with timestamp, show historic
      chai.assert.equal(await exchangeRates.tokenToCollateralValueAt(40, 3), '20')
      chai.assert.equal(await exchangeRates.tokenToCollateralValueAt(90, 5), '30')
    })
  })

  describe('collateralToTokenValue()', () => {
    beforeEach(async () => {
      await exchangeRates.collateralizationChanged(2, 1, 2)
      await exchangeRates.collateralizationChanged(3, 1, 4)
    })

    it('should calculate correctly', async () => {
      // with no timestamp, should be current
      chai.assert.equal((await exchangeRates.collateralToTokenValue(10)).toString(), '30')

      // with timestamp, show historic
      chai.assert.equal(await exchangeRates.collateralToTokenValueAt(10, 3), '20')
      chai.assert.equal(await exchangeRates.collateralToTokenValueAt(10, 5), '30')
    })
  })

  describe('collateralizationChanged()', () => {
    it('should require the timestamp to be greater than or equal', async () => {
      await exchangeRates.collateralizationChanged(1, 1, 1)
      await chai.assert.isRejected(exchangeRates.collateralizationChanged(1, 1, 0), /ExchangeRateTracker\/too-early/)
    })
  })

  describe('search()', () => {
    it('should fail when not initialized', async () => {
      exchangeRates = await ExposedExchangeRateTracker.new()
      await chai.assert.isRejected(exchangeRates.search(0), /ExchangeRateTracker\/not-init/)
    })
  
    it('should pick the last when duplicates exist', async () => {
      await exchangeRates.collateralizationChanged(1, 1, 1)
      await exchangeRates.collateralizationChanged(1, 1, 1)
      await exchangeRates.collateralizationChanged(1, 1, 2)
      await exchangeRates.collateralizationChanged(1, 1, 2)
      await exchangeRates.collateralizationChanged(1, 1, 2)
      await exchangeRates.collateralizationChanged(1, 1, 3)
      await exchangeRates.collateralizationChanged(1, 1, 3)
      chai.assert.equal(await exchangeRates.search(1), 2)
      chai.assert.equal(await exchangeRates.search(2), 5)
      chai.assert.equal(await exchangeRates.search(3), 7)
    })

    describe('with an existing history', () => {
      beforeEach(async () => {
        await exchangeRates.collateralizationChanged('1', '1', '1')
        await exchangeRates.collateralizationChanged(1, 1, 4)
        await exchangeRates.collateralizationChanged(1, 1, 10)
        await exchangeRates.collateralizationChanged(1, 1, 55)
      })

      it('should accept zero', async () => {
        chai.assert.equal(await exchangeRates.search(0), 0)
      })
    
      it('return a matching value', async () => {
        chai.assert.equal(await exchangeRates.search(4), 2)
      })
    
      it('returns the closest less than', async () => {
        chai.assert.equal(await exchangeRates.search(5), 2)
      })
    
      it('returns the closest less than', async () => {
        chai.assert.equal(await exchangeRates.search(500), 4)
      })
    
      it('returns the first', async () => {
        chai.assert.equal(await exchangeRates.search(1), 1)
      })
    
      it('returns the first', async () => {
        chai.assert.equal(await exchangeRates.search(2), 1)
      })
    
      it('returns the last', async () => {
        chai.assert.equal(await exchangeRates.search(55), 4)
      })
    })
  })
})

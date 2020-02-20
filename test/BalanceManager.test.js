const BalanceManager = artifacts.require('test/ExposedBalanceManager.sol')
const toWei = require('./helpers/toWei')
const chai = require('./helpers/chai')
const { 
  BASE_EXCHANGE_RATE_MANTISSA
} = require('./helpers/constants')

contract('BalanceManager', (accounts) => {

  let [user1, user2, user3, user4] = accounts

  let bm

  const million = toWei('1000000')

  const tenMillion = toWei('10000000')
  const twentyMillion = toWei('20000000')
  const thirtyMillion = toWei('30000000')

  async function printPending() {
    let pendingCollateralSupply = (await bm.pendingCollateralSupply()).toString()
    let pendingDrawId = (await bm.pendingDrawId()).toString()
    let _tokenSupply = (await bm._tokenSupply()).toString()
    console.log({ 
      pendingCollateralSupply, pendingDrawId, _tokenSupply
    })
  }

  beforeEach(async () => {
    bm = await BalanceManager.new()
    await bm.initializeBalanceManager(BASE_EXCHANGE_RATE_MANTISSA)
  })

  describe('depositCollateral()', () => {
    it('should disallow moving backwards in time', async () => {
      await bm.depositCollateral(user1, toWei('10'), '2')
      await chai.assert.isRejected(bm.depositCollateral(user1, toWei('10'), '1'), /BalanceManager\/later-draw/)
    })

    it('should consolidate a users deposit if they have previously deposited', async () => {
      await bm.depositCollateral(user1, toWei('10'), '1')
      await bm.depositCollateral(user1, toWei('10'), '2')
      
      // ensure the first was consolidated
      assert.equal((await bm.balanceOf(user1, '2')).toString(), tenMillion)
      assert.equal((await bm.totalSupply('2')).toString(), tenMillion)

      // now the second should be unconsolidated
      assert.equal((await bm.unconsolidatedBalanceOf(user1, '3')).toString(), tenMillion)
      assert.equal((await bm.balanceOf(user1, '3')).toString(), twentyMillion)
      assert.equal((await bm.totalSupply('3')).toString(), twentyMillion)
    })

    it('should add the deposit to pending collateral', async () => {
      await bm.depositCollateral(user1, toWei('10'), '1')

      assert.equal((await bm.balanceOf(user1, '2')).toString(), tenMillion)
      assert.equal((await bm.unconsolidatedBalanceOf(user1, '2')).toString(), tenMillion)
      assert.equal((await bm.totalSupply('2')).toString(), tenMillion)
      assert.equal((await bm.unconsolidatedSupply('2')).toString(), tenMillion)
    })

    it('should consolidate deposits', async () => {
      await bm.depositCollateral(user1, toWei('10'), '1')
      await bm.depositCollateral(user1, toWei('10'), '2')

      // balances as of open draw 2 is 10 mill
      assert.equal((await bm.balanceOf(user1, '2')).toString(), tenMillion)
      assert.equal((await bm.totalSupply('2')).toString(), tenMillion)

      // balances as of open draw 3 is 20 mill
      assert.equal((await bm.balanceOf(user1, '3')).toString(), twentyMillion)
      assert.equal((await bm.totalSupply('3')).toString(), twentyMillion)
      
      // unconsolidated balance for open draw 3 is ten mill
      assert.equal((await bm.unconsolidatedBalanceOf(user1, '3')).toString(), tenMillion)
    })

    describe('for multiple deposits', () => {
      it('should add the deposit to pending', async () => {
        await bm.depositCollateral(user1, toWei('10'), '1')
        await bm.depositCollateral(user2, toWei('10'), '1')
  
        assert.equal((await bm.balanceOf(user1, '2')).toString(), tenMillion)
        assert.equal((await bm.unconsolidatedBalanceOf(user1, '2')).toString(), tenMillion)
        assert.equal((await bm.totalSupply('2')).toString(), twentyMillion)
      })
  
      it('should consolidate deposits', async () => {
        await bm.depositCollateral(user1, toWei('10'), '1')
        // await printPending()
        await bm.depositCollateral(user2, toWei('10'), '1')
        // await printPending()
        await bm.depositCollateral(user1, toWei('10'), '2')
        // await printPending()

        assert.equal((await bm.balanceOf(user1, '2')).toString(), tenMillion)
        assert.equal((await bm.balanceOf(user2, '2')).toString(), tenMillion)

        assert.equal((await bm.unconsolidatedSupply('3')).toString(), tenMillion)
        assert.equal((await bm.totalSupply('3')).toString(), thirtyMillion)
      })
    })
  })

  describe('collateralChanged()', () => {
    it('should change the first exchange rate', async () => {
      await bm.depositCollateral(user1, toWei('10'), '1')
      assert.equal((await bm.balanceOf(user1, '3')).toString(), tenMillion)
      assert.equal((await bm.pendingCollateralSupply()).toString(), toWei('10'))

      await bm.collateralChanged(toWei('12'), '2')
      // 10 / 12 = 0.83333333...
      assert.equal((await bm.currentExchangeRateMantissa()).toString(), '833333333333333333333333')
      assert.equal((await bm.totalSupply('3')).toString(), tenMillion)
      assert.equal((await bm.pendingCollateralSupply()).toString(), toWei('0'))
      
      assert.equal((await bm.balanceOfUnderlying(user1, '3')).toString(), toWei('12'))
    })

    it('should handle more than one exchange rate change', async () => {
      await bm.depositCollateral(user1, toWei('10'), '1')

      await bm.collateralChanged(toWei('20'), '2')
      await bm.collateralChanged(toWei('40'), '6')

      assert.equal((await bm.currentExchangeRateMantissa()).toString(), '250000000000000000000000')
    })

    it('should correctly alter the exchange rate', async () => {
      await bm.depositCollateral(user1, toWei('10'), '1')
      await bm.depositCollateral(user2, toWei('10'), '1')

      await bm.collateralChanged(toWei('24'), '2')

      await bm.depositCollateral(user3, toWei('10'), '2')
      await bm.depositCollateral(user4, toWei('10'), '2')

      assert.equal((await bm.balanceOfUnderlying(user1, '3')).toString(), toWei('12'))
      assert.equal((await bm.balanceOfUnderlying(user2, '3')).toString(), toWei('12'))
      assert.equal((await bm.balanceOfUnderlying(user3, '3')).toString(), toWei('10'))
      assert.equal((await bm.balanceOfUnderlying(user4, '3')).toString(), toWei('10'))

      await bm.collateralChanged(toWei('50'), '3')

      // now this must be shared as so:
      // user1 has (12/44) * 50 of the underlying collateral == 13.636363636363635
      // user2 has (12/44) * 50 of the underlying collateral == 13.636363636363635
      // user3 has (10/44) * 50 of the underlying collateral == 11.363636363636363
      // user4 has (10/44) * 50 of the underlying collateral == 11.363636363636363

      assert.equal((await bm.balanceOfUnderlying(user1, '4')).toString(), toWei('13.636363636363636363'))
      assert.equal((await bm.balanceOfUnderlying(user2, '4')).toString(), toWei('13.636363636363636363'))
      assert.equal((await bm.balanceOfUnderlying(user3, '4')).toString(), toWei('11.363636363636363636'))
      assert.equal((await bm.balanceOfUnderlying(user4, '4')).toString(), toWei('11.363636363636363636'))
    })
  })
})

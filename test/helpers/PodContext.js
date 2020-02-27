module.exports = function PodContext({ artifacts, poolContext }) {

  const Pod = artifacts.require('Pod.sol')
  const FixedPoint = artifacts.require('FixedPoint.sol')
  const ExchangeRateTracker = artifacts.require('ExchangeRateTracker.sol')
  const SupplyBuffer = artifacts.require('SupplyBuffer.sol')
  const BalanceBuffer = artifacts.require('BalanceBuffer.sol')

  let pod, fixedPoint, exchangeRateTracker, supplyBuffer, balanceBuffer

  this.createPod = async () => {
    fixedPoint = await FixedPoint.new()
    exchangeRateTracker = await ExchangeRateTracker.new()
    supplyBuffer = await SupplyBuffer.new()
    balanceBuffer = await BalanceBuffer.new()
    Pod.link('FixedPoint', fixedPoint.address)
    Pod.link('ExchangeRateTracker', exchangeRateTracker.address)
    Pod.link('SupplyBuffer', supplyBuffer.address)
    Pod.link('BalanceBuffer', balanceBuffer.address)
    
    pod = await Pod.new()

    await pod.initialize(
      poolContext.pool.address
    )

    return pod
  }

  this.nextDraw = async (options) => {
    const { prize } = options || {}
    const { pool, moneyMarket } = poolContext
    const currentDrawId = await pool.currentCommittedDrawId()

    if (currentDrawId.toString() === '0') {
      return await poolContext.openNextDraw()
    } else {
      if (prize) {
        await moneyMarket.rewardCustom(pool.address, prize)
      } else {
        await moneyMarket.reward(pool.address)
      }
      return await poolContext.rewardAndOpenNextDraw()
    }
  }

  return this
}
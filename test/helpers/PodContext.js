module.exports = function PodContext({ artifacts, poolContext }) {

  const Pod = artifacts.require('Pod.sol')
  const FixedPoint = artifacts.require('FixedPoint.sol')
  const ExchangeRateTracker = artifacts.require('ExchangeRateTracker.sol')
  const ScheduledBalance = artifacts.require('ScheduledBalance.sol')

  let pod, fixedPoint, exchangeRateTracker, scheduledBalance

  this.createPodNoInit = async () => {
    fixedPoint = await FixedPoint.new()
    exchangeRateTracker = await ExchangeRateTracker.new()
    scheduledBalance = await ScheduledBalance.new()
    Pod.link('FixedPoint', fixedPoint.address)
    Pod.link('ExchangeRateTracker', exchangeRateTracker.address)
    Pod.link('ScheduledBalance', scheduledBalance.address)
    let pod = await Pod.new()
    return pod
  }

  this.createPod = async () => {
    pod = await this.createPodNoInit()
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
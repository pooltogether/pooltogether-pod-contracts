module.exports = function PodContext({ artifacts, poolContext }) {

  const Pod = artifacts.require('Pod.sol')

  this.createPod = async () => {
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
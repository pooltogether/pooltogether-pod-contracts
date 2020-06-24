const buidler = require("@nomiclabs/buidler")

const getCurrentBlockTime = async () => {
  const block = await buidler.ethers.provider.getBlockNumber()
  return (await buidler.ethers.provider.getBlock(block)).timestamp
}

module.exports = { getCurrentBlockTime }

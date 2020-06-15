
const { expect } = require('chai')

const LogParser = (contract) => {
  const parseLog = (receipt, eventName) => {
    const logs = receipt.logs.map((log) => contract.interface.parseLog(log))
    return logs.find((el) => (el && el['name'] === eventName))
  }

  const confirmEventLog = (receipt, eventName, logParams) => {
    const expectedLog = parseLog(receipt, eventName)
    expect(expectedLog).to.exist

    Object.keys(logParams).forEach(logField => {
      expect(expectedLog.values[logField]).to.equal(logParams[logField])
    })
    return expectedLog
  }

  return {
    parseLog,
    confirmEventLog,
  }
}

module.exports = LogParser

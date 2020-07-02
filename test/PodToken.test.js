const buidler = require('./helpers/buidler')

const { deployContract } = require('ethereum-waffle')
const { deploy1820 } = require('deploy-eip-1820')
const { ethers } = require('ethers')
const { expect } = require('chai')

const PodToken = require('../build/PodToken.json')

const toWei = ethers.utils.parseEther
const debug = require('debug')('PodToken.test')
const txOverrides = { gasLimit: 20000000 }
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

describe('PodToken Contract', function () {
  let wallet
  let otherWallet
  let podToken

  const TOKEN = {
    name: 'Pod Token',
    symbol: 'PTOKEN',
    forwarder: '0x1337c0d31337c0D31337C0d31337c0d31337C0d3',
    podWallet: '',
  };

  beforeEach(async () => {
    [wallet, otherWallet] = await buidler.ethers.getSigners()

    debug('deploying 1820...')
    registry = await deploy1820(wallet)

    debug('deploying PodToken...')
    podToken = await deployContract(wallet, PodToken, [], txOverrides)

    debug('initializing PodToken...')
    TOKEN.podWallet = otherWallet  // For Minting and Buring as Pod
    await podToken.initialize(TOKEN.name, TOKEN.symbol, TOKEN.forwarder, TOKEN.podWallet._address)
  })

  describe('pod()', function () {
    it('should return the address for the Pod', async function () {
      expect(await podToken.pod()).to.equal(TOKEN.podWallet._address)
    })
  })

  describe('initialize()', () => {
    it('should set the params', async () => {
      expect(await podToken.name()).to.equal(TOKEN.name)
      expect(await podToken.symbol()).to.equal(TOKEN.symbol)
      expect(await podToken.getTrustedForwarder()).to.equal(TOKEN.forwarder)
    })
  })

  describe('mint()', function () {
    it('should allow the Pod to mint tokens', async function () {
      const amountToMint = toWei('10')

      // Confirm initial balance
      expect(await podToken.totalSupply()).to.equal(toWei('0'))

      // Perform minting & confirm event
      debug('minting tokens...')
      await expect(podToken.connect(TOKEN.podWallet).mint(wallet._address, amountToMint))
        .to.emit(podToken, 'Transfer')
        .withArgs(ZERO_ADDRESS, wallet._address, amountToMint)

      // Confirm tokens were minted
      expect(await podToken.balanceOf(wallet._address)).to.equal(amountToMint)
      expect(await podToken.totalSupply()).to.equal(amountToMint)
    })

    it('should not allow anyone else to mint tokens', async function () {
      const accounts = await buidler.ethers.getSigners()
      const mintReceiver = accounts[5]._address
      const amountToMint = toWei('10')

      // Confirm initial balance
      expect(await podToken.totalSupply()).to.equal(toWei('0'))

      // Attempt minting
      debug('attempt minting tokens...')
      await expect(podToken.mint(mintReceiver, amountToMint)).to.be.revertedWith('PodToken: only pod');
    })
  })


  describe('burnFrom()', function () {
    it('should allow the Pod to burn tokens', async function () {
      const amountToMint = toWei('10')
      const amountToBurn = toWei('7')

      // Confirm initial balance
      expect(await podToken.totalSupply()).to.equal(toWei('0'))

      // Perform minting
      debug('minting tokens...')
      await podToken.connect(TOKEN.podWallet).mint(wallet._address, amountToMint)

      // Confirm tokens were minted
      expect(await podToken.balanceOf(wallet._address)).to.equal(amountToMint)
      expect(await podToken.totalSupply()).to.equal(amountToMint)

      // Perform burning
      debug('burning tokens...')
      await podToken.connect(TOKEN.podWallet).burnFrom(wallet._address, amountToBurn)

      // Confirm tokens were burned
      expect(await podToken.balanceOf(wallet._address)).to.equal(amountToMint.sub(amountToBurn))
      expect(await podToken.totalSupply()).to.equal(amountToMint.sub(amountToBurn))
    })

    it('should not allow anyone else to burn tokens', async function () {
      const accounts = await buidler.ethers.getSigners()
      const mintReceiver = accounts[5]._address
      const amountToMint = toWei('10')
      const amountToBurn = toWei('7')

      // Confirm initial balance
      expect(await podToken.totalSupply()).to.equal(toWei('0'))

      // Perform minting
      debug('minting tokens...')
      await podToken.connect(TOKEN.podWallet).mint(mintReceiver, amountToMint)

      // Confirm tokens were minted
      expect(await podToken.balanceOf(mintReceiver)).to.equal(amountToMint)
      expect(await podToken.totalSupply()).to.equal(amountToMint)

      // Attempt burning
      debug('burning tokens...')
      await expect(podToken.burnFrom(mintReceiver, amountToBurn)).to.be.revertedWith('PodToken: only pod');
    })
  })
})

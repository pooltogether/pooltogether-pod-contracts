const buidler = require('./helpers/buidler')

const { deployContract } = require('ethereum-waffle')
const { deploy1820 } = require('deploy-eip-1820')
const { ethers } = require('ethers')
const { expect } = require('chai')

const PodSponsorship = require('../build/PodSponsorship.json')

const toWei = ethers.utils.parseEther
const debug = require('debug')('PodSponsorship.test')
const txOverrides = { gasLimit: 20000000 }


describe('PodSponsorship Contract', function () {
  let wallet
  let otherWallet
  let podSponsorship

  const SPONSOR = {
    name: 'Pod Sponsor',
    symbol: 'PSPON',
    forwarder: '0x1337c0d31337c0D31337C0d31337c0d31337C0d3',
    podWallet: '',
  };

  beforeEach(async () => {
    [wallet, otherWallet] = await buidler.ethers.getSigners()

    debug('deploying 1820...')
    registry = await deploy1820(wallet)

    debug('deploying PodSponsorship...')
    podSponsorship = await deployContract(wallet, PodSponsorship, [], txOverrides)

    debug('initializing PodSponsorship...')
    SPONSOR.podWallet = otherWallet  // For Minting and Buring as Pod
    await podSponsorship.initialize(SPONSOR.name, SPONSOR.symbol, SPONSOR.forwarder, SPONSOR.podWallet._address)
  })

  describe('sponsoredPod()', function () {
    it('should return the address for the Pod', async function () {
      expect(await podSponsorship.sponsoredPod()).to.equal(SPONSOR.podWallet._address)
    })
  })

  describe('initialize()', () => {
    it('should set the params', async () => {
      expect(await podSponsorship.name()).to.equal(SPONSOR.name)
      expect(await podSponsorship.symbol()).to.equal(SPONSOR.symbol)
      expect(await podSponsorship.getTrustedForwarder()).to.equal(SPONSOR.forwarder)
    })
  })

  describe('mint()', function () {
    it('should allow the Pod to mint tokens', async function () {
      const amountToMint = toWei('10')

      // Confirm initial balance
      expect(await podSponsorship.totalSupply()).to.equal(toWei('0'))

      // Perform minting & confirm event
      debug('minting tokens...')
      await expect(podSponsorship.connect(SPONSOR.podWallet).mint(wallet._address, amountToMint))
        .to.emit(podSponsorship, 'Minted')
        .withArgs(SPONSOR.podWallet._address, wallet._address, amountToMint, '0x', '0x');

      // Confirm tokens were minted
      expect(await podSponsorship.balanceOf(wallet._address)).to.equal(amountToMint)
      expect(await podSponsorship.totalSupply()).to.equal(amountToMint)
    })

    it('should not allow anyone else to mint tokens', async function () {
      const accounts = await buidler.ethers.getSigners()
      const mintReceiver = accounts[5]._address
      const amountToMint = toWei('10')

      // Confirm initial balance
      expect(await podSponsorship.totalSupply()).to.equal(toWei('0'))

      // Attempt minting
      debug('attempt minting tokens...')
      debug({account: mintReceiver})
      await expect(podSponsorship.mint(mintReceiver, amountToMint)).to.be.revertedWith('PodSponsorship: only pod');
    })
  })


  describe('burn()', function () {
    it('should allow the Pod to burn tokens', async function () {
      const amountToMint = toWei('10')
      const amountToBurn = toWei('7')

      // Confirm initial balance
      expect(await podSponsorship.totalSupply()).to.equal(toWei('0'))

      // Perform minting
      debug('minting tokens...')
      await podSponsorship.connect(SPONSOR.podWallet).mint(wallet._address, amountToMint)

      // Confirm tokens were minted
      expect(await podSponsorship.balanceOf(wallet._address)).to.equal(amountToMint)
      expect(await podSponsorship.totalSupply()).to.equal(amountToMint)

      // Perform burning
      debug('burning tokens...')
      await podSponsorship.connect(SPONSOR.podWallet).burn(wallet._address, amountToBurn)

      // Confirm tokens were burned
      expect(await podSponsorship.balanceOf(wallet._address)).to.equal(amountToMint.sub(amountToBurn))
      expect(await podSponsorship.totalSupply()).to.equal(amountToMint.sub(amountToBurn))
    })

    it('should not allow anyone else to burn tokens', async function () {
      const accounts = await buidler.ethers.getSigners()
      const mintReceiver = accounts[5]._address
      const amountToMint = toWei('10')
      const amountToBurn = toWei('7')

      // Confirm initial balance
      expect(await podSponsorship.totalSupply()).to.equal(toWei('0'))

      // Perform minting
      debug('minting tokens...')
      await podSponsorship.connect(SPONSOR.podWallet).mint(mintReceiver, amountToMint)

      // Confirm tokens were minted
      expect(await podSponsorship.balanceOf(mintReceiver)).to.equal(amountToMint)
      expect(await podSponsorship.totalSupply()).to.equal(amountToMint)

      // Attempt burning
      debug('burning tokens...')
      await expect(podSponsorship.burn(mintReceiver, amountToBurn)).to.be.revertedWith('PodSponsorship: only pod');
    })
  })
})




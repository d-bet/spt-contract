const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Treasury", function () {
  let treasury;
  let token;
  let owner;
  let user1;
  let user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // 部署Treasury
    const TreasuryFactory = await ethers.getContractFactory("Treasury");
    treasury = await TreasuryFactory.deploy();
    await treasury.waitForDeployment();

    // 部署测试代币
    const TokenFactory = await ethers.getContractFactory("ggUSDT");
    token = await TokenFactory.deploy();
    await token.waitForDeployment();
  });

  describe("部署", function () {
    it("应该设置owner为部署者", async function () {
      expect(await treasury.owner()).to.equal(owner.address);
    });
  });

  describe("receiveFees功能", function () {
    it("任何人都应该能够调用receiveFees", async function () {
      const amount = ethers.parseUnits("1000", 6);
      
      await expect(
        treasury.connect(user1).receiveFees(await token.getAddress(), amount)
      ).to.emit(treasury, "FeesReceived")
        .withArgs(await token.getAddress(), amount);
    });

    it("应该拒绝零金额", async function () {
      await expect(
        treasury.receiveFees(await token.getAddress(), 0)
      ).to.be.revertedWith("Zero amount");
    });

    it("应该正确emit FeesReceived事件", async function () {
      const amount = ethers.parseUnits("500", 6);
      const tokenAddress = await token.getAddress();
      
      await expect(
        treasury.receiveFees(tokenAddress, amount)
      ).to.emit(treasury, "FeesReceived")
        .withArgs(tokenAddress, amount);
    });
  });

  describe("withdrawERC20功能", function () {
    beforeEach(async function () {
      // 给Treasury合约一些代币
      const amount = ethers.parseUnits("10000", 6);
      await token.mint(await treasury.getAddress(), amount);
    });

    it("owner应该能够提取代币", async function () {
      const withdrawAmount = ethers.parseUnits("1000", 6);
      const tokenAddress = await token.getAddress();
      
      await expect(
        treasury.withdrawERC20(tokenAddress, user1.address, withdrawAmount)
      ).to.emit(treasury, "Withdraw")
        .withArgs(tokenAddress, user1.address, withdrawAmount);
      
      const balance = await token.balanceOf(user1.address);
      expect(balance).to.equal(withdrawAmount);
    });

    it("非owner不应该能够提取代币", async function () {
      const withdrawAmount = ethers.parseUnits("1000", 6);
      const tokenAddress = await token.getAddress();
      
      await expect(
        treasury.connect(user1).withdrawERC20(tokenAddress, user2.address, withdrawAmount)
      ).to.be.revertedWithCustomError(treasury, "OwnableUnauthorizedAccount");
    });

    it("不应该允许提取到零地址", async function () {
      const withdrawAmount = ethers.parseUnits("1000", 6);
      const tokenAddress = await token.getAddress();
      
      await expect(
        treasury.withdrawERC20(tokenAddress, ethers.ZeroAddress, withdrawAmount)
      ).to.be.revertedWith("bad to");
    });

    it("应该正确更新余额", async function () {
      const initialBalance = await token.balanceOf(await treasury.getAddress());
      const withdrawAmount = ethers.parseUnits("2000", 6);
      const tokenAddress = await token.getAddress();
      
      await treasury.withdrawERC20(tokenAddress, user1.address, withdrawAmount);
      
      const newBalance = await token.balanceOf(await treasury.getAddress());
      expect(newBalance).to.equal(initialBalance - withdrawAmount);
    });

    it("应该正确emit Withdraw事件", async function () {
      const withdrawAmount = ethers.parseUnits("1500", 6);
      const tokenAddress = await token.getAddress();
      
      await expect(
        treasury.withdrawERC20(tokenAddress, user2.address, withdrawAmount)
      ).to.emit(treasury, "Withdraw")
        .withArgs(tokenAddress, user2.address, withdrawAmount);
    });

    it("不应该允许提取超过余额的代币", async function () {
      const treasuryBalance = await token.balanceOf(await treasury.getAddress());
      const excessAmount = treasuryBalance + ethers.parseUnits("1", 6);
      const tokenAddress = await token.getAddress();
      
      await expect(
        treasury.withdrawERC20(tokenAddress, user1.address, excessAmount)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });
  });

  describe("集成测试", function () {
    it("应该能够接收费用并提取", async function () {
      // 先接收费用（只是事件，不实际转账）
      const feeAmount = ethers.parseUnits("500", 6);
      await treasury.receiveFees(await token.getAddress(), feeAmount);
      
      // 实际给Treasury转账代币
      await token.mint(await treasury.getAddress(), feeAmount);
      
      // 提取代币
      await treasury.withdrawERC20(await token.getAddress(), user1.address, feeAmount);
      
      const balance = await token.balanceOf(user1.address);
      expect(balance).to.equal(feeAmount);
    });
  });
});


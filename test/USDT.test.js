const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ggUSDT", function () {
  let ggUSDT;
  let owner;
  let user1;
  let user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const ggUSDTFactory = await ethers.getContractFactory("ggUSDT");
    ggUSDT = await ggUSDTFactory.deploy();
    await ggUSDT.waitForDeployment();
  });

  describe("部署", function () {
    it("应该正确设置名称和符号", async function () {
      expect(await ggUSDT.name()).to.equal("Game USDT");
      expect(await ggUSDT.symbol()).to.equal("ggUSDT");
    });

    it("应该正确设置decimals为18", async function () {
      expect(await ggUSDT.decimals()).to.equal(18);
    });

    it("应该向部署者mint初始代币", async function () {
      const expectedAmount = ethers.parseUnits("10000000", 18); // 10,000,000 * 10^18
      const balance = await ggUSDT.balanceOf(owner.address);
      expect(balance).to.equal(expectedAmount);
    });

    it("应该设置owner为部署者", async function () {
      expect(await ggUSDT.owner()).to.equal(owner.address);
    });
  });

  describe("mint功能", function () {
    it("owner应该能够mint代币", async function () {
      const mintAmount = ethers.parseUnits("1000", 18);
      await ggUSDT.mint(user1.address, mintAmount);
      
      const balance = await ggUSDT.balanceOf(user1.address);
      expect(balance).to.equal(mintAmount);
    });

    it("非owner不应该能够mint代币", async function () {
      const mintAmount = ethers.parseUnits("1000", 18);
      await expect(
        ggUSDT.connect(user1).mint(user2.address, mintAmount)
      ).to.be.revertedWithCustomError(ggUSDT, "OwnableUnauthorizedAccount");
    });

    it("应该正确更新总供应量", async function () {
      const initialSupply = await ggUSDT.totalSupply();
      const mintAmount = ethers.parseUnits("5000", 18);
      
      await ggUSDT.mint(user1.address, mintAmount);
      
      const newSupply = await ggUSDT.totalSupply();
      expect(newSupply).to.equal(initialSupply + mintAmount);
    });
  });

  describe("ERC20基本功能", function () {
    beforeEach(async function () {
      // 给user1一些代币用于测试
      const amount = ethers.parseUnits("1000", 18);
      await ggUSDT.mint(user1.address, amount);
    });

    it("应该能够转账代币", async function () {
      const transferAmount = ethers.parseUnits("100", 18);
      await ggUSDT.connect(user1).transfer(user2.address, transferAmount);
      
      const user2Balance = await ggUSDT.balanceOf(user2.address);
      expect(user2Balance).to.equal(transferAmount);
    });

    it("应该正确更新余额", async function () {
      const transferAmount = ethers.parseUnits("200", 18);
      const initialBalance = await ggUSDT.balanceOf(user1.address);
      
      await ggUSDT.connect(user1).transfer(user2.address, transferAmount);
      
      const newBalance = await ggUSDT.balanceOf(user1.address);
      expect(newBalance).to.equal(initialBalance - transferAmount);
    });

    it("应该能够approve和transferFrom", async function () {
      const approveAmount = ethers.parseUnits("300", 18);
      await ggUSDT.connect(user1).approve(user2.address, approveAmount);
      
      const allowance = await ggUSDT.allowance(user1.address, user2.address);
      expect(allowance).to.equal(approveAmount);
      
      const transferAmount = ethers.parseUnits("150", 18);
      await ggUSDT.connect(user2).transferFrom(user1.address, user2.address, transferAmount);
      
      const user2Balance = await ggUSDT.balanceOf(user2.address);
      expect(user2Balance).to.equal(transferAmount);
      
      const newAllowance = await ggUSDT.allowance(user1.address, user2.address);
      expect(newAllowance).to.equal(approveAmount - transferAmount);
    });

    it("不应该允许转账超过余额", async function () {
      const balance = await ggUSDT.balanceOf(user1.address);
      const excessAmount = balance + ethers.parseUnits("1", 18);
      
      await expect(
        ggUSDT.connect(user1).transfer(user2.address, excessAmount)
      ).to.be.revertedWithCustomError(ggUSDT, "ERC20InsufficientBalance");
    });
  });
});


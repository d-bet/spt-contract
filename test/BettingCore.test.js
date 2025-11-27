const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BettingCore", function () {
  let bettingCore;
  let token;
  let treasury;
  let owner;
  let signer;
  let user1;
  let user2;
  let user3;

  // 辅助函数：生成结算签名
  async function generateSettleSignature(matchId, result, timestamp, signerWallet) {
    const contractAddress = await bettingCore.getAddress();
    // 合约使用 abi.encodePacked，所以我们也使用 solidityPackedKeccak256
    const message = ethers.solidityPackedKeccak256(
      ["address", "uint256", "uint256", "uint256"],
      [contractAddress, matchId, result, timestamp]
    );
    // signMessage 会自动添加以太坊消息前缀（\x19Ethereum Signed Message:\n32）
    // 这与合约中的 toEthSignedMessageHash() 对应
    const signature = await signerWallet.signMessage(ethers.getBytes(message));
    return signature;
  }

  beforeEach(async function () {
    [owner, signer, user1, user2, user3] = await ethers.getSigners();

    // 部署代币
    const TokenFactory = await ethers.getContractFactory("ggUSDT");
    token = await TokenFactory.deploy();
    await token.waitForDeployment();

    // 部署Treasury
    const TreasuryFactory = await ethers.getContractFactory("Treasury");
    treasury = await TreasuryFactory.deploy();
    await treasury.waitForDeployment();

    // 部署BettingCore
    const BettingCoreFactory = await ethers.getContractFactory("BettingCore");
    bettingCore = await BettingCoreFactory.deploy(
      await token.getAddress(),
      await treasury.getAddress(),
      signer.address
    );
    await bettingCore.waitForDeployment();

    // 给用户分配代币
    const amount = ethers.parseUnits("100000", 6);
    await token.mint(user1.address, amount);
    await token.mint(user2.address, amount);
    await token.mint(user3.address, amount);

    // 用户approve代币
    await token.connect(user1).approve(await bettingCore.getAddress(), ethers.MaxUint256);
    await token.connect(user2).approve(await bettingCore.getAddress(), ethers.MaxUint256);
    await token.connect(user3).approve(await bettingCore.getAddress(), ethers.MaxUint256);
  });

  describe("部署", function () {
    it("应该正确设置stakeToken、treasury和signer", async function () {
      expect(await bettingCore.stakeToken()).to.equal(await token.getAddress());
      expect(await bettingCore.treasury()).to.equal(await treasury.getAddress());
      expect(await bettingCore.signer()).to.equal(signer.address);
    });

    it("应该设置owner为部署者", async function () {
      expect(await bettingCore.owner()).to.equal(owner.address);
    });

    it("不应该允许零地址的stakeToken", async function () {
      const BettingCoreFactory = await ethers.getContractFactory("BettingCore");
      await expect(
        BettingCoreFactory.deploy(
          ethers.ZeroAddress,
          await treasury.getAddress(),
          signer.address
        )
      ).to.be.revertedWith("zero token");
    });

    it("不应该允许零地址的treasury", async function () {
      const BettingCoreFactory = await ethers.getContractFactory("BettingCore");
      await expect(
        BettingCoreFactory.deploy(
          await token.getAddress(),
          ethers.ZeroAddress,
          signer.address
        )
      ).to.be.revertedWith("zero treasury");
    });

    it("不应该允许零地址的signer", async function () {
      const BettingCoreFactory = await ethers.getContractFactory("BettingCore");
      await expect(
        BettingCoreFactory.deploy(
          await token.getAddress(),
          await treasury.getAddress(),
          ethers.ZeroAddress
        )
      ).to.be.revertedWith("zero signer");
    });
  });

  describe("管理员功能", function () {
    it("owner应该能够设置treasury", async function () {
      const newTreasury = user1.address;
      await bettingCore.setTreasury(newTreasury);
      expect(await bettingCore.treasury()).to.equal(newTreasury);
    });

    it("owner应该能够设置signer", async function () {
      const newSigner = user1.address;
      await bettingCore.setSigner(newSigner);
      expect(await bettingCore.signer()).to.equal(newSigner);
    });

    it("非owner不应该能够设置treasury", async function () {
      await expect(
        bettingCore.connect(user1).setTreasury(user2.address)
      ).to.be.revertedWithCustomError(bettingCore, "OwnableUnauthorizedAccount");
    });

    it("不应该允许设置零地址的treasury", async function () {
      await expect(
        bettingCore.setTreasury(ethers.ZeroAddress)
      ).to.be.revertedWith("zero");
    });

    it("不应该允许设置零地址的signer", async function () {
      await expect(
        bettingCore.setSigner(ethers.ZeroAddress)
      ).to.be.revertedWith("zero");
    });
  });

  describe("比赛管理", function () {
    const matchId = 1;
    const startTime = Math.floor(Date.now() / 1000) + 3600; // 1小时后
    const feeBps = 300; // 3%

    it("应该能够创建比赛", async function () {
      await expect(bettingCore.createMatch(matchId, startTime, feeBps))
        .to.emit(bettingCore, "MatchCreated")
        .withArgs(matchId, startTime);

      const match = await bettingCore.matches(matchId);
      expect(match.startTime).to.equal(startTime);
      expect(match.status).to.equal(0); // MatchStatus.Created
      expect(match.feeBps).to.equal(feeBps);
    });

    it("不应该允许创建已存在的比赛", async function () {
      await bettingCore.createMatch(matchId, startTime, feeBps);
      await expect(
        bettingCore.createMatch(matchId, startTime, feeBps)
      ).to.be.revertedWith("exists");
    });

    it("不应该允许费用超过10%", async function () {
      await expect(
        bettingCore.createMatch(matchId, startTime, 1001)
      ).to.be.revertedWith("fee too high");
    });

    it("非owner不应该能够创建比赛", async function () {
      await expect(
        bettingCore.connect(user1).createMatch(matchId, startTime, feeBps)
      ).to.be.revertedWithCustomError(bettingCore, "OwnableUnauthorizedAccount");
    });

    it("应该能够打开比赛", async function () {
      await bettingCore.createMatch(matchId, startTime, feeBps);
      await expect(bettingCore.openMatch(matchId))
        .to.emit(bettingCore, "MatchOpened")
        .withArgs(matchId);

      const match = await bettingCore.matches(matchId);
      expect(match.status).to.equal(1); // MatchStatus.Open
    });

    it("应该能够关闭比赛", async function () {
      await bettingCore.createMatch(matchId, startTime, feeBps);
      await bettingCore.openMatch(matchId);
      await expect(bettingCore.closeMatch(matchId))
        .to.emit(bettingCore, "MatchClosed")
        .withArgs(matchId);

      const match = await bettingCore.matches(matchId);
      expect(match.status).to.equal(2); // MatchStatus.Closed
    });

    it("应该能够取消比赛", async function () {
      await bettingCore.createMatch(matchId, startTime, feeBps);
      await bettingCore.openMatch(matchId);
      await expect(bettingCore.cancelMatch(matchId))
        .to.emit(bettingCore, "MatchSettled")
        .withArgs(matchId, 0, owner.address); // Outcome.None

      const match = await bettingCore.matches(matchId);
      expect(match.status).to.equal(4); // MatchStatus.Cancelled
    });

    it("不应该允许取消已结算的比赛", async function () {
      await bettingCore.createMatch(matchId, startTime, feeBps);
      await bettingCore.openMatch(matchId);
      await bettingCore.closeMatch(matchId);
      
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await generateSettleSignature(matchId, 1, timestamp, signer);
      await bettingCore.settleMatchWithSignature(matchId, 1, timestamp, signature);

      await expect(
        bettingCore.cancelMatch(matchId)
      ).to.be.revertedWith("bad status");
    });
  });

  describe("下注功能", function () {
    const matchId = 1;
    const startTime = Math.floor(Date.now() / 1000) + 3600;
    const feeBps = 300;

    beforeEach(async function () {
      await bettingCore.createMatch(matchId, startTime, feeBps);
      await bettingCore.openMatch(matchId);
    });

    it("应该能够下注Home", async function () {
      const betAmount = ethers.parseUnits("1000", 6);
      await expect(bettingCore.connect(user1).placeBet(matchId, 0, betAmount)) // Option.Home = 0
        .to.emit(bettingCore, "BetPlaced")
        .withArgs(matchId, user1.address, 0, betAmount);

      const userBet = await bettingCore.getUserBet(matchId, user1.address);
      expect(userBet.home).to.equal(betAmount);
      
      const totals = await bettingCore.getMatchTotals(matchId);
      expect(totals.home).to.equal(betAmount);
      expect(totals.total).to.equal(betAmount);
    });

    it("应该能够下注Draw", async function () {
      const betAmount = ethers.parseUnits("500", 6);
      await bettingCore.connect(user1).placeBet(matchId, 1, betAmount); // Option.Draw = 1

      const userBet = await bettingCore.getUserBet(matchId, user1.address);
      expect(userBet.draw).to.equal(betAmount);
      
      const totals = await bettingCore.getMatchTotals(matchId);
      expect(totals.draw).to.equal(betAmount);
    });

    it("应该能够下注Away", async function () {
      const betAmount = ethers.parseUnits("800", 6);
      await bettingCore.connect(user1).placeBet(matchId, 2, betAmount); // Option.Away = 2

      const userBet = await bettingCore.getUserBet(matchId, user1.address);
      expect(userBet.away).to.equal(betAmount);
      
      const totals = await bettingCore.getMatchTotals(matchId);
      expect(totals.away).to.equal(betAmount);
    });

    it("应该能够多次下注同一选项", async function () {
      const betAmount1 = ethers.parseUnits("500", 6);
      const betAmount2 = ethers.parseUnits("300", 6);
      
      await bettingCore.connect(user1).placeBet(matchId, 0, betAmount1);
      await bettingCore.connect(user1).placeBet(matchId, 0, betAmount2);

      const userBet = await bettingCore.getUserBet(matchId, user1.address);
      expect(userBet.home).to.equal(betAmount1 + betAmount2);
    });

    it("不应该允许在非Open状态下下注", async function () {
      await bettingCore.closeMatch(matchId);
      const betAmount = ethers.parseUnits("1000", 6);
      
      await expect(
        bettingCore.connect(user1).placeBet(matchId, 0, betAmount)
      ).to.be.revertedWith("not open");
    });

    it("不应该允许零金额下注", async function () {
      await expect(
        bettingCore.connect(user1).placeBet(matchId, 0, 0)
      ).to.be.revertedWith("zero amount");
    });

    it("应该正确转移代币", async function () {
      const betAmount = ethers.parseUnits("1000", 6);
      const initialBalance = await token.balanceOf(user1.address);
      const contractInitialBalance = await token.balanceOf(await bettingCore.getAddress());

      await bettingCore.connect(user1).placeBet(matchId, 0, betAmount);

      const newBalance = await token.balanceOf(user1.address);
      const contractNewBalance = await token.balanceOf(await bettingCore.getAddress());
      
      expect(newBalance).to.equal(initialBalance - betAmount);
      expect(contractNewBalance).to.equal(contractInitialBalance + betAmount);
    });
  });

  describe("结算功能", function () {
    const matchId = 1;
    const startTime = Math.floor(Date.now() / 1000) + 3600;
    const feeBps = 300;

    beforeEach(async function () {
      await bettingCore.createMatch(matchId, startTime, feeBps);
      await bettingCore.openMatch(matchId);
    });

    it("应该能够结算比赛（Home获胜）", async function () {
      // 用户下注
      await bettingCore.connect(user1).placeBet(matchId, 0, ethers.parseUnits("1000", 6)); // Home
      await bettingCore.connect(user2).placeBet(matchId, 2, ethers.parseUnits("500", 6)); // Away
      
      await bettingCore.closeMatch(matchId);

      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await generateSettleSignature(matchId, 1, timestamp, signer); // Outcome.Home = 1
      
      await expect(bettingCore.settleMatchWithSignature(matchId, 1, timestamp, signature))
        .to.emit(bettingCore, "MatchSettled")
        .withArgs(matchId, 1, owner.address);

      const match = await bettingCore.matches(matchId);
      expect(match.status).to.equal(3); // MatchStatus.Settled
      expect(match.result).to.equal(1); // Outcome.Home
    });

    it("应该能够结算比赛（Draw）", async function () {
      await bettingCore.connect(user1).placeBet(matchId, 1, ethers.parseUnits("1000", 6)); // Draw
      await bettingCore.closeMatch(matchId);

      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await generateSettleSignature(matchId, 2, timestamp, signer); // Outcome.Draw = 2
      
      await bettingCore.settleMatchWithSignature(matchId, 2, timestamp, signature);

      const match = await bettingCore.matches(matchId);
      expect(match.result).to.equal(2); // Outcome.Draw
    });

    it("应该能够结算比赛（Away获胜）", async function () {
      await bettingCore.connect(user1).placeBet(matchId, 2, ethers.parseUnits("1000", 6)); // Away
      await bettingCore.closeMatch(matchId);

      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await generateSettleSignature(matchId, 3, timestamp, signer); // Outcome.Away = 3
      
      await bettingCore.settleMatchWithSignature(matchId, 3, timestamp, signature);

      const match = await bettingCore.matches(matchId);
      expect(match.result).to.equal(3); // Outcome.Away
    });

    it("应该将费用转移到treasury", async function () {
      const betAmount = ethers.parseUnits("10000", 6);
      await bettingCore.connect(user1).placeBet(matchId, 0, betAmount);
      await bettingCore.closeMatch(matchId);

      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await generateSettleSignature(matchId, 1, timestamp, signer);
      
      const expectedFee = (betAmount * BigInt(feeBps)) / BigInt(10000);
      await expect(bettingCore.settleMatchWithSignature(matchId, 1, timestamp, signature))
        .to.emit(bettingCore, "FeeWithdrawn")
        .withArgs(await treasury.getAddress(), expectedFee);

      const treasuryBalance = await token.balanceOf(await treasury.getAddress());
      expect(treasuryBalance).to.equal(expectedFee);
    });

    it("不应该允许重复结算", async function () {
      await bettingCore.connect(user1).placeBet(matchId, 0, ethers.parseUnits("1000", 6));
      await bettingCore.closeMatch(matchId);

      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await generateSettleSignature(matchId, 1, timestamp, signer);
      
      await bettingCore.settleMatchWithSignature(matchId, 1, timestamp, signature);
      
      // 第一次结算后，状态变为Settled，第二次调用会在状态检查时失败
      await expect(
        bettingCore.settleMatchWithSignature(matchId, 1, timestamp, signature)
      ).to.be.revertedWith("already settled/cancelled");
    });

    it("不应该接受无效签名", async function () {
      await bettingCore.closeMatch(matchId);
      const timestamp = Math.floor(Date.now() / 1000);
      const wrongSignature = await generateSettleSignature(matchId, 1, timestamp, user1); // 使用错误的签名者
      
      await expect(
        bettingCore.settleMatchWithSignature(matchId, 1, timestamp, wrongSignature)
      ).to.be.revertedWith("bad signature");
    });

    it("不应该接受无效结果", async function () {
      await bettingCore.closeMatch(matchId);
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await generateSettleSignature(matchId, 0, timestamp, signer); // Outcome.None = 0 无效
      
      await expect(
        bettingCore.settleMatchWithSignature(matchId, 0, timestamp, signature)
      ).to.be.revertedWith("invalid result");
    });
  });

  describe("领取奖励功能", function () {
    const matchId = 1;
    const startTime = Math.floor(Date.now() / 1000) + 3600;
    const feeBps = 300;

    beforeEach(async function () {
      await bettingCore.createMatch(matchId, startTime, feeBps);
      await bettingCore.openMatch(matchId);
    });

    it("获胜者应该能够领取奖励", async function () {
      // user1下注Home 1000, user2下注Away 500
      await bettingCore.connect(user1).placeBet(matchId, 0, ethers.parseUnits("1000", 6));
      await bettingCore.connect(user2).placeBet(matchId, 2, ethers.parseUnits("500", 6));
      
      await bettingCore.closeMatch(matchId);
      
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await generateSettleSignature(matchId, 1, timestamp, signer); // Home获胜
      await bettingCore.settleMatchWithSignature(matchId, 1, timestamp, signature);

      // user1应该能够领取
      const initialBalance = await token.balanceOf(user1.address);
      const expectedPayout = await bettingCore.computeUserPayout(matchId, user1.address);
      
      await expect(bettingCore.connect(user1).claim(matchId))
        .to.emit(bettingCore, "Claimed")
        .withArgs(matchId, user1.address, expectedPayout);

      const newBalance = await token.balanceOf(user1.address);
      expect(newBalance).to.equal(initialBalance + expectedPayout);
    });

    it("失败者不应该能够领取", async function () {
      await bettingCore.connect(user1).placeBet(matchId, 0, ethers.parseUnits("1000", 6));
      await bettingCore.connect(user2).placeBet(matchId, 2, ethers.parseUnits("500", 6));
      
      await bettingCore.closeMatch(matchId);
      
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await generateSettleSignature(matchId, 1, timestamp, signer); // Home获胜
      await bettingCore.settleMatchWithSignature(matchId, 1, timestamp, signature);

      // user2不应该能够领取（下注Away但Home获胜）
      await expect(
        bettingCore.connect(user2).claim(matchId)
      ).to.be.revertedWith("no winning bet");
    });

    it("不应该允许重复领取", async function () {
      await bettingCore.connect(user1).placeBet(matchId, 0, ethers.parseUnits("1000", 6));
      await bettingCore.closeMatch(matchId);
      
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await generateSettleSignature(matchId, 1, timestamp, signer);
      await bettingCore.settleMatchWithSignature(matchId, 1, timestamp, signature);

      await bettingCore.connect(user1).claim(matchId);
      
      await expect(
        bettingCore.connect(user1).claim(matchId)
      ).to.be.revertedWith("already claimed");
    });

    it("不应该允许在未结算时领取", async function () {
      await bettingCore.connect(user1).placeBet(matchId, 0, ethers.parseUnits("1000", 6));
      
      await expect(
        bettingCore.connect(user1).claim(matchId)
      ).to.be.revertedWith("not settled");
    });
  });

  describe("取消比赛退款功能", function () {
    const matchId = 1;
    const startTime = Math.floor(Date.now() / 1000) + 3600;
    const feeBps = 300;

    beforeEach(async function () {
      await bettingCore.createMatch(matchId, startTime, feeBps);
      await bettingCore.openMatch(matchId);
    });

    it("应该能够在取消的比赛上退款", async function () {
      const betAmount = ethers.parseUnits("1000", 6);
      await bettingCore.connect(user1).placeBet(matchId, 0, betAmount);
      await bettingCore.connect(user1).placeBet(matchId, 1, ethers.parseUnits("500", 6));
      
      await bettingCore.cancelMatch(matchId);

      const initialBalance = await token.balanceOf(user1.address);
      await expect(bettingCore.connect(user1).refundOnCancelled(matchId))
        .to.emit(bettingCore, "Claimed")
        .withArgs(matchId, user1.address, betAmount + ethers.parseUnits("500", 6));

      const newBalance = await token.balanceOf(user1.address);
      expect(newBalance).to.equal(initialBalance + betAmount + ethers.parseUnits("500", 6));
    });

    it("不应该允许在非取消状态下退款", async function () {
      await bettingCore.connect(user1).placeBet(matchId, 0, ethers.parseUnits("1000", 6));
      
      await expect(
        bettingCore.connect(user1).refundOnCancelled(matchId)
      ).to.be.revertedWith("not cancelled");
    });

    it("不应该允许重复退款", async function () {
      await bettingCore.connect(user1).placeBet(matchId, 0, ethers.parseUnits("1000", 6));
      await bettingCore.cancelMatch(matchId);
      
      await bettingCore.connect(user1).refundOnCancelled(matchId);
      
      await expect(
        bettingCore.connect(user1).refundOnCancelled(matchId)
      ).to.be.revertedWith("already claimed");
    });
  });

  describe("View函数", function () {
    const matchId = 1;
    const startTime = Math.floor(Date.now() / 1000) + 3600;
    const feeBps = 300;

    beforeEach(async function () {
      await bettingCore.createMatch(matchId, startTime, feeBps);
      await bettingCore.openMatch(matchId);
    });

    it("getUserBet应该返回正确的用户下注", async function () {
      await bettingCore.connect(user1).placeBet(matchId, 0, ethers.parseUnits("1000", 6));
      await bettingCore.connect(user1).placeBet(matchId, 1, ethers.parseUnits("500", 6));
      await bettingCore.connect(user1).placeBet(matchId, 2, ethers.parseUnits("300", 6));

      const userBet = await bettingCore.getUserBet(matchId, user1.address);
      expect(userBet.home).to.equal(ethers.parseUnits("1000", 6));
      expect(userBet.draw).to.equal(ethers.parseUnits("500", 6));
      expect(userBet.away).to.equal(ethers.parseUnits("300", 6));
    });

    it("getMatchTotals应该返回正确的总额", async function () {
      await bettingCore.connect(user1).placeBet(matchId, 0, ethers.parseUnits("1000", 6));
      await bettingCore.connect(user2).placeBet(matchId, 1, ethers.parseUnits("500", 6));
      await bettingCore.connect(user3).placeBet(matchId, 2, ethers.parseUnits("300", 6));

      const totals = await bettingCore.getMatchTotals(matchId);
      expect(totals.home).to.equal(ethers.parseUnits("1000", 6));
      expect(totals.draw).to.equal(ethers.parseUnits("500", 6));
      expect(totals.away).to.equal(ethers.parseUnits("300", 6));
      expect(totals.total).to.equal(ethers.parseUnits("1800", 6));
    });

    it("computeUserPayout应该正确计算潜在收益", async function () {
      await bettingCore.connect(user1).placeBet(matchId, 0, ethers.parseUnits("1000", 6));
      await bettingCore.connect(user2).placeBet(matchId, 2, ethers.parseUnits("500", 6));
      
      await bettingCore.closeMatch(matchId);
      
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await generateSettleSignature(matchId, 1, timestamp, signer);
      await bettingCore.settleMatchWithSignature(matchId, 1, timestamp, signature);

      const payout = await bettingCore.computeUserPayout(matchId, user1.address);
      expect(payout).to.be.gt(0);
      
      // 验证计算：prizePool = totalStaked * (10000 - feeBps) / 10000
      // payout = userBet * prizePool / totalWinnerStaked
      const totals = await bettingCore.getMatchTotals(matchId);
      const prizePool = (totals.total * BigInt(10000 - feeBps)) / BigInt(10000);
      const expectedPayout = (ethers.parseUnits("1000", 6) * prizePool) / totals.home;
      expect(payout).to.equal(expectedPayout);
    });
  });
});


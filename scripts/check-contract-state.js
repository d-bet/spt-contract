// contract/scripts/check-contract-state.js
const { ethers } = require("hardhat");

async function main() {
  const contractAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
  const BettingCore = await ethers.getContractAt("BettingCore", contractAddress);

  console.log("\n=== BettingCore 合约状态 ===\n");
  
  // 基本信息
  console.log("📋 基本信息:");
  console.log("  质押代币:", await BettingCore.stakeToken());
  console.log("  金库地址:", await BettingCore.treasury());
  console.log("  签名者:", await BettingCore.signer());
  console.log("  所有者:", await BettingCore.owner());
  
  // 查询比赛（示例：matchId = 1）
  const matchId = 1;
  console.log(`\n📊 比赛 #${matchId} 信息:`);
  const matchInfo = await BettingCore.matches(matchId);
  
  if (matchInfo.startTime.toString() !== "0") {
    const statusNames = ["Created", "Open", "Closed", "Settled", "Cancelled"];
    const resultNames = ["None", "Home", "Draw", "Away"];
    
    console.log("  开始时间:", new Date(Number(matchInfo.startTime) * 1000).toLocaleString());
    console.log("  状态:", matchInfo.status);
    console.log("  结果:", resultNames[matchInfo.result]);
    console.log("  主队总投注:", ethers.formatUnits(matchInfo.totalHome, 6));
    console.log("  平局总投注:", ethers.formatUnits(matchInfo.totalDraw, 6));
    console.log("  客队总投注:", ethers.formatUnits(matchInfo.totalAway, 6));
    console.log("  总投注:", ethers.formatUnits(matchInfo.totalStaked, 6));
    console.log("  手续费:", Number(matchInfo.feeBps) / 100, "%");
    console.log("  结算人:", matchInfo.settledBy);
  } else {
    console.log("  比赛不存在");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
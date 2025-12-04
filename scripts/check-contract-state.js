// contract/scripts/check-contract-state.js
const { ethers } = require("hardhat");
const { loadAddresses } = require("./save-addresses");

async function main() {
  // 获取网络名称
  const network = await ethers.provider.getNetwork();
  let networkName = network.name === "unknown" ? "localhost" : network.name;
  
  // 如果网络是 "hardhat" 但 Chain ID 是 31337，使用 "localhost" 地址文件
  // 因为 hardhat 和 localhost 实际上是同一个网络（Chain ID 31337）
  if (networkName === "hardhat" && network.chainId === 31337n) {
    networkName = "localhost";
  }
  
  // 尝试从地址文件读取，如果没有则使用硬编码地址
  const addresses = loadAddresses(networkName);
  const contractAddress = addresses?.BettingCore || "0x610178dA211FEF7D417bC0e6FeD39F05609AD788";
  
  // 从命令行参数获取 matchId，如果没有则使用默认值
  const matchId = process.argv[2] ? BigInt(process.argv[2]) : 185778135n; // 使用你创建的 matchId
  // 从命令行参数获取用户地址（可选），格式: node script.js [matchId] [userAddress]
  const userAddress = process.argv[3] || null;
  
  console.log(`\n网络: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`使用地址文件: ${networkName}.json`);
  console.log(`合约地址: ${contractAddress}`);
  if (userAddress) {
    console.log(`查询用户: ${userAddress}`);
  }
  console.log();

  // 检查合约代码是否存在
  let code = await ethers.provider.getCode(contractAddress);
  let provider = ethers.provider;
  
  // 如果当前是 hardhat 内置网络且合约代码不存在，尝试切换到 localhost 网络
  if (code === "0x" && networkName === "hardhat" && network.chainId === 31337n) {
    console.log("⚠️  检测到 Hardhat 内置网络，尝试切换到 localhost 网络...");
    try {
      const localhostProvider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
      const localhostCode = await localhostProvider.getCode(contractAddress);
      if (localhostCode !== "0x") {
        console.log("✅ 在 localhost 网络找到合约，已自动切换！\n");
        provider = localhostProvider;
        code = localhostCode;
        // 重新获取 signers（使用 localhost provider）
        const [signer] = await ethers.getSigners();
        // 注意：这里我们需要使用 localhost provider 来创建合约实例
      } else {
        console.error("❌ localhost 网络也没有合约代码！");
        console.error(`  当前网络: ${network.name} (Chain ID: ${network.chainId})`);
        console.error(`  合约地址: ${contractAddress}`);
        console.error("\n可能的原因:");
        console.error("  1. Hardhat 本地节点未启动");
        console.error("  2. 合约未部署到该地址");
        console.error("  3. 网络配置不匹配");
        console.error("\n解决方案:");
        console.error("  ✅ 启动本地节点并部署合约:");
        console.error("     终端1: npx hardhat node");
        console.error("     终端2: npx hardhat run scripts/deploy.js --network localhost");
        process.exit(1);
      }
    } catch (error) {
      console.error("❌ 无法连接到 localhost 网络！");
      console.error(`  错误: ${error.message}`);
      console.error("\n请确保 Hardhat 本地节点正在运行:");
      console.error("  npx hardhat node");
      process.exit(1);
    }
  } else if (code === "0x") {
    console.error("❌ 错误: 该地址没有合约代码！");
    console.error(`  当前网络: ${network.name} (Chain ID: ${network.chainId})`);
    console.error(`  合约地址: ${contractAddress}`);
    console.error("\n可能的原因:");
    console.error("  1. Hardhat 本地节点未启动或已重启，合约状态丢失");
    console.error("  2. 合约未部署到该地址");
    console.error("  3. 网络配置不匹配");
    console.error("\n解决方案:");
    console.error("  ✅ 使用 Hardhat 运行脚本（推荐）:");
    console.error("     npx hardhat run scripts/check-contract-state.js --network localhost");
    console.error("\n  ✅ 或者先启动本地节点:");
    console.error("     终端1: npx hardhat node");
    console.error("     终端2: npx hardhat run scripts/deploy.js --network localhost");
    console.error("     终端2: npx hardhat run scripts/check-contract-state.js --network localhost");
    process.exit(1);
  }

  try {
    // 如果切换到了 localhost provider，需要使用它来创建合约实例
    let BettingCore;
    if (provider !== ethers.provider) {
      // 使用 localhost provider 创建合约实例（只读操作，不需要 signer）
      const BettingCoreFactory = await ethers.getContractFactory("BettingCore");
      BettingCore = BettingCoreFactory.attach(contractAddress).connect(provider);
    } else {
      BettingCore = await ethers.getContractAt("BettingCore", contractAddress);
    }

    console.log("=== BettingCore 合约状态 ===\n");
    
    // 基本信息
    console.log("📋 基本信息:");
    try {
      // 使用 read() 方法（ethers v6 推荐方式）
      const stakeToken = await BettingCore.stakeToken.read();
      console.log("  质押代币:", stakeToken);
    } catch (error) {
      // 如果 read() 失败，尝试直接调用
      try {
        const stakeToken = await BettingCore.stakeToken();
        console.log("  质押代币:", stakeToken);
      } catch (error2) {
        console.error("  ❌ 无法读取 stakeToken:", error2.message);
        console.error("    原始错误:", error.message);
      }
    }

    try {
      const treasury = await BettingCore.treasury.read();
      console.log("  金库地址:", treasury);
    } catch (error) {
      try {
        const treasury = await BettingCore.treasury();
        console.log("  金库地址:", treasury);
      } catch (error2) {
        console.error("  ❌ 无法读取 treasury:", error2.message);
      }
    }

    try {
      const signer = await BettingCore.signer.read();
      console.log("  签名者:", signer);
    } catch (error) {
      try {
        const signer = await BettingCore.signer();
        console.log("  签名者:", signer);
      } catch (error2) {
        console.error("  ❌ 无法读取 signer:", error2.message);
      }
    }

    try {
      const owner = await BettingCore.owner.read();
      console.log("  所有者:", owner);
    } catch (error) {
      try {
        const owner = await BettingCore.owner();
        console.log("  所有者:", owner);
      } catch (error2) {
        console.error("  ❌ 无法读取 owner:", error2.message);
      }
    }
    
    // 查询比赛
    console.log(`\n📊 比赛 #${matchId} 信息:`);
    try {
      const matchInfo = await BettingCore.matches(matchId);
      
      if (matchInfo.startTime.toString() !== "0") {
        const statusNames = ["Created", "Open", "Closed", "Settled", "Cancelled"];
        const resultNames = ["None", "Home", "Draw", "Away"];
        
        console.log("  开始时间:", new Date(Number(matchInfo.startTime) * 1000).toLocaleString());
        console.log("  状态:", statusNames[Number(matchInfo.status)]);
        const resultNum = Number(matchInfo.result);
        console.log("  结果:", resultNames[resultNum], `(值: ${resultNum}, 0=None, 1=Home, 2=Draw, 3=Away)`);
        console.log("  主队总投注:", ethers.formatUnits(matchInfo.totalHome, 6));
        console.log("  平局总投注:", ethers.formatUnits(matchInfo.totalDraw, 6));
        console.log("  客队总投注:", ethers.formatUnits(matchInfo.totalAway, 6));
        console.log("  总投注:", ethers.formatUnits(matchInfo.totalStaked, 6));
        console.log("  手续费:", Number(matchInfo.feeBps) / 100, "%");
        console.log("  结算人:", matchInfo.settledBy);
        
        // 如果比赛已结算，显示奖金池信息
        if (matchInfo.status === 3n) { // Settled
          const MAX_BPS = 10000n;
          const feeAmount = (matchInfo.totalStaked * BigInt(matchInfo.feeBps)) / MAX_BPS;
          const prizePool = matchInfo.totalStaked - feeAmount;
          
          console.log("\n  💰 奖金池信息:");
          console.log("    总奖金池:", ethers.formatUnits(prizePool, 6));
          console.log("    手续费金额:", ethers.formatUnits(feeAmount, 6));
          
          // 显示获胜方的总投注
          // Outcome 枚举: None=0, Home=1, Draw=2, Away=3
          let winnerTotal = 0n;
          const resultValue = Number(matchInfo.result); // 转换为数字以便比较
          
          if (resultValue === 1) { // Home
            winnerTotal = matchInfo.totalHome;
            console.log("    获胜方: 主队 (Home)");
          } else if (resultValue === 2) { // Draw
            winnerTotal = matchInfo.totalDraw;
            console.log("    获胜方: 平局 (Draw)");
          } else if (resultValue === 3) { // Away
            winnerTotal = matchInfo.totalAway;
            console.log("    获胜方: 客队 (Away)");
          } else {
            console.log(`    ⚠️  未知结果值: ${resultValue} (应该是 1=Home, 2=Draw, 3=Away)`);
          }
          
          if (winnerTotal > 0n) {
            console.log("    获胜方总投注:", ethers.formatUnits(winnerTotal, 6));
            // 计算平均赔率（简化版，实际赔率取决于用户投注比例）
            const avgOdds = Number(prizePool) / Number(winnerTotal);
            console.log("    平均赔率:", avgOdds.toFixed(4), "x");
          }
        }
      } else {
        console.log("  比赛不存在");
      }
    } catch (error) {
      console.error("  ❌ 无法读取比赛信息:", error.message);
      console.error("  错误详情:", error);
    }
    
    // 如果提供了用户地址，查询用户相关信息
    if (userAddress) {
      try {
        // 验证地址格式
        if (!ethers.isAddress(userAddress)) {
          console.error(`\n❌ 无效的用户地址: ${userAddress}`);
          return;
        }
        
        console.log(`\n👤 用户 ${userAddress} 的投注信息:`);
        
        // 查询用户投注
        const userBet = await BettingCore.getUserBet(matchId, userAddress);
        const totalUserBet = userBet.home + userBet.draw + userBet.away;
        
        if (totalUserBet > 0n) {
          console.log("  主队投注:", ethers.formatUnits(userBet.home, 6));
          console.log("  平局投注:", ethers.formatUnits(userBet.draw, 6));
          console.log("  客队投注:", ethers.formatUnits(userBet.away, 6));
          console.log("  总投注:", ethers.formatUnits(totalUserBet, 6));
          
          // 查询比赛信息以判断是否已结算
          const matchInfo = await BettingCore.matches(matchId);
          
          if (matchInfo.status === 3n) { // Settled
            console.log("\n  🎯 中奖信息:");
            
            // 查询中奖金额
            const payout = await BettingCore.computeUserPayout(matchId, userAddress);
            
            if (payout > 0n) {
              console.log("    中奖金额:", ethers.formatUnits(payout, 6));
              const profit = payout - totalUserBet;
              console.log("    净利润:", ethers.formatUnits(profit, 6));
              const roi = (Number(profit) / Number(totalUserBet)) * 100;
              console.log("    收益率:", roi.toFixed(2), "%");
              
              // 查询是否已领取
              const hasClaimed = await BettingCore.claimed(matchId, userAddress);
              console.log("    领取状态:", hasClaimed ? "✅ 已领取" : "⏳ 未领取");
              
              if (!hasClaimed) {
                console.log("\n  💡 提示: 您可以调用 claim() 函数领取奖金");
              }
            } else {
              console.log("    ❌ 未中奖");
              console.log("    原因: 您的投注选项与比赛结果不匹配");
            }
          } else if (matchInfo.status === 4n) { // Cancelled
            console.log("\n  🔄 退款信息:");
            console.log("    比赛已取消，可以领取全额退款");
            const hasClaimed = await BettingCore.claimed(matchId, userAddress);
            console.log("    领取状态:", hasClaimed ? "✅ 已领取" : "⏳ 未领取");
            if (!hasClaimed) {
              console.log("\n  💡 提示: 您可以调用 refundOnCancelled() 函数领取退款");
            }
          } else {
            console.log("\n  ⏳ 比赛尚未结算，无法查询中奖信息");
            console.log("    当前状态:", ["Created", "Open", "Closed", "Settled", "Cancelled"][Number(matchInfo.status)]);
          }
        } else {
          console.log("  该用户在此比赛中没有投注记录");
        }
      } catch (error) {
        console.error("  ❌ 无法查询用户信息:", error.message);
        console.error("  错误详情:", error);
      }
    } else {
      console.log("\n💡 提示: 要查询特定用户的中奖信息，请在命令后添加用户地址:");
      console.log(`  例如: npx hardhat run scripts/check-contract-state.js --network localhost ${matchId} 0xYourUserAddress`);
    }
  } catch (error) {
    console.error("❌ 连接合约失败:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
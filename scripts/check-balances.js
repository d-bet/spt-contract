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
  
  // 获取所有账户
  const accounts = await ethers.getSigners();
  console.log("\n=== 账户列表 ===");
  accounts.forEach((account, index) => {
    console.log(`Account #${index}: ${account.address}`);
  });

  // 从文件加载合约地址
  console.log(`\n=== 检查代币余额 (${networkName}) ===`);
  const addresses = loadAddresses(networkName);
  
  if (!addresses) {
    console.error("\n❌ 未找到已保存的合约地址！");
    console.log("请先运行部署脚本: pnpm hardhat run scripts/deploy.js --network localhost");
    process.exit(1);
  }

  console.log("\n📋 使用以下合约地址:");
  console.log(`  ggUSDT: ${addresses.ggUSDT}`);
  console.log(`  SPT: ${addresses.SPT}`);
  if (addresses.lastUpdated) {
    console.log(`  最后更新: ${addresses.lastUpdated}`);
  }

  // 检查合约代码是否存在
  const ggUSDTCode = await ethers.provider.getCode(addresses.ggUSDT);
  const SPTCode = await ethers.provider.getCode(addresses.SPT);
  
  if (ggUSDTCode === "0x" || SPTCode === "0x") {
    console.error(`\n❌ 错误: 合约地址没有合约代码！`);
    console.error(`  当前网络: ${network.name} (Chain ID: ${network.chainId})`);
    console.error(`  ggUSDT 地址: ${addresses.ggUSDT} ${ggUSDTCode === "0x" ? "❌" : "✅"}`);
    console.error(`  SPT 地址: ${addresses.SPT} ${SPTCode === "0x" ? "❌" : "✅"}`);
    console.error("\n可能的原因:");
    console.error("  1. 你直接运行了 'node scripts/check-balances.js'，这使用了 Hardhat 内置网络");
    console.error("  2. 合约部署在 localhost 网络，需要使用 --network localhost 参数");
    console.error("  3. Hardhat 本地节点未启动或已重启，合约状态丢失");
    console.error("\n解决方案:");
    console.error("  ✅ 使用 Hardhat 运行脚本（推荐）:");
    console.error("     npx hardhat run scripts/check-balances.js --network localhost");
    console.error("\n  ✅ 或者先启动本地节点:");
    console.error("     终端1: npx hardhat node");
    console.error("     终端2: npx hardhat run scripts/deploy.js --network localhost");
    console.error("     终端2: npx hardhat run scripts/check-balances.js --network localhost");
    process.exit(1);
  }

  // 获取合约实例
  const ggUSDT = await ethers.getContractAt("ggUSDT", addresses.ggUSDT);
  const SPT = await ethers.getContractAt("SPT", addresses.SPT);
  
  // 检查每个账户的余额
  console.log("\n💰 账户余额:");
  for (let i = 0; i < accounts.length; i++) {
    const ggusdtBalance = await ggUSDT.balanceOf(accounts[i].address);
    const sptBalance = await SPT.balanceOf(accounts[i].address);
    console.log(`\nAccount #${i} (${accounts[i].address}):`);
    console.log(`  ggUSDT: ${ethers.formatUnits(ggusdtBalance, 6)} ggUSDT`);
    console.log(`  SPT: ${ethers.formatEther(sptBalance)} SPT`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


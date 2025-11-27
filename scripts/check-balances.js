const { ethers } = require("hardhat");
const { loadAddresses } = require("./save-addresses");

async function main() {
  // 获取网络名称
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "localhost" : network.name;
  
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


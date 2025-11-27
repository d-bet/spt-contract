const { ethers } = require("hardhat");
const { loadAddresses } = require("./save-addresses");

async function main() {
  // 获取网络名称
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "localhost" : network.name;
  
  // 从文件加载合约地址
  const addresses = loadAddresses(networkName);
  
  if (!addresses || !addresses.ggUSDT) {
    console.error("\n❌ 未找到已保存的合约地址！");
    process.exit(1);
  }

  const ggUSDTAddress = addresses.ggUSDT;
  console.log(`\n=== 检查 ggUSDT 合约信息 ===`);
  console.log(`合约地址: ${ggUSDTAddress}`);
  
  // 获取合约实例
  const ggUSDT = await ethers.getContractAt("ggUSDT", ggUSDTAddress);
  
  // 检查代币信息
  try {
    const name = await ggUSDT.name();
    const symbol = await ggUSDT.symbol();
    const decimals = await ggUSDT.decimals();
    const totalSupply = await ggUSDT.totalSupply();
    const deployerBalance = await ggUSDT.balanceOf(addresses.deployer);
    
    console.log(`\n📋 代币信息:`);
    console.log(`  名称: ${name}`);
    console.log(`  符号: ${symbol}`);
    console.log(`  小数位: ${decimals} ⬅️ 这应该是 6`);
    console.log(`  总供应量: ${ethers.formatUnits(totalSupply, decimals)} ${symbol}`);
    console.log(`  部署者余额: ${ethers.formatUnits(deployerBalance, decimals)} ${symbol}`);
    
    if (decimals === 6) {
      console.log(`\n✅ 合约 decimals() 返回正确值: 6`);
      console.log(`\n⚠️  如果钱包仍显示 18 位精度，这是钱包缓存问题，请尝试：`);
      console.log(`\n📱 MetaMask 解决方案：`);
      console.log(`   1. 删除钱包中的旧 ggUSDT 代币（点击代币，选择"隐藏"或"删除"）`);
      console.log(`   2. 清除浏览器缓存：`);
      console.log(`      - Chrome/Edge: 设置 > 隐私和安全 > 清除浏览数据 > 缓存的图片和文件`);
      console.log(`      - 或使用 Ctrl+Shift+Delete`);
      console.log(`   3. 刷新页面或重启 MetaMask 扩展`);
      console.log(`   4. 重新添加代币（使用合约地址: ${ggUSDTAddress}）`);
      console.log(`   5. 钱包会自动从合约读取 decimals() = 6，应该显示正确余额`);
      console.log(`\n💡 如果还是不行，可以尝试：`);
      console.log(`   - 使用新的浏览器/隐私模式`);
      console.log(`   - 或者等待几分钟让缓存过期`);
    } else {
      console.log(`\n❌ 合约 decimals() 返回错误值: ${decimals}，应该是 6`);
      console.log(`   请检查合约代码是否正确编译和部署`);
    }
  } catch (error) {
    console.error(`\n❌ 读取合约信息失败:`, error.message);
    console.log(`   可能是合约地址错误或合约未部署`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


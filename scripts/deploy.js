const { ethers } = require("hardhat");
const { saveAddresses } = require("./save-addresses");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // 获取网络名称
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "localhost" : network.name;
  console.log(`Network: ${networkName} (Chain ID: ${network.chainId})`);

  // 部署 ggUSDT 测试代币
  const ggUSDT = await ethers.getContractFactory("ggUSDT");
  const ggusdt = await ggUSDT.deploy();
  await ggusdt.waitForDeployment();
  const ggusdtAddress = await ggusdt.getAddress();
  console.log("ggUSDT deployed to:", ggusdtAddress);

  // 部署 SPT
  const SPT = await ethers.getContractFactory("SPT");
  const spt = await SPT.deploy("SportWin Token", "SPT", ethers.parseEther("100000000"));
  await spt.waitForDeployment();
  const sptAddress = await spt.getAddress();
  console.log("SPT deployed to:", sptAddress);

  // 部署 Treasury
  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy();
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log("Treasury deployed to:", treasuryAddress);

  // 部署 BettingCore
  const BettingCore = await ethers.getContractFactory("BettingCore");
  const bettingCore = await BettingCore.deploy(
    ggusdtAddress,
    treasuryAddress,
    deployer.address // signer
  );
  await bettingCore.waitForDeployment();
  const bettingCoreAddress = await bettingCore.getAddress();
  console.log("BettingCore deployed to:", bettingCoreAddress);

  // 保存合约地址
  const addresses = {
    ggUSDT: ggusdtAddress,
    SPT: sptAddress,
    Treasury: treasuryAddress,
    BettingCore: bettingCoreAddress,
    deployer: deployer.address,
  };
  saveAddresses(networkName, addresses);

  // 显示代币分配情况
  console.log("\n=== 代币分配情况 ===");
  const deployerBalanceggUSDT = await ggusdt.balanceOf(deployer.address);
  const deployerBalanceSPT = await spt.balanceOf(deployer.address);
  
  console.log(`部署者地址: ${deployer.address}`);
  console.log(`ggUSDT余额: ${ethers.formatUnits(deployerBalanceggUSDT, 6)} ggUSDT`);
  console.log(`SPT余额: ${ethers.formatEther(deployerBalanceSPT)} SPT`);
  
  console.log("\n提示：所有代币都在部署者钱包中，可以转账给其他账户进行测试");
  console.log(`\n💾 合约地址已自动保存，下次可以直接使用！`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
const { run, ethers } = require("hardhat");

async function main() {
  // 从环境变量或命令行参数获取合约地址
  const sptAddress = process.env.SPT_ADDRESS || "";
  const treasuryAddress = process.env.TREASURY_ADDRESS || "";
  const bettingCoreAddress = process.env.BETTING_CORE_ADDRESS || "";
  const signerAddress = process.env.SIGNER_ADDRESS || "";

  if (!sptAddress || !treasuryAddress || !bettingCoreAddress) {
    console.error("请设置合约地址环境变量:");
    console.error("SPT_ADDRESS, TREASURY_ADDRESS, BETTING_CORE_ADDRESS");
    process.exit(1);
  }

  console.log("开始验证合约...\n");

  // 验证 SPT
  console.log("验证 SPT:", sptAddress);
  try {
    await run("verify:verify", {
      address: sptAddress,
      constructorArguments: [
        "SportWin Token",
        "SPT",
        ethers.parseEther("1000000").toString(),
      ],
    });
    console.log("✓ SPT 验证成功\n");
  } catch (error) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log("✓ SPT 已验证\n");
    } else {
      console.error("✗ SPT 验证失败:", error.message, "\n");
    }
  }

  // 验证 Treasury
  console.log("验证 Treasury:", treasuryAddress);
  try {
    await run("verify:verify", {
      address: treasuryAddress,
      constructorArguments: [],
    });
    console.log("✓ Treasury 验证成功\n");
  } catch (error) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log("✓ Treasury 已验证\n");
    } else {
      console.error("✗ Treasury 验证失败:", error.message, "\n");
    }
  }

  // 验证 BettingCore
  console.log("验证 BettingCore:", bettingCoreAddress);
  try {
    await run("verify:verify", {
      address: bettingCoreAddress,
      constructorArguments: [sptAddress, treasuryAddress, signerAddress],
    });
    console.log("✓ BettingCore 验证成功\n");
  } catch (error) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log("✓ BettingCore 已验证\n");
    } else {
      console.error("✗ BettingCore 验证失败:", error.message, "\n");
    }
  }

  console.log("验证完成！");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

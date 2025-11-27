const fs = require("fs");
const path = require("path");

/**
 * 保存合约地址到文件
 * @param {string} network - 网络名称 (localhost, bscTestnet, bscMainnet)
 * @param {Object} addresses - 合约地址对象
 */
function saveAddresses(network, addresses) {
  const addressesDir = path.join(__dirname, "..", "addresses");
  const filePath = path.join(addressesDir, `${network}.json`);

  // 创建 addresses 目录（如果不存在）
  if (!fs.existsSync(addressesDir)) {
    fs.mkdirSync(addressesDir, { recursive: true });
  }

  // 读取现有地址（如果存在）
  let existingAddresses = {};
  if (fs.existsSync(filePath)) {
    try {
      existingAddresses = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
      console.log("无法读取现有地址文件，将创建新文件");
    }
  }

  // 合并地址（新地址会覆盖旧地址）
  const updatedAddresses = {
    ...existingAddresses,
    ...addresses,
    lastUpdated: new Date().toISOString(),
  };

  // 保存到文件
  fs.writeFileSync(filePath, JSON.stringify(updatedAddresses, null, 2));
  console.log(`\n✅ 合约地址已保存到: ${filePath}`);
}

/**
 * 读取合约地址
 * @param {string} network - 网络名称
 * @returns {Object} 合约地址对象
 */
function loadAddresses(network) {
  const filePath = path.join(__dirname, "..", "addresses", `${network}.json`);

  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  地址文件不存在: ${filePath}`);
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.error(`❌ 读取地址文件失败: ${error.message}`);
    return null;
  }
}

module.exports = {
  saveAddresses,
  loadAddresses,
};


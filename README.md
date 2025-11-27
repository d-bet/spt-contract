# spt contract

```
pnpm install

编译
pnpm hardhat compile 

# 运行测试（会启动本地 Hardhat 网络）
pnpm test 

# 启动本地节点（新终端）
pnpm hardhat node

# 部署到本地网络（另一个终端）
pnpm hardhat run scripts/deploy.js --network localhost

# 部署到 BSC 测试网
# 测试通过后，部署到 BSC 测试网：
# 确保 .env 文件配置了：
# PRIVATE_KEY=你的私钥（0x开头，66字符）
# BSCSCAN_API_KEY=你的BSCScan API密钥（用于验证）

# 部署到测试网
pnpm hardhat run scripts/deploy.ts --network bscTestnet
```
// contracts/USDT.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title ggUSDT Test Token - for local testing
contract ggUSDT is ERC20, Ownable {
    constructor() ERC20("Game USDT", "ggUSDT") Ownable(msg.sender) {
        _mint(msg.sender, 10_000_000 * 10**6);
    }

    // 重写 decimals 函数，返回 6（USDT 标准）
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
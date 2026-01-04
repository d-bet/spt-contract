// contracts/USDT.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title USDT Test Token - for local testing
contract USDT is ERC20, Ownable {
    constructor() ERC20("Game USDT", "USDT") Ownable(msg.sender) {
        _mint(msg.sender, 10_000_000 * 10**18);
    }

    // 重写 decimals 函数，返回 18（USDT 标准）
    function decimals() public pure override returns (uint8) {
        return 18;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
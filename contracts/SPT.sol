// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title SPT token - simple BEP20/ERC20 for platform usage
contract SPT is ERC20, ERC20Burnable, Ownable {
    constructor(string memory name_, string memory symbol_, uint256 initialMint) ERC20(name_, symbol_) Ownable(msg.sender) {
        if (initialMint > 0) {
            _mint(msg.sender, initialMint);
        }
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
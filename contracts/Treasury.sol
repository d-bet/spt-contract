// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Treasury - receives fees and allows owner withdrawals
contract Treasury is Ownable {
    using SafeERC20 for IERC20;

    constructor() Ownable(msg.sender) {}

    event FeesReceived(address indexed token, uint256 amount);
    event Withdraw(address indexed token, address indexed to, uint256 amount);

    function receiveFees(address token, uint256 amount) external {
        require(amount > 0, "Zero amount");
        emit FeesReceived(token, amount);
    }

    function withdrawERC20(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "bad to");
        IERC20(token).safeTransfer(to, amount);
        emit Withdraw(token, to, amount);
    }
}
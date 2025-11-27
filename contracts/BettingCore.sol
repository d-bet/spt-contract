// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// ... BettingCore合约代码保持不变 ...
contract BettingCore is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // --- Events ---
    event MatchCreated(uint256 indexed matchId, uint256 startTime);
    event MatchOpened(uint256 indexed matchId);
    event MatchClosed(uint256 indexed matchId);
    event MatchSettled(uint256 indexed matchId, Outcome result, address indexed settledBy);
    event BetPlaced(uint256 indexed matchId, address indexed user, Option option, uint256 amount);
    event Claimed(uint256 indexed matchId, address indexed user, uint256 payout);
    event FeeWithdrawn(address indexed to, uint256 amount);

    // --- Enums ---
    enum MatchStatus { Created, Open, Closed, Settled, Cancelled }
    enum Option { Home, Draw, Away }
    enum Outcome { None, Home, Draw, Away }
    /* None (值为 0): 未结算/无结果
    Home (值为 1): 主队获胜
    Draw (值为 2): 平局
    Away (值为 3): 客队获胜 */

    // --- Structs ---
    struct MatchInfo {
        uint256 startTime;
        MatchStatus status;
        Outcome result;
        uint256 totalHome;
        uint256 totalDraw;
        uint256 totalAway;
        uint256 totalStaked; // totalHome + totalDraw + totalAway
        uint16 feeBps;       // fee in basis points (e.g., 300 = 3.00%)
        address settledBy;   // who called settle (for audit)
    }

    struct UserBet {
        uint256 home;
        uint256 draw;
        uint256 away;
    }

    // --- Storage ---
    IERC20 public immutable stakeToken; // e.g., USDT (BEP20)
    address public treasury;            // where fees are sent
    address public signer;              // offchain signer whose signature authorizes settle (can be multisig private key address)
    uint16 public constant MAX_BPS = 10000;

    mapping(uint256 => MatchInfo) public matches; // matchId => MatchInfo
    mapping(uint256 => mapping(address => UserBet)) public userBets; // matchId => user => bets
    mapping(uint256 => mapping(address => bool)) public claimed; // matchId => user => claimed

    // nonce to prevent replay for settle signatures per match or global (optional)
    mapping(uint256 => bool) public matchSettledNonce; // if settle was executed for matchId

    // --- Constructor ---
    constructor(IERC20 _stakeToken, address _treasury, address _signer) Ownable(msg.sender) {
        require(address(_stakeToken) != address(0), "zero token");
        require(_treasury != address(0), "zero treasury");
        require(_signer != address(0), "zero signer");
        stakeToken = _stakeToken;
        treasury = _treasury;
        signer = _signer;
    }

    // --- Admin functions ---
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "zero");
        treasury = _treasury;
    }

    function setSigner(address _signer) external onlyOwner {
        require(_signer != address(0), "zero");
        signer = _signer;
    }

    /// @notice 创建比赛（链下应确保matchId唯一）
    /// @param matchId 比赛ID，唯一标识符
    /// @param startTime 比赛开始时间（Unix时间戳）
    /// @param feeBps 手续费（基点），例如300表示3.00%，最大不超过1000（10%）
    function createMatch(uint256 matchId, uint256 startTime, uint16 feeBps) external onlyOwner {
        require(matches[matchId].startTime == 0, "exists");
        require(feeBps <= 1000, "fee too high"); // optional cap: <=10%
        matches[matchId] = MatchInfo({
            startTime: startTime,
            status: MatchStatus.Created,
            result: Outcome.None,
            totalHome: 0,
            totalDraw: 0,
            totalAway: 0,
            totalStaked: 0,
            feeBps: feeBps,
            settledBy: address(0)
        });
        emit MatchCreated(matchId, startTime);
    }

    function openMatch(uint256 matchId) external onlyOwner {
        MatchInfo storage m = matches[matchId];
        require(m.startTime != 0, "no match");
        require(m.status == MatchStatus.Created || m.status == MatchStatus.Closed, "not create/closed");
        m.status = MatchStatus.Open;
        emit MatchOpened(matchId);
    }

    function closeMatch(uint256 matchId) external onlyOwner {
        MatchInfo storage m = matches[matchId];
        require(m.status == MatchStatus.Open, "not open");
        m.status = MatchStatus.Closed;
        emit MatchClosed(matchId);
    }

    function cancelMatch(uint256 matchId) external onlyOwner {
        MatchInfo storage m = matches[matchId];
        require(m.status != MatchStatus.Settled && m.status != MatchStatus.Cancelled, "bad status");
        m.status = MatchStatus.Cancelled;
        emit MatchSettled(matchId, Outcome.None, msg.sender);
    }

    // --- Betting ---
    /// @notice User places a bet on a given option; user must approve token first.
    function placeBet(uint256 matchId, Option option, uint256 amount) external nonReentrant {
        require(amount > 0, "zero amount");
        MatchInfo storage m = matches[matchId];
        require(m.status == MatchStatus.Open, "not open");
        // transfer token from user to contract
        stakeToken.safeTransferFrom(msg.sender, address(this), amount);

        // update user bet & totals (packed into UserBet struct)
        UserBet storage b = userBets[matchId][msg.sender];
        if (option == Option.Home) {
            b.home += amount;
            m.totalHome += amount;
        } else if (option == Option.Draw) {
            b.draw += amount;
            m.totalDraw += amount;
        } else { // Away
            b.away += amount;
            m.totalAway += amount;
        }
        m.totalStaked += amount;

        emit BetPlaced(matchId, msg.sender, option, amount);
    }

    // --- Settlement ---
    /// @notice Settle a match: requires off-chain signer signature for (matchId, result, timestamp)
    /// Payload includes matchId, result (0=Home,1=Draw,2=Away), timestamp to prevent replay beyond reasonable window.
    function settleMatchWithSignature(
        uint256 matchId,
        Outcome result,
        uint256 timestamp,
        bytes calldata sig
    ) external nonReentrant {
        MatchInfo storage m = matches[matchId];
        require(m.startTime != 0, "no match");
        require(m.status == MatchStatus.Closed || m.status == MatchStatus.Open || m.status == MatchStatus.Created, "already settled/cancelled");
        require(result == Outcome.Home || result == Outcome.Draw || result == Outcome.Away, "invalid result");
        // one-time settle guard
        require(!matchSettledNonce[matchId], "already settled");

        // Construct the signed message.
        bytes32 message = keccak256(abi.encodePacked(address(this), matchId, uint256(result), timestamp));
        bytes32 ethSigned = message.toEthSignedMessageHash();
        address recovered = ECDSA.recover(ethSigned, sig);
        require(recovered == signer, "bad signature");

        // mark settled
        m.result = result;
        m.status = MatchStatus.Settled;
        m.settledBy = msg.sender;
        matchSettledNonce[matchId] = true;

        // compute fee and move fee to treasury (do NOT distribute here)
        uint256 total = m.totalStaked;
        if (total > 0) {
            uint256 fee = (total * m.feeBps) / MAX_BPS;
            if (fee > 0) {
                // transfer fee to treasury
                stakeToken.safeTransfer(treasury, fee);
                emit FeeWithdrawn(treasury, fee);
            }
        }

        emit MatchSettled(matchId, result, msg.sender);
    }

    /// @notice Claim winnings for a user (user calls for themselves). Handles per-user claim only.
    function claim(uint256 matchId) external nonReentrant {
        MatchInfo storage m = matches[matchId];
        require(m.status == MatchStatus.Settled, "not settled");
        require(!claimed[matchId][msg.sender], "already claimed");

        UserBet storage b = userBets[matchId][msg.sender];
        uint256 userBetOnWinner;
        uint256 totalWinnerStaked;

        if (m.result == Outcome.Home) {
            userBetOnWinner = b.home;
            totalWinnerStaked = m.totalHome;
        } else if (m.result == Outcome.Draw) {
            userBetOnWinner = b.draw;
            totalWinnerStaked = m.totalDraw;
        } else { // Away
            userBetOnWinner = b.away;
            totalWinnerStaked = m.totalAway;
        }

        require(userBetOnWinner > 0, "no winning bet");
        require(totalWinnerStaked > 0, "no winner pool");

        // Prize pool after fee
        uint256 prizePool = (m.totalStaked * (MAX_BPS - m.feeBps)) / MAX_BPS;

        // payout = userBetOnWinner * prizePool / totalWinnerStaked
        uint256 payout = (userBetOnWinner * prizePool) / totalWinnerStaked;

        // mark claimed
        claimed[matchId][msg.sender] = true;

        // transfer payout
        stakeToken.safeTransfer(msg.sender, payout);

        emit Claimed(matchId, msg.sender, payout);
    }

    /// @notice In case of cancelled match, allow user to withdraw their stakes (full refund)
    function refundOnCancelled(uint256 matchId) external nonReentrant {
        MatchInfo storage m = matches[matchId];
        require(m.status == MatchStatus.Cancelled, "not cancelled");
        require(!claimed[matchId][msg.sender], "already claimed");

        UserBet storage b = userBets[matchId][msg.sender];
        uint256 refund = b.home + b.draw + b.away;
        require(refund > 0, "nothing to refund");

        // zero out and mark claimed to prevent reentry
        b.home = 0;
        b.draw = 0;
        b.away = 0;
        claimed[matchId][msg.sender] = true;

        stakeToken.safeTransfer(msg.sender, refund);
        emit Claimed(matchId, msg.sender, refund);
    }

    // --- Views / helpers ---
    function getUserBet(uint256 matchId, address user) external view returns (uint256 home, uint256 draw, uint256 away) {
        UserBet storage b = userBets[matchId][user];
        return (b.home, b.draw, b.away);
    }

    function getMatchTotals(uint256 matchId) external view returns (uint256 home, uint256 draw, uint256 away, uint256 total) {
        MatchInfo storage m = matches[matchId];
        return (m.totalHome, m.totalDraw, m.totalAway, m.totalStaked);
    }

    /// @notice Helper to compute user's potential payout (read-only). Does not consider rounding.
    function computeUserPayout(uint256 matchId, address user) external view returns (uint256 payout) {
        MatchInfo storage m = matches[matchId];
        UserBet storage b = userBets[matchId][user];
        if (m.status != MatchStatus.Settled) return 0;

        uint256 userBetOnWinner;
        uint256 totalWinnerStaked;
        if (m.result == Outcome.Home) {
            userBetOnWinner = b.home;
            totalWinnerStaked = m.totalHome;
        } else if (m.result == Outcome.Draw) {
            userBetOnWinner = b.draw;
            totalWinnerStaked = m.totalDraw;
        } else if (m.result == Outcome.Away) {
            userBetOnWinner = b.away;
            totalWinnerStaked = m.totalAway;
        } else {
            return 0;
        }
        if (userBetOnWinner == 0 || totalWinnerStaked == 0) return 0;
        uint256 prizePool = (m.totalStaked * (MAX_BPS - m.feeBps)) / MAX_BPS;
        payout = (userBetOnWinner * prizePool) / totalWinnerStaked;
    }
}
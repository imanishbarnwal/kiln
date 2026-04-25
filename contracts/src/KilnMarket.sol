// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {KilnAgentNFT} from "./KilnAgentNFT.sol";

/// @title KilnMarket
/// @notice Marketplace + payment splitter for Kiln iNFTs.
///
/// Pricing model:
///   - Per-session rent: pay pricePerSession, get one TEE inference session.
///   - Bulk license:     pay licensePricePerDay * durationDays, get time-boxed
///                       executor authorization for an organization.
///
/// Payment split:
///   - 90% to the iNFT owner
///   - 8%  to the Kiln treasury
///   - 2%  retained in this contract for the 0G ecosystem fund
///
/// Authorization model:
///   The coach must call nft.authorizeUsage(tokenId, executorAddress) once
///   before listing. KilnMarket cannot grant authorization on the owner's
///   behalf because the reference ERC-7857 reserves authorizeUsage to the
///   token owner. The frontend bundles this auth call into the listing UX.
contract KilnMarket {
    KilnAgentNFT public immutable nft;
    address public immutable treasury;
    address public admin;
    address public executor;

    uint256 public ecosystemBalance;

    struct Listing {
        address owner;
        uint256 pricePerSession;
        uint256 licensePricePerDay;
        string  metadataURI;
        bool    active;
    }

    struct Session {
        uint256 tokenId;
        address student;
        uint256 amount;
        bool    settled;
    }

    struct License {
        uint256 tokenId;
        address licensee;
        uint256 expiresAt;
        uint256 seats;
        bool    revoked;
    }

    mapping(uint256 => Listing) public listings;
    mapping(uint256 => Session) public sessions;
    mapping(uint256 => License) public licenses;

    uint256 public nextSessionId = 1;
    uint256 public nextLicenseId = 1;

    event Listed(
        uint256 indexed tokenId,
        address indexed owner,
        uint256 pricePerSession,
        uint256 licensePricePerDay
    );
    event Delisted(uint256 indexed tokenId);
    event SessionStarted(
        uint256 indexed sessionId,
        uint256 indexed tokenId,
        address indexed student,
        uint256 amount
    );
    event SessionEnded(uint256 indexed sessionId, uint256 ownerPayout, uint8 rating);
    event LicenseStarted(
        uint256 indexed licenseId,
        uint256 indexed tokenId,
        address indexed licensee,
        uint256 expiresAt,
        uint256 seats
    );
    event LicenseRevoked(uint256 indexed licenseId);
    event ExecutorChanged(address indexed oldExecutor, address indexed newExecutor);
    event EcosystemFundsWithdrawn(address indexed to, uint256 amount);

    modifier onlyAdmin() {
        require(msg.sender == admin, "KilnMarket: not admin");
        _;
    }

    modifier onlyExecutor() {
        require(msg.sender == executor, "KilnMarket: not executor");
        _;
    }

    constructor(address nft_, address treasury_, address executor_) {
        require(nft_ != address(0) && treasury_ != address(0) && executor_ != address(0),
            "KilnMarket: zero address");
        nft = KilnAgentNFT(nft_);
        treasury = treasury_;
        admin = msg.sender;
        executor = executor_;
    }

    /* ------------------------------ Listing ------------------------------ */

    function list(
        uint256 tokenId,
        uint256 pricePerSession,
        uint256 licensePricePerDay,
        string calldata metadataURI
    ) external {
        require(nft.ownerOf(tokenId) == msg.sender, "KilnMarket: not iNFT owner");
        require(pricePerSession > 0 || licensePricePerDay > 0, "KilnMarket: zero pricing");
        listings[tokenId] = Listing({
            owner: msg.sender,
            pricePerSession: pricePerSession,
            licensePricePerDay: licensePricePerDay,
            metadataURI: metadataURI,
            active: true
        });
        emit Listed(tokenId, msg.sender, pricePerSession, licensePricePerDay);
    }

    function delist(uint256 tokenId) external {
        Listing storage l = listings[tokenId];
        require(l.owner == msg.sender, "KilnMarket: not listing owner");
        l.active = false;
        emit Delisted(tokenId);
    }

    /* ----------------------- Per-session rent flow ----------------------- */

    function startSession(uint256 tokenId) external payable returns (uint256 sessionId) {
        Listing memory l = listings[tokenId];
        require(l.active, "KilnMarket: not listed");
        require(l.pricePerSession > 0, "KilnMarket: per-session not offered");
        require(msg.value == l.pricePerSession, "KilnMarket: bad payment");

        sessionId = nextSessionId++;
        sessions[sessionId] = Session({
            tokenId: tokenId,
            student: msg.sender,
            amount:  msg.value,
            settled: false
        });

        emit SessionStarted(sessionId, tokenId, msg.sender, msg.value);
    }

    function endSession(uint256 sessionId, uint8 rating) external onlyExecutor {
        Session storage s = sessions[sessionId];
        require(!s.settled, "KilnMarket: already settled");
        s.settled = true;

        Listing memory l = listings[s.tokenId];
        (uint256 ownerCut, uint256 treasuryCut, uint256 ecosystemCut) = _split(s.amount);

        ecosystemBalance += ecosystemCut;
        _send(payable(l.owner), ownerCut);
        _send(payable(treasury), treasuryCut);

        emit SessionEnded(sessionId, ownerCut, rating);
    }

    /* --------------------------- Bulk license flow --------------------------- */

    function startLicense(uint256 tokenId, uint256 durationDays, uint256 seats)
        external payable returns (uint256 licenseId)
    {
        Listing memory l = listings[tokenId];
        require(l.active, "KilnMarket: not listed");
        require(l.licensePricePerDay > 0, "KilnMarket: licensing not offered");
        require(durationDays > 0 && durationDays <= 3650, "KilnMarket: bad duration");
        require(seats > 0, "KilnMarket: zero seats");
        uint256 fee = l.licensePricePerDay * durationDays;
        require(msg.value == fee, "KilnMarket: bad payment");

        licenseId = nextLicenseId++;
        licenses[licenseId] = License({
            tokenId:   tokenId,
            licensee:  msg.sender,
            expiresAt: block.timestamp + durationDays * 1 days,
            seats:     seats,
            revoked:   false
        });

        // Bulk fee settles immediately (no per-call settlement loop).
        (uint256 ownerCut, uint256 treasuryCut, uint256 ecosystemCut) = _split(msg.value);
        ecosystemBalance += ecosystemCut;
        _send(payable(l.owner), ownerCut);
        _send(payable(treasury), treasuryCut);

        emit LicenseStarted(licenseId, tokenId, msg.sender, licenses[licenseId].expiresAt, seats);
    }

    function revokeLicense(uint256 licenseId) external {
        License storage lic = licenses[licenseId];
        require(!lic.revoked, "KilnMarket: already revoked");
        require(
            block.timestamp >= lic.expiresAt
                || msg.sender == executor
                || msg.sender == nft.ownerOf(lic.tokenId),
            "KilnMarket: not allowed"
        );
        lic.revoked = true;
        emit LicenseRevoked(licenseId);
    }

    /* --------------------------- Admin --------------------------- */

    function setExecutor(address newExecutor) external onlyAdmin {
        require(newExecutor != address(0), "KilnMarket: zero executor");
        emit ExecutorChanged(executor, newExecutor);
        executor = newExecutor;
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "KilnMarket: zero admin");
        admin = newAdmin;
    }

    function withdrawEcosystem(address to, uint256 amount) external onlyAdmin {
        require(amount <= ecosystemBalance, "KilnMarket: insufficient balance");
        ecosystemBalance -= amount;
        _send(payable(to), amount);
        emit EcosystemFundsWithdrawn(to, amount);
    }

    /* --------------------------- Helpers --------------------------- */

    function _split(uint256 amount)
        internal
        pure
        returns (uint256 ownerCut, uint256 treasuryCut, uint256 ecosystemCut)
    {
        ownerCut    = (amount * 90) / 100;
        treasuryCut = (amount *  8) / 100;
        ecosystemCut = amount - ownerCut - treasuryCut;
    }

    function _send(address payable to, uint256 amount) internal {
        if (amount == 0) return;
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "KilnMarket: payout failed");
    }

    receive() external payable {}
}

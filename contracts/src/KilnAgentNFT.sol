// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC7857} from "0g-agent-nft/interfaces/IERC7857.sol";
import {IERC7857Metadata} from "0g-agent-nft/interfaces/IERC7857Metadata.sol";
import {
    IERC7857DataVerifier,
    PreimageProofOutput,
    TransferValidityProofOutput
} from "0g-agent-nft/interfaces/IERC7857DataVerifier.sol";

/// @title KilnAgentNFT
/// @notice Non-upgradeable implementation of ERC-7857 (iNFT) for the Kiln marketplace.
///         Mirrors the 0gfoundation reference contract's surface area but ships as a
///         plain constructor-deployed contract for simpler testnet operations.
contract KilnAgentNFT is IERC7857, IERC7857Metadata {
    struct TokenData {
        address owner;
        string[] dataDescriptions;
        bytes32[] dataHashes;
        address[] authorizedUsers;
        address approvedUser;
    }

    string private _name;
    string private _symbol;
    string private _chainURL;
    string private _indexerURL;
    IERC7857DataVerifier private _verifier;
    address public admin;

    mapping(uint256 => TokenData) private _tokens;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    uint256 private _nextTokenId;

    event Approval(address indexed _from, address indexed _to, uint256 indexed _tokenId);
    event ApprovalForAll(address indexed _owner, address indexed _operator, bool _approved);

    string public constant VERSION = "1.0.0-kiln";

    modifier onlyAdmin() {
        require(msg.sender == admin, "KilnAgentNFT: not admin");
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        address verifier_,
        string memory chainURL_,
        string memory indexerURL_
    ) {
        require(verifier_ != address(0), "KilnAgentNFT: zero verifier");
        admin = msg.sender;
        _name = name_;
        _symbol = symbol_;
        _verifier = IERC7857DataVerifier(verifier_);
        _chainURL = chainURL_;
        _indexerURL = indexerURL_;
        _nextTokenId = 1; // start at 1 so 0 means "no token"
    }

    /* ----------------------------- IERC7857 ----------------------------- */

    function verifier() external view override returns (IERC7857DataVerifier) {
        return _verifier;
    }

    function mint(
        bytes[] calldata proofs,
        string[] calldata dataDescriptions,
        address to
    ) external payable override returns (uint256 tokenId) {
        require(
            dataDescriptions.length == proofs.length,
            "KilnAgentNFT: descriptions length mismatch"
        );
        if (to == address(0)) to = msg.sender;

        PreimageProofOutput[] memory out = _verifier.verifyPreimage(proofs);
        bytes32[] memory dataHashes = new bytes32[](out.length);
        for (uint256 i = 0; i < out.length; i++) {
            require(out[i].isValid, "KilnAgentNFT: invalid preimage proof");
            dataHashes[i] = out[i].dataHash;
        }

        tokenId = _nextTokenId++;
        _tokens[tokenId] = TokenData({
            owner: to,
            dataDescriptions: dataDescriptions,
            dataHashes: dataHashes,
            authorizedUsers: new address[](0),
            approvedUser: address(0)
        });

        emit Minted(tokenId, msg.sender, to, dataHashes, dataDescriptions);
    }

    function transfer(
        address to,
        uint256 tokenId,
        bytes[] calldata proofs
    ) external override {
        require(to != address(0), "KilnAgentNFT: zero address");
        TokenData storage token = _tokens[tokenId];
        require(token.owner == msg.sender, "KilnAgentNFT: not owner");

        TransferValidityProofOutput[] memory out =
            _verifier.verifyTransferValidity(proofs);
        bytes16[] memory sealedKeys = new bytes16[](out.length);
        bytes32[] memory newDataHashes = new bytes32[](out.length);

        for (uint256 i = 0; i < out.length; i++) {
            require(out[i].isValid, "KilnAgentNFT: invalid transfer proof");
            require(
                out[i].oldDataHash == token.dataHashes[i],
                "KilnAgentNFT: oldDataHash mismatch"
            );
            require(out[i].receiver == to, "KilnAgentNFT: receiver mismatch");
            sealedKeys[i] = out[i].sealedKey;
            newDataHashes[i] = out[i].newDataHash;
        }

        token.owner = to;
        token.dataHashes = newDataHashes;
        // Reset approval and authorized users on transfer.
        // (Reference contract leaves authorizedUsers in place; we reset for safer demo semantics.)
        token.approvedUser = address(0);
        delete token.authorizedUsers;

        emit Transferred(tokenId, msg.sender, to);
        emit PublishedSealedKey(to, tokenId, sealedKeys);
    }

    function clone(
        address to,
        uint256 tokenId,
        bytes[] calldata proofs
    ) external override returns (uint256 newTokenId) {
        require(to != address(0), "KilnAgentNFT: zero address");
        TokenData storage token = _tokens[tokenId];
        require(token.owner == msg.sender, "KilnAgentNFT: not owner");

        TransferValidityProofOutput[] memory out =
            _verifier.verifyTransferValidity(proofs);
        bytes16[] memory sealedKeys = new bytes16[](out.length);
        bytes32[] memory newDataHashes = new bytes32[](out.length);

        for (uint256 i = 0; i < out.length; i++) {
            require(out[i].isValid, "KilnAgentNFT: invalid clone proof");
            require(
                out[i].oldDataHash == token.dataHashes[i],
                "KilnAgentNFT: oldDataHash mismatch"
            );
            require(out[i].receiver == to, "KilnAgentNFT: receiver mismatch");
            sealedKeys[i] = out[i].sealedKey;
            newDataHashes[i] = out[i].newDataHash;
        }

        newTokenId = _nextTokenId++;
        _tokens[newTokenId] = TokenData({
            owner: to,
            dataDescriptions: token.dataDescriptions,
            dataHashes: newDataHashes,
            authorizedUsers: new address[](0),
            approvedUser: address(0)
        });

        emit Cloned(tokenId, newTokenId, msg.sender, to);
        emit PublishedSealedKey(to, newTokenId, sealedKeys);
    }

    function authorizeUsage(uint256 tokenId, address to) external override {
        TokenData storage token = _tokens[tokenId];
        require(token.owner == msg.sender, "KilnAgentNFT: not owner");
        require(to != address(0), "KilnAgentNFT: zero address");
        token.authorizedUsers.push(to);
        emit Authorization(msg.sender, to, tokenId);
    }

    function ownerOf(uint256 tokenId) external view override returns (address) {
        address owner_ = _tokens[tokenId].owner;
        require(owner_ != address(0), "KilnAgentNFT: token does not exist");
        return owner_;
    }

    function authorizedUsersOf(uint256 tokenId)
        external
        view
        override
        returns (address[] memory)
    {
        require(_tokens[tokenId].owner != address(0), "KilnAgentNFT: token does not exist");
        return _tokens[tokenId].authorizedUsers;
    }

    /* -------------------------- Helpers and views -------------------------- */

    function name() external view override returns (string memory) { return _name; }
    function symbol() external view override returns (string memory) { return _symbol; }
    function chainURL() external view returns (string memory) { return _chainURL; }
    function indexerURL() external view returns (string memory) { return _indexerURL; }
    function nextTokenId() external view returns (uint256) { return _nextTokenId; }

    function dataHashesOf(uint256 tokenId) external view override returns (bytes32[] memory) {
        require(_tokens[tokenId].owner != address(0), "KilnAgentNFT: token does not exist");
        return _tokens[tokenId].dataHashes;
    }

    function dataDescriptionsOf(uint256 tokenId) external view override returns (string[] memory) {
        require(_tokens[tokenId].owner != address(0), "KilnAgentNFT: token does not exist");
        return _tokens[tokenId].dataDescriptions;
    }

    /// @notice Update the encrypted data backing a token (e.g., the coach uploaded a new
    ///         fine-tune artifact). Re-runs preimage proof verification.
    function update(uint256 tokenId, bytes[] calldata proofs) external override {
        TokenData storage token = _tokens[tokenId];
        require(token.owner == msg.sender, "KilnAgentNFT: not owner");
        require(proofs.length == token.dataHashes.length, "KilnAgentNFT: proofs length mismatch");

        PreimageProofOutput[] memory out = _verifier.verifyPreimage(proofs);
        bytes32[] memory newDataHashes = new bytes32[](out.length);
        for (uint256 i = 0; i < out.length; i++) {
            require(out[i].isValid, "KilnAgentNFT: invalid preimage proof");
            newDataHashes[i] = out[i].dataHash;
        }

        bytes32[] memory oldDataHashes = token.dataHashes;
        token.dataHashes = newDataHashes;

        emit Updated(tokenId, oldDataHashes, newDataHashes);
    }

    /// @notice Refine an iNFT's persona by replacing both data hashes AND
    ///         the human-readable descriptions in one tx. Used by coaches
    ///         to evolve their persona text (system prompt, blurb) without
    ///         minting a new token. Owner-only. The Updated event still
    ///         fires so existing indexers see the data hash rotation;
    ///         downstream consumers can read the new descriptions via
    ///         dataDescriptionsOf(tokenId).
    function refine(
        uint256 tokenId,
        bytes[] calldata proofs,
        string[] calldata dataDescriptions
    ) external {
        TokenData storage token = _tokens[tokenId];
        require(token.owner == msg.sender, "KilnAgentNFT: not owner");
        require(proofs.length == token.dataHashes.length, "KilnAgentNFT: proofs length mismatch");
        require(
            dataDescriptions.length == proofs.length,
            "KilnAgentNFT: descriptions length mismatch"
        );

        PreimageProofOutput[] memory out = _verifier.verifyPreimage(proofs);
        bytes32[] memory newDataHashes = new bytes32[](out.length);
        for (uint256 i = 0; i < out.length; i++) {
            require(out[i].isValid, "KilnAgentNFT: invalid preimage proof");
            newDataHashes[i] = out[i].dataHash;
        }

        bytes32[] memory oldDataHashes = token.dataHashes;
        token.dataHashes = newDataHashes;

        // Manually copy each string · solc's old codegen cannot bulk-copy a
        // nested calldata dynamic array (string[]) into storage in one go.
        delete token.dataDescriptions;
        for (uint256 i = 0; i < dataDescriptions.length; i++) {
            token.dataDescriptions.push(dataDescriptions[i]);
        }

        emit Updated(tokenId, oldDataHashes, newDataHashes);
    }

    function isAuthorized(uint256 tokenId, address user) external view returns (bool) {
        address[] storage list = _tokens[tokenId].authorizedUsers;
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i] == user) return true;
        }
        return false;
    }

    /* --------------------------- Approvals (ERC721-ish) ------------------- */

    function approve(address to, uint256 tokenId) external {
        require(_tokens[tokenId].owner == msg.sender, "KilnAgentNFT: not owner");
        _tokens[tokenId].approvedUser = to;
        emit Approval(msg.sender, to, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        return _tokens[tokenId].approvedUser;
    }

    function isApprovedForAll(address owner_, address operator) external view returns (bool) {
        return _operatorApprovals[owner_][operator];
    }

    /* --------------------------- Admin --------------------------- */

    function setVerifier(address newVerifier) external onlyAdmin {
        require(newVerifier != address(0), "KilnAgentNFT: zero verifier");
        _verifier = IERC7857DataVerifier(newVerifier);
    }

    function setURLs(string calldata newChainURL, string calldata newIndexerURL) external onlyAdmin {
        _chainURL = newChainURL;
        _indexerURL = newIndexerURL;
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "KilnAgentNFT: zero admin");
        admin = newAdmin;
    }

    /* --------------------------- IERC7857Metadata --------------------------- */

    function tokenURI(uint256 tokenId) external view override returns (string memory) {
        require(_tokens[tokenId].owner != address(0), "KilnAgentNFT: token does not exist");
        return string(abi.encodePacked(
            '{"chainURL":"', _chainURL, '","indexerURL":"', _indexerURL, '"}'
        ));
    }
}

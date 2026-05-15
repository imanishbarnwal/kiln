// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {
    IERC7857DataVerifier,
    PreimageProofOutput,
    TransferValidityProofOutput
} from "0g-agent-nft/interfaces/IERC7857DataVerifier.sol";

/// @title KilnAttestationOracle
/// @notice Spec-conformant ERC-7857 verifier that checks ECDSA signatures
///         from trusted signers on extended proof envelopes. Stamps nonces
///         to prevent replay and enforces expiry windows. mockMode bypass
///         exists for the Galileo demo only; production uses mockMode=false.
contract KilnAttestationOracle is IERC7857DataVerifier {
    /// @dev EIP-191-style domain separators bound into the signed digest.
    bytes32 public constant PREIMAGE_DOMAIN = keccak256("KILN_PREIMAGE_V1");
    bytes32 public constant TRANSFER_DOMAIN = keccak256("KILN_TRANSFER_V1");

    /// @dev How far in the future an attestation may claim expiry.
    /// Clock-skew window for backend↔chain drift.
    uint256 public constant MAX_EXPIRY_SKEW = 60;

    address public admin;
    bool public mockMode;
    mapping(address => bool) public trustedSigners;
    mapping(address => mapping(uint256 => bool)) public usedNonces; // signer → nonce → used

    event TrustedSignerAdded(address indexed signer);
    event TrustedSignerRemoved(address indexed signer);
    event MockModeToggled(bool enabled);
    event PreimageVerified(address indexed signer, bytes32 indexed dataHash, uint256 nonce);
    event TransferVerified(
        address indexed signer,
        bytes32 indexed oldDataHash,
        bytes32 newDataHash,
        address receiver,
        uint256 nonce
    );
    event MockAttestationAccepted(bytes32 indexed dataHash, uint256 nonce);

    modifier onlyAdmin() {
        require(msg.sender == admin, "KilnAttestationOracle: not admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function addTrustedSigner(address signer) external onlyAdmin {
        require(signer != address(0), "KilnAttestationOracle: zero signer");
        trustedSigners[signer] = true;
        emit TrustedSignerAdded(signer);
    }

    function removeTrustedSigner(address signer) external onlyAdmin {
        trustedSigners[signer] = false;
        emit TrustedSignerRemoved(signer);
    }

    function setMockMode(bool enabled) external onlyAdmin {
        mockMode = enabled;
        emit MockModeToggled(enabled);
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "KilnAttestationOracle: zero admin");
        admin = newAdmin;
    }

    function verifyPreimage(bytes[] calldata _proofs)
        external
        override
        returns (PreimageProofOutput[] memory)
    {
        // Implemented in Task 1.4 (next task in plan)
        revert("KilnAttestationOracle: verifyPreimage not implemented");
    }

    function verifyTransferValidity(bytes[] calldata _proofs)
        external
        override
        returns (TransferValidityProofOutput[] memory)
    {
        // Implemented in Task 1.6 (later task in plan)
        revert("KilnAttestationOracle: verifyTransferValidity not implemented");
    }
}

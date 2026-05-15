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
    /// @dev Context constants bound into the signed digest. NOT EIP-712 domain
    ///      separators — we use raw EIP-191 signatures since the signer is a
    ///      backend ops wallet (no end-user wallet UX to optimize for).
    bytes32 public constant PREIMAGE_DOMAIN = keccak256("KILN_PREIMAGE_V1");
    bytes32 public constant TRANSFER_DOMAIN = keccak256("KILN_TRANSFER_V1");

    /// @dev Maximum allowed clock skew (in seconds) between backend signer and
    ///      chain timestamp. Attestations claiming expiry up to this many seconds
    ///      past `block.timestamp` are still accepted at signing time.
    uint256 public constant MAX_EXPIRY_SKEW = 60;

    address public admin;
    address public pendingAdmin;
    bool public mockMode;
    bool public mainnetLocked;
    mapping(address => bool) public trustedSigners;
    mapping(address => mapping(uint256 => bool)) public usedNonces; // signer → nonce → used

    event TrustedSignerAdded(address indexed signer);
    event TrustedSignerRemoved(address indexed signer);
    event MockModeToggled(bool enabled);
    event MainnetModeLocked();
    event AdminTransferStarted(address indexed oldAdmin, address indexed pendingAdmin);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
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
        require(trustedSigners[signer], "KilnAttestationOracle: not a signer");
        trustedSigners[signer] = false;
        emit TrustedSignerRemoved(signer);
    }

    function setMockMode(bool enabled) external onlyAdmin {
        if (enabled) {
            require(!mainnetLocked, "KilnAttestationOracle: mainnet locked");
        }
        mockMode = enabled;
        emit MockModeToggled(enabled);
    }

    function lockMainnetMode() external onlyAdmin {
        require(!mockMode, "KilnAttestationOracle: mockMode currently true");
        mainnetLocked = true;
        emit MainnetModeLocked();
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "KilnAttestationOracle: zero admin");
        pendingAdmin = newAdmin;
        emit AdminTransferStarted(admin, newAdmin);
    }

    function acceptAdmin() external {
        require(msg.sender == pendingAdmin, "KilnAttestationOracle: not pending admin");
        address oldAdmin = admin;
        admin = pendingAdmin;
        pendingAdmin = address(0);
        emit AdminTransferred(oldAdmin, admin);
    }

    function verifyPreimage(bytes[] calldata _proofs)
        external
        override
        returns (PreimageProofOutput[] memory)
    {
        PreimageProofOutput[] memory outputs = new PreimageProofOutput[](_proofs.length);
        for (uint256 i = 0; i < _proofs.length; i++) {
            outputs[i] = _verifyPreimageOne(_proofs[i]);
        }
        return outputs;
    }

    function _verifyPreimageOne(bytes calldata proof)
        internal
        returns (PreimageProofOutput memory)
    {
        (bytes32 dataHash, uint256 nonce, uint256 expiry, bytes memory signature) =
            abi.decode(proof, (bytes32, uint256, uint256, bytes));

        if (mockMode) {
            require(expiry >= block.timestamp, "KilnAttestationOracle: expired");
            emit MockAttestationAccepted(dataHash, nonce);
            return PreimageProofOutput({dataHash: dataHash, isValid: true});
        }

        require(expiry >= block.timestamp, "KilnAttestationOracle: expired");
        require(expiry <= block.timestamp + 365 days + MAX_EXPIRY_SKEW, "KilnAttestationOracle: expiry too far");

        bytes32 digest = keccak256(abi.encode(dataHash, nonce, expiry, PREIMAGE_DOMAIN));
        address recovered = _recoverSigner(digest, signature);
        require(trustedSigners[recovered], "KilnAttestationOracle: untrusted signer");
        require(!usedNonces[recovered][nonce], "KilnAttestationOracle: nonce used");
        usedNonces[recovered][nonce] = true;

        emit PreimageVerified(recovered, dataHash, nonce);
        return PreimageProofOutput({dataHash: dataHash, isValid: true});
    }

    function _recoverSigner(bytes32 digest, bytes memory signature) internal pure returns (address) {
        require(signature.length == 65, "KilnAttestationOracle: bad sig length");
        bytes32 r; bytes32 s; uint8 v;
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        return ecrecover(digest, v, r, s);
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

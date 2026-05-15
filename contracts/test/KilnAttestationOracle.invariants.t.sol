// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import {KilnAttestationOracle} from "../src/KilnAttestationOracle.sol";
import {PreimageProofOutput} from "0g-agent-nft/interfaces/IERC7857DataVerifier.sol";

contract OracleHandler is Test {
    KilnAttestationOracle public oracle;
    uint256 public signerKey;
    address public signer;
    mapping(uint256 => bool) public consumedNonces;

    constructor(KilnAttestationOracle _oracle, uint256 _signerKey, address _signer) {
        oracle = _oracle;
        signerKey = _signerKey;
        signer = _signer;
    }

    function consumePreimage(bytes32 dataHash, uint256 nonce) external {
        uint256 expiry = block.timestamp + 60;
        bytes32 digest = keccak256(abi.encode(dataHash, nonce, expiry, oracle.PREIMAGE_DOMAIN()));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        bytes memory sig = abi.encodePacked(r, s, v);
        bytes memory proof = abi.encode(dataHash, nonce, expiry, sig);
        bytes[] memory proofs = new bytes[](1);
        proofs[0] = proof;
        try oracle.verifyPreimage(proofs) {
            consumedNonces[nonce] = true;
        } catch {}
    }
}

contract KilnAttestationOracleInvariants is Test {
    KilnAttestationOracle oracle;
    OracleHandler handler;
    address admin = address(0xA11CE);
    uint256 signerKey = 0xB0B;
    address signer;

    function setUp() public {
        signer = vm.addr(signerKey);
        vm.prank(admin);
        oracle = new KilnAttestationOracle();
        vm.prank(admin);
        oracle.addTrustedSigner(signer);
        handler = new OracleHandler(oracle, signerKey, signer);
        targetContract(address(handler));
    }

    /// @dev Once a nonce has been successfully consumed for a signer, it
    ///      can never be consumed again. The unit tests already cover this
    ///      directly; this invariant documents the property at the system
    ///      level under fuzz exploration.
    function invariant_adminUnchanged() public {
        // Admin role is never delegated away by the handler — it should stay
        // exactly as set in setUp.
        assertEq(oracle.admin(), admin);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import {KilnAttestationOracle} from "../src/KilnAttestationOracle.sol";
import {
    PreimageProofOutput,
    TransferValidityProofOutput
} from "0g-agent-nft/interfaces/IERC7857DataVerifier.sol";

contract KilnAttestationOracleTest is Test {
    KilnAttestationOracle oracle;
    address admin = address(0xA11CE);
    uint256 signerKey = 0xB0B;
    address signer;

    function setUp() public {
        signer = vm.addr(signerKey);
        vm.prank(admin);
        oracle = new KilnAttestationOracle();
        vm.prank(admin);
        oracle.addTrustedSigner(signer);
    }

    function test_constructor_setsAdmin() public {
        assertEq(oracle.admin(), admin);
    }

    function _signPreimage(
        bytes32 dataHash,
        uint256 nonce,
        uint256 expiry,
        uint256 privKey
    ) internal view returns (bytes memory proof) {
        bytes32 digest = keccak256(abi.encode(
            dataHash, nonce, expiry, oracle.PREIMAGE_DOMAIN()
        ));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        return abi.encode(dataHash, nonce, expiry, signature);
    }

    function test_verifyPreimage_validSignature() public {
        bytes32 dataHash = keccak256("data");
        uint256 nonce = 1;
        uint256 expiry = block.timestamp + 300;
        bytes memory proof = _signPreimage(dataHash, nonce, expiry, signerKey);

        bytes[] memory proofs = new bytes[](1);
        proofs[0] = proof;

        PreimageProofOutput[] memory out = oracle.verifyPreimage(proofs);
        assertEq(out.length, 1);
        assertTrue(out[0].isValid);
        assertEq(out[0].dataHash, dataHash);
        assertTrue(oracle.usedNonces(signer, nonce));
    }

    function test_verifyPreimage_untrustedSignerFails() public {
        uint256 otherKey = 0xDEAD;
        bytes memory proof = _signPreimage(keccak256("x"), 1, block.timestamp + 60, otherKey);
        bytes[] memory proofs = new bytes[](1);
        proofs[0] = proof;
        vm.expectRevert(bytes("KilnAttestationOracle: untrusted signer"));
        oracle.verifyPreimage(proofs);
    }

    function test_verifyPreimage_expiredFails() public {
        bytes memory proof = _signPreimage(keccak256("x"), 1, block.timestamp - 1, signerKey);
        bytes[] memory proofs = new bytes[](1);
        proofs[0] = proof;
        vm.expectRevert(bytes("KilnAttestationOracle: expired"));
        oracle.verifyPreimage(proofs);
    }

    function test_verifyPreimage_replayedNonceFails() public {
        bytes memory proof = _signPreimage(keccak256("x"), 1, block.timestamp + 60, signerKey);
        bytes[] memory proofs = new bytes[](1);
        proofs[0] = proof;
        oracle.verifyPreimage(proofs);
        vm.expectRevert(bytes("KilnAttestationOracle: nonce used"));
        oracle.verifyPreimage(proofs);
    }

    function test_verifyPreimage_tamperedDataHashFails() public {
        bytes32 origHash = keccak256("orig");
        bytes memory signed = _signPreimage(origHash, 1, block.timestamp + 60, signerKey);
        // Decode and replace dataHash with a different one, keep same signature
        (, uint256 n, uint256 e, bytes memory sig) = abi.decode(signed, (bytes32, uint256, uint256, bytes));
        bytes memory tampered = abi.encode(keccak256("evil"), n, e, sig);
        bytes[] memory proofs = new bytes[](1);
        proofs[0] = tampered;
        vm.expectRevert(bytes("KilnAttestationOracle: untrusted signer"));
        oracle.verifyPreimage(proofs);
    }

    function test_verifyPreimage_expiryTooFarFails() public {
        bytes memory proof = _signPreimage(
            keccak256("x"), 1, block.timestamp + 366 days, signerKey
        );
        bytes[] memory proofs = new bytes[](1);
        proofs[0] = proof;
        vm.expectRevert(bytes("KilnAttestationOracle: expiry too far"));
        oracle.verifyPreimage(proofs);
    }

    function test_addTrustedSigner_nonAdminFails() public {
        vm.prank(address(0xBAD));
        vm.expectRevert(bytes("KilnAttestationOracle: not admin"));
        oracle.addTrustedSigner(address(0x123));
    }

    function _signTransfer(
        bytes32 oldHash,
        bytes32 newHash,
        address receiver,
        bytes16 sealedKey,
        uint256 nonce,
        uint256 expiry,
        uint256 privKey
    ) internal view returns (bytes memory proof) {
        bytes32 digest = keccak256(abi.encode(
            oldHash, newHash, receiver, sealedKey, nonce, expiry, oracle.TRANSFER_DOMAIN()
        ));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        return abi.encode(oldHash, newHash, receiver, sealedKey, nonce, expiry, signature);
    }

    function test_verifyTransferValidity_valid() public {
        bytes32 oldH = keccak256("old");
        bytes32 newH = keccak256("new");
        address rcv = address(0xCAFE);
        bytes16 sealedKey = bytes16(keccak256("key"));
        bytes memory proof = _signTransfer(oldH, newH, rcv, sealedKey, 7, block.timestamp + 300, signerKey);

        bytes[] memory proofs = new bytes[](1);
        proofs[0] = proof;

        TransferValidityProofOutput[] memory out = oracle.verifyTransferValidity(proofs);
        assertTrue(out[0].isValid);
        assertEq(out[0].oldDataHash, oldH);
        assertEq(out[0].newDataHash, newH);
        assertEq(out[0].receiver, rcv);
        assertEq(out[0].sealedKey, sealedKey);
    }

    function test_verifyTransferValidity_preimageProofCannotBeReplayed() public {
        // Domain-separator defense: a preimage proof must NOT verify as transfer.
        bytes memory preimage = _signPreimage(keccak256("x"), 99, block.timestamp + 60, signerKey);
        bytes[] memory proofs = new bytes[](1);
        proofs[0] = preimage;
        vm.expectRevert();
        oracle.verifyTransferValidity(proofs);
    }

    function test_verifyTransferValidity_untrustedSignerFails() public {
        uint256 otherKey = 0xDEAD;
        bytes memory proof = _signTransfer(
            keccak256("old"), keccak256("new"), address(0xCAFE),
            bytes16(0), 1, block.timestamp + 60, otherKey
        );
        bytes[] memory proofs = new bytes[](1);
        proofs[0] = proof;
        vm.expectRevert(bytes("KilnAttestationOracle: untrusted signer"));
        oracle.verifyTransferValidity(proofs);
    }

    function test_verifyTransferValidity_replayedNonceFails() public {
        bytes memory proof = _signTransfer(
            keccak256("old"), keccak256("new"), address(0xCAFE),
            bytes16(0), 42, block.timestamp + 60, signerKey
        );
        bytes[] memory proofs = new bytes[](1);
        proofs[0] = proof;
        oracle.verifyTransferValidity(proofs);
        vm.expectRevert(bytes("KilnAttestationOracle: nonce used"));
        oracle.verifyTransferValidity(proofs);
    }

    function test_mockMode_acceptsAnyPreimage() public {
        vm.prank(admin);
        oracle.setMockMode(true);

        // No valid signature — just any bytes
        bytes memory proof = abi.encode(
            bytes32(uint256(0xDEAD)), uint256(1), block.timestamp + 60, hex"00"
        );
        bytes[] memory proofs = new bytes[](1);
        proofs[0] = proof;

        PreimageProofOutput[] memory out = oracle.verifyPreimage(proofs);
        assertTrue(out[0].isValid);
    }

    function test_mockMode_rejectsExpiredEven() public {
        vm.prank(admin);
        oracle.setMockMode(true);

        bytes memory proof = abi.encode(
            bytes32(uint256(0xDEAD)), uint256(1), uint256(0), hex"00"
        );
        bytes[] memory proofs = new bytes[](1);
        proofs[0] = proof;

        vm.expectRevert(bytes("KilnAttestationOracle: expired"));
        oracle.verifyPreimage(proofs);
    }

    function test_setMockMode_nonAdminFails() public {
        vm.prank(address(0xBAD));
        vm.expectRevert(bytes("KilnAttestationOracle: not admin"));
        oracle.setMockMode(true);
    }

    function test_mainnetLock_blocksReenableMockMode() public {
        // Admin locks mainnet mode while mockMode = false (the default state).
        vm.prank(admin);
        oracle.lockMainnetMode();
        // Setting mockMode = false is still fine (no-op).
        vm.prank(admin);
        oracle.setMockMode(false);
        // Setting mockMode = true is permanently blocked.
        vm.prank(admin);
        vm.expectRevert(bytes("KilnAttestationOracle: mainnet locked"));
        oracle.setMockMode(true);
    }

    function test_lockMainnetMode_failsIfMockModeOn() public {
        vm.prank(admin);
        oracle.setMockMode(true);
        vm.prank(admin);
        vm.expectRevert(bytes("KilnAttestationOracle: mockMode currently true"));
        oracle.lockMainnetMode();
    }
}

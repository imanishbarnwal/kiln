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
}

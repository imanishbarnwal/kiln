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
}

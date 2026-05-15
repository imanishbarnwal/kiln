// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {KilnAgentNFT} from "../src/KilnAgentNFT.sol";
import {KilnAttestationOracle} from "../src/KilnAttestationOracle.sol";

contract KilnAgentNFTTest is Test {
    KilnAgentNFT internal nft;
    KilnAttestationOracle internal verifier;

    address internal alice = makeAddr("alice");
    address internal bob   = makeAddr("bob");
    address internal carol = makeAddr("carol");

    function setUp() public {
        verifier = new KilnAttestationOracle();
        verifier.setMockMode(true);
        nft = new KilnAgentNFT(
            "Kiln AgentNFT",
            "KILN",
            address(verifier),
            "https://chainscan-galileo.0g.ai",
            "https://indexer-storage-testnet-turbo.0g.ai"
        );
    }

    function _preimageProof(bytes32 dataHash) internal view returns (bytes memory) {
        return abi.encode(dataHash, uint256(0), block.timestamp + 60, hex"00");
    }

    function _mintTo(address to, bytes32 dataHash) internal returns (uint256) {
        bytes[] memory proofs = new bytes[](1);
        proofs[0] = _preimageProof(dataHash);
        string[] memory descs = new string[](1);
        descs[0] = "encrypted-model-blob";
        vm.prank(to);
        return nft.mint(proofs, descs, to);
    }

    function _transferProof(bytes32 oldHash, bytes32 newHash, address receiver, bytes16 sealedKey)
        internal
        view
        returns (bytes[] memory proofs)
    {
        proofs = new bytes[](1);
        proofs[0] = abi.encode(oldHash, newHash, receiver, sealedKey, uint256(0), block.timestamp + 60, hex"00");
    }

    function test_mint_assignsOwnerAndStoresHash() public {
        bytes32 h = keccak256("blob-1");
        uint256 tokenId = _mintTo(alice, h);

        assertEq(nft.ownerOf(tokenId), alice);
        bytes32[] memory hashes = nft.dataHashesOf(tokenId);
        assertEq(hashes.length, 1);
        assertEq(hashes[0], h);
        assertEq(nft.nextTokenId(), tokenId + 1);
    }

    function test_authorizeUsage_addsAuthorizedUser() public {
        bytes32 h = keccak256("blob-2");
        uint256 tokenId = _mintTo(alice, h);

        vm.prank(alice);
        nft.authorizeUsage(tokenId, carol);

        address[] memory users = nft.authorizedUsersOf(tokenId);
        assertEq(users.length, 1);
        assertEq(users[0], carol);
        assertTrue(nft.isAuthorized(tokenId, carol));
        assertFalse(nft.isAuthorized(tokenId, bob));
    }

    function test_authorizeUsage_revertsWhenNotOwner() public {
        bytes32 h = keccak256("blob-3");
        uint256 tokenId = _mintTo(alice, h);

        vm.prank(bob);
        vm.expectRevert(bytes("KilnAgentNFT: not owner"));
        nft.authorizeUsage(tokenId, carol);
    }

    function test_transfer_changesOwnerAndUpdatesHash() public {
        bytes32 oldHash = keccak256("blob-4-old");
        uint256 tokenId = _mintTo(alice, oldHash);

        bytes32 newHash = keccak256("blob-4-new");
        bytes16 sealed_ = bytes16(keccak256("sealed-key-for-bob"));
        bytes[] memory proofs = _transferProof(oldHash, newHash, bob, sealed_);

        vm.prank(alice);
        nft.transfer(bob, tokenId, proofs);

        assertEq(nft.ownerOf(tokenId), bob);
        bytes32[] memory hashes = nft.dataHashesOf(tokenId);
        assertEq(hashes[0], newHash);

        // Authorizations should reset on transfer.
        address[] memory users = nft.authorizedUsersOf(tokenId);
        assertEq(users.length, 0);
    }

    function test_transfer_revertsWhenReceiverMismatch() public {
        bytes32 oldHash = keccak256("blob-5-old");
        uint256 tokenId = _mintTo(alice, oldHash);

        bytes32 newHash = keccak256("blob-5-new");
        bytes16 sealed_ = bytes16(keccak256("sealed"));
        // Proof says receiver=carol but we try to transfer to bob.
        bytes[] memory proofs = _transferProof(oldHash, newHash, carol, sealed_);

        vm.prank(alice);
        vm.expectRevert(bytes("KilnAgentNFT: receiver mismatch"));
        nft.transfer(bob, tokenId, proofs);
    }

    function test_clone_createsSecondTokenForReceiver() public {
        bytes32 oldHash = keccak256("blob-6-old");
        uint256 originalId = _mintTo(alice, oldHash);

        bytes32 newHash = keccak256("blob-6-new");
        bytes16 sealed_ = bytes16(keccak256("sealed"));
        bytes[] memory proofs = _transferProof(oldHash, newHash, carol, sealed_);

        vm.prank(alice);
        uint256 cloneId = nft.clone(carol, originalId, proofs);

        assertEq(nft.ownerOf(originalId), alice, "original still owned by alice");
        assertEq(nft.ownerOf(cloneId), carol, "clone owned by carol");
        assertEq(nft.dataHashesOf(cloneId)[0], newHash);
    }

    function test_update_changesDataHashes() public {
        bytes32 oldHash = keccak256("blob-7-old");
        uint256 tokenId = _mintTo(alice, oldHash);

        bytes32 newHash = keccak256("blob-7-new");
        bytes[] memory proofs = new bytes[](1);
        proofs[0] = _preimageProof(newHash);

        vm.prank(alice);
        nft.update(tokenId, proofs);

        assertEq(nft.dataHashesOf(tokenId)[0], newHash);
    }

    function test_refine_changesBothHashesAndDescriptions() public {
        bytes32 oldHash = keccak256("blob-8-old");
        uint256 tokenId = _mintTo(alice, oldHash);
        // mint() seeded a "encrypted-model-blob" description; verify that's there
        assertEq(nft.dataDescriptionsOf(tokenId)[0], "encrypted-model-blob");

        bytes32 newHash = keccak256("blob-8-new");
        bytes[] memory proofs = new bytes[](1);
        proofs[0] = _preimageProof(newHash);
        string[] memory newDesc = new string[](1);
        newDesc[0] = "kiln:v1:{\"name\":\"GM Mira v2\"}";

        vm.prank(alice);
        nft.refine(tokenId, proofs, newDesc);

        assertEq(nft.dataHashesOf(tokenId)[0], newHash);
        assertEq(nft.dataDescriptionsOf(tokenId)[0], newDesc[0]);
    }

    function test_refine_revertsWhenNotOwner() public {
        bytes32 h = keccak256("blob-9");
        uint256 tokenId = _mintTo(alice, h);

        bytes[] memory proofs = new bytes[](1);
        proofs[0] = _preimageProof(h);
        string[] memory desc = new string[](1);
        desc[0] = "anything";

        vm.prank(bob);
        vm.expectRevert(bytes("KilnAgentNFT: not owner"));
        nft.refine(tokenId, proofs, desc);
    }

    function test_refine_revertsOnDescriptionLengthMismatch() public {
        bytes32 h = keccak256("blob-10");
        uint256 tokenId = _mintTo(alice, h);

        bytes[] memory proofs = new bytes[](1);
        proofs[0] = _preimageProof(h);
        string[] memory desc = new string[](2);
        desc[0] = "a";
        desc[1] = "b"; // length 2 vs proofs length 1

        vm.prank(alice);
        vm.expectRevert(bytes("KilnAgentNFT: descriptions length mismatch"));
        nft.refine(tokenId, proofs, desc);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {KilnAgentNFT} from "../src/KilnAgentNFT.sol";
import {KilnMockVerifier} from "../src/KilnMockVerifier.sol";
import {KilnMarket} from "../src/KilnMarket.sol";

contract KilnMarketTest is Test {
    KilnAgentNFT internal nft;
    KilnMockVerifier internal verifier;
    KilnMarket internal market;

    address internal coach    = makeAddr("coach");
    address internal student  = makeAddr("student");
    address internal academy  = makeAddr("academy");
    address internal treasury = makeAddr("treasury");
    address internal executor = makeAddr("executor");

    function setUp() public {
        verifier = new KilnMockVerifier();
        nft = new KilnAgentNFT(
            "Kiln",
            "KILN",
            address(verifier),
            "https://chainscan-galileo.0g.ai",
            "https://indexer-storage-testnet-turbo.0g.ai"
        );
        market = new KilnMarket(address(nft), treasury, executor);

        vm.deal(student, 10 ether);
        vm.deal(academy, 100 ether);
    }

    function _mintTo(address to, uint256 seed) internal returns (uint256) {
        bytes32 h = keccak256(abi.encode("blob", seed));
        bytes[] memory proofs = new bytes[](1);
        proofs[0] = abi.encodePacked(h);
        string[] memory descs = new string[](1);
        descs[0] = "encrypted-model-blob";
        vm.prank(to);
        return nft.mint(proofs, descs, to);
    }

    function _list(address owner, uint256 tokenId, uint256 perSession, uint256 perDay) internal {
        vm.prank(owner);
        market.list(tokenId, perSession, perDay, "kiln://meta");
    }

    /* ----------------------------- listing ----------------------------- */

    function test_list_emitsAndStores() public {
        uint256 tokenId = _mintTo(coach, 1);

        vm.expectEmit(true, true, false, true);
        emit KilnMarket.Listed(tokenId, coach, 0.001 ether, 0.01 ether);

        _list(coach, tokenId, 0.001 ether, 0.01 ether);

        (address owner_, uint256 perSession, uint256 perDay, , bool active) =
            market.listings(tokenId);
        assertEq(owner_, coach);
        assertEq(perSession, 0.001 ether);
        assertEq(perDay, 0.01 ether);
        assertTrue(active);
    }

    function test_list_revertsWhenNotOwner() public {
        uint256 tokenId = _mintTo(coach, 1);
        vm.prank(student);
        vm.expectRevert(bytes("KilnMarket: not iNFT owner"));
        market.list(tokenId, 0.001 ether, 0, "x");
    }

    /* ----------------------- per-session rent flow ---------------------- */

    function test_startSession_emitsAndEscrowsPayment() public {
        uint256 tokenId = _mintTo(coach, 2);
        _list(coach, tokenId, 0.001 ether, 0);

        vm.prank(student);
        uint256 sessionId = market.startSession{value: 0.001 ether}(tokenId);

        assertGt(sessionId, 0);
        (uint256 sTok, address sStu, uint256 sAmt, bool sSettled) = market.sessions(sessionId);
        assertEq(sTok, tokenId);
        assertEq(sStu, student);
        assertEq(sAmt, 0.001 ether);
        assertFalse(sSettled);

        // Funds escrowed in market until endSession.
        assertEq(address(market).balance, 0.001 ether);
    }

    function test_startSession_revertsOnBadPrice() public {
        uint256 tokenId = _mintTo(coach, 3);
        _list(coach, tokenId, 0.001 ether, 0);

        vm.prank(student);
        vm.expectRevert(bytes("KilnMarket: bad payment"));
        market.startSession{value: 0.0005 ether}(tokenId);
    }

    function test_endSession_settlesWith90_8_2_Split() public {
        uint256 tokenId = _mintTo(coach, 4);
        _list(coach, tokenId, 0.001 ether, 0);

        vm.prank(student);
        uint256 sessionId = market.startSession{value: 0.001 ether}(tokenId);

        uint256 coachBefore    = coach.balance;
        uint256 treasuryBefore = treasury.balance;

        vm.prank(executor);
        market.endSession(sessionId, 5);

        assertEq(coach.balance - coachBefore,       (0.001 ether * 90) / 100);
        assertEq(treasury.balance - treasuryBefore, (0.001 ether *  8) / 100);
        assertEq(market.ecosystemBalance(),         0.001 ether - ((0.001 ether * 90) / 100) - ((0.001 ether * 8) / 100));

        ( , , , bool settled) = market.sessions(sessionId);
        assertTrue(settled);
    }

    function test_endSession_revertsWhenNotExecutor() public {
        uint256 tokenId = _mintTo(coach, 5);
        _list(coach, tokenId, 0.001 ether, 0);

        vm.prank(student);
        uint256 sessionId = market.startSession{value: 0.001 ether}(tokenId);

        vm.prank(student);
        vm.expectRevert(bytes("KilnMarket: not executor"));
        market.endSession(sessionId, 5);
    }

    function test_endSession_revertsWhenAlreadySettled() public {
        uint256 tokenId = _mintTo(coach, 6);
        _list(coach, tokenId, 0.001 ether, 0);
        vm.prank(student);
        uint256 sessionId = market.startSession{value: 0.001 ether}(tokenId);
        vm.prank(executor);
        market.endSession(sessionId, 5);

        vm.prank(executor);
        vm.expectRevert(bytes("KilnMarket: already settled"));
        market.endSession(sessionId, 5);
    }

    /* --------------------------- bulk license --------------------------- */

    function test_startLicense_settlesImmediately() public {
        uint256 tokenId = _mintTo(coach, 7);
        _list(coach, tokenId, 0, 0.01 ether);

        uint256 days_ = 30;
        uint256 fee = 0.01 ether * days_;

        uint256 coachBefore    = coach.balance;
        uint256 treasuryBefore = treasury.balance;

        vm.prank(academy);
        uint256 licenseId = market.startLicense{value: fee}(tokenId, days_, 50);

        assertGt(licenseId, 0);
        (uint256 lTok, address lLicensee, uint256 lExpires, uint256 lSeats, bool lRevoked) =
            market.licenses(licenseId);
        assertEq(lTok, tokenId);
        assertEq(lLicensee, academy);
        assertEq(lExpires, block.timestamp + days_ * 1 days);
        assertEq(lSeats, 50);
        assertFalse(lRevoked);

        assertEq(coach.balance - coachBefore,       (fee * 90) / 100);
        assertEq(treasury.balance - treasuryBefore, (fee *  8) / 100);
    }

    function test_startLicense_revertsWhenNoLicensePrice() public {
        uint256 tokenId = _mintTo(coach, 8);
        _list(coach, tokenId, 0.001 ether, 0);
        vm.prank(academy);
        vm.expectRevert(bytes("KilnMarket: licensing not offered"));
        market.startLicense{value: 0}(tokenId, 30, 50);
    }

    function test_revokeLicense_byExecutor() public {
        uint256 tokenId = _mintTo(coach, 9);
        _list(coach, tokenId, 0, 0.01 ether);
        vm.prank(academy);
        uint256 licenseId = market.startLicense{value: 0.01 ether * 30}(tokenId, 30, 50);

        vm.prank(executor);
        market.revokeLicense(licenseId);

        ( , , , , bool revoked) = market.licenses(licenseId);
        assertTrue(revoked);
    }

    function test_revokeLicense_afterExpiryAnyoneCan() public {
        uint256 tokenId = _mintTo(coach, 10);
        _list(coach, tokenId, 0, 0.01 ether);
        vm.prank(academy);
        uint256 licenseId = market.startLicense{value: 0.01 ether * 30}(tokenId, 30, 50);

        vm.warp(block.timestamp + 31 days);
        vm.prank(student); // even an unrelated party can finalize after expiry
        market.revokeLicense(licenseId);

        ( , , , , bool revoked) = market.licenses(licenseId);
        assertTrue(revoked);
    }

    /* ----------------------------- admin ----------------------------- */

    function test_setExecutor_updatesAndEmits() public {
        address newExec = makeAddr("newExec");
        vm.expectEmit(true, true, false, false);
        emit KilnMarket.ExecutorChanged(executor, newExec);
        vm.prank(address(this)); // test contract is admin (deployer)
        market.setExecutor(newExec);
        assertEq(market.executor(), newExec);
    }

    function test_withdrawEcosystem_movesFunds() public {
        // build up ecosystem balance via a session
        uint256 tokenId = _mintTo(coach, 11);
        _list(coach, tokenId, 0.001 ether, 0);
        vm.prank(student);
        uint256 sessionId = market.startSession{value: 0.001 ether}(tokenId);
        vm.prank(executor);
        market.endSession(sessionId, 5);

        uint256 eco = market.ecosystemBalance();
        assertGt(eco, 0);

        address recipient = makeAddr("ecosystem");
        market.withdrawEcosystem(recipient, eco);

        assertEq(recipient.balance, eco);
        assertEq(market.ecosystemBalance(), 0);
    }
}

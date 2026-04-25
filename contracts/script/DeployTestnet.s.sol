// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {KilnAgentNFT} from "../src/KilnAgentNFT.sol";
import {KilnMockVerifier} from "../src/KilnMockVerifier.sol";
import {KilnMarket} from "../src/KilnMarket.sol";

/// @notice Deploys the full Kiln stack to 0G Galileo testnet.
///
/// Required env vars:
///   DEPLOYER_PK - private key of the funded ops wallet
///   TREASURY    - address that receives the 8% Kiln fee
///   EXECUTOR    - address authorized to call endSession (typically same as deployer)
///
/// Usage:
///   source contracts/.env && \
///     forge script script/DeployTestnet.s.sol --rpc-url galileo --broadcast -vv
contract DeployTestnet is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        address treasury = vm.envAddress("TREASURY");
        address executor = vm.envAddress("EXECUTOR");

        vm.startBroadcast(pk);

        KilnMockVerifier verifier = new KilnMockVerifier();
        console2.log("KilnMockVerifier:", address(verifier));

        KilnAgentNFT nft = new KilnAgentNFT(
            "Kiln AgentNFT",
            "KILN",
            address(verifier),
            "https://chainscan-galileo.0g.ai",
            "https://indexer-storage-testnet-turbo.0g.ai"
        );
        console2.log("KilnAgentNFT    :", address(nft));

        KilnMarket market = new KilnMarket(address(nft), treasury, executor);
        console2.log("KilnMarket      :", address(market));

        vm.stopBroadcast();
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {KilnAttestationOracle} from "../src/KilnAttestationOracle.sol";
import {KilnAgentNFT} from "../src/KilnAgentNFT.sol";
import {KilnMarket} from "../src/KilnMarket.sol";

/// Orchestrator: deploys Oracle -> AgentNFT -> Market on Aristotle (16661).
/// Registers OPS_SIGNER_ADDRESS as the initial trusted signer with
/// mockMode = false (default).
///
/// Run:
///   forge script script/DeployMainnet.s.sol \
///     --rpc-url aristotle --broadcast --verify
///
/// Expected env:
///   DEPLOYER_PK         private key of the deployer wallet (must hold OG)
///   OPS_SIGNER_ADDRESS  address registered as the initial trusted signer
///   TREASURY            address that receives the 8% Kiln fee
///   EXECUTOR            address authorized to call endSession (typically ops signer)
contract DeployMainnet is Script {
    function run() external returns (address oracle, address nft, address market) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PK");
        address opsSigner = vm.envAddress("OPS_SIGNER_ADDRESS");
        address treasury  = vm.envAddress("TREASURY");
        address executor  = vm.envAddress("EXECUTOR");
        require(opsSigner != address(0), "DeployMainnet: zero ops signer");
        require(treasury  != address(0), "DeployMainnet: zero treasury");
        require(executor  != address(0), "DeployMainnet: zero executor");

        vm.startBroadcast(deployerKey);

        KilnAttestationOracle o = new KilnAttestationOracle();
        o.addTrustedSigner(opsSigner);
        // mockMode is false by default - explicit set documents intent:
        o.setMockMode(false);

        KilnAgentNFT n = new KilnAgentNFT(
            "Kiln Agent",
            "KILN",
            address(o),
            "https://chainscan.0g.ai",
            "https://aiverse.0g.ai"
        );

        KilnMarket m = new KilnMarket(address(n), treasury, executor);

        vm.stopBroadcast();

        console2.log("Oracle:",   address(o));
        console2.log("AgentNFT:", address(n));
        console2.log("Market:",   address(m));

        console2.log("");
        console2.log("====================================================================");
        console2.log("DEPLOY COMPLETE. NEXT STEP (manual):");
        console2.log("After verifying the contracts work, run from the admin wallet:");
        console2.log("  cast send <ORACLE_ADDRESS> 'lockMainnetMode()' --rpc-url aristotle");
        console2.log("This permanently disables mockMode. See docs/MAINNET.md.");
        console2.log("====================================================================");

        return (address(o), address(n), address(m));
    }
}

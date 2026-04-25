// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {KilnSubnameRegistrar} from "../src/KilnSubnameRegistrar.sol";

/// @notice Deploys KilnSubnameRegistrar to Sepolia ENS.
///
/// Required env vars:
///   DEPLOYER_PK   - private key of funded Sepolia ops wallet
///   PARENT_NODE   - namehash of the parent .eth (bytes32 hex)
///                   e.g. namehash("kiln.eth")
///   KILN_CHAIN_ID - chain id where the iNFT lives (16602 for Galileo)
///
/// Constants pinned to Sepolia ENS:
///   ENS Registry    : 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e
///   PublicResolver  : 0x8FADE66B79cC9f707aB26799354482EB93a5B7dD
///
/// Post-deploy ritual (do this from the wallet that owns the parent name):
///   cast send <ens-registry> \
///     "setOwner(bytes32,address)" $PARENT_NODE <registrar-address> \
///     --rpc-url sepolia --private-key $DEPLOYER_PK
///
/// Usage:
///   source contracts/.env && \
///     forge script script/DeploySubnameRegistrar.s.sol \
///       --rpc-url sepolia --broadcast -vv
contract DeploySubnameRegistrar is Script {
    address constant ENS_REGISTRY    = 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e;
    address constant PUBLIC_RESOLVER = 0x8FADE66B79cC9f707aB26799354482EB93a5B7dD;

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        bytes32 parentNode = vm.envBytes32("PARENT_NODE");
        uint256 kilnChainId = vm.envUint("KILN_CHAIN_ID");

        vm.startBroadcast(pk);

        KilnSubnameRegistrar registrar = new KilnSubnameRegistrar(
            ENS_REGISTRY,
            PUBLIC_RESOLVER,
            parentNode,
            kilnChainId
        );
        console2.log("KilnSubnameRegistrar:", address(registrar));
        console2.log("Parent node bytes32 :");
        console2.logBytes32(parentNode);
        console2.log("Kiln chain id       :", kilnChainId);

        vm.stopBroadcast();
    }
}

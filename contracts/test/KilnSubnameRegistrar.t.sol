// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {KilnSubnameRegistrar} from "../src/KilnSubnameRegistrar.sol";

/// @dev Minimal stand-in for ENS Registry. Tracks owner + resolver per node
///      and enforces "only current owner may mutate" the way the real registry
///      does, so we exercise the registrar's permission flow.
contract MockENSRegistry {
    mapping(bytes32 => address) public ownerOf;
    mapping(bytes32 => address) public resolverOf;

    error NotOwner();

    function setSubnodeRecord(
        bytes32 node,
        bytes32 label,
        address newOwner,
        address newResolver,
        uint64 /*ttl*/
    ) external {
        if (ownerOf[node] != msg.sender) revert NotOwner();
        bytes32 sub = keccak256(abi.encodePacked(node, label));
        ownerOf[sub] = newOwner;
        resolverOf[sub] = newResolver;
    }

    function setSubnodeOwner(
        bytes32 node,
        bytes32 label,
        address newOwner
    ) external returns (bytes32) {
        if (ownerOf[node] != msg.sender) revert NotOwner();
        bytes32 sub = keccak256(abi.encodePacked(node, label));
        ownerOf[sub] = newOwner;
        return sub;
    }

    function owner(bytes32 node) external view returns (address) {
        return ownerOf[node];
    }

    function resolver(bytes32 node) external view returns (address) {
        return resolverOf[node];
    }

    /// test helper · seed initial ownership of a node (e.g., the parent)
    function seed(bytes32 node, address newOwner) external {
        ownerOf[node] = newOwner;
    }
}

/// @dev Minimal stand-in for ENS PublicResolver. Honors the registry's owner
///      check before accepting writes, just like the real one.
contract MockPublicResolver {
    MockENSRegistry public immutable ens;

    mapping(bytes32 => address) public addrOf;
    mapping(bytes32 => mapping(string => string)) private _text;

    error NotAuthorised();

    constructor(address _ens) {
        ens = MockENSRegistry(_ens);
    }

    modifier authorised(bytes32 node) {
        if (ens.owner(node) != msg.sender) revert NotAuthorised();
        _;
    }

    function setAddr(bytes32 node, address a) external authorised(node) {
        addrOf[node] = a;
    }

    function setText(bytes32 node, string calldata key, string calldata value)
        external
        authorised(node)
    {
        _text[node][key] = value;
    }

    function addr(bytes32 node) external view returns (address payable) {
        return payable(addrOf[node]);
    }

    function text(bytes32 node, string calldata key) external view returns (string memory) {
        return _text[node][key];
    }
}

contract KilnSubnameRegistrarTest is Test {
    MockENSRegistry internal ens;
    MockPublicResolver internal resolver;
    KilnSubnameRegistrar internal registrar;

    bytes32 internal constant PARENT_NODE = keccak256("parent-node-namehash");
    uint256 internal constant KILN_CHAIN = 16602;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        ens = new MockENSRegistry();
        resolver = new MockPublicResolver(address(ens));
        registrar = new KilnSubnameRegistrar(
            address(ens),
            address(resolver),
            PARENT_NODE,
            KILN_CHAIN
        );
        // hand parent ownership to the registrar, mirroring the deploy ritual
        ens.seed(PARENT_NODE, address(registrar));
    }

    function _expectedSubnode(string memory label) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(PARENT_NODE, keccak256(bytes(label))));
    }

    function test_register_writesRecordsAndTransfersOwnership() public {
        vm.prank(alice);
        bytes32 sub = registrar.register(
            "mira",
            42,
            alice,
            "GM coach for blitz openings.",
            "https://kiln.app/chat/42"
        );

        assertEq(sub, _expectedSubnode("mira"));
        // final owner is the requested subOwner
        assertEq(ens.owner(sub), alice, "subnode owner should be alice");
        // resolver wired
        assertEq(ens.resolver(sub), address(resolver));
        // addr record
        assertEq(resolver.addr(sub), payable(alice));
        // text records
        assertEq(resolver.text(sub, "kiln.tokenId"), "42");
        assertEq(resolver.text(sub, "kiln.chain"), "16602");
        assertEq(resolver.text(sub, "description"), "GM coach for blitz openings.");
        assertEq(resolver.text(sub, "url"), "https://kiln.app/chat/42");

        // bookkeeping
        assertEq(registrar.tokenSubnode(42), sub);
        assertEq(registrar.subnodeToken(sub), 42);
        assertEq(registrar.subnodeLabel(sub), "mira");
        assertTrue(registrar.labelClaimed(keccak256(bytes("mira"))));
    }

    function test_register_skipsEmptyOptionalRecords() public {
        vm.prank(alice);
        bytes32 sub = registrar.register("solo", 1, alice, "", "");
        assertEq(resolver.text(sub, "description"), "");
        assertEq(resolver.text(sub, "url"), "");
        // mandatory records still set
        assertEq(resolver.text(sub, "kiln.tokenId"), "1");
        assertEq(resolver.text(sub, "kiln.chain"), "16602");
    }

    function test_register_revertsOnLabelTaken() public {
        vm.prank(alice);
        registrar.register("mira", 1, alice, "", "");

        vm.prank(bob);
        vm.expectRevert(KilnSubnameRegistrar.LabelTaken.selector);
        registrar.register("mira", 2, bob, "", "");
    }

    function test_register_revertsOnTokenAlreadyClaimed() public {
        vm.prank(alice);
        registrar.register("mira", 7, alice, "", "");

        vm.prank(alice);
        vm.expectRevert(KilnSubnameRegistrar.TokenAlreadyClaimed.selector);
        registrar.register("mira-two", 7, alice, "", "");
    }

    function test_register_handsResolverWriteRightsToOwner() public {
        vm.prank(alice);
        bytes32 sub = registrar.register("mira", 1, alice, "first", "first-url");

        // After register, alice owns the subnode and can call the resolver
        // directly to update text records · this is the documented update path.
        vm.prank(alice);
        resolver.setText(sub, "description", "second");
        assertEq(resolver.text(sub, "description"), "second");

        // Non-owners cannot.
        vm.prank(bob);
        vm.expectRevert(MockPublicResolver.NotAuthorised.selector);
        resolver.setText(sub, "description", "hostile");
    }

    function test_transferAdmin_onlyAdmin() public {
        vm.prank(bob);
        vm.expectRevert(KilnSubnameRegistrar.NotAdmin.selector);
        registrar.transferAdmin(bob);

        // deployer (this test contract) is admin
        registrar.transferAdmin(alice);
        assertEq(registrar.admin(), alice);
    }
}

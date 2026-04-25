// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title KilnSubnameRegistrar
/// @notice Permissionless registrar for `<label>.<parent>` subnames on ENS.
///         Maps each subname to a Kiln iNFT tokenId + chain id via standard
///         ENS PublicResolver text records, so any ENS-aware client can
///         resolve a coach's name and learn their on-chain identity.
///
/// Deployment context:
///         - Sepolia ENS Registry:   0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e
///         - Sepolia PublicResolver: 0x8FADE66B79cC9f707aB26799354482EB93a5B7dD
///         - Parent node:            namehash of the .eth name we own
///                                   (e.g., namehash("kiln.eth"))
///
/// Setup ritual after deploy:
///         1. Owner of parent name calls
///            ens.setSubnodeRecord(rootNode, keccak("eth"), parentOwner, …)
///            already done at parent registration.
///         2. Owner of parent name calls
///            ens.setOwner(parentNode, address(this))
///            so this contract can mint subnames.
///         3. From here, anyone can call register() to claim an unused
///            label and get the subnode transferred to their wallet.

interface IENSRegistry {
    function setSubnodeRecord(
        bytes32 node,
        bytes32 label,
        address owner,
        address resolver,
        uint64 ttl
    ) external;

    function setSubnodeOwner(
        bytes32 node,
        bytes32 label,
        address owner
    ) external returns (bytes32);

    function owner(bytes32 node) external view returns (address);
    function resolver(bytes32 node) external view returns (address);
}

interface IPublicResolver {
    function setAddr(bytes32 node, address a) external;
    function setText(bytes32 node, string calldata key, string calldata value) external;
    function addr(bytes32 node) external view returns (address payable);
    function text(bytes32 node, string calldata key) external view returns (string memory);
}

contract KilnSubnameRegistrar {
    IENSRegistry public immutable ens;
    IPublicResolver public immutable resolver;

    /// namehash of the parent .eth domain (e.g., namehash("kiln.eth"))
    bytes32 public immutable parentNode;

    /// chain id where the iNFT lives. For Galileo testnet, 16602.
    uint256 public immutable kilnChainId;

    address public admin;

    /// tokenId → subnode hash (so we can do reverse lookups)
    mapping(uint256 => bytes32) public tokenSubnode;
    /// subnode hash → tokenId
    mapping(bytes32 => uint256) public subnodeToken;
    /// subnode hash → label string (kept on-chain for easy listing)
    mapping(bytes32 => string) public subnodeLabel;
    /// labelHash → registered, prevents double-claim
    mapping(bytes32 => bool) public labelClaimed;

    event SubnameRegistered(
        uint256 indexed tokenId,
        bytes32 indexed subnode,
        string label,
        address indexed registrant
    );

    error LabelTaken();
    error TokenAlreadyClaimed();
    error NotAdmin();

    constructor(
        address _ens,
        address _resolver,
        bytes32 _parentNode,
        uint256 _kilnChainId
    ) {
        require(_ens != address(0), "ens=0");
        require(_resolver != address(0), "resolver=0");
        ens = IENSRegistry(_ens);
        resolver = IPublicResolver(_resolver);
        parentNode = _parentNode;
        kilnChainId = _kilnChainId;
        admin = msg.sender;
    }

    /// @notice Claim a `<label>.<parent>` subname for a Kiln iNFT.
    /// @param label       short string, e.g. "mira"
    /// @param tokenId     the Kiln iNFT this subname represents
    /// @param subOwner    final on-chain owner of the subname
    /// @param description short blurb stored as ENS `description` text record
    /// @param urlValue    canonical Kiln URL (e.g., kiln.app/chat/5)
    function register(
        string calldata label,
        uint256 tokenId,
        address subOwner,
        string calldata description,
        string calldata urlValue
    ) external returns (bytes32 subnode) {
        bytes32 labelHash = keccak256(bytes(label));
        if (labelClaimed[labelHash]) revert LabelTaken();
        if (tokenSubnode[tokenId] != bytes32(0)) revert TokenAlreadyClaimed();

        // Compute the subnode (namehash of label.parent).
        subnode = keccak256(abi.encodePacked(parentNode, labelHash));

        // Step 1: take ownership of the subnode and point it at our resolver.
        // We need to be the owner so we can write text records.
        ens.setSubnodeRecord(parentNode, labelHash, address(this), address(resolver), 0);

        // Step 2: write the records.
        resolver.setAddr(subnode, subOwner);
        resolver.setText(subnode, "kiln.tokenId", _uint2str(tokenId));
        resolver.setText(subnode, "kiln.chain", _uint2str(kilnChainId));
        if (bytes(description).length > 0) {
            resolver.setText(subnode, "description", description);
        }
        if (bytes(urlValue).length > 0) {
            resolver.setText(subnode, "url", urlValue);
        }

        // Step 3: transfer subnode ownership to the requested owner so they
        // can update their own records or transfer the subname later.
        ens.setSubnodeOwner(parentNode, labelHash, subOwner);

        labelClaimed[labelHash] = true;
        tokenSubnode[tokenId] = subnode;
        subnodeToken[subnode] = tokenId;
        subnodeLabel[subnode] = label;

        emit SubnameRegistered(tokenId, subnode, label, msg.sender);
    }

    /// @notice Owners update their own description/url by calling the
    ///         PublicResolver directly with `setText`. The registrar
    ///         intentionally does not wrap that, since it no longer holds
    ///         resolver-write authority once ownership is transferred.

    function transferAdmin(address newAdmin) external {
        if (msg.sender != admin) revert NotAdmin();
        require(newAdmin != address(0), "admin=0");
        admin = newAdmin;
    }

    /// @dev If the parent owner has not yet handed over registrar rights
    ///      this contract still needs a way to relinquish back. Keeps the
    ///      operation reversible without redeploying.
    function relinquishParent(address newOwner) external {
        if (msg.sender != admin) revert NotAdmin();
        ens.setSubnodeOwner(parentNode, bytes32(0), newOwner);
    }

    /* ------------------------- internal helpers ------------------------- */

    function _uint2str(uint256 v) private pure returns (string memory) {
        if (v == 0) return "0";
        uint256 t = v;
        uint256 digits;
        while (t != 0) { t /= 10; digits++; }
        bytes memory buf = new bytes(digits);
        while (v != 0) {
            digits--;
            buf[digits] = bytes1(uint8(48 + (v % 10)));
            v /= 10;
        }
        return string(buf);
    }
}

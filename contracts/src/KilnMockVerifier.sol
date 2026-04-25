// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {
    IERC7857DataVerifier,
    PreimageProofOutput,
    TransferValidityProofOutput
} from "0g-agent-nft/interfaces/IERC7857DataVerifier.sol";

/// @title KilnMockVerifier
/// @notice Hackathon stand-in for 0G's TeeML verifier.
///         Always returns isValid = true and trusts the supplied proof bytes.
///         Production deployments must replace this with the real TeeML verifier.
///
/// Proof formats expected by this mock:
///
///   verifyPreimage:
///     Each proof is exactly 32 bytes. Treated as the dataHash.
///
///   verifyTransferValidity:
///     Each proof is abi.encode(bytes32 oldDataHash,
///                              bytes32 newDataHash,
///                              address receiver,
///                              bytes16 sealedKey)
contract KilnMockVerifier is IERC7857DataVerifier {
    function verifyPreimage(bytes[] calldata proofs)
        external
        pure
        override
        returns (PreimageProofOutput[] memory)
    {
        PreimageProofOutput[] memory outputs = new PreimageProofOutput[](proofs.length);
        for (uint256 i = 0; i < proofs.length; i++) {
            require(proofs[i].length == 32, "KilnMockVerifier: bad preimage proof length");
            outputs[i] = PreimageProofOutput({
                dataHash: bytes32(proofs[i]),
                isValid: true
            });
        }
        return outputs;
    }

    function verifyTransferValidity(bytes[] calldata proofs)
        external
        pure
        override
        returns (TransferValidityProofOutput[] memory)
    {
        TransferValidityProofOutput[] memory outputs = new TransferValidityProofOutput[](proofs.length);
        for (uint256 i = 0; i < proofs.length; i++) {
            (bytes32 oldHash, bytes32 newHash, address receiver, bytes16 sealedKey) =
                abi.decode(proofs[i], (bytes32, bytes32, address, bytes16));
            outputs[i] = TransferValidityProofOutput({
                oldDataHash: oldHash,
                newDataHash: newHash,
                receiver: receiver,
                sealedKey: sealedKey,
                isValid: true
            });
        }
        return outputs;
    }
}

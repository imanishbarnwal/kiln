// Auto-generated from contracts/out/. Re-run scripts/sync-abis.sh after contract changes.
export const ABIS = {
  "KilnAgentNFT": [
    {
      "type": "constructor",
      "inputs": [
        {
          "name": "name_",
          "type": "string",
          "internalType": "string"
        },
        {
          "name": "symbol_",
          "type": "string",
          "internalType": "string"
        },
        {
          "name": "verifier_",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "chainURL_",
          "type": "string",
          "internalType": "string"
        },
        {
          "name": "indexerURL_",
          "type": "string",
          "internalType": "string"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "VERSION",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "string",
          "internalType": "string"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "admin",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "approve",
      "inputs": [
        {
          "name": "to",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "tokenId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "authorizeUsage",
      "inputs": [
        {
          "name": "tokenId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "to",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "authorizedUsersOf",
      "inputs": [
        {
          "name": "tokenId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "address[]",
          "internalType": "address[]"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "chainURL",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "string",
          "internalType": "string"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "clone",
      "inputs": [
        {
          "name": "to",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "tokenId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "proofs",
          "type": "bytes[]",
          "internalType": "bytes[]"
        }
      ],
      "outputs": [
        {
          "name": "newTokenId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "dataDescriptionsOf",
      "inputs": [
        {
          "name": "tokenId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "string[]",
          "internalType": "string[]"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "dataHashesOf",
      "inputs": [
        {
          "name": "tokenId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bytes32[]",
          "internalType": "bytes32[]"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getApproved",
      "inputs": [
        {
          "name": "tokenId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "indexerURL",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "string",
          "internalType": "string"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "isApprovedForAll",
      "inputs": [
        {
          "name": "owner_",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "operator",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "isAuthorized",
      "inputs": [
        {
          "name": "tokenId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "user",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "mint",
      "inputs": [
        {
          "name": "proofs",
          "type": "bytes[]",
          "internalType": "bytes[]"
        },
        {
          "name": "dataDescriptions",
          "type": "string[]",
          "internalType": "string[]"
        },
        {
          "name": "to",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "tokenId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "payable"
    },
    {
      "type": "function",
      "name": "name",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "string",
          "internalType": "string"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "nextTokenId",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "ownerOf",
      "inputs": [
        {
          "name": "tokenId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "refine",
      "inputs": [
        {
          "name": "tokenId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "proofs",
          "type": "bytes[]",
          "internalType": "bytes[]"
        },
        {
          "name": "dataDescriptions",
          "type": "string[]",
          "internalType": "string[]"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "setApprovalForAll",
      "inputs": [
        {
          "name": "operator",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "approved",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "setURLs",
      "inputs": [
        {
          "name": "newChainURL",
          "type": "string",
          "internalType": "string"
        },
        {
          "name": "newIndexerURL",
          "type": "string",
          "internalType": "string"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "setVerifier",
      "inputs": [
        {
          "name": "newVerifier",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "symbol",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "string",
          "internalType": "string"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "tokenURI",
      "inputs": [
        {
          "name": "tokenId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "string",
          "internalType": "string"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "transfer",
      "inputs": [
        {
          "name": "to",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "tokenId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "proofs",
          "type": "bytes[]",
          "internalType": "bytes[]"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "transferAdmin",
      "inputs": [
        {
          "name": "newAdmin",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "update",
      "inputs": [
        {
          "name": "tokenId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "proofs",
          "type": "bytes[]",
          "internalType": "bytes[]"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "verifier",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "contract IERC7857DataVerifier"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "event",
      "name": "Approval",
      "inputs": [
        {
          "name": "_from",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "_to",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "_tokenId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "ApprovalForAll",
      "inputs": [
        {
          "name": "_owner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "_operator",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "_approved",
          "type": "bool",
          "indexed": false,
          "internalType": "bool"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "Authorization",
      "inputs": [
        {
          "name": "_from",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "_to",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "_tokenId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "Cloned",
      "inputs": [
        {
          "name": "_tokenId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "_newTokenId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "_from",
          "type": "address",
          "indexed": false,
          "internalType": "address"
        },
        {
          "name": "_to",
          "type": "address",
          "indexed": false,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "Minted",
      "inputs": [
        {
          "name": "_tokenId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "_creator",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "_owner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "_dataHashes",
          "type": "bytes32[]",
          "indexed": false,
          "internalType": "bytes32[]"
        },
        {
          "name": "_dataDescriptions",
          "type": "string[]",
          "indexed": false,
          "internalType": "string[]"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "PublishedSealedKey",
      "inputs": [
        {
          "name": "_to",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "_tokenId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "_sealedKeys",
          "type": "bytes16[]",
          "indexed": false,
          "internalType": "bytes16[]"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "Transferred",
      "inputs": [
        {
          "name": "_tokenId",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "_from",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "_to",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "Updated",
      "inputs": [
        {
          "name": "_tokenId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "_oldDataHashes",
          "type": "bytes32[]",
          "indexed": false,
          "internalType": "bytes32[]"
        },
        {
          "name": "_newDataHashes",
          "type": "bytes32[]",
          "indexed": false,
          "internalType": "bytes32[]"
        }
      ],
      "anonymous": false
    }
  ],
  "KilnMarket": [
    {
      "type": "constructor",
      "inputs": [
        {
          "name": "nft_",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "treasury_",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "executor_",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "receive",
      "stateMutability": "payable"
    },
    {
      "type": "function",
      "name": "admin",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "delist",
      "inputs": [
        {
          "name": "tokenId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "ecosystemBalance",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "endSession",
      "inputs": [
        {
          "name": "sessionId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "rating",
          "type": "uint8",
          "internalType": "uint8"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "executor",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "licenses",
      "inputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "tokenId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "licensee",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "expiresAt",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "seats",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "revoked",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "list",
      "inputs": [
        {
          "name": "tokenId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "pricePerSession",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "licensePricePerDay",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "metadataURI",
          "type": "string",
          "internalType": "string"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "listings",
      "inputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "owner",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "pricePerSession",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "licensePricePerDay",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "metadataURI",
          "type": "string",
          "internalType": "string"
        },
        {
          "name": "active",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "nextLicenseId",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "nextSessionId",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "nft",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "contract KilnAgentNFT"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "revokeLicense",
      "inputs": [
        {
          "name": "licenseId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "sessions",
      "inputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "tokenId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "student",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "settled",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "setExecutor",
      "inputs": [
        {
          "name": "newExecutor",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "startLicense",
      "inputs": [
        {
          "name": "tokenId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "durationDays",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "seats",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "licenseId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "payable"
    },
    {
      "type": "function",
      "name": "startSession",
      "inputs": [
        {
          "name": "tokenId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "sessionId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "payable"
    },
    {
      "type": "function",
      "name": "transferAdmin",
      "inputs": [
        {
          "name": "newAdmin",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "treasury",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "withdrawEcosystem",
      "inputs": [
        {
          "name": "to",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "event",
      "name": "Delisted",
      "inputs": [
        {
          "name": "tokenId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "EcosystemFundsWithdrawn",
      "inputs": [
        {
          "name": "to",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "ExecutorChanged",
      "inputs": [
        {
          "name": "oldExecutor",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "newExecutor",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "LicenseRevoked",
      "inputs": [
        {
          "name": "licenseId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "LicenseStarted",
      "inputs": [
        {
          "name": "licenseId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "tokenId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "licensee",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "expiresAt",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "seats",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "Listed",
      "inputs": [
        {
          "name": "tokenId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "owner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "pricePerSession",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "licensePricePerDay",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "SessionEnded",
      "inputs": [
        {
          "name": "sessionId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "ownerPayout",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "rating",
          "type": "uint8",
          "indexed": false,
          "internalType": "uint8"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "SessionStarted",
      "inputs": [
        {
          "name": "sessionId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "tokenId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "student",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    }
  ],
  "KilnMockVerifier": [
    {
      "type": "function",
      "name": "verifyPreimage",
      "inputs": [
        {
          "name": "proofs",
          "type": "bytes[]",
          "internalType": "bytes[]"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "tuple[]",
          "internalType": "struct PreimageProofOutput[]",
          "components": [
            {
              "name": "dataHash",
              "type": "bytes32",
              "internalType": "bytes32"
            },
            {
              "name": "isValid",
              "type": "bool",
              "internalType": "bool"
            }
          ]
        }
      ],
      "stateMutability": "pure"
    },
    {
      "type": "function",
      "name": "verifyTransferValidity",
      "inputs": [
        {
          "name": "proofs",
          "type": "bytes[]",
          "internalType": "bytes[]"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "tuple[]",
          "internalType": "struct TransferValidityProofOutput[]",
          "components": [
            {
              "name": "oldDataHash",
              "type": "bytes32",
              "internalType": "bytes32"
            },
            {
              "name": "newDataHash",
              "type": "bytes32",
              "internalType": "bytes32"
            },
            {
              "name": "receiver",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "sealedKey",
              "type": "bytes16",
              "internalType": "bytes16"
            },
            {
              "name": "isValid",
              "type": "bool",
              "internalType": "bool"
            }
          ]
        }
      ],
      "stateMutability": "pure"
    }
  ]
} as const;
export default ABIS;

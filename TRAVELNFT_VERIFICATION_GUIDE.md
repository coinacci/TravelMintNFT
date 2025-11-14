# TravelNFT Contract Verification Guide

## Contract Information
- **Contract Address:** `0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f`
- **Network:** Base Mainnet (Chain ID: 8453)
- **Deployer:** `0x7CDe7822456AAC667Df0420cD048295b92704084`
- **Deployment TX:** `0x7c127dc13b46e0eddc30cddf5fdc8d35a1272b5de75c91c4c0da37f292884f5c`

## Verification Steps on BaseScan

### Step 1: Go to Contract Verification Page
Visit: https://basescan.org/verifyContract-solc?a=0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f

### Step 2: Select Verification Method
- Select: **"Via Standard JSON Input"** (RECOMMENDED)
- OR: **"Via flattened source code"**

---

## Method 1: Standard JSON Input (RECOMMENDED)

### Compiler Settings:
1. **Compiler Version:** `v0.8.20+commit.a1b79de6`
2. **License Type:** `MIT`

### Standard Input JSON:
Create a file called `standard-input.json` with the following content:

```json
{
  "language": "Solidity",
  "sources": {
    "contracts/TravelNFT.sol": {
      "content": "[PASTE FULL TRAVELNFT.SOL SOURCE CODE HERE]"
    }
  },
  "settings": {
    "optimizer": {
      "enabled": true,
      "runs": 200
    },
    "outputSelection": {
      "*": {
        "*": ["*"]
      }
    }
  }
}
```

### Constructor Arguments (ABI-encoded):
```
0000000000000000000000007cde7822456aac667df0420cd048295b92704084
```

**Decoded Constructor Arguments:**
- `initialOwner`: `0x7CDe7822456AAC667Df0420cD048295b92704084`

---

## Method 2: Via Flattened Source Code

### Compiler Configuration:
- **Compiler Type:** Solidity (Single file)
- **Compiler Version:** `v0.8.20+commit.a1b79de6`
- **License Type:** MIT

### Optimization:
- **Optimization:** Yes
- **Runs:** 200

### Constructor Arguments (ABI-encoded):
```
0000000000000000000000007cde7822456aac667df0420cd048295b92704084
```

### Flattened Source Code:
✅ **READY TO USE:** The flattened contract is saved in `TravelNFT-flattened.sol` (2,773 lines)

**How to use:**
1. Open the file `TravelNFT-flattened.sol` in this repository
2. Copy ALL the content (Ctrl+A, Ctrl+C)
3. Paste it into the "Enter the Solidity Contract Code below" field on BaseScan

The file includes:
- Single SPDX-License-Identifier at the top
- Single pragma statement (^0.8.20)
- All OpenZeppelin contracts (IERC165, ERC165, IERC721, ERC721, ERC721URIStorage, IERC20, Ownable, ReentrancyGuard)
- TravelNFT contract at the end
- NO import statements (all dependencies are inlined)

---

## Alternative: Use Hardhat Verify (If Environment Supports)

If you have a working Hardhat environment, run:

```bash
npx hardhat verify --network base \
  0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f \
  "0x7CDe7822456AAC667Df0420cD048295b92704084"
```

---

## Verification Checklist

✅ Contract address is correct  
✅ Compiler version is `0.8.20`  
✅ Optimization enabled with 200 runs  
✅ Constructor arguments encoded correctly  
✅ License type is MIT  
✅ All source code included (no missing imports)  

---

## Troubleshooting

### Error: "Bytecode mismatch"
- Double-check compiler version (must be exactly `0.8.20`)
- Verify optimization is enabled with 200 runs
- Ensure constructor arguments are correct
- Make sure flattened code includes ALL dependencies

### Error: "Constructor arguments invalid"
- Use the ABI-encoded value: `0000000000000000000000007cde7822456aac667df0420cd048295b92704084`
- Do NOT include the `0x` prefix for constructor arguments

### Need Help?
The contract uses:
- Solidity `^0.8.20`
- OpenZeppelin Contracts v5.x
- Constructor parameter: `address initialOwner`

---

## Quick Verification (Copy-Paste Ready)

**Compiler:** `v0.8.20+commit.a1b79de6`  
**Optimization:** Enabled (200 runs)  
**License:** MIT  
**Constructor Arguments:**
```
0000000000000000000000007cde7822456aac667df0420cd048295b92704084
```

After verification, the contract will be publicly viewable with verified source code at:
https://basescan.org/address/0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f#code

# TypeScript Testing Setup Guide for Solana Programs

This guide provides a complete setup for TypeScript testing with Codama client generation, CLI tooling, and Surfpool integration for Solana programs.

## Overview

This testing setup includes:
- **Codama**: IDL-based TypeScript client generation
- **Gill**: Modern Solana TypeScript SDK
- **Surfpool**: Local Solana validator for testing
- **Automated Testing Pipeline**: Build, generate, test, and cleanup

## Project Structure

```
├── package.json              # Dependencies and scripts
├── codama.js                 # Codama configuration
├── run_tests.sh             # Automated test runner (macOS)
├── e2e/
│   └── e2e.ts              # End-to-end tests
├── clients/
│   └── js/
│       └── src/
│           └── generated/   # Auto-generated TypeScript client
├── idl/
│   └── your_program.json   # Generated IDL file
└── src/                    # Rust program source
```

## Setup Instructions

### 1. Package.json Configuration

```json
{
  "name": "your-program-name",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "bash ./run_tests.sh"
  },
  "dependencies": {
    "@codama/cli": "^1.2.0",
    "@codama/nodes-from-anchor": "^1.2.2",
    "@codama/renderers": "^1.0.26",
    "@codama/renderers-js": "^1.3.1",
    "@codama/renderers-rust": "^1.1.2",
    "codama": "^1.3.0",
    "gill": "^0.10.2",
  },
  "devDependencies": {
    "@types/node": "^20",
    "typescript": "^5"
  }
}
```

### 2. Codama Configuration (codama.js)

```javascript
import { createCodamaConfig } from "gill";
 
export default createCodamaConfig({
  idl: "idl/your_program.json",
  clientJs: "clients/js/src/generated",
},
{
  "idl": "program/idl.json",
  "before": [],
  "scripts": {
    "js": {
      "from": "@codama/renderers-js",
      "args": [
        "clients/js/src/generated",
        {
          "dependencyMap": {
            "solanaAccounts": "gill",
            "solanaAddresses": "gill",
            "solanaCodecsCore": "gill",
            "solanaCodecsDataStructures": "gill",
            "solanaCodecsNumbers": "gill",
            "solanaCodecsStrings": "gill",
            "solanaErrors": "gill",
            "solanaInstructions": "gill",
            "solanaOptions": "gill",
            "solanaPrograms": "gill",
            "solanaRpcTypes": "gill",
            "solanaSigners": "gill"
          }
        }
      ]
    }
  }
});
```

### 3. Automated Test Runner (run_tests.sh)

```bash
#!/usr/bin/env bash
# Automated test runner for macOS (uses AppleScript/Terminal)
set -euo pipefail

# ───────── 1) BUILD / CODE‑GEN STEPS ─────────
echo "🚀 cargo build-sbf"
cargo build-sbf

echo "📜 shank idl"
shank idl

echo "🛠 npx codama run js"
npx codama run js

# ───────── 2) START SURFPOOL IN A NEW TERMINAL WINDOW ─────────
echo "🌊 Launching surfpool in its own Terminal window…"

# Get current directory
CURRENT_DIR=$(pwd)

# Create new Terminal window and run surfpool
SURF_WIN_ID=$(osascript <<APPLESCRIPT
tell application "Terminal"
    -- Create a new window
    set newWindow to do script "cd ${CURRENT_DIR} && surfpool start"
    -- Get the window ID
    set windowID to id of window 1
    return windowID
end tell
APPLESCRIPT
)

echo "ℹ️  Surfpool running in Terminal window id ${SURF_WIN_ID}"
sleep 3  # give Surfpool a moment to boot

# ───────── 3) RUN E2E TESTS ─────────
echo "✅ Running e2e tests…"
npx tsx e2e/e2e.ts
TEST_EXIT=$?

# ───────── 4) CLOSE THE SURFPOOL WINDOW ─────────
echo "🧹 Closing Surfpool window…"
osascript <<APPLESCRIPT
tell application "Terminal"
    try
        -- Send ESC key to the window
         tell application "System Events"
            tell process "Terminal"
                set frontmost to true
                key code 53 -- ESC key
            end tell
        end tell
        -- First, send Ctrl+C to terminate the process
        do script "exit" in window id ${SURF_WIN_ID}
        delay 0.5
        -- Then close the window without confirmation
        close window id ${SURF_WIN_ID} saving no
    end try
end tell
APPLESCRIPT

exit $TEST_EXIT
```

### 4. Linux/Cross-Platform Test Runner (run_tests_linux.sh)

```bash
#!/usr/bin/env bash
# Cross-platform test runner
set -euo pipefail

# ───────── 1) BUILD / CODE‑GEN STEPS ─────────
echo "🚀 cargo build-sbf"
cargo build-sbf

echo "📜 shank idl"
shank idl

echo "🛠 npx codama run js"
npx codama run js

# ───────── 2) START SURFPOOL IN BACKGROUND ─────────
echo "🌊 Starting surfpool in background..."
surfpool start &
SURFPOOL_PID=$!

# Wait for surfpool to be ready
sleep 5

# ───────── 3) RUN E2E TESTS ─────────
echo "✅ Running e2e tests…"
npx tsx e2e/e2e.ts
TEST_EXIT=$?

# ───────── 4) CLEANUP ─────────
echo "🧹 Stopping surfpool..."
kill $SURFPOOL_PID 2>/dev/null || true
wait $SURFPOOL_PID 2>/dev/null || true

exit $TEST_EXIT
```

## E2E Testing Patterns

### 1. Basic Test Setup (e2e/e2e.ts)

```typescript
import { loadKeypairSignerFromFile } from "gill/node";
import { 
    TOKEN_PROGRAM_ADDRESS, 
    getAssociatedTokenAccountAddress, 
    ASSOCIATED_TOKEN_PROGRAM_ADDRESS 
} from "gill/programs/token";
import { 
    createSolanaClient, 
    createTransaction, 
    address, 
    getAddressEncoder, 
    getProgramDerivedAddress, 
    generateKeyPairSigner 
} from "gill";
import * as programClient from "../clients/js/src/generated";

// Your program ID
const PROGRAM_ID = address('YOUR_PROGRAM_ID_HERE');

// Load authority keypair
const authority = await loadKeypairSignerFromFile("~/.config/solana/id.json");

// Create Solana client
const { rpc, sendAndConfirmTransaction } = createSolanaClient({
    urlOrMoniker: "localnet",
});

// Get latest blockhash
const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
console.log("Latest blockhash:", latestBlockhash);
```

### 2. PDA Derivation Pattern

```typescript
const enc = getAddressEncoder();

// Derive PDAs
const [platformPda, platformBump] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: [
        "config"  // Your seed string
        // enc.encode(address('some_address')) // For address seeds
    ]
});

const [vaultPda, vaultBump] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: [ 
        enc.encode(platformPda) 
    ]
});
```

### 3. Instruction Creation and Execution

```typescript
// Prepare instruction data
const fee = Buffer.alloc(2);
fee.writeUInt16LE(500); // 5% fee in basis points

// Create instruction using generated client
const initPlatIx = programClient.getInitializePlatformInstruction({
    authority: authority,
    platform: platformPda,
    vault: vaultPda,
    fee: fee,
    vaultBump: vaultBump,
    platformBump: platformBump
});

// Create and send transaction
const transaction = createTransaction({
    version: "legacy",
    feePayer: authority,
    instructions: [initPlatIx],
    latestBlockhash,
    computeUnitLimit: 50_000,
    computeUnitPrice: 1_000,
});

const result = await sendAndConfirmTransaction(transaction);
console.log("Transaction result:", result);
```

### 4. Token Account Handling

```typescript
// Generate new keypair for account
const newAccount = await generateKeyPairSigner();

// Get associated token account address
const tokenAccount = await getAssociatedTokenAccountAddress(
    tokenMint, 
    newAccount.address
);

// Use in instruction
const instruction = programClient.getYourInstructionInstruction({
    authority,
    targetAccount: newAccount,
    tokenAccount: tokenAccount,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
    // ... other parameters
});
```

### 5. Complete Test Example

```typescript
// Test: Initialize Platform and Create Vote
async function testPlatformAndVote() {
    try {
        // 1. Initialize Platform
        const fee = Buffer.alloc(2);
        fee.writeUInt16LE(500);
        
        const initPlatIx = programClient.getInitializePlatformInstruction({
            authority,
            platform: platformPda,
            vault: vaultPda,
            fee,
            vaultBump,
            platformBump
        });
        
        const initPlatformTx = createTransaction({
            version: "legacy",
            feePayer: authority,
            instructions: [initPlatIx],
            latestBlockhash,
            computeUnitLimit: 50_000,
            computeUnitPrice: 1_000,
        });
        
        const platformResult = await sendAndConfirmTransaction(initPlatformTx);
        console.log("✅ Platform initialized:", platformResult);
        
        // 2. Create Vote
        const vote = await generateKeyPairSigner();
        const [voteVaultPda] = await getProgramDerivedAddress({
            programAddress: PROGRAM_ID,
            seeds: [enc.encode(vote.address)]
        });
        
        const timeToAdd = Buffer.alloc(8);
        timeToAdd.writeBigInt64LE(86400n); // 24 hours
        
        const initVoteIx = programClient.getInitializeVoteInstruction({
            authority,
            platform: platformPda,
            vault: vaultPda,
            vote: vote,
            token: tokenMint,
            voteVault: voteVaultPda,
            voteVaultTokenAccount: await getAssociatedTokenAccountAddress(
                tokenMint, 
                voteVaultPda
            ),
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
            timeToAdd
        });
        
        const initVoteTx = createTransaction({
            version: "legacy",
            feePayer: authority,
            instructions: [initVoteIx],
            latestBlockhash,
            computeUnitLimit: 100_000,
            computeUnitPrice: 1_000,
        });
        
        const voteResult = await sendAndConfirmTransaction(initVoteTx);
        console.log("✅ Vote initialized:", voteResult);
        
    } catch (error) {
        console.error("❌ Test failed:", error);
        throw error;
    }
}

// Run the test
await testPlatformAndVote();
```

## Generated Client Usage

### 1. Instruction Functions

The generated client provides typed instruction functions:

```typescript
// Generated function signature
function getYourInstructionInstruction<...>(
    input: YourInstructionInput<...>,
    config?: { programAddress?: TProgramAddress }
): YourInstructionInstruction<...>

// Usage
const instruction = programClient.getYourInstructionInstruction({
    account1: signer,
    account2: address,
    param1: value1,
    param2: value2
});
```

### 2. Account Types

Generated account types with proper validation:

```typescript
// Account input types are generated based on your IDL
type YourInstructionInput = {
    authority: TransactionSigner<string>;
    targetAccount: Address<string>;
    param1: number;
    param2: ReadonlyUint8Array;
};
```

### 3. Data Encoding/Decoding

```typescript
// Instruction data encoding is handled automatically
const instructionData = getYourInstructionDataEncoder().encode({
    param1: 123,
    param2: buffer
});

// Parsing received instruction data
const parsed = parseYourInstructionInstruction(instruction);
console.log(parsed.data.param1);
```

## Testing Best Practices

### 1. Test Organization

```typescript
// Group related tests
describe("Platform Tests", () => {
    test("Initialize Platform", async () => {
        // Test implementation
    });
    
    test("Update Platform", async () => {
        // Test implementation
    });
});

describe("Vote Tests", () => {
    test("Create Vote", async () => {
        // Test implementation
    });
    
    test("Cast Vote", async () => {
        // Test implementation
    });
});
```

### 2. Error Handling

```typescript
async function testErrorCondition() {
    try {
        // This should fail
        await sendAndConfirmTransaction(invalidTransaction);
        throw new Error("Expected transaction to fail");
    } catch (error) {
        // Verify specific error
        expect(error.message).toContain("Expected error message");
        console.log("✅ Error handled correctly");
    }
}
```

### 3. Account State Verification

```typescript
// Verify account state after instruction
async function verifyAccountState(accountAddress: Address) {
    const accountInfo = await rpc.getAccountInfo(accountAddress).send();
    
    if (!accountInfo.value) {
        throw new Error("Account not found");
    }
    
    // Decode account data using generated types
    const accountData = decodeYourAccountData(accountInfo.value.data);
    
    // Verify expected values
    expect(accountData.field1).toBe(expectedValue);
    console.log("✅ Account state verified");
}
```

## Development Workflow

### 1. Make Changes to Rust Program
```bash
# Edit your Rust code
vim src/instructions/your_instruction.rs
```

### 2. Run Tests
```bash
# This will build, generate clients, and run tests
npm test
```

### 3. Debug Issues
```bash
# Run individual steps for debugging
cargo build-sbf
shank idl
npx codama run js
npx tsx e2e/e2e.ts
```

## Troubleshooting

### Common Issues

1. **Surfpool not starting**: Ensure you have surfpool installed and in PATH
2. **IDL generation fails**: Check your Shank annotations in Rust code
3. **Client generation fails**: Verify codama.js configuration
4. **Transaction fails**: Check account validation and instruction data

### Debug Commands

```bash
# Check if surfpool is running
ps aux | grep surfpool

# Verify IDL generation
cat idl/your_program.json

# Check generated client
ls -la clients/js/src/generated/

# Test RPC connection
curl -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' \
  http://localhost:8899
```

## Installation Requirements

```bash
# Install Rust and Solana CLI
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Install Node.js dependencies
npm install

# Install Shank for IDL generation
cargo install shank-cli

# Install Surfpool for local testing
cargo install surfpool
```

This setup provides a complete TypeScript testing environment with automated client generation, local validator management, and comprehensive testing patterns for Solana programs.
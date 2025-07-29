# TypeScript Testing Setup Guide for Solana Programs

This guide provides a complete setup for TypeScript testing with Codama client generation, CLI tooling, and Surfpool integration for Solana programs.

## Overview

This testing setup follows a specific workflow:

1. **Build Program**: Compile the Rust Solana program
2. **Generate IDL**: Extract Interface Definition Language from the program using Shank
3. **Generate Clients**: Use Codama to generate TypeScript (and potentially Rust/Python) clients from the IDL
4. **Run Surfpool**: Start the enhanced Solana test validator with mainnet program access
5. **Execute Tests**: Run end-to-end tests against the local validator

### Key Components:

- **Codama**: IDL-based client generation for multiple languages
- **Gill**: Modern Solana TypeScript SDK
- **Surfpool**: Enhanced Solana test validator with mainnet program access
- **Shank**: IDL generation from Rust programs
- **Automated Pipeline**: Complete build, generate, test, and cleanup workflow

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

## Initial Setup Requirements

### Prerequisites

Before setting up the testing environment, ensure you have:

```bash
# Install Rust and Solana CLI
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Install Shank for IDL generation
cargo install shank-cli

# Install Surfpool for enhanced local testing
cargo install surfpool

# Install Node.js dependencies (after creating package.json)
npm install
```

### Critical First-Time Setup

**IMPORTANT**: Before running any tests, you MUST initialize Surfpool in your project directory:

```bash
# Navigate to your project root
cd your-project-directory

# Initialize Surfpool (FIRST TIME ONLY)
surfpool start
```

When you first run `surfpool start`, it will prompt you to create project configuration files:

- **Accept ALL defaults** when prompted
- This creates configuration files that automatically deploy your Pinocchio program on startup
- This setup ensures your program is available every time Surfpool starts
- You should never need to modify these generated files

**This initialization step is REQUIRED before `run_tests.sh` will work successfully.**

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
    "gill": "^0.10.2"
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

export default createCodamaConfig(
  {
    idl: "idl/your_program.json",
    clientJs: "clients/js/src/generated",
  },
  {
    idl: "program/idl.json",
    before: [],
    scripts: {
      js: {
        from: "@codama/renderers-js",
        args: [
          "clients/js/src/generated",
          {
            dependencyMap: {
              solanaAccounts: "gill",
              solanaAddresses: "gill",
              solanaCodecsCore: "gill",
              solanaCodecsDataStructures: "gill",
              solanaCodecsNumbers: "gill",
              solanaCodecsStrings: "gill",
              solanaErrors: "gill",
              solanaInstructions: "gill",
              solanaOptions: "gill",
              solanaPrograms: "gill",
              solanaRpcTypes: "gill",
              solanaSigners: "gill",
            },
          },
        ],
      },
    },
  }
);
```

### 3. Understanding the Build Pipeline

The testing workflow follows this exact sequence:

1. **Build Program** (`cargo build-sbf`): Compiles your Rust Solana program
2. **Generate IDL** (`shank idl`): Extracts interface definitions from your program
3. **Generate Clients** (`npx codama run js`): Creates TypeScript client from IDL
4. **Start Surfpool**: Launches enhanced validator with mainnet program access
5. **Run Tests**: Executes your e2e tests against the local validator

### 4. Automated Test Runner (run_tests.sh)

**Note**: This script should work out-of-the-box after Surfpool initialization. You should never need to modify it.

```bash
#!/usr/bin/env bash
# Automated test runner for macOS (uses AppleScript/Terminal)
set -euo pipefail

# ───────── 1) BUILD / CODE‑GEN STEPS ─────────
echo "🚀 Building Solana program..."
cargo build-sbf

echo "📜 Generating IDL from program..."
shank idl

echo "🛠 Generating TypeScript client from IDL..."
npx codama run js

# ───────── 2) START SURFPOOL IN A NEW TERMINAL WINDOW ─────────
echo "🌊 Launching Surfpool (enhanced Solana validator)..."

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
echo "ℹ️  Surfpool provides access to mainnet programs (Token, Metaplex, etc.)"
sleep 3  # give Surfpool a moment to boot and deploy your program

# ───────── 3) RUN E2E TESTS ─────────
echo "✅ Running e2e tests against Surfpool validator..."
npx tsx e2e/e2e.ts
TEST_EXIT=$?

# ───────── 4) CLOSE THE SURFPOOL WINDOW ─────────
echo "🧹 Cleaning up Surfpool..."
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

### 5. Linux/Cross-Platform Test Runner (run_tests_linux.sh)

```bash
#!/usr/bin/env bash
# Cross-platform test runner
set -euo pipefail

# ───────── 1) BUILD / CODE‑GEN STEPS ─────────
echo "🚀 Building Solana program..."
cargo build-sbf

echo "📜 Generating IDL from program..."
shank idl

echo "🛠 Generating TypeScript client from IDL..."
npx codama run js

# ───────── 2) START SURFPOOL IN BACKGROUND ─────────
echo "🌊 Starting Surfpool (enhanced Solana validator)..."
surfpool start &
SURFPOOL_PID=$!

echo "ℹ️  Surfpool provides access to mainnet programs (Token, Metaplex, etc.)"
# Wait for surfpool to be ready and deploy your program
sleep 8

# ───────── 3) RUN E2E TESTS ─────────
echo "✅ Running e2e tests against Surfpool validator..."
npx tsx e2e/e2e.ts
TEST_EXIT=$?

# ───────── 4) CLEANUP ─────────
echo "🧹 Cleaning up Surfpool..."
kill $SURFPOOL_PID 2>/dev/null || true
wait $SURFPOOL_PID 2>/dev/null || true

exit $TEST_EXIT
```

## About Surfpool

Surfpool is an enhanced Solana test validator that provides several key advantages over the standard `solana-test-validator`:

- **Mainnet Program Access**: Automatically provides access to mainnet programs like Token Program, Metaplex Metadata, and others
- **Automatic Program Deployment**: Configured to automatically deploy your Pinocchio program on startup
- **Enhanced Testing Environment**: Optimized for local development and testing
- **Documentation**: Full documentation available at https://docs.surfpool.run/

### Why Use Surfpool?

When testing Solana programs, you often need to interact with existing mainnet programs (tokens, NFTs, DeFi protocols). Surfpool makes this seamless by providing a local environment that mirrors mainnet capabilities while allowing you to test your custom program.

## E2E Testing Patterns

### 1. Basic Test Setup (e2e/e2e.ts)

```typescript
import { loadKeypairSignerFromFile } from "gill/node";
import {
  TOKEN_PROGRAM_ADDRESS,
  getAssociatedTokenAccountAddress,
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
} from "gill/programs/token";
import {
  createSolanaClient,
  createTransaction,
  address,
  getAddressEncoder,
  getProgramDerivedAddress,
  generateKeyPairSigner,
} from "gill";
import * as programClient from "../clients/js/src/generated";

// Your program ID
const PROGRAM_ID = address("YOUR_PROGRAM_ID_HERE");

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
    "config", // Your seed string
    // enc.encode(address('some_address')) // For address seeds
  ],
});

const [vaultPda, vaultBump] = await getProgramDerivedAddress({
  programAddress: PROGRAM_ID,
  seeds: [enc.encode(platformPda)],
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
  platformBump: platformBump,
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
      platformBump,
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
      seeds: [enc.encode(vote.address)],
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
      timeToAdd,
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
  param2: buffer,
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

### 1. Initial Project Setup (One-time)

```bash
# Clone or create your project
cd your-solana-project

# Install dependencies
npm install

# CRITICAL: Initialize Surfpool (accept all defaults)
surfpool start
# Follow prompts and accept all defaults
# This creates auto-deployment configuration
# Stop surfpool after setup (Ctrl+C)
```

### 2. Regular Development Cycle

```bash
# Edit your Rust code
vim src/instructions/your_instruction.rs

# Run complete test suite (builds, generates, tests)
npm test
```

### 3. Manual Testing/Debugging

```bash
# Run individual pipeline steps for debugging
cargo build-sbf          # Build program
shank idl               # Generate IDL
npx codama run js       # Generate TypeScript client
surfpool start          # Start validator (in separate terminal)
npx tsx e2e/e2e.ts     # Run tests
```

### 4. Understanding the Generated Files

After running the pipeline, you'll have:

```
├── target/deploy/your_program.so    # Compiled program
├── idl/your_program.json           # Generated IDL
├── clients/js/src/generated/       # TypeScript client
│   ├── instructions/               # Typed instruction functions
│   ├── accounts/                   # Account type definitions
│   ├── types/                      # Data type definitions
│   └── index.ts                    # Main exports
└── surfpool.toml                   # Surfpool configuration (auto-generated)
```

## Troubleshooting

### Common Issues

1. **"run_tests.sh fails immediately"**:
   - **Solution**: You must run `surfpool start` once in your project directory and accept all defaults before running tests
   - This creates the necessary configuration files for automatic program deployment

2. **"Surfpool not starting"**:
   - Ensure surfpool is installed: `cargo install surfpool`
   - Check if port 8899 is already in use: `lsof -i :8899`

3. **"IDL generation fails"**:
   - Check your Shank annotations in Rust code
   - Ensure all instruction structs have proper `#[derive(ShankInstruction)]`
   - Verify account annotations are correct

4. **"Client generation fails"**:
   - Verify `codama.js` configuration matches your IDL path
   - Check that IDL was generated successfully: `cat idl/your_program.json`

5. **"Transaction fails with program not found"**:
   - Ensure Surfpool initialization was completed (accept defaults)
   - Check that your program ID in tests matches the one in `lib.rs`
   - Verify Surfpool deployed your program (check logs on startup)

### Debug Commands

```bash
# Check if surfpool is running
ps aux | grep surfpool

# Verify IDL generation
cat idl/your_program.json

# Check generated client structure
ls -la clients/js/src/generated/
tree clients/js/src/generated/

# Test RPC connection to Surfpool
curl -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' \
  http://api.devnet.solana.com

# Check Surfpool configuration
cat surfpool.toml

# Verify program deployment in Surfpool logs
# (Look for your program ID in the startup logs)
```

### Step-by-Step Troubleshooting

If tests are failing, debug in this order:

1. **Check build**: `cargo build-sbf` should complete without errors
2. **Check IDL**: `shank idl` should generate `idl/your_program.json`
3. **Check client generation**: `npx codama run js` should populate `clients/js/src/generated/`
4. **Check Surfpool**: Start manually and look for your program in deployment logs
5. **Check tests**: Run `npx tsx e2e/e2e.ts` with Surfpool running

## Quick Start Checklist

For a new project, follow this exact sequence:

- [ ] Install prerequisites (Rust, Solana CLI, Node.js)
- [ ] Install tools: `cargo install shank-cli surfpool`
- [ ] Create `package.json` with required dependencies
- [ ] Create `codama.js` configuration
- [ ] Copy `run_tests.sh` script
- [ ] **CRITICAL**: Run `surfpool start` and accept all defaults
- [ ] Create your first test in `e2e/e2e.ts`
- [ ] Run `npm test` to verify everything works

## Additional Resources

- **Surfpool Documentation**: https://docs.surfpool.run/
- **Codama Documentation**: https://github.com/codama-idl/codama
- **Gill SDK Documentation**: https://github.com/solana-labs/gill
- **Shank IDL Generation**: https://github.com/metaplex-foundation/shank

This setup provides a complete TypeScript testing environment with automated client generation, local validator management, and comprehensive testing patterns for Solana programs.

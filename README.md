## p-vote

This is a simple usdc based solana voting contract(program) written in pinocchio(rust). It's meant be used as a model to create future program. As such it's designed to be exploitable by a flash loan program I"ll implement next.

## Stack

We'll be using pinocchio for the solana program, mollusk for testing (unit and CU benching), surfpool.run for deployment and E2E testing, codama/shank for idl and client generation, and finally nextjs and solana kit for the front-end.

## Commands

Build Pinocchio Program
```bash
cargo build-sbf
```
Run Mollusk Tests
```bash
cargo test
```
Run Mollusk Bench
```bash
cargo bench
```
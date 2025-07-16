<h1 align="center">
  <code>p-vote</code>
</h1>
<p align="center">
  <img width="400" alt="p-vote-logo" src="https://github.com/user-attachments/assets/7a81eefa-4ab4-4481-accf-c950b84bd7ff" />
</p>
<p align="center">
  Exploitable Voting Program
</p>

## about

This is a simple solana voting contract(program) written in pinocchio(rust). It's meant be used as a model to create future program. As such it's designed to be exploitable by a flash loan program I"ll implement next.

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

## How votes work

Users will create a vote about anything they want choosing a regular spl token and a end date for the vote. Once created anyone can vote true / false on the topic by sending some of the chosen token to that side. That token is then LOCKED in until the end of the vote. Users can NOT change the side the voted on only add more votes to their original vote. When the chain time hits the end time the side with the most votes (aka chosen token sent) wins! This is regardless of the actual answer to the question (If there is one). Its just the side with the most votes at the end that wins. This is purposely exploitable by a flash loan program or user with deep liquidity of the chosen token. That will be the next program I build using this repo as a template for pinocchio projects moving forward.

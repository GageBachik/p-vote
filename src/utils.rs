// This repo is not meant to be an anchor alternative.
// as such I will not be writing a bunch of one time use helpers
// for things like account data parsing etc etc
// I have not found a set I personally like and encourage others to
// explore what they like in that regard and post them for others
// https://x.com/lich01_ <- posts his often if you need inspiration
// instead the repo will reuse PATTERNS that make it easy to understand
// and reason about exactly whats happening where they care about.
// similiar to anchors concept of seperating: logics, validations, structs.

// Which means all you'll find here is a reusable function for calculating fees <3

pub fn calculate_fees(amount: u64, bps: u16) -> u64 {
    amount * bps as u64 / 10_000
}

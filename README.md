# FlightSurety
Blockchain project (Ethereum) for simple flight status and insurance, based on Udacity's project.

## Environment

Version used in this project:

. Truffle v5.0.1 (core: 5.0.1)
. Solidity - 0.5.2 (solc-js)
. Node v8.9.4

## Install

This repository contains Smart Contract code in Solidity (using Truffle), tests (also using Truffle), DApp (using HTML, CSS and JS) and server app.

To install, download or clone the repo, then:

`npm install`
`truffle compile`

## Develop Client

To run truffle tests:

`truffle test ./test/FlightSurety.js`
`truffle test ./test/Oracles.js`

To use the dapp:

`truffle migrate`
`npm run dapp`

To view dapp:

`http://localhost:8000`

## Develop Server

`npm run server`
`truffle test ./test/Oracles.js`

## Deploy

To build dapp for prod:
`npm run dapp:prod`

Deploy the contents of the ./dapp folder




# FlightSurety
Blockchain project (Ethereum) for simple flight status and insurance, based on Udacity's project.

## Environment

Version used in this project:

* Truffle v5.0.1 (core: 5.0.1)
* Solidity - 0.5.2 (solc-js)
* Node v8.9.4

## Install

This repository contains Smart Contract code in Solidity (using Truffle), tests (also using Truffle), DApp (using HTML, CSS and JS) and server app.

To install, download or clone the repo, then:

* `npm install`
* `truffle compile`

## Develop Client

To run truffle tests:

* `truffle test ./test/FlightSurety.js`
* `truffle test ./test/Oracles.js`

Start ganache client with 50 accounts, using a mnemonic of your choice:

* `ganache-cli -a 50 -m "<mnemonic>"`

Migrate the project and run the dapp:

* `truffle migrate --reset`
* `npm run dapp`

To view dapp:

* `http://localhost:8000`

## Develop Server

On another terminal (command prompt), run:

* `npm run server`

## Deploy

To build dapp for prod:
* `npm run dapp:prod`

Deploy the contents of the ./dist folder

## Contract operation

* In order to enable/disable the contract operation (both Data and App), there is a function called setOperatingStatus() on the Data contract, that can be called only by the owner of the contract. Once the contract is not operational, no functions that change the state of the contracts can be called.

* In order to attach a different App contract to the Data contract, it is required that the owner calls the function authorizeCaller() on the Data contract, passing the new App contract address as parameter. 




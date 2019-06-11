const Web3 = require('web3');
const appContractJson = require('../../build/contracts/FlightSuretyApp.json');
const configJson = require('./config.json');
const express = require('express');
const http = require('http');
const BigNumber = require('bignumber.js');

// Flight Status Codes
const STATUS_CODE_UNKNOWN = 0;
const STATUS_CODE_ON_TIME = 10;
const STATUS_CODE_LATE_AIRLINE = 20;
const STATUS_CODE_LATE_WEATHER = 30;
const STATUS_CODE_LATE_TECHNICAL = 40;
const STATUS_CODE_LATE_OTHER = 50;

let network = Object.keys(configJson)[0];
//console.log("network", network);
let config = configJson[network];
//console.log("config", config);
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
//let web3 = new Web3(new HDWalletProvider(mnemonic, config.url, 0, 10));
let flightSuretyApp = new web3.eth.Contract(appContractJson.abi, config.appAddress);
let oracles = new Map();

function getRandomStatusCode() {
  let n = Math.random() * 6 * 10;  // 6 possible values
  if (n >= 50) return STATUS_CODE_LATE_OTHER;
  else if (n >= 40) return STATUS_CODE_LATE_TECHNICAL;
  else if (n >= 30) return STATUS_CODE_LATE_WEATHER;
  else if (n >= 20) return STATUS_CODE_LATE_AIRLINE;
  else if (n >= 10) return STATUS_CODE_ON_TIME;
  else if (n >= 0) return STATUS_CODE_UNKNOWN;
}

// Monitors requests and submit random responses
flightSuretyApp.events.OracleRequest({
    fromBlock: 0
  }, function (error, result) {
    if (error) {
      console.log(error)
    } else {
      console.log('Event', result.event, result.returnValues.index, result.returnValues.airline, 
        result.returnValues.flight, BigNumber(result.returnValues.scheduledDepartureTime).toNumber());
      for (var [key, value] of oracles) {
        console.log(key + " = " + value);
        if (value.indexOf(result.returnValues.index) != -1) {
          console.log("Oracle", key, "has index", result.returnValues.index);
          let statusCode = getRandomStatusCode();
          flightSuretyApp.methods.submitOracleResponse(
            result.returnValues.index, 
            result.returnValues.airline, 
            result.returnValues.flight, 
            result.returnValues.scheduledDepartureTime,
            statusCode
          ).send({from: key});
          console.log("Status code", statusCode, "sent");
        }
      }
    }
});

// Logs results from responses
flightSuretyApp.events.FlightStatusInfo({
  fromBlock: 0
}, function (error, result) {
  if (error) {
    console.log(error)
  } else {
    console.log('Event', result.event, result.returnValues.airline, result.returnValues.flight, 
      BigNumber(result.returnValues.scheduledDepartureTime).toNumber(), BigNumber(result.returnValues.status).toNumber());
  }
});

(async function() {
  try {
    let fee = await flightSuretyApp.methods.REGISTRATION_FEE.call();
    console.log("fee", BigNumber(fee).toNumber());
    const accounts = await web3.eth.getAccounts();
    console.log("accounts.length", accounts.length);
    let numOracles = 20;
    for (let i=0; i<numOracles; i++) {  
      let account = accounts[i+10];     // register oracles from account 10 to 30
      console.log("Registering oracle with account", account);
      flightSuretyApp.methods.registerOracle().send({from: account, value: fee, gas: 6000000})
      .on('transactionHash', (hash) => {
        console.log("transactionHash:", hash);
        flightSuretyApp.methods.getMyIndexes().call({from: account}, (error, indexes) => {
          console.log("Indexes:", account, indexes);
          oracles.set(account, indexes);
        });
      })
      // .on('receipt', (receipt) => {
      //   console.log("receipt");
      // })
      // .on('confirmation', (confirmationNumber, receipt) => {
      //   console.log("confirmationNumber", confirmationNumber);
      // })
      .on('error', (error) => {
        console.log("Oracle probably is already registered");
        flightSuretyApp.methods.getMyIndexes().call({from: account}, (error, indexes) => {
          console.log("Indexes:", account, indexes);
          oracles.set(account, indexes);
        });
      });
    }
  } catch(err) {
    console.log(err);
  }
})();

const app = express();
app.get('/api', (req, res) => {
    res.send({
      message: 'An API for use with your Dapp!'
    })
})

const server = http.createServer(app)
server.listen(3000)


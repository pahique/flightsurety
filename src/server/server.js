const Web3 = require('web3');
const appContractJson = require('../../build/contracts/FlightSuretyApp.json');
const configJson = require('./config.json');
const express = require('express');
const http = require('http');

let network = Object.keys(configJson)[0];
let config = configJson[network];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(appContractJson.abi, config.appAddress);

flightSuretyApp.events.OracleRequest({
    fromBlock: 0
  }, function (error, result) {
    if (error) {
      console.log(error)
    } else {
      console.log('Received', result.event);
    }
});

const app = express();
app.get('/api', (req, res) => {
    res.send({
      message: 'An API for use with your Dapp!'
    })
})

const server = http.createServer(app)
let currentApp = app
server.listen(3000)

// if (module.hot) {
//  module.hot.accept('./server', () => {
//   server.removeListener('request', currentApp)
//   server.on('request', app)
//   currentApp = app
//  })
// }

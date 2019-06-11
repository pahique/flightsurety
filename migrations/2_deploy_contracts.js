const FlightSuretyApp = artifacts.require("FlightSuretyApp");
const FlightSuretyData = artifacts.require("FlightSuretyData");
const fs = require('fs');

module.exports = function(deployer, network, accounts) {
    //console.log("accounts", accounts);
    let firstAirline = accounts[1];
    let firstAirlineName = 'Airline One';
    deployer.deploy(FlightSuretyData, firstAirline, firstAirlineName).then(() => {
        return FlightSuretyData.deployed();
    }).then((dataContractInstance) => {
        return deployer.deploy(FlightSuretyApp, FlightSuretyData.address).then(() => {
            dataContractInstance.authorizeCaller(FlightSuretyApp.address);
            let config = {
                localhost: {
                    url: network == 'development' ? 'http://localhost:8545' : 'wss://rinkeby.infura.io/ws/v3/8e013dba7e4c494aa93d12d42fd537b7',
                    dataAddress: FlightSuretyData.address,
                    appAddress: FlightSuretyApp.address
                }
            }
            fs.writeFileSync(__dirname + '/../src/dapp/config.json', JSON.stringify(config, null, '\t'), 'utf-8');
            fs.writeFileSync(__dirname + '/../src/server/config.json', JSON.stringify(config, null, '\t'), 'utf-8');
        });
    });
}

// deployer.deploy(Storage)
//     .then(() => Storage.deployed())
//     .then((instance) => {
//         instance.addData("Hello", "world")
//     }).then(() => deployer.deploy(InfoManager, Storage.address));
    
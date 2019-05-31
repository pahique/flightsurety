
var Test = require('./config/TestConfig.js');
var BigNumber = require('bignumber.js');
//const web3 = require('web3');
//import web3 from 'web3';



contract('Flight Surety Tests', async (accounts) => {

  let lastSnapshot;
    
  var config;
  before('setup contract', async () => {
    // creates a snapshot of the accounts, to avoid lack of funds after multiple tests without restarting Ganache
    await web3.currentProvider.send({
        jsonrpc: "2.0",
        method: "evm_snapshot"
      }, function(err, res) {
        lastSnapshot = parseInt(res.result, 0);
    });
    // inits test data
    config = await Test.Config(accounts);
    // authorizes app contract to call data contract
    await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
  });

  after(async () => {
      // reverts accounts from last snapshot
      await web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_revert',
        params: lastSnapshot
      });
  })

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`(multiparty) has correct initial isOperational() value`, async function () {
    // Get operating status
    let status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");
  });

  it(`(multiparty) has first airline registered automatically`, async function () {
    // Get operating status
    let status = await config.flightSuretyData.isAirline.call(config.firstAirline);
    assert.equal(status, true, "First airline not registered automatically");
  });

  it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {
      // Ensure that access is denied for non-Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] });
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, true, "Access not restricted to Contract Owner");          
  });

  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {
      // Ensure that access is allowed for Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false);
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, false, "Access not restricted to Contract Owner");    
  });

  it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {
      await config.flightSuretyData.setOperatingStatus(false);
      let reverted = false;
      try 
      {
          await config.flightSurety.setTestingMode(true);
      }
      catch(e) {
          reverted = true;
      }
      assert.equal(reverted, true, "Access not blocked for requireIsOperational");      

      // Set it back for other tests to work
      await config.flightSuretyData.setOperatingStatus(true);
  });

  it('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {
    // ARRANGE
    let airline2 = accounts[2];
    // ACT
    try {
        await config.flightSuretyApp.registerAirline(airline2, {from: config.firstAirline});
    }
    catch(e) {
        console.log(e.message);
    }
    let result = await config.flightSuretyData.isAirline.call(airline2); 
    // ASSERT
    assert.equal(result, false, "Airline should not be able to register another airline if it hasn't provided funding");
  });
 
  it('(airline) can register an Airline using registerAirline() if it is funded', async () => {
    // ARRANGE
    let airline2 = accounts[2];
    // ACT
    try {
        let minimumFunds = await config.flightSuretyData.MINIMUM_FUNDS.call();
        //console.log("minimumFunds", minimumFunds);
        await config.flightSuretyApp.fund({from: config.firstAirline, value: minimumFunds});
        await config.flightSuretyApp.registerAirline(airline2, {from: config.firstAirline});
    }
    catch(e) {
        console.log(e.message);
    }
    let result = await config.flightSuretyData.isAirline.call(airline2); 
    // ASSERT
    assert.equal(result, true, "First airline should be able to register a second airline if it has provided funding");
  });

  it('(airline) can register only 4 airlines using registerAirline() without the need of consensus', async () => {
    // ARRANGE 
    // Note: First airline and newAirline are already registered, 2 airlines in total
    let airline3 = accounts[3];
    let airline4 = accounts[4];
    let airline5 = accounts[5];
    // ACT
    try {
        let minimumFunds = await config.flightSuretyData.MINIMUM_FUNDS.call();
        await config.flightSuretyApp.fund({from: config.firstAirline, value: minimumFunds});
        await config.flightSuretyApp.registerAirline(airline3, {from: config.firstAirline});
        await config.flightSuretyApp.registerAirline(airline4, {from: config.firstAirline});
        await config.flightSuretyApp.registerAirline(airline5, {from: config.firstAirline});
    }
    catch(e) {
        console.log(e.message);
    }
    let result1 = await config.flightSuretyData.isAirline.call(airline3); 
    let result2 = await config.flightSuretyData.isAirline.call(airline4); 
    let result3 = await config.flightSuretyData.isAirline.call(airline5); 
    // ASSERT
    assert.equal(result1, true, "First airline should be able to register a third airline if it has provided funding");
    assert.equal(result2, true, "First airline should be able to register a fourth airline if it has provided funding");
    assert.equal(result3, false, "First airline should NOT be able to register a fifth airline without consensus");
    assert.equal(await config.flightSuretyData.getNumAirlines(), 4);
  });

  it('(airline) can register a 5th airline with at least 50% of consensus', async () => {
    // ARRANGE 
    // Note: 4 airlines are already registered
    let airline2 = accounts[2];
    let airline3 = accounts[3];
    let airline4 = accounts[4];
    let airline5 = accounts[5];
    // ACT
    try {
        let minimumFunds = await config.flightSuretyData.MINIMUM_FUNDS.call();
        await config.flightSuretyApp.fund({from: airline2, value: minimumFunds});
        await config.flightSuretyApp.fund({from: airline3, value: minimumFunds});
        await config.flightSuretyApp.registerAirline(airline5, {from: config.firstAirline});
        await config.flightSuretyApp.registerAirline(airline5, {from: airline2});
        await config.flightSuretyApp.registerAirline(airline5, {from: airline3});
    }
    catch(e) {
        console.log(e.message);
    }
    let result = await config.flightSuretyData.isAirline.call(airline5); 
    // ASSERT
    assert.equal(result, true, "Fifth airline should be registered by consensus");
    assert.equal(await config.flightSuretyData.getNumAirlines(), 5);
  });

  it('(airline) cannot register a 6th airline with less than 50% of consensus', async () => {
    // ARRANGE 
    // Note: 4 airlines are already registered
    let airline2 = accounts[2];
    let airline3 = accounts[3];
    let airline4 = accounts[4];
    let airline5 = accounts[5];
    let airline6 = accounts[6];
    // ACT
    try {
        await config.flightSuretyApp.registerAirline(airline6, {from: config.firstAirline});
        await config.flightSuretyApp.registerAirline(airline6, {from: airline2});
    }
    catch(e) {
        console.log(e.message);
    }
    let result = await config.flightSuretyData.isAirline.call(airline6); 
    // ASSERT
    assert.equal(result, false, "Sixth airline should NOT be registered because there was not enough consensus");
    assert.equal(await config.flightSuretyData.getNumAirlines(), 5);
  });

  it('(airline) can register a 6th airline with a least 50% of consensus', async () => {
    // ARRANGE 
    // Note: 5 airlines are already registered
    let airline2 = accounts[2];
    let airline3 = accounts[3];
    let airline4 = accounts[4];
    let airline5 = accounts[5];
    let airline6 = accounts[6];
    // ACT
    try {
        await config.flightSuretyApp.registerAirline(airline6, {from: config.firstAirline});
        await config.flightSuretyApp.registerAirline(airline6, {from: airline2});
        await config.flightSuretyApp.registerAirline(airline6, {from: airline3});
    }
    catch(e) {
        console.log(e.message);
    }
    let result = await config.flightSuretyData.isAirline.call(airline6); 
    // ASSERT
    assert.equal(result, true, "Sixth airline should be registered because there was enough consensus");
    assert.equal(await config.flightSuretyData.getNumAirlines(), 6);
  });

});

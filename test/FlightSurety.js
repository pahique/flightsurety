
var Test = require('./config/TestConfig.js');
var BigNumber = require('bignumber.js');


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
    await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address, {from: config.owner});
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
        await config.flightSuretyApp.registerAirline(airline2, "Airline 2", {from: config.firstAirline});
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
        let minimumFunds = await config.flightSuretyApp.minimumFunds.call();
        //console.log("minimumFunds", minimumFunds);
        await config.flightSuretyApp.fund({from: config.firstAirline, value: minimumFunds});
        await config.flightSuretyApp.registerAirline(airline2, "Airline 2", {from: config.firstAirline});
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
        let minimumFunds = await config.flightSuretyApp.minimumFunds.call();
        await config.flightSuretyApp.fund({from: config.firstAirline, value: minimumFunds});
        await config.flightSuretyApp.registerAirline(airline3, "Airline 3", {from: config.firstAirline});
        await config.flightSuretyApp.registerAirline(airline4, "Airline 4", {from: config.firstAirline});
        await config.flightSuretyApp.registerAirline(airline5, "Airline 5", {from: config.firstAirline});
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
        let minimumFunds = await config.flightSuretyApp.minimumFunds.call();
        await config.flightSuretyApp.fund({from: airline2, value: minimumFunds});
        await config.flightSuretyApp.fund({from: airline3, value: minimumFunds});
        await config.flightSuretyApp.registerAirline(airline5, "Airline 5", {from: config.firstAirline});
        await config.flightSuretyApp.registerAirline(airline5, "Airline 5", {from: airline2});
        await config.flightSuretyApp.registerAirline(airline5, "Airline 5", {from: airline3});
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
        await config.flightSuretyApp.registerAirline(airline6, "Airline 6", {from: config.firstAirline});
        await config.flightSuretyApp.registerAirline(airline6, "Airline 6", {from: airline2});
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
        await config.flightSuretyApp.registerAirline(airline6, "Airline 6", {from: config.firstAirline});
        await config.flightSuretyApp.registerAirline(airline6, "Airline 6", {from: airline2});
        await config.flightSuretyApp.registerAirline(airline6, "Airline 6", {from: airline3});
    }
    catch(e) {
        console.log(e.message);
    }
    let result = await config.flightSuretyData.isAirline.call(airline6); 
    // ASSERT
    assert.equal(result, true, "Sixth airline should be registered because there was enough consensus");
    assert.equal(await config.flightSuretyData.getNumAirlines(), 6);
  });

  it('(airline) cannot register a flight that departs in the past', async() => {
    // ARRANGE
    let passenger = config.testAddresses[0];
    // ACT
    try {
        let flight = "AD4061";
        let departureTimestamp = Math.trunc(((new Date()).getTime() - 3*3600) / 1000);
        let arrivalTimestamp = Math.trunc(((new Date()).getTime() + 5*3600) / 1000);
        let amountPaid = web3.utils.toWei("1.1", "ether");
        await expectThrow(config.flightSuretyApp.registerFlight(flight, departureTimestamp, arrivalTimestamp, "VCP", "POA", {from: config.firstAirline}));
    }
    catch(e) {
        assert.fail(e.message);
    }
  });

  it('(passenger) cannot buy insurance for a flight paying more than 1 ether', async() => {
    // ARRANGE
    let passenger = config.testAddresses[0];
    // ACT
    try {
        let flight = "AD4061";
        let departureTimestamp = Math.trunc(((new Date()).getTime() + 3*3600) / 1000);
        let arrivalTimestamp = Math.trunc(((new Date()).getTime() + 5*3600) / 1000);
        let amountPaid = web3.utils.toWei("1.1", "ether");
        await config.flightSuretyApp.registerFlight(flight, departureTimestamp, arrivalTimestamp, "VCP", "POA", {from: config.firstAirline});
        await expectThrow(config.flightSuretyApp.buyInsurance(config.firstAirline, flight, departureTimestamp, {from: passenger, value: amountPaid}));
    }
    catch(e) {
        assert.fail(e.message);
    }
  });

  it('(passenger) can buy insurance for a flight paying up to 1 ether', async() => {
    // ARRANGE
    let passenger1 = config.testAddresses[0];
    let flight = "AD4061";
    let departureTimestamp = Math.trunc(((new Date()).getTime() + 3*3600) / 1000);
    let arrivalTimestamp = Math.trunc(((new Date()).getTime() + 5*3600) / 1000);
    let amountPaid = web3.utils.toWei("0.5", "ether");
    // ACT
    try {
        await config.flightSuretyApp.registerFlight(flight, departureTimestamp, arrivalTimestamp, "VCP", "POA", {from: config.firstAirline});
        await config.flightSuretyApp.buyInsurance(config.firstAirline, flight, departureTimestamp, {from: passenger1, value: amountPaid});
    }
    catch(e) {
        assert.fail(e.message);
    }
    // ASSERT
    let result = await config.flightSuretyApp.getAmountPaidByInsuree.call(config.firstAirline, flight, departureTimestamp, {from: passenger1});
    assert.equal(result, amountPaid);
  });

  it('(passengers) receive credit for the insurance bought, and only once', async() => {
    // ARRANGE
    let passenger2 = config.testAddresses[1];
    let passenger3 = config.testAddresses[2];
    let flight = "AD4062";
    let departureTimestamp = Math.trunc(((new Date()).getTime() + 3*3600) / 1000);
    let arrivalTimestamp = Math.trunc(((new Date()).getTime() + 5*3600) / 1000);
    let amountPaid2 = web3.utils.toWei("0.6", "ether");
    let amountPaid3 = web3.utils.toWei("0.4", "ether");
    let percentage = 150;
    let fundsBefore;
    let fundsAfter;
    // ACT
    try {
        fundsBefore = await config.flightSuretyData.getCurrentFunds(config.firstAirline);
        //console.log(BigNumber(fundsBefore).toNumber());
        await config.flightSuretyApp.registerFlight(flight, departureTimestamp, arrivalTimestamp, "VCP", "SSA", {from: config.firstAirline});
        await config.flightSuretyApp.buyInsurance(config.firstAirline, flight, departureTimestamp, {from: passenger2, value: amountPaid2});
        await config.flightSuretyApp.buyInsurance(config.firstAirline, flight, departureTimestamp, {from: passenger3, value: amountPaid3});
        await config.flightSuretyData.creditInsurees(percentage, config.firstAirline, flight, departureTimestamp, {from: config.owner});
        await expectThrow(config.flightSuretyData.creditInsurees(percentage, config.firstAirline, flight, departureTimestamp, {from: config.owner}));
        fundsAfter = await config.flightSuretyData.getCurrentFunds(config.firstAirline);
        //console.log(BigNumber(fundsAfter).toNumber());
    }
    catch(e) {
        assert.fail(e.message);
    }
    // ASSERT
    // Passenger2 credits
    let paid2 = await config.flightSuretyApp.getAmountPaidByInsuree.call(config.firstAirline, flight, departureTimestamp, {from: passenger2});
    assert.equal(paid2, amountPaid2);
    let credit2 = await config.flightSuretyApp.getAmountToBeReceived.call({from: passenger2});
    assert.equal(credit2, amountPaid2 * percentage/100);
    // Passenger3 credits
    let paid3 = await config.flightSuretyApp.getAmountPaidByInsuree.call(config.firstAirline, flight, departureTimestamp, {from: passenger3});
    assert.equal(paid3, amountPaid3);
    let credit3 = await config.flightSuretyApp.getAmountToBeReceived.call({from: passenger3});
    assert.equal(credit3, amountPaid3 * percentage/100);
    // Airline funds
    assert.equal(BigNumber(fundsAfter).toNumber(), BigNumber(fundsBefore.add(paid2).add(paid3).sub(credit2).sub(credit3)).toNumber());
  });

  it('(passenger) can withdraw credits successfully', async() => {
    // ARRANGE
    let passenger2 = config.testAddresses[1];
    let amountPaid2 = web3.utils.toWei("0.6", "ether");
    let percentage = 150;
    let compensation = amountPaid2 * percentage / 100;
    let balanceBeforeTransaction;
    let balanceAfterTransaction;
    // ACT
    try {
        balanceBeforeTransaction = await web3.eth.getBalance(passenger2);
        await config.flightSuretyApp.withdrawCompensation({from: passenger2, gasPrice: 0});
        balanceAfterTransaction = await web3.eth.getBalance(passenger2);
    }
    catch(e) {
        assert.fail(e.message);
    }
    // ASSERT
    assert.equal(compensation, balanceAfterTransaction - balanceBeforeTransaction);
  });

});

let expectThrow = async function(promise) {
    try {
        await promise;
    } catch(error) {
        assert.exists(error);
        return;
    }
    assert.fail("Expected an error but didn't see one");
}


import Web3 from "web3";
import appContractArtifact from "../../build/contracts/FlightSuretyApp.json";
import dataContractArtifact from "../../build/contracts/FlightSuretyData.json";
import configArtifact from "./config.json";
import BigNumber from 'bignumber.js';

const App = {
  web3: null,
  owner: null,
  currentUser: null,
  appContract: null,
  dataContract: null,

  start: async function() {
    const { web3 } = this;

    try {
      // get contract instance
      const networkId = await web3.eth.net.getId();
      console.log("networkId:", networkId);
      //const deployedNetwork = appContractArtifact.networks[networkId];
      //console.log("deployed network:", deployedNetwork);
      let network = Object.keys(configArtifact)[0];
      console.log("dataAddress:", configArtifact[network].dataAddress);
      this.dataContract = new web3.eth.Contract(
        dataContractArtifact.abi,
        configArtifact[network].dataAddress,
      );
      console.log("DataContract:", this.dataContract);

      console.log("appAddress:", configArtifact[network].appAddress);
      this.appContract = new web3.eth.Contract(
        appContractArtifact.abi,
        configArtifact[network].appAddress,
      );
      console.log("AppContract:", this.appContract);

      // get accounts
      const accounts = await web3.eth.getAccounts();
      this.currentUser = accounts[0];
      const currentUserElement = document.getElementById("currentUser");
      currentUserElement.innerHTML = this.currentUser;
      let self = this;
      var accountInterval = setInterval(async function() {
        let currentAccounts = await web3.eth.getAccounts();
        if (currentAccounts[0] !== self.currentUser) {
          self.currentUser = currentAccounts[0];
          const currentUserElement = document.getElementById("currentUser");
          currentUserElement.innerHTML = self.currentUser;
          self.getIsAirline();
        }
      }, 100);      
      // show owner
      this.getOwner();
      // show contract status
      this.getIsOperational();
      // show if current user is airline
      this.getIsAirline();
      // Get registered airlines
      this.fetchAirlines();
      // Get registered flights
      this.fetchFlights();
      // Get registered insurances 
      this.fetchInsurances();
    } catch (error) {
      console.error("Could not connect to contract or chain.", error);
    }
  },

  getOwner: async function() {
    const { contractOwner } = this.appContract.methods;
    this.owner = await contractOwner().call();
    console.log("Owner:", this.owner);
    const ownerElement = document.getElementById("owner");
    ownerElement.innerHTML = this.owner;
  },

  getIsOperational: async function() {
    const { isOperational } = this.appContract.methods;
    const resultOperational = await isOperational().call();
    console.log("Operational:", resultOperational);
    const operationalElement = document.getElementById("operational");
    operationalElement.innerHTML = resultOperational ? "Operational" : "Not operational";
    operationalElement.className = resultOperational ? "operational" : "notOperational";
  },

  getIsAirline: async function() {
    let airlineElement = document.getElementById("isAirline");
    airlineElement.innerHTML = "";
    const { isAirline } = this.appContract.methods;
    const resultIsAirline = await isAirline().call({from: this.currentUser});
    console.log("Is Airline:", resultIsAirline);
    airlineElement = document.getElementById("isAirline");
    airlineElement.innerHTML = resultIsAirline ? "(airline)" : "(not an airline)";
    airlineElement.className = resultIsAirline ? "airline" : "notAirline";
  },

  fetchAirlines: function () {
    this.dataContract.getPastEvents('AirlineRegistered', {fromBlock: 0, toBLock: 'latest'}, (err, events) => {
        if (!err) {   
          document.getElementById("airlinesList").innerHTML = "";
          for (event of events) {
            //console.log(event);
            var itemNode = document.createElement("li");                 
            var textnode = document.createTextNode(event.returnValues.name + " - " + event.returnValues.account);         
            itemNode.appendChild(textnode);                              
            document.getElementById("airlinesList").appendChild(itemNode);     
          }
        }
    });
  },

  registerAirlne: async function() {
    const address = document.getElementById("airlineAddress").value;
    const name = document.getElementById("airlineName").value;

    this.setStatus("Initiating transaction... (please wait)");

    const { registerAirline } = this.appContract.methods;
    await registerAirline(address, name).send({ from: this.currentUser });

    this.setStatus("Transaction complete!");
  },

  sendFunds: async function() {
    const fundsToSend = parseInt(document.getElementById("fundsToSend").value);
    let amount = web3.toWei(fundsToSend, "ether");
    this.setStatus("Initiating transaction... (please wait)");

    const { fund } = this.appContract.methods;
    await fund().send({ from: this.currentUser, value: amount });

    this.setStatus("Transaction complete!");
  },

  registerFlight: async function() {
    const flight = document.getElementById("flightNumber").value;
    const departureTime = document.getElementById("departureTime").value;
    const arrivalTime = document.getElementById("arrivalTime").value;
    const origAirport = document.getElementById("departureAirport").value;
    const destAirport = document.getElementById("arrivalAirport").value;

    let departureTimestamp; 
    let arrivalTimestamp;
    try {
      let year = departureTime.substring(0, 4);
      let month = departureTime.substring(4, 6) - 1;
      let day = departureTime.substring(6, 8);
      let hour = departureTime.substring(8, 10);
      let minute = departureTime.substring(10, 12);
      departureTimestamp = Math.trunc(new Date(year, month, day, hour, minute).getTime() / 1000);
      console.log("departure", departureTimestamp);
    } catch(e) {}
    try {
      let year = arrivalTime.substring(0, 4);
      let month = arrivalTime.substring(4, 6) - 1;
      let day = arrivalTime.substring(6, 8);
      let hour = arrivalTime.substring(8, 10);
      let minute = arrivalTime.substring(10, 12);
      arrivalTimestamp = Math.trunc(new Date(year, month, day, hour, minute).getTime() / 1000);
      console.log("arrival", arrivalTimestamp);
    } catch(e) {}

    this.setStatus("Initiating transaction... (please wait)");

    const { registerFlight } = this.appContract.methods;
    await registerFlight(flight, departureTimestamp, arrivalTimestamp, origAirport, destAirport).send({ from: this.currentUser });

    this.setStatus("Transaction complete!");
  },

  fetchFlights: async function() {
    this.appContract.getPastEvents('FlightRegistered', {fromBlock: 0, toBLock: 'latest'}, (err, events) => {
      if (!err) {   
        if (events.length == 0) {
          document.getElementById("flightList").innerHTML = "Not found";
          document.getElementById("flightSelect").innerHTML = "";
        } else {
          document.getElementById("flightList").innerHTML = "";
          document.getElementById("flightSelect").innerHTML = "";
          for (event of events) {
            //console.log(event);
            var itemNode = document.createElement("li");                 
            var textnode = document.createTextNode(event.returnValues.flight + " - " + event.returnValues.scheduledDepartureTime + " - " + event.returnValues.airline);         
            itemNode.appendChild(textnode);                              
            document.getElementById("flightList").appendChild(itemNode);     

            var option = document.createElement("option");                 
            option.text = event.returnValues.flight + " - " + event.returnValues.scheduledDepartureTime + " - " + event.returnValues.airline;
            document.getElementById("flightSelect").add(option); 
          }  
        }
      }
    });
  },

  buyInsurance: async function() {
    const insurancePrice = document.getElementById("insurancePrice").value;
    let amount = web3.toWei(insurancePrice, "ether");
    console.log("Amount in wei:", amount);
    const flightSelect = document.getElementById("flightSelect");
    let flightInfo = flightSelect.options[flightSelect.selectedIndex].value;
    let flightInfoArray = flightInfo.split("-").map(item => item.trim()); // [flight, scheduledDepartureTime, airline]
    console.log("flightInfoArray", flightInfoArray);
    this.setStatus("Initiating transaction... (please wait)");

    const { buyInsurance } = this.appContract.methods;
    await buyInsurance(flightInfoArray[2], flightInfoArray[0], flightInfoArray[1]).send({ from: this.currentUser, value: amount });

    this.setStatus("Transaction complete!");
  },

  fetchInsurances: function () {
    this.dataContract.getPastEvents('InsuranceBought', {filter: {passenger: this.currentUser}, fromBlock: 0, toBLock: 'latest'}, (err, events) => {
      if (!err) {   
        if (events.length == 0) {
          document.getElementById("insuranceList").innerHTML = "Not found";
        } else {
          document.getElementById("insuranceList").innerHTML = "";
          for (event of events) {
            //console.log(event);
            try {
              let itemNode = document.createElement("li");                 
              let priceEth = web3.fromWei(BigNumber(event.returnValues.price).toNumber(), "ether");
              let textnode = document.createTextNode(event.returnValues.passenger + " - " + event.returnValues.flight + " - " + priceEth + " ETH");         
              itemNode.appendChild(textnode);                              
              document.getElementById("insuranceList").appendChild(itemNode);     
            } catch(err) {
              console.log(err);
            }
          }
        }
      }
    });
  },

  requestFlightStatus: async function() {
    const flightSelect = document.getElementById("flightSelect");
    let flightInfo = flightSelect.options[flightSelect.selectedIndex].value;
    let flightInfoArray = flightInfo.split("-").map(item => item.trim()); // [flight, scheduledDepartureTime, airline]
    console.log("flightInfoArray", flightInfoArray);
    this.setStatus("Initiating transaction... (please wait)");

    const { fetchFlightStatus } = this.appContract.methods;
    await fetchFlightStatus(flightInfoArray[2], flightInfoArray[0], flightInfoArray[1]).send({ from: this.currentUser });

    this.setStatus("Transaction complete!");
  },

  getFlightStatusInfo: async function () {
    const flightSelect = document.getElementById("flightSelect");
    let flightInfo = flightSelect.options[flightSelect.selectedIndex].value;
    let flightInfoArray = flightInfo.split("-").map(item => item.trim()); // [flight, scheduledDepartureTime, airline]
    const { getFlightStatusInfo } = this.appContract.methods;
    let { statusCode, updateTimestamp } = await getFlightStatusInfo(flightInfoArray[2], flightInfoArray[0], flightInfoArray[1]).call();
    let status = BigNumber(statusCode).toNumber();
    console.log("statusCode:", status, "updateTimestamp:", BigNumber(updateTimestamp).toNumber());
    let lastUpdate = new Date(BigNumber(updateTimestamp).toNumber() * 1000);
    const STATUS_CODE_UNKNOWN = 0;
    const STATUS_CODE_ON_TIME = 10;
    const STATUS_CODE_LATE_AIRLINE = 20;
    const STATUS_CODE_LATE_WEATHER = 30;
    const STATUS_CODE_LATE_TECHNICAL = 40;
    const STATUS_CODE_LATE_OTHER = 50;
    let statusDescription = "UNKNOWN";
    switch(status) {
      case STATUS_CODE_UNKNOWN: statusDescription = "UNKNOWN"; break;
      case STATUS_CODE_ON_TIME: statusDescription = "ON TIME"; break;
      case STATUS_CODE_LATE_AIRLINE: statusDescription = "LATE (AIRLINE)"; break;
      case STATUS_CODE_LATE_WEATHER: statusDescription = "LATE (WEATHER)"; break;
      case STATUS_CODE_LATE_TECHNICAL: statusDescription = "LATE (TECHNICAL)"; break;
      case STATUS_CODE_LATE_OTHER: statusDescription = "LATE (OTHER)"; break;
    }
    const flightStatusElement = document.getElementById("flightStatus");
    flightStatusElement.value = statusDescription;
    const lastUpdateElement = document.getElementById("lastUpdate");
    lastUpdateElement.innerHTML = "Last update: " + lastUpdate.toString();
  },

  claimCompensation: async function() {
    const flightSelect = document.getElementById("flightSelect");
    let flightInfo = flightSelect.options[flightSelect.selectedIndex].value;
    let flightInfoArray = flightInfo.split("-").map(item => item.trim()); // [flight, scheduledDepartureTime, airline]
    this.setStatus("Initiating transaction... (please wait)");

    const { claimCompensation } = this.appContract.methods;
    await claimCompensation(flightInfoArray[2], flightInfoArray[0], flightInfoArray[1]).send({from: this.currentUser});

    this.setStatus("Transaction complete!");
  },

  checkCredits: async function() {
    const { getAmountToBeReceived } = this.appContract.methods;
    const creditsAmount = await getAmountToBeReceived().call({from: this.currentUser});
    console.log("creditsAmount:", BigNumber(creditsAmount).toNumber());
    let creditsElement = document.getElementById("credits");
    creditsElement.value = web3.fromWei(BigNumber(creditsAmount).toNumber(), "ether") + " ETH";
  },

  withdrawCredits: async function() {
    this.setStatus("Initiating transaction... (please wait)");

    const { withdrawCompensation } = this.appContract.methods;
    await withdrawCompensation().send({ from: this.currentUser });

    this.setStatus("Transaction complete!");
  },

  setStatus: function(message) {
    const status = document.getElementById("status");
    status.innerHTML = message;
  },
};

window.App = App;

window.addEventListener("load", function() {
  if (window.ethereum) {
    // use MetaMask's provider
    App.web3 = new Web3(window.ethereum);
    window.ethereum.enable(); // get permission to access accounts
  } else {
    console.warn(
      "No web3 detected. Falling back to http://127.0.0.1:8545. You should remove this fallback when you deploy live",
    );
    // fallback - use your fallback strategy (local node / hosted node + in-dapp id mgmt / fail)
    App.web3 = new Web3(
      new Web3.providers.HttpProvider("http://127.0.0.1:8545"),
    );
  }

  App.start();
});

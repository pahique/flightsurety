pragma solidity >=0.5.0 <0.6.0;

// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {

    using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Flight status codees
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    uint256 private constant AIRLINES_THRESHOLD = 4;
    uint256 public constant MAX_INSURANCE_COST = 1 ether;
    uint256 public constant INSURANCE_RETURN_PERCENTAGE = 150;
    uint256 public minimumFunds = 10 ether; 

    address public contractOwner;          // Account used to deploy contract

    struct Flight {
        bool isRegistered;
        uint8 statusCode;
        uint256 updatedTimestamp;
        uint256 scheduledDepartureTime; 
        uint256 scheduledArrivalTime;       
        address airline;
        string departureAirport;
        string arrivalAirport;
    }

    mapping(bytes32 => Flight) private flights;

    FlightSuretyData internal flightSuretyData;

    mapping(address => mapping(address => bool)) private airlineVoters;
    mapping(address => uint256) private airlineVotesCount;

    event FlightRegistered(
        address indexed airline, 
        string indexed indexedFlight, 
        string flight, 
        uint256 scheduledDepartureTime, 
        uint256 scheduledArrivalTime, 
        string departureAirport, 
        string arrivalAirport
    );

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() {
         // Modify to call data contract's status
        require(isOperational(), "Contract is currently not operational");  
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner() {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
    * @dev Contract constructor
    *
    */
    constructor(address payable dataContract) public {
        contractOwner = msg.sender;
        flightSuretyData = FlightSuretyData(dataContract);
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    function isOperational() public view returns(bool) {
        return flightSuretyData.isOperational();  
    }

    function isAirline() public view returns(bool) {
        return flightSuretyData.isAirline(msg.sender);  
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

  
    /**
    * @dev Update the minimum funds required for an airline to operate the contract
    *      Can only be called by the contract owner
    */    
    function updateMinimumFunds(uint256 newAmount) external requireContractOwner requireIsOperational {
        minimumFunds = newAmount;
    }

    function incrementVotes(address airline, address caller) internal {
        if (airlineVoters[airline][caller] == false)  {   // Count vote only once per airline
            airlineVoters[airline][caller] = true;
            airlineVotesCount[airline] = airlineVotesCount[airline].add(1);
        }
    }

   /**
    * @dev Add an airline to the registration queue
    *
    */   
    function registerAirline(address account, string calldata name) external requireIsOperational returns(bool success, uint256 votes) {
        require(flightSuretyData.isAirline(msg.sender), "Caller must be a registered airline");
        require(flightSuretyData.isFunded(msg.sender), "Caller airline has not been funded yet");
        require(!flightSuretyData.isAirline(account), "Airline already registered");
        success = false;
        votes = 0;
        uint256 numAirlines = flightSuretyData.getNumAirlines();
        if (numAirlines < AIRLINES_THRESHOLD) {
            flightSuretyData.registerAirline(account, name);
            success = true;
        } else {
            uint256 numVotesNeededx100 = numAirlines.mul(100).div(2);  // multiply by 100 before division to avoid rounding
            incrementVotes(account, msg.sender);
            votes = airlineVotesCount[account];
            if (votes.mul(100) >= numVotesNeededx100) {   // multiply votes by 100 to adjust comparison
                flightSuretyData.registerAirline(account, name);
                success = true;
            }
        }
    }

   /**
    * @dev Update the name of the airline (optional)
    *
    */   
    function updateAirlineName(string calldata newName) external requireIsOperational {
        require(flightSuretyData.isAirline(msg.sender), "Caller must be a registered airline");
        require(bytes(newName).length == 0, "Name is required");
        flightSuretyData.updateAirlineName(msg.sender, newName);
    }

   /**
    * @dev Send funds to the contract, to be called by the airlines
    *
    */   
    function fund() external payable requireIsOperational {
        require(flightSuretyData.isAirline(msg.sender), "Caller must be a registered airline");
        require(msg.value >= minimumFunds, "Not enough funds");
        flightSuretyData.fund.value(msg.value)(msg.sender);
    }
 

   /**
    * @dev Register a future flight for insuring.
    *
    */  
    function registerFlight(string calldata flight, 
                    uint256 scheduledDepartureTime, 
                    uint256 scheduledArrivalTime,
                    string calldata departureAirport, 
                    string calldata arrivalAirport) external requireIsOperational {
        require(flightSuretyData.isAirline(msg.sender), "Only airlines can register flights");
        require(flightSuretyData.isFunded(msg.sender), "Caller airline has not been funded yet");
        require(scheduledDepartureTime > block.timestamp, "Flight should be in the future");
        require(scheduledArrivalTime > scheduledDepartureTime, "Arrival should be after departure");
        bytes32 key = getFlightKey(msg.sender, flight, scheduledDepartureTime);
        flights[key] = Flight(
            true, 
            STATUS_CODE_UNKNOWN, 
            block.timestamp, 
            scheduledDepartureTime, 
            scheduledArrivalTime, 
            msg.sender, 
            departureAirport, 
            arrivalAirport
        );
        emit FlightRegistered(msg.sender, flight, flight, scheduledDepartureTime, scheduledArrivalTime, departureAirport, arrivalAirport);
    }
    
   /**
    * @dev Called after oracle has updated flight status
    *
    */  
    function processFlightStatus(address airline, string memory flight, uint256 scheduledDepartureTime, uint8 statusCode) internal {
        bytes32 key = getFlightKey(airline, flight, scheduledDepartureTime);
        flights[key].updatedTimestamp = block.timestamp;
        flights[key].statusCode = statusCode;
    }

   /**
    * @dev Get the current status code and its update timestamp
    *
    */  
    function getFlightStatusInfo(address airline, string calldata flight, uint256 scheduledDepartureTime) external view returns(uint256 statusCode, uint256 updateTimestamp) {
        bytes32 key = getFlightKey(airline, flight, scheduledDepartureTime);
        return (flights[key].statusCode, flights[key].updatedTimestamp);
    }

   /**
    * @dev Generate a request for oracles to fetch flight information
    *
    */  
    function fetchFlightStatus(address airline, string calldata flight, uint256 scheduledDepartureTime) external requireIsOperational {
        uint8 index = getRandomIndex(msg.sender);
        // Generate a unique key for storing the request
        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, scheduledDepartureTime));
        oracleResponses[key] = ResponseInfo({requester: msg.sender, isOpen: true});
        emit OracleRequest(index, airline, flight, scheduledDepartureTime);
    } 

   /**
    * @dev Buy insurance for a flight
    *
    */  
    function buyInsurance(address airline, string calldata flight, uint256 scheduledDepartureTime) external payable requireIsOperational {
        require(!flightSuretyData.isAirline(msg.sender), "Airlines cannot buy flight insurance");
        require(block.timestamp < scheduledDepartureTime, "Insurance should be bought before the scheduled departure of the flight");
        require(msg.value <= MAX_INSURANCE_COST, "Value sent is above maximum allowed");
        bytes32 key = getFlightKey(airline, flight, scheduledDepartureTime);
        require(flights[key].isRegistered == true, "Flight not registered");
        flightSuretyData.buy.value(msg.value)(msg.sender, airline, flight, scheduledDepartureTime);
    }

   /**
    * @dev Claim compensation for a delayed flight. If it is legitimate claim, proper credit is added 
    *      to all insurees that bought insurance for that flight
    *
    */  
    function claimCompensation(address airline, string calldata flight, uint256 scheduledDepartureTime) external requireIsOperational {
        bytes32 key = getFlightKey(airline, flight, scheduledDepartureTime);
        require(flights[key].statusCode == STATUS_CODE_LATE_AIRLINE, "Status of the flight does not fit the requirements for compensation");
        require(block.timestamp > flights[key].scheduledArrivalTime, "Claim not allowed yet, flight may still get on schedule");
        require(flights[key].updatedTimestamp > flights[key].scheduledArrivalTime, "Claim not allowed yet, flight status not up to date");
        flightSuretyData.creditInsurees(INSURANCE_RETURN_PERCENTAGE, airline, flight, scheduledDepartureTime);
    }

   /**
    * @dev Allow the insuree to withdraw the credits
    *
    */  
    function withdrawCompensation() external requireIsOperational {
        require(flightSuretyData.getAmountToBeReceived(msg.sender) > 0, "No compensation to be received");
        flightSuretyData.pay(msg.sender);
    }

   /**
    * @dev Get the amount paid by the insuree as insurance for a flight
    *
    */  
    function getAmountPaidByInsuree(address airline, string calldata flight, uint256 scheduledDepartureTime) external view returns(uint256) {
        bytes32 key = getFlightKey(airline, flight, scheduledDepartureTime);
        require(flights[key].isRegistered == true, "Flight not registered");
        return flightSuretyData.getAmountPaidByInsuree(msg.sender, airline, flight, scheduledDepartureTime);
    }

   /**
    * @dev Show the credits available for the insuree (caller)
    *
    */  
    function getAmountToBeReceived() external view returns(uint256) {
        return flightSuretyData.getAmountToBeReceived(msg.sender);
    }

// region ORACLE MANAGEMENT

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;    

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 3;


    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;        
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester;                              // Account that requested status
        bool isOpen;                                    // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses;          // Mapping key is the status code reported
                                                        // This lets us group responses and identify
                                                        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, flight, scheduledDepartureTime)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(address airline, string flight, uint256 scheduledDepartureTime, uint8 status);

    event OracleReport(address airline, string flight, uint256 scheduledDepartureTime, uint8 status);

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(uint8 index, address airline, string flight, uint256 scheduledDepartureTime);
    event OracleRegistered(address account, uint8[3] indexes);


    // Register an oracle with the contract
    function registerOracle() external payable {
        require(!oracles[msg.sender].isRegistered, "Oracle already registered");
        // Require registration fee
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");

        uint8[3] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({ isRegistered: true, indexes: indexes });
        emit OracleRegistered(msg.sender, indexes);
    }

    function getMyIndexes() view external returns(uint8[3] memory) {
        require(oracles[msg.sender].isRegistered, "Not registered as an oracle");
        return oracles[msg.sender].indexes;
    }

    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse(uint8 index, address airline, string calldata flight, uint256 scheduledDepartureTime, uint8 statusCode) external {
        require((oracles[msg.sender].indexes[0] == index) 
                || (oracles[msg.sender].indexes[1] == index) 
                || (oracles[msg.sender].indexes[2] == index), "Index does not match oracle request");


        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, scheduledDepartureTime)); 
        require(oracleResponses[key].isOpen, "Flight or scheduled departure time do not match oracle request");

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(airline, flight, scheduledDepartureTime, statusCode);
        if (oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES) {

            emit FlightStatusInfo(airline, flight, scheduledDepartureTime, statusCode);

            // Handle flight status as appropriate
            processFlightStatus(airline, flight, scheduledDepartureTime, statusCode);
        }
    }


    function getFlightKey(address airline, string memory flight, uint256 scheduledDepartureTime) pure internal returns(bytes32) {
        return keccak256(abi.encodePacked(airline, flight, scheduledDepartureTime));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes(address account) internal returns(uint8[3] memory) {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);
        
        indexes[1] = indexes[0];
        while(indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex(address account) internal returns (uint8) {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - nonce++), account))) % maxValue);

        if (nonce > 250) {
            nonce = 0;  // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }

// endregion
}   

// Interface to the data contract FlightSuretyData.sol
interface FlightSuretyData {
    function isOperational() external view returns(bool);
    function registerAirline(address airline, string calldata name) external;
    function getNumAirlines() external view returns(uint256);
    function isAirline(address account) external view returns(bool);
    function updateAirlineName(address airline, string calldata newName) external;
    function fund(address airline) external payable;
    function isFunded(address airline) external view returns(bool);
    function getCurrentFunds(address airline) external view returns(uint256);
    function buy(address payable byer, address airline, string calldata flight, uint256 scheduledDepartureTime) external payable;
    function getAmountPaidByInsuree(address payable insuree, address airline, string calldata flight, uint256 scheduledDepartureTime) external view returns(uint256 amount);    
    function creditInsurees(uint256 percentage, address airline, string calldata flight, uint256 scheduledDepartureTime) external;
    function getAmountToBeReceived(address payable insuree) external view returns(uint256 amount);
    function pay(address payable insuree) external;
}
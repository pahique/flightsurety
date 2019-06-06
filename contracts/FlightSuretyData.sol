pragma solidity >=0.5.0 <0.6.0;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {

    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false
    mapping(address => bool) private authorizedCallers;                 // Addresses that can access this contract

    struct Airline {
        string name;
        address account;
        bool isRegistered;
        bool isFunded;
        uint256 funds;
    }

    mapping(address => Airline) private airlines;  
    uint256 internal countAirlines = 0;

    uint256 public minimumFunds = 10 ether;

    struct FlightInsurance {
        address payable insuree;
        uint256 amountPaid;
        address airline;
        string flight;
        uint256 timestamp;
    }

    mapping(bytes32 => FlightInsurance[]) private flightInsurances;
    mapping(address => uint256) private insureeToPayout;

    event InsuranceCreditAvailable(address indexed airline, string indexed flight, uint256 indexed timestamp);
    event InsuranceCreditAvailable(address indexed insuree, uint256 amount);
    event InsurancePaid(address indexed insuree, uint256 amount);


    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/


    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor(address firstAirline, string memory name) public {
        contractOwner = msg.sender;
        addAirline(firstAirline, name);
    }

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
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    modifier requireIsCallerAuthorized() {
        require(authorizedCallers[msg.sender] == true || msg.sender == contractOwner, "Caller is not authorized");
        _;
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner() {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }


    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */      
    function isOperational() external view returns(bool) {
        return operational;
    }


    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */    
    function setOperatingStatus(bool mode) external requireContractOwner {
        operational = mode;
    }

    function updateMinimumFunds(uint256 newAmount) external requireContractOwner {
        minimumFunds = newAmount;
    }

    function authorizeCaller(address contractAddress) external requireContractOwner {
        authorizedCallers[contractAddress] = true;
    }

    function deauthorizeContract(address contractAddress) external requireContractOwner {
        delete authorizedCallers[contractAddress];
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    */   
    function registerAirline(address account, string calldata name) external requireIsCallerAuthorized {
        addAirline(account, name);
    }

    function addAirline(address account, string memory name) private {
        countAirlines = countAirlines.add(1);
        airlines[account] = Airline(name, account, true, false, 0);
    }

    function isAirline(address account) public view returns(bool) {
        return airlines[account].isRegistered;
    }

    function getNumAirlines() external view returns(uint256) {
        return countAirlines;
    }

    function updateAirlineName(address airline, string calldata newName) external requireIsCallerAuthorized {
        airlines[airline].name = newName;
    }

   /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    */   
    function fund(address airline) external payable requireIsCallerAuthorized {
        incrementFunds(airline, msg.value);
    }

    function incrementFunds(address airline, uint256 value) private {
        airlines[airline].funds = airlines[airline].funds.add(value);
        if (airlines[airline].isFunded == false && airlines[airline].funds >= minimumFunds) {
            airlines[airline].isFunded = true;
        }
    }

    function isFunded(address airline) external view requireIsCallerAuthorized returns(bool) {
        return airlines[airline].isFunded;
    }

    function getCurrentFunds(address airline) external view requireIsCallerAuthorized returns(uint256) {
        return airlines[airline].funds;
    }

   /**
    * @dev Buy insurance for a flight
    */   
    function buy(address payable byer, address airline, string calldata flight, uint256 timestamp) external payable requireIsCallerAuthorized {
        bytes32 flightKey = getFlightKey(airline, flight, timestamp);
        flightInsurances[flightKey].push(FlightInsurance(byer, msg.value, airline, flight, timestamp));
    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees(uint256 percentage, address airline, string calldata flight, uint256 timestamp) external requireIsCallerAuthorized {
        bytes32 flightKey = getFlightKey(airline, flight, timestamp);
        for (uint i=0; i < flightInsurances[flightKey].length; i++) {
            address insuree = flightInsurances[flightKey][i].insuree;
            insureeToPayout[insuree] = flightInsurances[flightKey][i].amountPaid.mul(percentage).div(100);
            airlines[airline].funds = airlines[airline].funds.sub(insureeToPayout[insuree]);
            emit InsuranceCreditAvailable(insuree, insureeToPayout[insuree]);
        }
        emit InsuranceCreditAvailable(airline, flight, timestamp);
    }

    /**
     *  @dev Transfers eligible payout funds to insuree
    */
    function pay(address payable insuree) external requireIsCallerAuthorized {
        uint256 amount = insureeToPayout[insuree];
        delete(insureeToPayout[insuree]);
        insuree.transfer(amount);
        emit InsurancePaid(insuree, amount);
    }

    function getAmountPaidByInsuree(address payable insuree, 
                                    address airline, 
                                    string calldata flight, 
                                    uint256 timestamp) external view requireIsCallerAuthorized returns(uint256 amount) 
    {
        amount = 0;
        bytes32 flightKey = getFlightKey(airline, flight, timestamp);
        for (uint i=0; i < flightInsurances[flightKey].length; i++) {
            if (flightInsurances[flightKey][i].insuree == insuree) {
                amount = flightInsurances[flightKey][i].amountPaid;
                break;
            }
        }
    }

    function getAmountToBeReceived(address payable insuree) external view requireIsCallerAuthorized returns(uint256 amount) {
        return insureeToPayout[insuree];
    }

    function getFlightKey(address airline, string memory flight, uint256 timestamp) internal pure returns(bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
    * @dev Fallback function for funding smart contract.
    */
    function() external payable {
        require(msg.data.length == 0, "Message data should be empty");
        require(isAirline(msg.sender), "Caller must be a registered airline");
        incrementFunds(msg.sender, msg.value);
    }


}


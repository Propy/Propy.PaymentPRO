//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract PaymentPRO is AccessControl {

  event StrictPaymentReceived(bytes32 indexed paymentReferenceHash, address indexed sender, address indexed tokenAddress, uint256 tokenAmount, string paymentReference);
  event OpenPaymentReceived(bytes32 indexed paymentReferenceHash, address indexed sender, address indexed tokenAddress, uint256 tokenAmount, string paymentReference);
  event DefaultPaymentReceived(bytes32 indexed paymentReferenceHash, address indexed sender, address indexed tokenAddress, uint256 tokenAmount, string paymentReference);
  event TokenSwept(address indexed recipient, address indexed sweeper, address indexed tokenAddress, uint256 tokenAmount);
  event PaymentReferenceCreated(bytes32 indexed paymentReferenceHash, string paymentReference, StrictPayment referencedPaymentEntry);
  event PaymentReferenceDeleted(bytes32 indexed paymentReferenceHash, string paymentReference);
  event DefaultPaymentConfigAdjusted(address indexed tokenAddress, uint256 tokenAmount);
  event ApprovedPaymentToken(address indexed tokenAddress);
  event ApprovedSweepingToken(address indexed tokenAddress);
  event ApprovedTokenSweepRecipient(address indexed recipientAddress);
  event UnapprovedPaymentToken(address indexed tokenAddress);
  event UnapprovedSweepingToken(address indexed tokenAddress);
  event UnapprovedTokenSweepRecipient(address indexed recipientAddress);

  bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE"); // can manage approvedPaymentTokens / approvedSweepingTokens / approvedSweepRecipients ->
  bytes32 public constant SWEEPER_ROLE = keccak256("SWEEPER_ROLE"); // can sweep tokens -> 
  bytes32 public constant PAYMENT_MANAGER_ROLE = keccak256("PAYMENT_MANAGER_ROLE"); // can manage default payment configs / strict payments -> 

  struct DefaultPaymentConfig {
    address tokenAddress;
    uint256 tokenAmount;
  }

  struct StrictPayment {
    string paymentReference;
    bytes32 paymentReferenceHash;
    address tokenAddress;
    uint256 tokenAmount;
    address payer;
    bool enforcePayer;
    bool complete;
    bool exists;
  }

  mapping (bytes32 => StrictPayment) internal strictPayments;
  mapping (bytes32 => bool) internal referenceReservations;
  mapping (address => bool) internal approvedPaymentTokens;
  mapping (address => bool) internal approvedSweepingTokens;
  mapping (address => bool) internal approvedSweepRecipients;

  DefaultPaymentConfig public defaultPaymentConfig;

  constructor(
    address _roleAdmin
  ) {
    _setupRole(DEFAULT_ADMIN_ROLE, _roleAdmin);
    _setupRole(ADMIN_ROLE, _roleAdmin);
    _setupRole(SWEEPER_ROLE, _roleAdmin);
    _setupRole(PAYMENT_MANAGER_ROLE, _roleAdmin);
  }

  // ROLE MODIFIERS

  modifier onlyAdmin() {
    require(hasRole(ADMIN_ROLE, msg.sender), "NOT_ADMIN");
    _;
  }

  modifier onlySweeper() {
    require(hasRole(SWEEPER_ROLE, msg.sender), "NOT_SWEEPER");
    _;
  }

  modifier onlyPaymentManager() {
    require(hasRole(PAYMENT_MANAGER_ROLE, msg.sender), "NOT_PAYMENT_MANAGER");
    _;
  }

  // ADMIN FUNCTIONS

  function setApprovedPaymentToken(address _tokenAddress, bool _validity) external onlyAdmin {
    require(_tokenAddress != address(0), "NO_ZERO_ADDRESS");
    approvedPaymentTokens[_tokenAddress] = _validity;
    if(_validity) {
      emit ApprovedPaymentToken(_tokenAddress);
    } else {
      emit UnapprovedPaymentToken(_tokenAddress);
    }
  }

  function setApprovedSweepingToken(address _tokenAddress, bool _validity) external onlyAdmin {
    require(_tokenAddress != address(0), "NO_ZERO_ADDRESS");
    approvedSweepingTokens[_tokenAddress] = _validity;
    if(_validity) {
      emit ApprovedSweepingToken(_tokenAddress);
    } else {
      emit UnapprovedSweepingToken(_tokenAddress);
    }
  }

  function setApprovedSweepRecipient(address _recipientAddress, bool _validity) external onlyAdmin {
    require(_recipientAddress != address(0), "NO_ZERO_ADDRESS");
    approvedSweepRecipients[_recipientAddress] = _validity;
    if(_validity) {
      emit ApprovedTokenSweepRecipient(_recipientAddress);
    } else {
      emit UnapprovedTokenSweepRecipient(_recipientAddress);
    }
  }

  // SWEEPING / WITHDRAWAL FUNCTIONS

  function sweepTokenByFullBalance(
    address _tokenAddress,
    address _recipientAddress
  ) external onlySweeper {
    require(approvedPaymentTokens[_tokenAddress], "NOT_APPROVED_TOKEN_ADDRESS");
    require(approvedSweepRecipients[_recipientAddress], "NOT_APPROVED_RECIPIENT");
    IERC20 _tokenContract = IERC20(_tokenAddress);
    uint256 _tokenBalance = _tokenContract.balanceOf(address(this));
    _tokenContract.transferFrom(address(this), _recipientAddress, _tokenBalance);
    emit TokenSwept(_recipientAddress, msg.sender, _tokenAddress, _tokenBalance);
  }

  function sweepTokenByAmount(
    address _tokenAddress,
    address _recipientAddress,
    uint256 _tokenAmount
  ) external onlySweeper {
    require(approvedPaymentTokens[_tokenAddress], "NOT_APPROVED_TOKEN_ADDRESS");
    require(approvedSweepRecipients[_recipientAddress], "NOT_APPROVED_RECIPIENT");
    IERC20 _tokenContract = IERC20(_tokenAddress);
    uint256 _tokenBalance = _tokenContract.balanceOf(address(this));
    require(_tokenBalance >= _tokenAmount, "INSUFFICIENT_BALANCE");
    _tokenContract.transferFrom(address(this), _recipientAddress, _tokenAmount);
    emit TokenSwept(_recipientAddress, msg.sender, _tokenAddress, _tokenAmount);
  }

  // PAYMENT MANAGEMENT FUNCTIONS

  function createStrictPayment(
    string memory _reference,
    address _tokenAddress,
    uint256 _tokenAmount,
    address _payer,
    bool _enforcePayer
  ) external onlyPaymentManager {
    bytes32 _hashedReference = keccak256(abi.encodePacked(_reference));
    require(!referenceReservations[_hashedReference], "REFERENCE_ALREADY_RESERVED");
    referenceReservations[_hashedReference] = true;
    StrictPayment memory newStrictPaymentEntry = StrictPayment(
      _reference,
      _hashedReference,
      _tokenAddress,
      _tokenAmount,
      _payer,
      _enforcePayer,
      false,
      true
    );
    strictPayments[_hashedReference] = newStrictPaymentEntry;
    emit PaymentReferenceCreated(_hashedReference, _reference, newStrictPaymentEntry);
  }

  function deleteStrictPayment(
    string memory _reference
  ) external onlyPaymentManager {
    bytes32 _hashedReference = keccak256(abi.encodePacked(_reference));
    require(referenceReservations[_hashedReference], "REFERENCE_NOT_RESERVED");
    referenceReservations[_hashedReference] = false;
    strictPayments[_hashedReference].exists = false;
    emit PaymentReferenceDeleted(_hashedReference, _reference);
  }

  function setDefaultPaymentConfig(address _tokenAddress, uint256 _tokenAmount) external onlyPaymentManager {
    require(approvedPaymentTokens[_tokenAddress], "NOT_APPROVED_TOKEN_ADDRESS");
    require(_tokenAmount > 0, "NO_ZERO_AMOUNT");
    defaultPaymentConfig = DefaultPaymentConfig(_tokenAddress, _tokenAmount);
    emit DefaultPaymentConfigAdjusted(_tokenAddress, _tokenAmount);
  }

  // PAYMENT FUNCTIONS

  function makeOpenPayment(
    address _tokenAddress,
    uint256 _tokenAmount,
    string memory _reference
  ) external {
    require(approvedPaymentTokens[_tokenAddress], "NOT_APPROVED_TOKEN");
    require(_tokenAmount > 0, "NO_ZERO_AMOUNT");
    bytes32 _hashedReference = keccak256(abi.encodePacked(_reference));
    require(!referenceReservations[_hashedReference], "REFERENCE_RESERVED");
    IERC20(_tokenAddress).transferFrom(msg.sender, address(this), _tokenAmount);
    emit OpenPaymentReceived(_hashedReference, msg.sender, _tokenAddress, _tokenAmount, _reference);
  }

  function makeDefaultPayment(
    string memory _reference
  ) external {
    require(approvedPaymentTokens[defaultPaymentConfig.tokenAddress], "NOT_APPROVED_TOKEN_ADDRESS");
    require(defaultPaymentConfig.tokenAmount > 0, "NO_ZERO_AMOUNT");
    bytes32 _hashedReference = keccak256(abi.encodePacked(_reference));
    require(!referenceReservations[_hashedReference], "REFERENCE_RESERVED");
    IERC20(defaultPaymentConfig.tokenAddress).transferFrom(msg.sender, address(this), defaultPaymentConfig.tokenAmount);
    emit DefaultPaymentReceived(_hashedReference, msg.sender, defaultPaymentConfig.tokenAddress, defaultPaymentConfig.tokenAmount, _reference);
  }

  function makeStrictPayment(
    string memory _reference
  ) external {
    bytes32 _hashedReference = keccak256(abi.encodePacked(_reference));
    require(referenceReservations[_hashedReference], "REFERENCE_NOT_RESERVED");
    StrictPayment memory strictPayment = strictPayments[_hashedReference];
    require(approvedPaymentTokens[strictPayment.tokenAddress], "NOT_APPROVED_TOKEN");
    require(strictPayment.tokenAmount > 0, "NO_ZERO_AMOUNT");
    if(strictPayment.enforcePayer) {
      require(strictPayment.payer == msg.sender, "PAYER_MISMATCH");
    }
    strictPayment.complete = true;
    strictPayments[_hashedReference] = strictPayment;
    IERC20(strictPayment.tokenAddress).transferFrom(msg.sender, address(this), strictPayment.tokenAmount);
    emit StrictPaymentReceived(_hashedReference, msg.sender, strictPayment.tokenAddress, strictPayment.tokenAmount, _reference);
  }

  // VIEWS

  function viewStrictPaymentByStringReference(
    string memory _reference
  ) external view returns (StrictPayment memory) {
    bytes32 _hashedReference = keccak256(abi.encodePacked(_reference));
    return strictPayments[_hashedReference];
  }

  function viewStrictPaymentByHashedReference(
    bytes32 _hashedReference
  ) external view returns (StrictPayment memory) {
    return strictPayments[_hashedReference];
  }

  // MISC

  function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControl) returns (bool) {
    return super.supportsInterface(interfaceId);
  }

}
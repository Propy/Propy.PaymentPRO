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
  event PaymentReferenceCreated(bytes32 indexed paymentReferenceHash, string paymentReference, ReferencedPayment referencedPaymentEntry);
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
  bytes32 public constant PAYMENT_MANAGER_ROLE = keccak256("PAYMENT_MANAGER_ROLE"); // can manage default payment configs / enforced payment refs -> 

  struct DefaultPaymentConfig {
    address tokenAddress;
    uint256 tokenAmount;
  }

  struct ReferencedPayment {
    string paymentReference;
    bytes32 paymentReferenceHash;
    address tokenAddress;
    uint256 tokenAmount;
    address payer;
    bool enforcePayer;
    bool exists;
  }

  mapping (bytes32 => ReferencedPayment) internal enforcedReferencePayments;
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

  // PAYMENT MANAGEMENT FUNCTIONS

  function createEnforcedReferencePayment(
    string memory _reference,
    address _tokenAddress,
    uint256 _tokenAmount,
    address _payer,
    bool _enforcePayer
  ) external onlyPaymentManager {
    bytes32 _hashedReference = keccak256(abi.encodePacked(_reference));
    require(!referenceReservations[_hashedReference], "REFERENCE_ALREADY_RESERVED");
    referenceReservations[_hashedReference] = true;
    ReferencedPayment memory newReferencedPaymentEntry = ReferencedPayment(
      _reference,
      _hashedReference,
      _tokenAddress,
      _tokenAmount,
      _payer,
      _enforcePayer,
      true
    );
    enforcedReferencePayments[_hashedReference] = newReferencedPaymentEntry;
    emit PaymentReferenceCreated(_hashedReference, _reference, newReferencedPaymentEntry);
  }

  function deleteEnforcedReferencePayment(
    string memory _reference
  ) external onlyPaymentManager {
    bytes32 _hashedReference = keccak256(abi.encodePacked(_reference));
    require(referenceReservations[_hashedReference], "REFERENCE_NOT_RESERVED");
    referenceReservations[_hashedReference] = false;
    enforcedReferencePayments[_hashedReference].exists = false;
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

  function makeEnforcedPayment(
    string memory _reference
  ) external {
    bytes32 _hashedReference = keccak256(abi.encodePacked(_reference));
    require(referenceReservations[_hashedReference], "REFERENCE_NOT_RESERVED");
    ReferencedPayment memory referencedPayment = enforcedReferencePayments[_hashedReference];
    require(approvedPaymentTokens[referencedPayment.tokenAddress], "NOT_APPROVED_TOKEN");
    require(referencedPayment.tokenAmount > 0, "NO_ZERO_AMOUNT");
    if(referencedPayment.enforcePayer) {
      require(referencedPayment.payer == msg.sender, "PAYER_MISMATCH");
    }
    IERC20(referencedPayment.tokenAddress).transferFrom(msg.sender, address(this), referencedPayment.tokenAmount);
    emit StrictPaymentReceived(_hashedReference, msg.sender, referencedPayment.tokenAddress, referencedPayment.tokenAmount, _reference);
  }

  // VIEWS

  // MISC

  function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControl) returns (bool) {
    return super.supportsInterface(interfaceId);
  }

}
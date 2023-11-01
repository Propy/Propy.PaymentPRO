// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/IAccessControl.sol";

library StructLib {
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
}

interface IPaymentPRO is IAccessControl {

  // ADMIN FUNCTIONS
  function setApprovedPaymentToken(address _tokenAddress, bool _validity) external;
  function setApprovedSweepingToken(address _tokenAddress, bool _validity) external;
  function setApprovedSweepRecipient(address _recipientAddress, bool _validity) external;

  // PAYMENT MANAGEMENT FUNCTIONS
  function createStrictPayment(string memory _reference, address _tokenAddress, uint256 _tokenAmount, address _payer, bool _enforcePayer) external;
  function deleteStrictPayment(string memory _reference) external;
  function setDefaultPaymentConfig(address _tokenAddress, uint256 _tokenAmount) external;

  // SWEEPING / WITHDRAWAL FUNCTIONS
  function sweepTokenByFullBalance(address _tokenAddress, address _recipientAddress) external;
  function sweepTokenByAmount(address _tokenAddress, address _recipientAddress, uint256 _tokenAmount) external;

  // PAYMENT FUNCTIONS
  function makeOpenPayment(address _tokenAddress, uint256 _tokenAmount, string memory _reference) external;
  function makeDefaultPayment(string memory _reference) external;
  function makeStrictPayment(string memory _reference) external;

  // VIEWS
  function viewStrictPaymentByStringReference(string memory _reference) external view returns (StructLib.StrictPayment memory);
  function viewStrictPaymentByHashedReference(bytes32 _hashedReference) external view returns (StructLib.StrictPayment memory);

}
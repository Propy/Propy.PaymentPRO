# Propy.PaymentPRO

This repo implements the PaymentPRO.sol contract used by the Propy Transaction Platform (developed specifically to form part of the "claim your address" initiative), but constructed with the goal of being generic enough to fit into additional processes in the future. This contract handles token payments (with payment references to align with Propy's .NET backend). Approved tokens accumulated in this contract can be "swept" by an approved "sweeper" address to an approved recipient address. Only approved tokens may be used to make payments.

## Deployments

Sepolia: [`0x2671F689317F636baCB92594342e19Cdd163833e`](https://sepolia.etherscan.io/address/0x2671F689317F636baCB92594342e19Cdd163833e) (all roles assigned to `0x657C0eCF07f6e2B2D01c13F328B230F07b824a57`, role admin is `0x48608159077516aFE77A04ebC0448eC32E6670c1`, using [`0xa7423583D3b0B292E093aAC2f8900396EC110960`](https://sepolia.etherscan.io/address/0xa7423583D3b0B292E093aAC2f8900396EC110960) as testnet/mock version of PRO, balance of this mock token is held by `0x657C0eCF07f6e2B2D01c13F328B230F07b824a57`)

## ABI

The ABI for interacting with PaymentPRO can be found [here](https://github.com/Propy/Propy.PaymentPRO/blob/main/abi/PaymentPROABI.json).

The functionality of this repo is dependent upon 1 core contract:

## PaymentPRO.sol

- [PaymentPRO.sol](https://github.com/Propy/Propy.PaymentPRO/blob/main/contracts/PaymentPRO.sol) is a contract which handles referenced token payments

## Overview/interface of PaymentPRO.sol

Below we outline the interface of the contract to get an quick overview of the functionality included in it, the full interface can be found [here](https://github.com/Propy/Propy.PaymentPRO/blob/main/contracts/interfaces/IPaymentPRO.sol).

```solidity
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
```

## Role References

We use OpenZeppelin's [AccessControl](https://docs.openzeppelin.com/contracts/4.x/access-control) library to manage roles and permissions of addresses.

We have the following roles:

### **APPROVER_ROLE**:

Computation: `keccak256("APPROVER_ROLE")`

Result: `0x408a36151f841709116a4e8aca4e0202874f7f54687dcb863b1ea4672dc9d8cf`

Role: Usage of the `approvedPaymentTokens`, `approvedSweepingTokens` & `approvedSweepRecipients` functions

Description: This role is responsible for managing which tokens may be used to make payments, which tokens may be swept out of the contract & which address may receive tokens. It's important to manage this list carefully, since **approving a malicious token contract or recipient of swept funds can put funds in this contract at risk**. Therefore, we should carefully review the potential for issues before approving any additional payment tokens, sweeping tokens and/or recipients of sweeps.

### **SWEEPER_ROLE**:

Computation: `keccak256("SWEEPER_ROLE")`

Result: `0x8aef0597c0be1e090afba1f387ee99f604b5d975ccbed6215cdf146ffd5c49fc`

Role: Usage of the `sweepTokenByFullBalance` & `sweepTokenByAmount` functions

Description: This role is responsible for triggering "sweeps" of approved tokens accumulated in the PaymentPRO contract to approved recipients. An address with the sweeper role has the option to either sweep a portion of approved token funds to an approved recipient via the `sweepTokenByAmount` function, or the entire balance of the approved token to an approved sweeper via the `sweepTokenByFullBalance` function.

### **PAYMENT_MANAGER_ROLE**:

Computation: `keccak256("PAYMENT_MANAGER_ROLE")`

Result: `0xa624ddbc4fb31a463e13e6620d62eeaf14248f89110a7fda32b4048499c999a6`

Role: Usage of the `createStrictPayment`, `deleteStrictPayment` & `setDefaultPaymentConfig` functions

Description: This role is responsible for using an approved token address to set the default payment config via the `setDefaultPaymentConfig` function (the default payment config is used in the `makeDefaultPayment` function, a public function which can be called by anyone). This role also has the responsibility to manage any "strict" payments. Strict payment are payments which have a predefined config associated with a payment reference, strict payments entries enforce that a payment with a certain reference must satisfy additional criteria, primarily the approved token address and a specified approved token amount - with the option of enforcing that the defined payment can only be made by a specific payer address. Once a strict payment is created, it can be deleted using the `deleteStrictPayment` and then recreated using the original payment reference along with a new config (token address, token amount & payer address) if required.

Here we can see the form of a strict payment:

```solidity
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
```

## Security Considerations

- Whichever address is provided as the `_roleAdmin` during deployment will have the ability to manage roles (assigning & revoking).

- It's important to be highly selective of which tokens are approved as valid payment tokens, sweep tokens & sweep recipients. This is because an approved malicious contract/recipient can **try** to exploit the payment contract (e.g. via reentrancy or by behaving in unexpected ways). The contract has been written defensively to attempt to be resistant to these sorts of attempts but in any case we should avoid increasing the available attack surface by approving untrusted tokens / recipients.

## Commands

### Installation

`npm install`

### Testing

Tests can be run using `npx hardhat test`

### Coverage

Test coverage can be derived using `npx hardhat coverage`

Make sure to keep the tests for `PaymentPRO.sol` at 100% coverage for `% Stmts`, `% Branch`, `% Funcs` & `% Lines`:

![100% Coverage](https://vagabond-public-storage.s3.eu-west-2.amazonaws.com/PaymentPRO-test-coverage.png)

### Deployment

Deployment can be run using `npx hardhat run scripts/deployment.js --network goerli` (adjust network name to change destination of deployment)

### Gas Consumption Stats

![Avg USD Pricing (Ethereum L1 @ 20 gwei)](https://vagabond-public-storage.s3.eu-west-2.amazonaws.com/PaymentPRO-gas-estimates.png)

## Versions

This repo was produced using `node v16.14.2` & `npm v8.5.0`
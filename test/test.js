const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PaymentPRO", function () {

  let paymentPRO, mockPro;

  let DEFAULT_ADMIN_ROLE = "0x00";
  let APPROVER_ROLE = "0x408a36151f841709116a4e8aca4e0202874f7f54687dcb863b1ea4672dc9d8cf";
  let SWEEPER_ROLE = "0x8aef0597c0be1e090afba1f387ee99f604b5d975ccbed6215cdf146ffd5c49fc";
  let PAYMENT_MANAGER_ROLE = "0xa624ddbc4fb31a463e13e6620d62eeaf14248f89110a7fda32b4048499c999a6";

  let adminSigner,
    approverSigner,
    sweeperSigner,
    paymentManagerSigner,
    miscSigner,
    sweepReceiverSigner,
    mockThirdParty,
    payerSigner;

  let zeroAddress = "0x0000000000000000000000000000000000000000";

  beforeEach(async function () {
    [
      adminSigner,
      approverSigner,
      sweeperSigner,
      paymentManagerSigner,
      miscSigner,
      sweepReceiverSigner,
      mockThirdParty,
      payerSigner,
    ] = await hre.ethers.getSigners();

    // Deploy mock version of PRO tokens
    const MockPRO = await ethers.getContractFactory("MockPRO");
    // constructor(
    //     uint256 _initialSupply,
    //     uint8 _decimals,
    //     string memory name_,
    //     string memory symbol_
    // )
    mockPRO = await MockPRO.deploy(
      ethers.utils.parseUnits("100000", 8),
      8,
      "Propy",
      "PRO"
    );
    await mockPRO.deployed();

    const PaymentPRO = await ethers.getContractFactory("PaymentPRO");
    // constructor(
    //   address _roleAdmin,
    //   address _approvedPaymentToken,
    //   address _approvedSweepingToken,
    //   address _approvedTokenSweepRecipient
    // )
    paymentPRO = await PaymentPRO.deploy(
      adminSigner.address,
      mockPRO.address,
      mockPRO.address,
      sweepReceiverSigner.address
    );
    await paymentPRO.deployed();

    // Grant roles
    await paymentPRO.grantRole(APPROVER_ROLE, approverSigner.address);
    await paymentPRO.grantRole(SWEEPER_ROLE, sweeperSigner.address);
    await paymentPRO.grantRole(PAYMENT_MANAGER_ROLE, paymentManagerSigner.address);

  });
  context("state-modifying functions", async function () {
    context("function constructor", async function () {
      context("Failure cases", async function () {
        it("Should NOT allow a zero address to be used on roleAdmin", async function () {
          const PaymentPRO = await ethers.getContractFactory("PaymentPRO");
          await expect(
            PaymentPRO.deploy(
              zeroAddress,
              mockPRO.address,
              mockPRO.address,
              sweepReceiverSigner.address
            )
          ).to.be.revertedWith("NO_ZERO_ADDRESS")
        })
        it("Should NOT allow a zero address to be used on approvedPaymentToken", async function () {
          const PaymentPRO = await ethers.getContractFactory("PaymentPRO");
          await expect(
            PaymentPRO.deploy(
              adminSigner.address,
              zeroAddress,
              mockPRO.address,
              sweepReceiverSigner.address
            )
          ).to.be.revertedWith("NO_ZERO_ADDRESS")
        })
        it("Should NOT allow a zero address to be used on approvedSweepingToken", async function () {
          const PaymentPRO = await ethers.getContractFactory("PaymentPRO");
          await expect(
            PaymentPRO.deploy(
              adminSigner.address,
              mockPRO.address,
              zeroAddress,
              sweepReceiverSigner.address
            )
          ).to.be.revertedWith("NO_ZERO_ADDRESS")
        })
        it("Should NOT allow a zero address to be used on approvedTokenSweepRecipient", async function () {
          const PaymentPRO = await ethers.getContractFactory("PaymentPRO");
          await expect(
            PaymentPRO.deploy(
              adminSigner.address,
              mockPRO.address,
              mockPRO.address,
              zeroAddress
            )
          ).to.be.revertedWith("NO_ZERO_ADDRESS")
        })
      });
    })
    context("function grantRole", async function () {
      it("Should only be callable from the adminSigner address (DEFAULT_ADMIN_ROLE)", async function () {
        await expect(
          paymentPRO.connect(miscSigner).grantRole(APPROVER_ROLE, approverSigner.address)
        ).to.be.reverted;
        await expect(
          paymentPRO.connect(miscSigner).grantRole(SWEEPER_ROLE, sweeperSigner.address)
        ).to.be.reverted;
        await expect(
          paymentPRO.connect(miscSigner).grantRole(PAYMENT_MANAGER_ROLE, paymentManagerSigner.address)
        ).to.be.reverted;
      });
      it("Should enable the adminSigner to properly grant and revoke roles", async function () {
        await paymentPRO.revokeRole(APPROVER_ROLE, approverSigner.address);
        await paymentPRO.revokeRole(SWEEPER_ROLE, sweeperSigner.address);
        await paymentPRO.revokeRole(PAYMENT_MANAGER_ROLE, paymentManagerSigner.address);
        expect(
          await paymentPRO.hasRole(APPROVER_ROLE, approverSigner.address)
        ).to.equal(false);
        expect(
          await paymentPRO.hasRole(SWEEPER_ROLE, sweeperSigner.address)
        ).to.equal(false);
        expect(
          await paymentPRO.hasRole(PAYMENT_MANAGER_ROLE, paymentManagerSigner.address)
        ).to.equal(false);
        await paymentPRO.grantRole(APPROVER_ROLE, approverSigner.address);
        await paymentPRO.grantRole(SWEEPER_ROLE, sweeperSigner.address);
        await paymentPRO.grantRole(PAYMENT_MANAGER_ROLE, paymentManagerSigner.address);
        expect(
          await paymentPRO.hasRole(APPROVER_ROLE, approverSigner.address)
        ).to.equal(true);
        expect(
          await paymentPRO.hasRole(SWEEPER_ROLE, sweeperSigner.address)
        ).to.equal(true);
        expect(
          await paymentPRO.hasRole(PAYMENT_MANAGER_ROLE, paymentManagerSigner.address)
        ).to.equal(true);
      })
    });
    context("onlyApprover functions", async function () {
      context("function setApprovedPaymentToken", async function () {
        context("Failure cases", async function () {
          it("Should NOT be callable from a non-approver address", async function () {
            await expect(
              paymentPRO.connect(miscSigner).setApprovedPaymentToken(mockThirdParty.address, true)
            ).to.be.revertedWith("NOT_APPROVER")
          });
          it("Should NOT allow the zero address as a token address", async function () {
            await expect(
              paymentPRO.connect(approverSigner).setApprovedPaymentToken(zeroAddress, true)
            ).to.be.revertedWith("NO_ZERO_ADDRESS")
          });
          it("Should NOT allow a call which wouldn't result in a change", async function () {
            await expect(
              paymentPRO.connect(approverSigner).setApprovedPaymentToken(mockPRO.address, true)
            ).to.be.revertedWith("NO_CHANGE")
          });
        })
        context("Success cases", async function () {
          it("Should allow the approver address to approve a token address", async function () {
            await expect(
              paymentPRO.connect(approverSigner).setApprovedPaymentToken(mockThirdParty.address, true)
            ).to.emit(paymentPRO, "ApprovedPaymentToken")
          });
          it("Should allow the approver address to unapprove a token address", async function () {
            await expect(
              paymentPRO.connect(approverSigner).setApprovedPaymentToken(mockPRO.address, false)
            ).to.emit(paymentPRO, "UnapprovedPaymentToken")
          });
        })
      });
      context("function setApprovedSweepingToken", async function () {
        context("Failure cases", async function () {
          it("Should NOT be callable from a non-approver address", async function () {
            await expect(
              paymentPRO.connect(miscSigner).setApprovedSweepingToken(mockThirdParty.address, true)
            ).to.be.revertedWith("NOT_APPROVER")
          });
          it("Should NOT allow the zero address as a sweeping token address", async function () {
            await expect(
              paymentPRO.connect(approverSigner).setApprovedSweepingToken(zeroAddress, true)
            ).to.be.revertedWith("NO_ZERO_ADDRESS")
          });
          it("Should NOT allow a call which wouldn't result in a change", async function () {
            await expect(
              paymentPRO.connect(approverSigner).setApprovedSweepingToken(mockPRO.address, true)
            ).to.be.revertedWith("NO_CHANGE")
          });
        })
        context("Success cases", async function () {
          it("Should allow the approver address to approve a sweeping token address", async function () {
            await expect(
              paymentPRO.connect(approverSigner).setApprovedSweepingToken(mockThirdParty.address, true)
            ).to.emit(paymentPRO, "ApprovedSweepingToken")
          });
          it("Should allow the approver address to unapprove a sweeping token address", async function () {
            await expect(
              paymentPRO.connect(approverSigner).setApprovedSweepingToken(mockPRO.address, false)
            ).to.emit(paymentPRO, "UnapprovedSweepingToken")
          });
        })
      });
      context("function setApprovedSweepRecipient", async function () {
        context("Failure cases", async function () {
          it("Should NOT be callable from a non-approver address", async function () {
            await expect(
              paymentPRO.connect(miscSigner).setApprovedSweepRecipient(mockThirdParty.address, true)
            ).to.be.revertedWith("NOT_APPROVER")
          });
          it("Should NOT allow the zero address as a sweeping token address", async function () {
            await expect(
              paymentPRO.connect(approverSigner).setApprovedSweepRecipient(zeroAddress, true)
            ).to.be.revertedWith("NO_ZERO_ADDRESS")
          });
          it("Should NOT allow a call which wouldn't result in a change", async function () {
            await expect(
              paymentPRO.connect(approverSigner).setApprovedSweepRecipient(sweepReceiverSigner.address, true)
            ).to.be.revertedWith("NO_CHANGE")
          });
        })
        context("Success cases", async function () {
          it("Should allow the approver address to approve a sweeping token address", async function () {
            await expect(
              paymentPRO.connect(approverSigner).setApprovedSweepRecipient(mockThirdParty.address, true)
            ).to.emit(paymentPRO, "ApprovedTokenSweepRecipient")
          });
          it("Should allow the approver address to unapprove a sweeping token address", async function () {
            await expect(
              paymentPRO.connect(approverSigner).setApprovedSweepRecipient(sweepReceiverSigner.address, false)
            ).to.emit(paymentPRO, "UnapprovedTokenSweepRecipient")
          });
        })
      });
    })
    context("onlyPaymentManager functions", async function () {
      context("function createStrictPayment", async function () {
        context("Failure cases", async function () {
          it("Should NOT be callable from a non-paymentManager address", async function () {
            await expect(
              paymentPRO.connect(miscSigner).createStrictPayment(
                "PAYMENT_REFERENCE",
                mockPRO.address,
                ethers.utils.parseUnits("500", 8),
                payerSigner.address,
                true,
              )
            ).to.be.revertedWith("NOT_PAYMENT_MANAGER")
          });
          it("Should NOT allow an already-reserved payment reference to be used", async function () {
            paymentPRO.connect(paymentManagerSigner).createStrictPayment(
              "PAYMENT_REFERENCE",
              mockPRO.address,
              ethers.utils.parseUnits("500", 8),
              payerSigner.address,
              true,
            )
            await expect(
              paymentPRO.connect(paymentManagerSigner).createStrictPayment(
                "PAYMENT_REFERENCE",
                mockPRO.address,
                ethers.utils.parseUnits("500", 8),
                payerSigner.address,
                true,
              )
            ).to.be.revertedWith("REFERENCE_ALREADY_RESERVED")
          });
          it("Should NOT allow an non-approved payment token address to be used", async function () {
            await expect(
              paymentPRO.connect(paymentManagerSigner).createStrictPayment(
                "PAYMENT_REFERENCE",
                miscSigner.address,
                ethers.utils.parseUnits("500", 8),
                payerSigner.address,
                true,
              )
            ).to.be.revertedWith("NOT_APPROVED_TOKEN_ADDRESS")
          });
        })
        context("Success cases", async function () {
          it("Should allow a payment manager address to create a strict payment", async function () {
            await expect(
              paymentPRO.connect(paymentManagerSigner).createStrictPayment(
                "PAYMENT_REFERENCE",
                mockPRO.address,
                ethers.utils.parseUnits("500", 8),
                payerSigner.address,
                true,
              )
            ).to.emit(paymentPRO, "PaymentReferenceCreated")
          });
        })
      });
    })
  });
});

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PaymentPRO", function () {

  let paymentPRO, mockPro, mockUnapprovedERC20;

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

  let DEFAULT_RESERVED_REFERENCE = "DEFAULT_RESERVED_REFERENCE";
  let DEFAULT_RESERVED_REFERENCE_UNENFORCED_PAYER = "DEFAULT_RESERVED_REFERENCE_UNENFORCED_PAYER";

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

    // Deploy mock version of unapproved token
    const MockUnapprovedERC20 = await ethers.getContractFactory("MockPRO");
    // constructor(
    //     uint256 _initialSupply,
    //     uint8 _decimals,
    //     string memory name_,
    //     string memory symbol_
    // )
    mockUnapprovedERC20 = await MockUnapprovedERC20.deploy(
      ethers.utils.parseUnits("100000", 8),
      8,
      "UNAPPROVED",
      "UNAP"
    );
    await mockUnapprovedERC20.deployed();

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

    // Assign a default payment config
    await paymentPRO.connect(paymentManagerSigner).setDefaultPaymentConfig(mockPRO.address, ethers.utils.parseUnits("500", 8));

    // Make default reservation
    await paymentPRO.connect(paymentManagerSigner).createStrictPayment(
      DEFAULT_RESERVED_REFERENCE,
      mockPRO.address,
      ethers.utils.parseUnits("500", 8),
      payerSigner.address,
      true,
    )

    await paymentPRO.connect(paymentManagerSigner).createStrictPayment(
      DEFAULT_RESERVED_REFERENCE_UNENFORCED_PAYER,
      mockPRO.address,
      ethers.utils.parseUnits("500", 8),
      payerSigner.address,
      false,
    )

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
          it("Should NOT allow a zero amount to be used", async function () {
            await expect(
              paymentPRO.connect(paymentManagerSigner).createStrictPayment(
                "PAYMENT_REFERENCE",
                mockPRO.address,
                0,
                payerSigner.address,
                true,
              )
            ).to.be.revertedWith("NO_ZERO_AMOUNT")
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
      context("function deleteStrictPayment", async function () {
        context("Failure cases", async function () {
          it("Should NOT be callable from a non-paymentManager address", async function () {
            await expect(
              paymentPRO.connect(miscSigner).deleteStrictPayment(
                DEFAULT_RESERVED_REFERENCE
              )
            ).to.be.revertedWith("NOT_PAYMENT_MANAGER")
          });
          it("Should NOT be callable with an unreserved reference", async function () {
            await expect(
              paymentPRO.connect(paymentManagerSigner).deleteStrictPayment(
                "UNRESERVED_REFERENCE",
              )
            ).to.be.revertedWith("REFERENCE_NOT_RESERVED")
          });
          it("Should NOT be callable for a payment which is already complete", async function () {
            await mockPRO.transfer(payerSigner.address, ethers.utils.parseUnits("500", 8));
            await mockPRO.connect(payerSigner).approve(paymentPRO.address, ethers.utils.parseUnits("500", 8));
            await expect(
              paymentPRO.connect(payerSigner).makeStrictPayment(
                DEFAULT_RESERVED_REFERENCE
              )
            ).to.emit(paymentPRO, "StrictPaymentReceived")
            await expect(
              paymentPRO.connect(paymentManagerSigner).deleteStrictPayment(
                DEFAULT_RESERVED_REFERENCE,
              )
            ).to.be.revertedWith("PAYMENT_ALREADY_COMPLETE")
          });
        })
        context("Success cases", async function () {
          it("Should allow an incomplete strict payment with a valid reference to be deleted", async function () {
            await expect(
              paymentPRO.connect(paymentManagerSigner).deleteStrictPayment(
                DEFAULT_RESERVED_REFERENCE,
              )
            ).to.emit(paymentPRO, "PaymentReferenceDeleted")
          });
        })
      });
      context("function setDefaultPaymentConfig", async function () {
        context("Failure cases", async function () {
          it("Should NOT be callable from a non-paymentManager address", async function () {
            await expect(
              paymentPRO.connect(miscSigner).setDefaultPaymentConfig(
                mockPRO.address,
                ethers.utils.parseUnits("500", 8)
              )
            ).to.be.revertedWith("NOT_PAYMENT_MANAGER")
          });
          it("Should NOT be callable using an unapproved token address", async function () {
            await expect(
              paymentPRO.connect(paymentManagerSigner).setDefaultPaymentConfig(
                mockUnapprovedERC20.address,
                ethers.utils.parseUnits("500", 8)
              )
            ).to.be.revertedWith("NOT_APPROVED_TOKEN_ADDRESS")
          });
          it("Should NOT be callable using a zero amount", async function () {
            await expect(
              paymentPRO.connect(paymentManagerSigner).setDefaultPaymentConfig(
                mockPRO.address,
                0
              )
            ).to.be.revertedWith("NO_ZERO_AMOUNT")
          });
        })
        context("Success cases", async function () {
          it("Should allow a payment manager to adjust the default payment config with an approved token address & non-zero amount", async function () {
            await expect(
              paymentPRO.connect(paymentManagerSigner).setDefaultPaymentConfig(
                mockPRO.address,
                ethers.utils.parseUnits("1000", 8)
              )
            ).to.emit(paymentPRO, "DefaultPaymentConfigAdjusted")
          });
        })
      });
    });
    context("onlySweeper functions", async function () {
      context("function sweepTokenByFullBalance", async function () {
        context("Failure cases", async function () {
          it("Should NOT be callable from a non-sweeper address", async function () {
            await expect(
              paymentPRO.connect(miscSigner).sweepTokenByFullBalance(
                mockPRO.address,
                sweepReceiverSigner.address
              )
            ).to.be.revertedWith("NOT_SWEEPER")
          });
          it("Should NOT be callable with an unapproved sweepToken address", async function () {
            await expect(
              paymentPRO.connect(sweeperSigner).sweepTokenByFullBalance(
                miscSigner.address,
                sweepReceiverSigner.address
              )
            ).to.be.revertedWith("NOT_APPROVED_TOKEN_ADDRESS")
          });
          it("Should NOT be callable with an unapproved sweep recipient address", async function () {
            await expect(
              paymentPRO.connect(sweeperSigner).sweepTokenByFullBalance(
                mockPRO.address,
                miscSigner.address
              )
            ).to.be.revertedWith("NOT_APPROVED_RECIPIENT")
          });
          it("Should NOT be callable if the token balance is zero", async function () {
            await expect(
              paymentPRO.connect(sweeperSigner).sweepTokenByFullBalance(
                mockPRO.address,
                sweepReceiverSigner.address
              )
            ).to.be.revertedWith("NO_BALANCE")
          });
        })
        context("Success cases", async function () {
          it("Should allow the full balance of an approved token to be swept to an approved recipient", async function () {
            await mockPRO.transfer(paymentPRO.address, ethers.utils.parseUnits("500", 8));
            await expect(
              paymentPRO.connect(sweeperSigner).sweepTokenByFullBalance(
                mockPRO.address,
                sweepReceiverSigner.address
              )
            ).to.emit(paymentPRO, "TokenSwept")
          });
        })
      });
      context("function sweepTokenByAmount", async function () {
        context("Failure cases", async function () {
          it("Should NOT be callable from a non-sweeper address", async function () {
            await expect(
              paymentPRO.connect(miscSigner).sweepTokenByAmount(
                mockPRO.address,
                sweepReceiverSigner.address,
                ethers.utils.parseUnits("500", 8)
              )
            ).to.be.revertedWith("NOT_SWEEPER")
          });
          it("Should NOT be callable with an unapproved sweepToken address", async function () {
            await expect(
              paymentPRO.connect(sweeperSigner).sweepTokenByAmount(
                miscSigner.address,
                sweepReceiverSigner.address,
                ethers.utils.parseUnits("500", 8)
              )
            ).to.be.revertedWith("NOT_APPROVED_TOKEN_ADDRESS")
          });
          it("Should NOT be callable with an unapproved sweep recipient address", async function () {
            await expect(
              paymentPRO.connect(sweeperSigner).sweepTokenByAmount(
                mockPRO.address,
                miscSigner.address,
                ethers.utils.parseUnits("500", 8)
              )
            ).to.be.revertedWith("NOT_APPROVED_RECIPIENT")
          });
          it("Should NOT be callable if amount exceeds balance", async function () {
            await expect(
              paymentPRO.connect(sweeperSigner).sweepTokenByAmount(
                mockPRO.address,
                sweepReceiverSigner.address,
                ethers.utils.parseUnits("500", 8)
              )
            ).to.be.revertedWith("INSUFFICIENT_BALANCE")
          });
          it("Should NOT be callable if the amount is zero", async function () {
            await expect(
              paymentPRO.connect(sweeperSigner).sweepTokenByAmount(
                mockPRO.address,
                sweepReceiverSigner.address,
                0
              )
            ).to.be.revertedWith("NO_ZERO_AMOUNT")
          });
        })
        context("Success cases", async function () {
          it("Should allow the specified amount of an approved token to be swept to an approved recipient", async function () {
            await mockPRO.transfer(paymentPRO.address, ethers.utils.parseUnits("500", 8));
            await expect(
              paymentPRO.connect(sweeperSigner).sweepTokenByAmount(
                mockPRO.address,
                sweepReceiverSigner.address,
                ethers.utils.parseUnits("250", 8)
              )
            ).to.emit(paymentPRO, "TokenSwept")
            await expect(
              paymentPRO.connect(sweeperSigner).sweepTokenByAmount(
                mockPRO.address,
                sweepReceiverSigner.address,
                ethers.utils.parseUnits("250", 8)
              )
            ).to.emit(paymentPRO, "TokenSwept")
            await expect(
              paymentPRO.connect(sweeperSigner).sweepTokenByAmount(
                mockPRO.address,
                sweepReceiverSigner.address,
                ethers.utils.parseUnits("1", 8)
              )
            ).to.be.revertedWith("INSUFFICIENT_BALANCE")
          });
        })
      });
    })
    context("payment functions", async function () {
      context("function makeOpenPayment", async function () {
        context("Failure cases", async function () {
          it("Should NOT allow an open payment from an unapproved token address", async function () {
            await expect(
              paymentPRO.makeOpenPayment(
                mockUnapprovedERC20.address,
                ethers.utils.parseUnits("500", 8),
                "REFERENCE"
              )
            ).to.be.revertedWith("NOT_APPROVED_TOKEN")
          });
          it("Should NOT allow an open payment amount of zero", async function () {
            await expect(
              paymentPRO.makeOpenPayment(
                mockPRO.address,
                0,
                "REFERENCE"
              )
            ).to.be.revertedWith("NO_ZERO_AMOUNT")
          });
          it("Should NOT allow an open payment amount with a reserved reference", async function () {
            await expect(
              paymentPRO.makeOpenPayment(
                mockPRO.address,
                ethers.utils.parseUnits("500", 8),
                DEFAULT_RESERVED_REFERENCE
              )
            ).to.be.revertedWith("REFERENCE_RESERVED")
          });
        })
        context("Success cases", async function () {
          it("Should allow an open payment with an approved token address of a non-zero amount, with an unreserved reference", async function () {
            await mockPRO.approve(paymentPRO.address, ethers.utils.parseUnits("500", 8));
            await expect(
              paymentPRO.makeOpenPayment(
                mockPRO.address,
                ethers.utils.parseUnits("500", 8),
                "UNRESERVED_REFERENCE"
              )
            ).to.emit(paymentPRO, "OpenPaymentReceived")
          });
        })
      });
      context("function makeDefaultPayment", async function () {
        context("Failure cases", async function () {
          it("Should NOT allow a default payment if the default payment token address has been unapproved", async function () {
            await paymentPRO.connect(approverSigner).setApprovedPaymentToken(mockPRO.address, false);
            await expect(
              paymentPRO.makeDefaultPayment(
                "REFERENCE"
              )
            ).to.be.revertedWith("NOT_APPROVED_TOKEN")
          });
          it("Should NOT allow a default payment with a reserved reference", async function () {
            await mockPRO.approve(paymentPRO.address, ethers.utils.parseUnits("500", 8));
            await expect(
              paymentPRO.makeDefaultPayment(
                DEFAULT_RESERVED_REFERENCE
              )
            ).to.be.revertedWith("REFERENCE_RESERVED")
          });
        })
        context("Success cases", async function () {
          it("Should allow an open payment with an approved token address of a non-zero amount, with an unreserved reference", async function () {
            await mockPRO.approve(paymentPRO.address, ethers.utils.parseUnits("500", 8));
            await expect(
              paymentPRO.makeDefaultPayment(
                "UNRESERVED_REFERENCE"
              )
            ).to.emit(paymentPRO, "DefaultPaymentReceived")
          });
        })
      });
      context("function makeStrictPayment", async function () {
        context("Failure cases", async function () {
          it("Should NOT allow a strict payment to use an unreserved reference", async function () {
            await paymentPRO.connect(approverSigner).setApprovedPaymentToken(mockPRO.address, false);
            await expect(
              paymentPRO.makeStrictPayment(
                "REFERENCE"
              )
            ).to.be.revertedWith("REFERENCE_NOT_RESERVED")
          });
          it("Should NOT allow a strict payment to be made if the associated token address has been unapproved", async function () {
            await paymentPRO.connect(approverSigner).setApprovedPaymentToken(mockPRO.address, false);
            await expect(
              paymentPRO.makeStrictPayment(
                DEFAULT_RESERVED_REFERENCE
              )
            ).to.be.revertedWith("NOT_APPROVED_TOKEN")
          });
          it("Should NOT allow a strict payment to be made from a non-matched payer address when enforcePayer is set to true", async function () {
            await expect(
              paymentPRO.makeStrictPayment(
                DEFAULT_RESERVED_REFERENCE
              )
            ).to.be.revertedWith("PAYER_MISMATCH")
          });
          it("Should NOT allow a strict payment to be made if it has been deleted", async function () {
            await expect(
              paymentPRO.connect(paymentManagerSigner).deleteStrictPayment(
                DEFAULT_RESERVED_REFERENCE,
              )
            ).to.emit(paymentPRO, "PaymentReferenceDeleted")
            await mockPRO.transfer(payerSigner.address, ethers.utils.parseUnits("500", 8));
            await mockPRO.connect(payerSigner).approve(paymentPRO.address, ethers.utils.parseUnits("500", 8));
            await expect(
              paymentPRO.connect(payerSigner).makeStrictPayment(
                DEFAULT_RESERVED_REFERENCE
              )
            ).to.be.revertedWith("REFERENCE_NOT_RESERVED")
          });
        })
        context("Success cases", async function () {
          it("Should allow strict payment to be made from a matched payer address when enforcePayer is set to true", async function () {
            await mockPRO.transfer(payerSigner.address, ethers.utils.parseUnits("500", 8));
            await mockPRO.connect(payerSigner).approve(paymentPRO.address, ethers.utils.parseUnits("500", 8));
            await expect(
              paymentPRO.connect(payerSigner).makeStrictPayment(
                DEFAULT_RESERVED_REFERENCE
              )
            ).to.emit(paymentPRO, "StrictPaymentReceived")
          });
          it("Should allow strict payment to be made from an unmatched payer address when enforcePayer is set to false", async function () {
            await mockPRO.approve(paymentPRO.address, ethers.utils.parseUnits("500", 8));
            await expect(
              paymentPRO.makeStrictPayment(
                DEFAULT_RESERVED_REFERENCE_UNENFORCED_PAYER
              )
            ).to.emit(paymentPRO, "StrictPaymentReceived")
          });
        })
      });
    })
  });
  context("read-only functions", async function () {
    context("function viewStrictPaymentByStringReference", async function () {
      it("Should allow a strict payment to be queried by reserved reference", async function () {
        let strictPayment = await paymentPRO.viewStrictPaymentByStringReference(DEFAULT_RESERVED_REFERENCE);
        expect(
          strictPayment.paymentReference
        ).to.equal("DEFAULT_RESERVED_REFERENCE");
        expect(
          strictPayment.paymentReferenceHash
        ).to.equal("0x0269305198f72f2734645179826e1c3d574a643c27c862abcbee656fc664ca5d");
        expect(
          strictPayment.tokenAddress
        ).to.equal(mockPRO.address);
        expect(
          strictPayment.payer
        ).to.equal(payerSigner.address);
        expect(
          strictPayment.enforcePayer
        ).to.equal(true);
        expect(
          strictPayment.complete
        ).to.equal(false);
        expect(
          strictPayment.exists
        ).to.equal(true);
      });
    });
    context("function viewStrictPaymentByHashedReference", async function () {
      it("Should allow a strict payment to be queried by reserved reference", async function () {
        let strictPayment = await paymentPRO.viewStrictPaymentByHashedReference("0x0269305198f72f2734645179826e1c3d574a643c27c862abcbee656fc664ca5d");
        expect(
          strictPayment.paymentReference
        ).to.equal("DEFAULT_RESERVED_REFERENCE");
        expect(
          strictPayment.paymentReferenceHash
        ).to.equal("0x0269305198f72f2734645179826e1c3d574a643c27c862abcbee656fc664ca5d");
        expect(
          strictPayment.tokenAddress
        ).to.equal(mockPRO.address);
        expect(
          strictPayment.payer
        ).to.equal(payerSigner.address);
        expect(
          strictPayment.enforcePayer
        ).to.equal(true);
        expect(
          strictPayment.complete
        ).to.equal(false);
        expect(
          strictPayment.exists
        ).to.equal(true);
      });
    });
  });
});

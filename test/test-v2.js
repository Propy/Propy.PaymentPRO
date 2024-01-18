const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PaymentPRO", function () {

  let paymentPROClone, paymentPROFactoryV2, paymentPROClonableV2Reference, mockPro, mockUnapprovedERC20;

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

    const PaymentPROClonableV2 = await ethers.getContractFactory("PaymentPROClonableV2");
    paymentPROClonableV2Reference = await PaymentPROClonableV2.deploy();
    await paymentPROClonableV2Reference.deployed();

    await paymentPROClonableV2Reference.initializeContract(
      adminSigner.address,
      mockPRO.address,
      mockPRO.address,
      sweepReceiverSigner.address,
      ethers.utils.parseUnits("500", 8),
      ethers.utils.parseEther("0.0005"),
    );

    // Grant roles
    await paymentPROClonableV2Reference.grantRole(APPROVER_ROLE, approverSigner.address);
    await paymentPROClonableV2Reference.grantRole(SWEEPER_ROLE, sweeperSigner.address);
    await paymentPROClonableV2Reference.grantRole(PAYMENT_MANAGER_ROLE, paymentManagerSigner.address);

    await paymentPROClonableV2Reference.connect(paymentManagerSigner).createStrictPayment(
      DEFAULT_RESERVED_REFERENCE,
      mockPRO.address,
      ethers.utils.parseUnits("500", 8),
      ethers.utils.parseEther("0.0005"),
      payerSigner.address,
      true,
    )

    await paymentPROClonableV2Reference.connect(paymentManagerSigner).createStrictPayment(
      DEFAULT_RESERVED_REFERENCE_UNENFORCED_PAYER,
      mockPRO.address,
      ethers.utils.parseUnits("500", 8),
      ethers.utils.parseEther("0.0005"),
      payerSigner.address,
      false,
    )

    const PaymentPROFactoryV2 = await ethers.getContractFactory("PaymentPROFactoryV2");
    paymentPROFactoryV2 = await PaymentPROFactoryV2.deploy(
      paymentPROClonableV2Reference.address,
    );
    await paymentPROFactoryV2.deployed();

    let newPaymentPROCloneTx = await paymentPROFactoryV2.newPaymentPROClone(
			// address _referenceContract,
      // address _roleAdmin,
      // address _approvedPaymentToken,
      // address _approvedSweepingToken,
      // address _approvedTokenSweepRecipient,
      // uint256 _defaultTokenAmount
      // uint256 _ethAmount
			paymentPROClonableV2Reference.address,
			adminSigner.address,
      mockPRO.address,
      mockPRO.address,
      sweepReceiverSigner.address,
      ethers.utils.parseUnits("500", 8),
      ethers.utils.parseEther("0.0005"),
		);
		let	txWithNewEventResponse = await newPaymentPROCloneTx.wait();
		let event = txWithNewEventResponse.events.find((item) => item.event === 'NewPaymentPROClone');
		let cloneAddress = event?.args?.cloneAddress;
		paymentPROClone = await PaymentPROClonableV2.attach(cloneAddress);

    // Grant roles
    await paymentPROClone.grantRole(APPROVER_ROLE, approverSigner.address);
    await paymentPROClone.grantRole(SWEEPER_ROLE, sweeperSigner.address);
    await paymentPROClone.grantRole(PAYMENT_MANAGER_ROLE, paymentManagerSigner.address);

    // Make default reservation
    await paymentPROClone.connect(paymentManagerSigner).createStrictPayment(
      DEFAULT_RESERVED_REFERENCE,
      mockPRO.address,
      ethers.utils.parseUnits("500", 8),
      ethers.utils.parseEther("0.0005"),
      payerSigner.address,
      true,
    )

    await paymentPROClone.connect(paymentManagerSigner).createStrictPayment(
      DEFAULT_RESERVED_REFERENCE_UNENFORCED_PAYER,
      mockPRO.address,
      ethers.utils.parseUnits("500", 8),
      ethers.utils.parseEther("0.0005"),
      payerSigner.address,
      false,
    )

  });
  context("PaymentPROClonableV2.sol deployed via PaymentPROFactoryV2", async function () {
    context("state-modifying functions", async function () {
      context("function initializeContract", async function () {
        context("Failure cases", async function () {
          it("Should NOT allow the contract to be initialized more than once", async function () {
            const PaymentPROClonableV2 = await ethers.getContractFactory("PaymentPROClonableV2");
            const paymentPROClonable = await PaymentPROClonableV2.deploy();
            await paymentPROClonable.deployed();
            await paymentPROClonable.initializeContract(
              adminSigner.address,
              mockPRO.address,
              mockPRO.address,
              sweepReceiverSigner.address,
              ethers.utils.parseUnits("500", 8),
              ethers.utils.parseEther("0.0005"),
            );
            await expect(
              paymentPROClonable.initializeContract(
                adminSigner.address,
                mockPRO.address,
                mockPRO.address,
                sweepReceiverSigner.address,
                ethers.utils.parseUnits("500", 8),
                ethers.utils.parseEther("0.0005"),
              )
            ).to.be.revertedWith("ALREADY_INITIALIZED")
          });
          it("Should NOT allow a zero address to be used on roleAdmin", async function () {
            const PaymentPROClonableV2 = await ethers.getContractFactory("PaymentPROClonableV2");
            const paymentPROClonable = await PaymentPROClonableV2.deploy();
            await paymentPROClonable.deployed();
            await expect(
              paymentPROClonable.initializeContract(
                zeroAddress,
                mockPRO.address,
                mockPRO.address,
                sweepReceiverSigner.address,
                ethers.utils.parseUnits("500", 8),
                ethers.utils.parseEther("0.0005"),
              )
            ).to.be.revertedWith("NO_ZERO_ADDRESS")
          })
          it("Should NOT allow a zero address to be used on approvedPaymentToken", async function () {
            const PaymentPROClonableV2 = await ethers.getContractFactory("PaymentPROClonableV2");
            const paymentPROClonable = await PaymentPROClonableV2.deploy();
            await paymentPROClonable.deployed();
            await expect(
              paymentPROClonable.initializeContract(
                adminSigner.address,
                zeroAddress,
                mockPRO.address,
                sweepReceiverSigner.address,
                ethers.utils.parseUnits("500", 8),
                ethers.utils.parseEther("0.0005"),
              )
            ).to.be.revertedWith("NO_ZERO_ADDRESS")
          })
          it("Should NOT allow a zero address to be used on approvedSweepingToken", async function () {
            const PaymentPROClonableV2 = await ethers.getContractFactory("PaymentPROClonableV2");
            const paymentPROClonable = await PaymentPROClonableV2.deploy();
            await paymentPROClonable.deployed();
            await expect(
              paymentPROClonable.initializeContract(
                adminSigner.address,
                mockPRO.address,
                zeroAddress,
                sweepReceiverSigner.address,
                ethers.utils.parseUnits("500", 8),
                ethers.utils.parseEther("0.0005"),
              )
            ).to.be.revertedWith("NO_ZERO_ADDRESS")
          })
          it("Should NOT allow a zero address to be used on approvedTokenSweepRecipient", async function () {
            const PaymentPROClonableV2 = await ethers.getContractFactory("PaymentPROClonableV2");
            const paymentPROClonable = await PaymentPROClonableV2.deploy();
            await paymentPROClonable.deployed();
            await expect(
              paymentPROClonable.initializeContract(
                adminSigner.address,
                mockPRO.address,
                mockPRO.address,
                zeroAddress,
                ethers.utils.parseUnits("500", 8),
                ethers.utils.parseEther("0.0005"),
              )
            ).to.be.revertedWith("NO_ZERO_ADDRESS")
          })
          it("Should NOT allow a zero amount to be used on defaultTokenAmount", async function () {
            const PaymentPROClonableV2 = await ethers.getContractFactory("PaymentPROClonableV2");
            const paymentPROClonable = await PaymentPROClonableV2.deploy();
            await paymentPROClonable.deployed();
            await expect(
              paymentPROClonable.initializeContract(
                adminSigner.address,
                mockPRO.address,
                mockPRO.address,
                sweepReceiverSigner.address,
                0,
                ethers.utils.parseEther("0.0005"),
              )
            ).to.be.revertedWith("NO_ZERO_AMOUNT")
          })
        });
      })
      context("function grantRole", async function () {
        it("Should only be callable from the adminSigner address (DEFAULT_ADMIN_ROLE)", async function () {
          await expect(
            paymentPROClone.connect(miscSigner).grantRole(APPROVER_ROLE, approverSigner.address)
          ).to.be.reverted;
          await expect(
            paymentPROClone.connect(miscSigner).grantRole(SWEEPER_ROLE, sweeperSigner.address)
          ).to.be.reverted;
          await expect(
            paymentPROClone.connect(miscSigner).grantRole(PAYMENT_MANAGER_ROLE, paymentManagerSigner.address)
          ).to.be.reverted;
        });
        it("Should enable the adminSigner to properly grant and revoke roles", async function () {
          await paymentPROClone.revokeRole(APPROVER_ROLE, approverSigner.address);
          await paymentPROClone.revokeRole(SWEEPER_ROLE, sweeperSigner.address);
          await paymentPROClone.revokeRole(PAYMENT_MANAGER_ROLE, paymentManagerSigner.address);
          expect(
            await paymentPROClone.hasRole(APPROVER_ROLE, approverSigner.address)
          ).to.equal(false);
          expect(
            await paymentPROClone.hasRole(SWEEPER_ROLE, sweeperSigner.address)
          ).to.equal(false);
          expect(
            await paymentPROClone.hasRole(PAYMENT_MANAGER_ROLE, paymentManagerSigner.address)
          ).to.equal(false);
          await paymentPROClone.grantRole(APPROVER_ROLE, approverSigner.address);
          await paymentPROClone.grantRole(SWEEPER_ROLE, sweeperSigner.address);
          await paymentPROClone.grantRole(PAYMENT_MANAGER_ROLE, paymentManagerSigner.address);
          expect(
            await paymentPROClone.hasRole(APPROVER_ROLE, approverSigner.address)
          ).to.equal(true);
          expect(
            await paymentPROClone.hasRole(SWEEPER_ROLE, sweeperSigner.address)
          ).to.equal(true);
          expect(
            await paymentPROClone.hasRole(PAYMENT_MANAGER_ROLE, paymentManagerSigner.address)
          ).to.equal(true);
        })
      });
      context("onlyApprover functions", async function () {
        context("function setApprovedPaymentToken", async function () {
          context("Failure cases", async function () {
            it("Should NOT be callable from a non-approver address", async function () {
              await expect(
                paymentPROClone.connect(miscSigner).setApprovedPaymentToken(mockThirdParty.address, true)
              ).to.be.revertedWith("NOT_APPROVER")
            });
            it("Should NOT allow the zero address as a token address", async function () {
              await expect(
                paymentPROClone.connect(approverSigner).setApprovedPaymentToken(zeroAddress, true)
              ).to.be.revertedWith("NO_ZERO_ADDRESS")
            });
            it("Should NOT allow a call which wouldn't result in a change", async function () {
              await expect(
                paymentPROClone.connect(approverSigner).setApprovedPaymentToken(mockPRO.address, true)
              ).to.be.revertedWith("NO_CHANGE")
            });
          })
          context("Success cases", async function () {
            it("Should allow the approver address to approve a token address", async function () {
              await expect(
                paymentPROClone.connect(approverSigner).setApprovedPaymentToken(mockThirdParty.address, true)
              ).to.emit(paymentPROClone, "ApprovedPaymentToken")
            });
            it("Should allow the approver address to unapprove a token address", async function () {
              await expect(
                paymentPROClone.connect(approverSigner).setApprovedPaymentToken(mockPRO.address, false)
              ).to.emit(paymentPROClone, "UnapprovedPaymentToken")
            });
          })
        });
        context("function setApprovedSweepingToken", async function () {
          context("Failure cases", async function () {
            it("Should NOT be callable from a non-approver address", async function () {
              await expect(
                paymentPROClone.connect(miscSigner).setApprovedSweepingToken(mockThirdParty.address, true)
              ).to.be.revertedWith("NOT_APPROVER")
            });
            it("Should NOT allow the zero address as a sweeping token address", async function () {
              await expect(
                paymentPROClone.connect(approverSigner).setApprovedSweepingToken(zeroAddress, true)
              ).to.be.revertedWith("NO_ZERO_ADDRESS")
            });
            it("Should NOT allow a call which wouldn't result in a change", async function () {
              await expect(
                paymentPROClone.connect(approverSigner).setApprovedSweepingToken(mockPRO.address, true)
              ).to.be.revertedWith("NO_CHANGE")
            });
          })
          context("Success cases", async function () {
            it("Should allow the approver address to approve a sweeping token address", async function () {
              await expect(
                paymentPROClone.connect(approverSigner).setApprovedSweepingToken(mockThirdParty.address, true)
              ).to.emit(paymentPROClone, "ApprovedSweepingToken")
            });
            it("Should allow the approver address to unapprove a sweeping token address", async function () {
              await expect(
                paymentPROClone.connect(approverSigner).setApprovedSweepingToken(mockPRO.address, false)
              ).to.emit(paymentPROClone, "UnapprovedSweepingToken")
            });
          })
        });
        context("function setApprovedSweepRecipient", async function () {
          context("Failure cases", async function () {
            it("Should NOT be callable from a non-approver address", async function () {
              await expect(
                paymentPROClone.connect(miscSigner).setApprovedSweepRecipient(mockThirdParty.address, true)
              ).to.be.revertedWith("NOT_APPROVER")
            });
            it("Should NOT allow the zero address as a sweeping token address", async function () {
              await expect(
                paymentPROClone.connect(approverSigner).setApprovedSweepRecipient(zeroAddress, true)
              ).to.be.revertedWith("NO_ZERO_ADDRESS")
            });
            it("Should NOT allow a call which wouldn't result in a change", async function () {
              await expect(
                paymentPROClone.connect(approverSigner).setApprovedSweepRecipient(sweepReceiverSigner.address, true)
              ).to.be.revertedWith("NO_CHANGE")
            });
          })
          context("Success cases", async function () {
            it("Should allow the approver address to approve a sweeping token address", async function () {
              await expect(
                paymentPROClone.connect(approverSigner).setApprovedSweepRecipient(mockThirdParty.address, true)
              ).to.emit(paymentPROClone, "ApprovedTokenSweepRecipient")
            });
            it("Should allow the approver address to unapprove a sweeping token address", async function () {
              await expect(
                paymentPROClone.connect(approverSigner).setApprovedSweepRecipient(sweepReceiverSigner.address, false)
              ).to.emit(paymentPROClone, "UnapprovedTokenSweepRecipient")
            });
          })
        });
      })
      context("onlyPaymentManager functions", async function () {
        context("function createStrictPayment", async function () {
          context("Failure cases", async function () {
            it("Should NOT be callable from a non-paymentManager address", async function () {
              await expect(
                paymentPROClone.connect(miscSigner).createStrictPayment(
                  "PAYMENT_REFERENCE",
                  mockPRO.address,
                  ethers.utils.parseUnits("500", 8),
                  ethers.utils.parseEther("0.0005"),
                  payerSigner.address,
                  true,
                )
              ).to.be.revertedWith("NOT_PAYMENT_MANAGER")
            });
            it("Should NOT allow an already-reserved payment reference to be used", async function () {
              paymentPROClone.connect(paymentManagerSigner).createStrictPayment(
                "PAYMENT_REFERENCE",
                mockPRO.address,
                ethers.utils.parseUnits("500", 8),
                ethers.utils.parseEther("0.0005"),
                payerSigner.address,
                true,
              )
              await expect(
                paymentPROClone.connect(paymentManagerSigner).createStrictPayment(
                  "PAYMENT_REFERENCE",
                  mockPRO.address,
                  ethers.utils.parseUnits("500", 8),
                  ethers.utils.parseEther("0.0005"),
                  payerSigner.address,
                  true,
                )
              ).to.be.revertedWith("REFERENCE_ALREADY_RESERVED")
            });
            it("Should NOT allow an non-approved payment token address to be used", async function () {
              await expect(
                paymentPROClone.connect(paymentManagerSigner).createStrictPayment(
                  "PAYMENT_REFERENCE",
                  miscSigner.address,
                  ethers.utils.parseUnits("500", 8),
                  ethers.utils.parseEther("0.0005"),
                  payerSigner.address,
                  true,
                )
              ).to.be.revertedWith("NOT_APPROVED_TOKEN_ADDRESS")
            });
            it("Should NOT allow a zero amount to be used", async function () {
              await expect(
                paymentPROClone.connect(paymentManagerSigner).createStrictPayment(
                  "PAYMENT_REFERENCE",
                  mockPRO.address,
                  0,
                  ethers.utils.parseEther("0.0005"),
                  payerSigner.address,
                  true,
                )
              ).to.be.revertedWith("NO_ZERO_AMOUNT")
            });
          })
          context("Success cases", async function () {
            it("Should allow a payment manager address to create a strict payment", async function () {
              await expect(
                paymentPROClone.connect(paymentManagerSigner).createStrictPayment(
                  "PAYMENT_REFERENCE",
                  mockPRO.address,
                  ethers.utils.parseUnits("500", 8),
                  ethers.utils.parseEther("0.0005"),
                  payerSigner.address,
                  true,
                )
              ).to.emit(paymentPROClone, "PaymentReferenceCreated")
            });
          })
        });
        context("function deleteStrictPayment", async function () {
          context("Failure cases", async function () {
            it("Should NOT be callable from a non-paymentManager address", async function () {
              await expect(
                paymentPROClone.connect(miscSigner).deleteStrictPayment(
                  DEFAULT_RESERVED_REFERENCE
                )
              ).to.be.revertedWith("NOT_PAYMENT_MANAGER")
            });
            it("Should NOT be callable with an unreserved reference", async function () {
              await expect(
                paymentPROClone.connect(paymentManagerSigner).deleteStrictPayment(
                  "UNRESERVED_REFERENCE",
                )
              ).to.be.revertedWith("REFERENCE_NOT_RESERVED")
            });
            it("Should NOT be callable for a payment which is already complete", async function () {
              await mockPRO.transfer(payerSigner.address, ethers.utils.parseUnits("500", 8));
              await mockPRO.connect(payerSigner).approve(paymentPROClone.address, ethers.utils.parseUnits("500", 8));
              await expect(
                paymentPROClone.connect(payerSigner).makeStrictPayment(
                  DEFAULT_RESERVED_REFERENCE,
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.emit(paymentPROClone, "StrictPaymentReceived")
              await expect(
                paymentPROClone.connect(paymentManagerSigner).deleteStrictPayment(
                  DEFAULT_RESERVED_REFERENCE,
                )
              ).to.be.revertedWith("PAYMENT_ALREADY_COMPLETE")
            });
          })
          context("Success cases", async function () {
            it("Should allow an incomplete strict payment with a valid reference to be deleted", async function () {
              await expect(
                paymentPROClone.connect(paymentManagerSigner).deleteStrictPayment(
                  DEFAULT_RESERVED_REFERENCE,
                )
              ).to.emit(paymentPROClone, "PaymentReferenceDeleted")
            });
          })
        });
        context("function setDefaultPaymentConfig", async function () {
          context("Failure cases", async function () {
            it("Should NOT be callable from a non-paymentManager address", async function () {
              await expect(
                paymentPROClone.connect(miscSigner).setDefaultPaymentConfig(
                  mockPRO.address,
                  ethers.utils.parseUnits("500", 8),
                  ethers.utils.parseEther("0.0005"),
                )
              ).to.be.revertedWith("NOT_PAYMENT_MANAGER")
            });
            it("Should NOT be callable using an unapproved token address", async function () {
              await expect(
                paymentPROClone.connect(paymentManagerSigner).setDefaultPaymentConfig(
                  mockUnapprovedERC20.address,
                  ethers.utils.parseUnits("500", 8),
                  ethers.utils.parseEther("0.0005"),
                )
              ).to.be.revertedWith("NOT_APPROVED_TOKEN_ADDRESS")
            });
            it("Should NOT be callable using a zero amount", async function () {
              await expect(
                paymentPROClone.connect(paymentManagerSigner).setDefaultPaymentConfig(
                  mockPRO.address,
                  0,
                  ethers.utils.parseEther("0.0005"),
                )
              ).to.be.revertedWith("NO_ZERO_AMOUNT")
            });
          })
          context("Success cases", async function () {
            it("Should allow a payment manager to adjust the default payment config with an approved token address & non-zero amount", async function () {
              await expect(
                paymentPROClone.connect(paymentManagerSigner).setDefaultPaymentConfig(
                  mockPRO.address,
                  ethers.utils.parseUnits("1000", 8),
                  ethers.utils.parseEther("0.0006"),
                )
              ).to.emit(paymentPROClone, "DefaultPaymentConfigAdjusted")
            });
          })
        });
      });
      context("onlySweeper functions", async function () {
        context("function sweepTokenByFullBalance", async function () {
          context("Failure cases", async function () {
            it("Should NOT be callable from a non-sweeper address", async function () {
              await expect(
                paymentPROClone.connect(miscSigner).sweepTokenByFullBalance(
                  mockPRO.address,
                  sweepReceiverSigner.address
                )
              ).to.be.revertedWith("NOT_SWEEPER")
            });
            it("Should NOT be callable with an unapproved sweepToken address", async function () {
              await expect(
                paymentPROClone.connect(sweeperSigner).sweepTokenByFullBalance(
                  miscSigner.address,
                  sweepReceiverSigner.address
                )
              ).to.be.revertedWith("NOT_APPROVED_TOKEN_ADDRESS")
            });
            it("Should NOT be callable with an unapproved sweep recipient address", async function () {
              await expect(
                paymentPROClone.connect(sweeperSigner).sweepTokenByFullBalance(
                  mockPRO.address,
                  miscSigner.address
                )
              ).to.be.revertedWith("NOT_APPROVED_RECIPIENT")
            });
            it("Should NOT be callable if the token balance is zero", async function () {
              await expect(
                paymentPROClone.connect(sweeperSigner).sweepTokenByFullBalance(
                  mockPRO.address,
                  sweepReceiverSigner.address
                )
              ).to.be.revertedWith("NO_BALANCE")
            });
          })
          context("Success cases", async function () {
            it("Should allow the full balance of an approved token to be swept to an approved recipient", async function () {
              await mockPRO.transfer(paymentPROClone.address, ethers.utils.parseUnits("500", 8));
              await expect(
                paymentPROClone.connect(sweeperSigner).sweepTokenByFullBalance(
                  mockPRO.address,
                  sweepReceiverSigner.address
                )
              ).to.emit(paymentPROClone, "TokenSwept")
            });
          })
        });
        context("function sweepTokenByAmount", async function () {
          context("Failure cases", async function () {
            it("Should NOT be callable from a non-sweeper address", async function () {
              await expect(
                paymentPROClone.connect(miscSigner).sweepTokenByAmount(
                  mockPRO.address,
                  sweepReceiverSigner.address,
                  ethers.utils.parseUnits("500", 8)
                )
              ).to.be.revertedWith("NOT_SWEEPER")
            });
            it("Should NOT be callable with an unapproved sweepToken address", async function () {
              await expect(
                paymentPROClone.connect(sweeperSigner).sweepTokenByAmount(
                  miscSigner.address,
                  sweepReceiverSigner.address,
                  ethers.utils.parseUnits("500", 8)
                )
              ).to.be.revertedWith("NOT_APPROVED_TOKEN_ADDRESS")
            });
            it("Should NOT be callable with an unapproved sweep recipient address", async function () {
              await expect(
                paymentPROClone.connect(sweeperSigner).sweepTokenByAmount(
                  mockPRO.address,
                  miscSigner.address,
                  ethers.utils.parseUnits("500", 8)
                )
              ).to.be.revertedWith("NOT_APPROVED_RECIPIENT")
            });
            it("Should NOT be callable if amount exceeds balance", async function () {
              await expect(
                paymentPROClone.connect(sweeperSigner).sweepTokenByAmount(
                  mockPRO.address,
                  sweepReceiverSigner.address,
                  ethers.utils.parseUnits("500", 8)
                )
              ).to.be.revertedWith("INSUFFICIENT_BALANCE")
            });
            it("Should NOT be callable if the amount is zero", async function () {
              await expect(
                paymentPROClone.connect(sweeperSigner).sweepTokenByAmount(
                  mockPRO.address,
                  sweepReceiverSigner.address,
                  0
                )
              ).to.be.revertedWith("NO_ZERO_AMOUNT")
            });
          })
          context("Success cases", async function () {
            it("Should allow the specified amount of an approved token to be swept to an approved recipient", async function () {
              await mockPRO.transfer(paymentPROClone.address, ethers.utils.parseUnits("500", 8));
              await expect(
                paymentPROClone.connect(sweeperSigner).sweepTokenByAmount(
                  mockPRO.address,
                  sweepReceiverSigner.address,
                  ethers.utils.parseUnits("250", 8)
                )
              ).to.emit(paymentPROClone, "TokenSwept")
              await expect(
                paymentPROClone.connect(sweeperSigner).sweepTokenByAmount(
                  mockPRO.address,
                  sweepReceiverSigner.address,
                  ethers.utils.parseUnits("250", 8)
                )
              ).to.emit(paymentPROClone, "TokenSwept")
              await expect(
                paymentPROClone.connect(sweeperSigner).sweepTokenByAmount(
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
                paymentPROClone.makeOpenPayment(
                  mockUnapprovedERC20.address,
                  ethers.utils.parseUnits("500", 8),
                  ethers.utils.parseEther("0.0005"),
                  "REFERENCE",
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.be.revertedWith("NOT_APPROVED_TOKEN")
            });
            it("Should NOT allow an open payment amount of zero", async function () {
              await expect(
                paymentPROClone.makeOpenPayment(
                  mockPRO.address,
                  0,
                  ethers.utils.parseEther("0.0005"),
                  "REFERENCE",
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.be.revertedWith("NO_ZERO_AMOUNT")
            });
            it("Should NOT allow an open payment amount with a reserved reference", async function () {
              await expect(
                paymentPROClone.makeOpenPayment(
                  mockPRO.address,
                  ethers.utils.parseUnits("500", 8),
                  ethers.utils.parseEther("0.0005"),
                  DEFAULT_RESERVED_REFERENCE,
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.be.revertedWith("REFERENCE_RESERVED")
            });
          })
          context("Success cases", async function () {
            it("Should allow an open payment with an approved token address of a non-zero amount, with an unreserved reference", async function () {
              await mockPRO.approve(paymentPROClone.address, ethers.utils.parseUnits("500", 8));
              await expect(
                paymentPROClone.makeOpenPayment(
                  mockPRO.address,
                  ethers.utils.parseUnits("500", 8),
                  ethers.utils.parseEther("0.0005"),
                  "UNRESERVED_REFERENCE",
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.emit(paymentPROClone, "OpenPaymentReceived")
            });
          })
        });
        context("function makeDefaultPayment", async function () {
          context("Failure cases", async function () {
            it("Should NOT allow a default payment if the default payment token address has been unapproved", async function () {
              await paymentPROClone.connect(approverSigner).setApprovedPaymentToken(mockPRO.address, false);
              await expect(
                paymentPROClone.makeDefaultPayment(
                  "REFERENCE",
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.be.revertedWith("NOT_APPROVED_TOKEN")
            });
            it("Should NOT allow a default payment with a reserved reference", async function () {
              await mockPRO.approve(paymentPROClone.address, ethers.utils.parseUnits("500", 8));
              await expect(
                paymentPROClone.makeDefaultPayment(
                  DEFAULT_RESERVED_REFERENCE,
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.be.revertedWith("REFERENCE_RESERVED")
            });
            it("Should NOT allow a default payment reference to be reused", async function () {
              await mockPRO.approve(paymentPROClonableV2Reference.address, ethers.utils.parseUnits("500", 8));
              await expect(
                paymentPROClonableV2Reference.makeDefaultPayment(
                  "UNRESERVED_REFERENCE",
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.emit(paymentPROClonableV2Reference, "DefaultPaymentReceived")
              await mockPRO.approve(paymentPROClonableV2Reference.address, ethers.utils.parseUnits("500", 8));
              await expect(
                paymentPROClonableV2Reference.makeDefaultPayment(
                  "UNRESERVED_REFERENCE",
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.be.revertedWith("REFERENCE_USED")
            });
          })
          context("Success cases", async function () {
            it("Should allow an open payment with an approved token address of a non-zero amount, with an unreserved reference", async function () {
              await mockPRO.approve(paymentPROClone.address, ethers.utils.parseUnits("500", 8));
              await expect(
                paymentPROClone.makeDefaultPayment(
                  "UNRESERVED_REFERENCE",
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.emit(paymentPROClone, "DefaultPaymentReceived")
            });
          })
        });
        context("function makeStrictPayment", async function () {
          context("Failure cases", async function () {
            it("Should NOT allow a strict payment to use an unreserved reference", async function () {
              await paymentPROClone.connect(approverSigner).setApprovedPaymentToken(mockPRO.address, false);
              await expect(
                paymentPROClone.makeStrictPayment(
                  "REFERENCE",
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.be.revertedWith("REFERENCE_NOT_RESERVED")
            });
            it("Should NOT allow a strict payment to be made if the associated token address has been unapproved", async function () {
              await paymentPROClone.connect(approverSigner).setApprovedPaymentToken(mockPRO.address, false);
              await expect(
                paymentPROClone.makeStrictPayment(
                  DEFAULT_RESERVED_REFERENCE,
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.be.revertedWith("NOT_APPROVED_TOKEN")
            });
            it("Should NOT allow a strict payment to be made from a non-matched payer address when enforcePayer is set to true", async function () {
              await expect(
                paymentPROClone.makeStrictPayment(
                  DEFAULT_RESERVED_REFERENCE,
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.be.revertedWith("PAYER_MISMATCH")
            });
            it("Should NOT allow a strict payment to be made if it has been deleted", async function () {
              await expect(
                paymentPROClone.connect(paymentManagerSigner).deleteStrictPayment(
                  DEFAULT_RESERVED_REFERENCE,
                )
              ).to.emit(paymentPROClone, "PaymentReferenceDeleted")
              await mockPRO.transfer(payerSigner.address, ethers.utils.parseUnits("500", 8));
              await mockPRO.connect(payerSigner).approve(paymentPROClone.address, ethers.utils.parseUnits("500", 8));
              await expect(
                paymentPROClone.connect(payerSigner).makeStrictPayment(
                  DEFAULT_RESERVED_REFERENCE,
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.be.revertedWith("REFERENCE_NOT_RESERVED")
            });
            it("Should NOT allow a strict payment to be made if it has already been completed", async function () {
              await mockPRO.transfer(payerSigner.address, ethers.utils.parseUnits("500", 8));
              await mockPRO.connect(payerSigner).approve(paymentPROClone.address, ethers.utils.parseUnits("500", 8));
              await expect(
                paymentPROClone.connect(payerSigner).makeStrictPayment(
                  DEFAULT_RESERVED_REFERENCE,
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.emit(paymentPROClone, "StrictPaymentReceived");
              await mockPRO.transfer(payerSigner.address, ethers.utils.parseUnits("500", 8));
              await mockPRO.connect(payerSigner).approve(paymentPROClone.address, ethers.utils.parseUnits("500", 8));
              await expect(
                paymentPROClone.connect(payerSigner).makeStrictPayment(
                  DEFAULT_RESERVED_REFERENCE,
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.be.revertedWith("PAYMENT_ALREADY_COMPLETE")
            });
            it("Should NOT allow a strict payment to be made if the msg.value does not match the expected ETH value", async function () {
              await mockPRO.transfer(payerSigner.address, ethers.utils.parseUnits("500", 8));
              await mockPRO.connect(payerSigner).approve(paymentPROClone.address, ethers.utils.parseUnits("500", 8));
              await expect(
                paymentPROClone.connect(payerSigner).makeStrictPayment(
                  DEFAULT_RESERVED_REFERENCE,
                  {
                    value: ethers.utils.parseEther("0.0004")
                  }
                )
              ).to.be.revertedWith("INCORRECT_ETH_AMOUNT");
            });
          })
          context("Success cases", async function () {
            it("Should allow strict payment to be made from a matched payer address when enforcePayer is set to true", async function () {
              await mockPRO.transfer(payerSigner.address, ethers.utils.parseUnits("500", 8));
              await mockPRO.connect(payerSigner).approve(paymentPROClone.address, ethers.utils.parseUnits("500", 8));
              await expect(
                paymentPROClone.connect(payerSigner).makeStrictPayment(
                  DEFAULT_RESERVED_REFERENCE,
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.emit(paymentPROClone, "StrictPaymentReceived")
            });
            it("Should allow strict payment to be made from an unmatched payer address when enforcePayer is set to false", async function () {
              await mockPRO.approve(paymentPROClone.address, ethers.utils.parseUnits("500", 8));
              await expect(
                paymentPROClone.makeStrictPayment(
                  DEFAULT_RESERVED_REFERENCE_UNENFORCED_PAYER,
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.emit(paymentPROClone, "StrictPaymentReceived")
            });
          })
        });
      })
    });
    context("read-only functions", async function () {
      context("function viewStrictPaymentByStringReference", async function () {
        it("Should allow a strict payment to be queried by reserved reference", async function () {
          let strictPayment = await paymentPROClone.viewStrictPaymentByStringReference(DEFAULT_RESERVED_REFERENCE);
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
          let strictPayment = await paymentPROClone.viewStrictPaymentByHashedReference("0x0269305198f72f2734645179826e1c3d574a643c27c862abcbee656fc664ca5d");
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
  context("PaymentPROClonableV2.sol deployed directly", async function () {
    context("state-modifying functions", async function () {
      context("function initializeContract", async function () {
        context("Failure cases", async function () {
          it("Should NOT allow the contract to be initialized more than once", async function () {
            const PaymentPROClonableV2 = await ethers.getContractFactory("PaymentPROClonableV2");
            const paymentPROClonable = await PaymentPROClonableV2.deploy();
            await paymentPROClonable.deployed();
            await paymentPROClonable.initializeContract(
              adminSigner.address,
              mockPRO.address,
              mockPRO.address,
              sweepReceiverSigner.address,
              ethers.utils.parseUnits("500", 8),
              ethers.utils.parseEther("0.0005"),
            );
            await expect(
              paymentPROClonable.initializeContract(
                adminSigner.address,
                mockPRO.address,
                mockPRO.address,
                sweepReceiverSigner.address,
                ethers.utils.parseUnits("500", 8),
                ethers.utils.parseEther("0.0005"),
              )
            ).to.be.revertedWith("ALREADY_INITIALIZED")
          });
          it("Should NOT allow a zero address to be used on roleAdmin", async function () {
            const PaymentPROClonableV2 = await ethers.getContractFactory("PaymentPROClonableV2");
            const paymentPROClonable = await PaymentPROClonableV2.deploy();
            await paymentPROClonable.deployed();
            await expect(
              paymentPROClonable.initializeContract(
                zeroAddress,
                mockPRO.address,
                mockPRO.address,
                sweepReceiverSigner.address,
                ethers.utils.parseUnits("500", 8),
                ethers.utils.parseEther("0.0005"),
              )
            ).to.be.revertedWith("NO_ZERO_ADDRESS")
          })
          it("Should NOT allow a zero address to be used on approvedPaymentToken", async function () {
            const PaymentPROClonableV2 = await ethers.getContractFactory("PaymentPROClonableV2");
            const paymentPROClonable = await PaymentPROClonableV2.deploy();
            await paymentPROClonable.deployed();
            await expect(
              paymentPROClonable.initializeContract(
                adminSigner.address,
                zeroAddress,
                mockPRO.address,
                sweepReceiverSigner.address,
                ethers.utils.parseUnits("500", 8),
                ethers.utils.parseEther("0.0005"),
              )
            ).to.be.revertedWith("NO_ZERO_ADDRESS")
          })
          it("Should NOT allow a zero address to be used on approvedSweepingToken", async function () {
            const PaymentPROClonableV2 = await ethers.getContractFactory("PaymentPROClonableV2");
            const paymentPROClonable = await PaymentPROClonableV2.deploy();
            await paymentPROClonable.deployed();
            await expect(
              paymentPROClonable.initializeContract(
                adminSigner.address,
                mockPRO.address,
                zeroAddress,
                sweepReceiverSigner.address,
                ethers.utils.parseUnits("500", 8),
                ethers.utils.parseEther("0.0005"),
              )
            ).to.be.revertedWith("NO_ZERO_ADDRESS")
          })
          it("Should NOT allow a zero address to be used on approvedTokenSweepRecipient", async function () {
            const PaymentPROClonableV2 = await ethers.getContractFactory("PaymentPROClonableV2");
            const paymentPROClonable = await PaymentPROClonableV2.deploy();
            await paymentPROClonable.deployed();
            await expect(
              paymentPROClonable.initializeContract(
                adminSigner.address,
                mockPRO.address,
                mockPRO.address,
                zeroAddress,
                ethers.utils.parseUnits("500", 8),
                ethers.utils.parseEther("0.0005"),
              )
            ).to.be.revertedWith("NO_ZERO_ADDRESS")
          })
          it("Should NOT allow a zero amount to be used on defaultTokenAmount", async function () {
            const PaymentPROClonableV2 = await ethers.getContractFactory("PaymentPROClonableV2");
            const paymentPROClonable = await PaymentPROClonableV2.deploy();
            await paymentPROClonable.deployed();
            await expect(
              paymentPROClonable.initializeContract(
                adminSigner.address,
                mockPRO.address,
                mockPRO.address,
                sweepReceiverSigner.address,
                0,
                ethers.utils.parseEther("0.0005"),
              )
            ).to.be.revertedWith("NO_ZERO_AMOUNT")
          })
        });
      })
      context("function grantRole", async function () {
        it("Should only be callable from the adminSigner address (DEFAULT_ADMIN_ROLE)", async function () {
          await expect(
            paymentPROClonableV2Reference.connect(miscSigner).grantRole(APPROVER_ROLE, approverSigner.address)
          ).to.be.reverted;
          await expect(
            paymentPROClonableV2Reference.connect(miscSigner).grantRole(SWEEPER_ROLE, sweeperSigner.address)
          ).to.be.reverted;
          await expect(
            paymentPROClonableV2Reference.connect(miscSigner).grantRole(PAYMENT_MANAGER_ROLE, paymentManagerSigner.address)
          ).to.be.reverted;
        });
        it("Should enable the adminSigner to properly grant and revoke roles", async function () {
          await paymentPROClonableV2Reference.revokeRole(APPROVER_ROLE, approverSigner.address);
          await paymentPROClonableV2Reference.revokeRole(SWEEPER_ROLE, sweeperSigner.address);
          await paymentPROClonableV2Reference.revokeRole(PAYMENT_MANAGER_ROLE, paymentManagerSigner.address);
          expect(
            await paymentPROClonableV2Reference.hasRole(APPROVER_ROLE, approverSigner.address)
          ).to.equal(false);
          expect(
            await paymentPROClonableV2Reference.hasRole(SWEEPER_ROLE, sweeperSigner.address)
          ).to.equal(false);
          expect(
            await paymentPROClonableV2Reference.hasRole(PAYMENT_MANAGER_ROLE, paymentManagerSigner.address)
          ).to.equal(false);
          await paymentPROClonableV2Reference.grantRole(APPROVER_ROLE, approverSigner.address);
          await paymentPROClonableV2Reference.grantRole(SWEEPER_ROLE, sweeperSigner.address);
          await paymentPROClonableV2Reference.grantRole(PAYMENT_MANAGER_ROLE, paymentManagerSigner.address);
          expect(
            await paymentPROClonableV2Reference.hasRole(APPROVER_ROLE, approverSigner.address)
          ).to.equal(true);
          expect(
            await paymentPROClonableV2Reference.hasRole(SWEEPER_ROLE, sweeperSigner.address)
          ).to.equal(true);
          expect(
            await paymentPROClonableV2Reference.hasRole(PAYMENT_MANAGER_ROLE, paymentManagerSigner.address)
          ).to.equal(true);
        })
      });
      context("onlyApprover functions", async function () {
        context("function setApprovedPaymentToken", async function () {
          context("Failure cases", async function () {
            it("Should NOT be callable from a non-approver address", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(miscSigner).setApprovedPaymentToken(mockThirdParty.address, true)
              ).to.be.revertedWith("NOT_APPROVER")
            });
            it("Should NOT allow the zero address as a token address", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(approverSigner).setApprovedPaymentToken(zeroAddress, true)
              ).to.be.revertedWith("NO_ZERO_ADDRESS")
            });
            it("Should NOT allow a call which wouldn't result in a change", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(approverSigner).setApprovedPaymentToken(mockPRO.address, true)
              ).to.be.revertedWith("NO_CHANGE")
            });
          })
          context("Success cases", async function () {
            it("Should allow the approver address to approve a token address", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(approverSigner).setApprovedPaymentToken(mockThirdParty.address, true)
              ).to.emit(paymentPROClonableV2Reference, "ApprovedPaymentToken")
            });
            it("Should allow the approver address to unapprove a token address", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(approverSigner).setApprovedPaymentToken(mockPRO.address, false)
              ).to.emit(paymentPROClonableV2Reference, "UnapprovedPaymentToken")
            });
          })
        });
        context("function setApprovedSweepingToken", async function () {
          context("Failure cases", async function () {
            it("Should NOT be callable from a non-approver address", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(miscSigner).setApprovedSweepingToken(mockThirdParty.address, true)
              ).to.be.revertedWith("NOT_APPROVER")
            });
            it("Should NOT allow the zero address as a sweeping token address", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(approverSigner).setApprovedSweepingToken(zeroAddress, true)
              ).to.be.revertedWith("NO_ZERO_ADDRESS")
            });
            it("Should NOT allow a call which wouldn't result in a change", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(approverSigner).setApprovedSweepingToken(mockPRO.address, true)
              ).to.be.revertedWith("NO_CHANGE")
            });
          })
          context("Success cases", async function () {
            it("Should allow the approver address to approve a sweeping token address", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(approverSigner).setApprovedSweepingToken(mockThirdParty.address, true)
              ).to.emit(paymentPROClonableV2Reference, "ApprovedSweepingToken")
            });
            it("Should allow the approver address to unapprove a sweeping token address", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(approverSigner).setApprovedSweepingToken(mockPRO.address, false)
              ).to.emit(paymentPROClonableV2Reference, "UnapprovedSweepingToken")
            });
          })
        });
        context("function setApprovedSweepRecipient", async function () {
          context("Failure cases", async function () {
            it("Should NOT be callable from a non-approver address", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(miscSigner).setApprovedSweepRecipient(mockThirdParty.address, true)
              ).to.be.revertedWith("NOT_APPROVER")
            });
            it("Should NOT allow the zero address as a sweeping token address", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(approverSigner).setApprovedSweepRecipient(zeroAddress, true)
              ).to.be.revertedWith("NO_ZERO_ADDRESS")
            });
            it("Should NOT allow a call which wouldn't result in a change", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(approverSigner).setApprovedSweepRecipient(sweepReceiverSigner.address, true)
              ).to.be.revertedWith("NO_CHANGE")
            });
          })
          context("Success cases", async function () {
            it("Should allow the approver address to approve a sweeping token address", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(approverSigner).setApprovedSweepRecipient(mockThirdParty.address, true)
              ).to.emit(paymentPROClonableV2Reference, "ApprovedTokenSweepRecipient")
            });
            it("Should allow the approver address to unapprove a sweeping token address", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(approverSigner).setApprovedSweepRecipient(sweepReceiverSigner.address, false)
              ).to.emit(paymentPROClonableV2Reference, "UnapprovedTokenSweepRecipient")
            });
          })
        });
      })
      context("onlyPaymentManager functions", async function () {
        context("function createStrictPayment", async function () {
          context("Failure cases", async function () {
            it("Should NOT be callable from a non-paymentManager address", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(miscSigner).createStrictPayment(
                  "PAYMENT_REFERENCE",
                  mockPRO.address,
                  ethers.utils.parseUnits("500", 8),
                  ethers.utils.parseEther("0.0005"),
                  payerSigner.address,
                  true,
                )
              ).to.be.revertedWith("NOT_PAYMENT_MANAGER")
            });
            it("Should NOT allow an already-reserved payment reference to be used", async function () {
              paymentPROClonableV2Reference.connect(paymentManagerSigner).createStrictPayment(
                "PAYMENT_REFERENCE",
                mockPRO.address,
                ethers.utils.parseUnits("500", 8),
                ethers.utils.parseEther("0.0005"),
                payerSigner.address,
                true,
              )
              await expect(
                paymentPROClonableV2Reference.connect(paymentManagerSigner).createStrictPayment(
                  "PAYMENT_REFERENCE",
                  mockPRO.address,
                  ethers.utils.parseUnits("500", 8),
                  ethers.utils.parseEther("0.0005"),
                  payerSigner.address,
                  true,
                )
              ).to.be.revertedWith("REFERENCE_ALREADY_RESERVED")
            });
            it("Should NOT allow an non-approved payment token address to be used", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(paymentManagerSigner).createStrictPayment(
                  "PAYMENT_REFERENCE",
                  miscSigner.address,
                  ethers.utils.parseUnits("500", 8),
                  ethers.utils.parseEther("0.0005"),
                  payerSigner.address,
                  true,
                )
              ).to.be.revertedWith("NOT_APPROVED_TOKEN_ADDRESS")
            });
            it("Should NOT allow a zero amount to be used", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(paymentManagerSigner).createStrictPayment(
                  "PAYMENT_REFERENCE",
                  mockPRO.address,
                  0,
                  ethers.utils.parseEther("0.0005"),
                  payerSigner.address,
                  true,
                )
              ).to.be.revertedWith("NO_ZERO_AMOUNT")
            });
          })
          context("Success cases", async function () {
            it("Should allow a payment manager address to create a strict payment", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(paymentManagerSigner).createStrictPayment(
                  "PAYMENT_REFERENCE",
                  mockPRO.address,
                  ethers.utils.parseUnits("500", 8),
                  ethers.utils.parseEther("0.0005"),
                  payerSigner.address,
                  true,
                )
              ).to.emit(paymentPROClonableV2Reference, "PaymentReferenceCreated")
            });
          })
        });
        context("function deleteStrictPayment", async function () {
          context("Failure cases", async function () {
            it("Should NOT be callable from a non-paymentManager address", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(miscSigner).deleteStrictPayment(
                  DEFAULT_RESERVED_REFERENCE
                )
              ).to.be.revertedWith("NOT_PAYMENT_MANAGER")
            });
            it("Should NOT be callable with an unreserved reference", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(paymentManagerSigner).deleteStrictPayment(
                  "UNRESERVED_REFERENCE",
                )
              ).to.be.revertedWith("REFERENCE_NOT_RESERVED")
            });
            it("Should NOT be callable for a payment which is already complete", async function () {
              await mockPRO.transfer(payerSigner.address, ethers.utils.parseUnits("500", 8));
              await mockPRO.connect(payerSigner).approve(paymentPROClonableV2Reference.address, ethers.utils.parseUnits("500", 8));
              await expect(
                paymentPROClonableV2Reference.connect(payerSigner).makeStrictPayment(
                  DEFAULT_RESERVED_REFERENCE,
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.emit(paymentPROClonableV2Reference, "StrictPaymentReceived")
              await expect(
                paymentPROClonableV2Reference.connect(paymentManagerSigner).deleteStrictPayment(
                  DEFAULT_RESERVED_REFERENCE,
                )
              ).to.be.revertedWith("PAYMENT_ALREADY_COMPLETE")
            });
          })
          context("Success cases", async function () {
            it("Should allow an incomplete strict payment with a valid reference to be deleted", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(paymentManagerSigner).deleteStrictPayment(
                  DEFAULT_RESERVED_REFERENCE,
                )
              ).to.emit(paymentPROClonableV2Reference, "PaymentReferenceDeleted")
            });
          })
        });
        context("function setDefaultPaymentConfig", async function () {
          context("Failure cases", async function () {
            it("Should NOT be callable from a non-paymentManager address", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(miscSigner).setDefaultPaymentConfig(
                  mockPRO.address,
                  ethers.utils.parseUnits("500", 8),
                  ethers.utils.parseEther("0.0005"),
                )
              ).to.be.revertedWith("NOT_PAYMENT_MANAGER")
            });
            it("Should NOT be callable using an unapproved token address", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(paymentManagerSigner).setDefaultPaymentConfig(
                  mockUnapprovedERC20.address,
                  ethers.utils.parseUnits("500", 8),
                  ethers.utils.parseEther("0.0005"),
                )
              ).to.be.revertedWith("NOT_APPROVED_TOKEN_ADDRESS")
            });
            it("Should NOT be callable using a zero amount", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(paymentManagerSigner).setDefaultPaymentConfig(
                  mockPRO.address,
                  0,
                  ethers.utils.parseEther("0.0005"),
                )
              ).to.be.revertedWith("NO_ZERO_AMOUNT")
            });
          })
          context("Success cases", async function () {
            it("Should allow a payment manager to adjust the default payment config with an approved token address & non-zero amount", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(paymentManagerSigner).setDefaultPaymentConfig(
                  mockPRO.address,
                  ethers.utils.parseUnits("1000", 8),
                  ethers.utils.parseEther("0.0005"),
                )
              ).to.emit(paymentPROClonableV2Reference, "DefaultPaymentConfigAdjusted")
            });
          })
        });
      });
      context("onlySweeper functions", async function () {
        context("function sweepTokenByFullBalance", async function () {
          context("Failure cases", async function () {
            it("Should NOT be callable from a non-sweeper address", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(miscSigner).sweepTokenByFullBalance(
                  mockPRO.address,
                  sweepReceiverSigner.address
                )
              ).to.be.revertedWith("NOT_SWEEPER")
            });
            it("Should NOT be callable with an unapproved sweepToken address", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(sweeperSigner).sweepTokenByFullBalance(
                  miscSigner.address,
                  sweepReceiverSigner.address
                )
              ).to.be.revertedWith("NOT_APPROVED_TOKEN_ADDRESS")
            });
            it("Should NOT be callable with an unapproved sweep recipient address", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(sweeperSigner).sweepTokenByFullBalance(
                  mockPRO.address,
                  miscSigner.address
                )
              ).to.be.revertedWith("NOT_APPROVED_RECIPIENT")
            });
            it("Should NOT be callable if the token balance is zero", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(sweeperSigner).sweepTokenByFullBalance(
                  mockPRO.address,
                  sweepReceiverSigner.address
                )
              ).to.be.revertedWith("NO_BALANCE")
            });
          })
          context("Success cases", async function () {
            it("Should allow the full balance of an approved token to be swept to an approved recipient", async function () {
              await mockPRO.transfer(paymentPROClonableV2Reference.address, ethers.utils.parseUnits("500", 8));
              await expect(
                paymentPROClonableV2Reference.connect(sweeperSigner).sweepTokenByFullBalance(
                  mockPRO.address,
                  sweepReceiverSigner.address
                )
              ).to.emit(paymentPROClonableV2Reference, "TokenSwept")
            });
          })
        });
        context("function sweepTokenByAmount", async function () {
          context("Failure cases", async function () {
            it("Should NOT be callable from a non-sweeper address", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(miscSigner).sweepTokenByAmount(
                  mockPRO.address,
                  sweepReceiverSigner.address,
                  ethers.utils.parseUnits("500", 8)
                )
              ).to.be.revertedWith("NOT_SWEEPER")
            });
            it("Should NOT be callable with an unapproved sweepToken address", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(sweeperSigner).sweepTokenByAmount(
                  miscSigner.address,
                  sweepReceiverSigner.address,
                  ethers.utils.parseUnits("500", 8)
                )
              ).to.be.revertedWith("NOT_APPROVED_TOKEN_ADDRESS")
            });
            it("Should NOT be callable with an unapproved sweep recipient address", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(sweeperSigner).sweepTokenByAmount(
                  mockPRO.address,
                  miscSigner.address,
                  ethers.utils.parseUnits("500", 8)
                )
              ).to.be.revertedWith("NOT_APPROVED_RECIPIENT")
            });
            it("Should NOT be callable if amount exceeds balance", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(sweeperSigner).sweepTokenByAmount(
                  mockPRO.address,
                  sweepReceiverSigner.address,
                  ethers.utils.parseUnits("500", 8)
                )
              ).to.be.revertedWith("INSUFFICIENT_BALANCE")
            });
            it("Should NOT be callable if the amount is zero", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(sweeperSigner).sweepTokenByAmount(
                  mockPRO.address,
                  sweepReceiverSigner.address,
                  0
                )
              ).to.be.revertedWith("NO_ZERO_AMOUNT")
            });
          })
          context("Success cases", async function () {
            it("Should allow the specified amount of an approved token to be swept to an approved recipient", async function () {
              await mockPRO.transfer(paymentPROClonableV2Reference.address, ethers.utils.parseUnits("500", 8));
              await expect(
                paymentPROClonableV2Reference.connect(sweeperSigner).sweepTokenByAmount(
                  mockPRO.address,
                  sweepReceiverSigner.address,
                  ethers.utils.parseUnits("250", 8)
                )
              ).to.emit(paymentPROClonableV2Reference, "TokenSwept")
              await expect(
                paymentPROClonableV2Reference.connect(sweeperSigner).sweepTokenByAmount(
                  mockPRO.address,
                  sweepReceiverSigner.address,
                  ethers.utils.parseUnits("250", 8)
                )
              ).to.emit(paymentPROClonableV2Reference, "TokenSwept")
              await expect(
                paymentPROClonableV2Reference.connect(sweeperSigner).sweepTokenByAmount(
                  mockPRO.address,
                  sweepReceiverSigner.address,
                  ethers.utils.parseUnits("1", 8)
                )
              ).to.be.revertedWith("INSUFFICIENT_BALANCE")
            });
          })
        });
        context("function sweepETHByFullBalance", async function () {
          context("Failure cases", async function () {
            it("Should NOT be callable from a non-sweeper address", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(miscSigner).sweepETHByFullBalance(
                  sweepReceiverSigner.address
                )
              ).to.be.revertedWith("NOT_SWEEPER")
            });
            it("Should NOT be callable with an unapproved sweep recipient address", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(sweeperSigner).sweepETHByFullBalance(
                  miscSigner.address
                )
              ).to.be.revertedWith("NOT_APPROVED_RECIPIENT")
            });
            it("Should NOT be callable if the ETH balance is zero", async function () {
              await expect(await ethers.provider.getBalance(paymentPROClonableV2Reference.address)).to.equal("0");
              await expect(
                paymentPROClonableV2Reference.connect(sweeperSigner).sweepETHByFullBalance(
                  sweepReceiverSigner.address
                )
              ).to.be.revertedWith("NO_BALANCE")
            });
          })
          context("Success cases", async function () {
            it("Should allow the full balance of ETH to be swept to an approved recipient", async function () {
              await mockPRO.approve(paymentPROClonableV2Reference.address, ethers.utils.parseUnits("500", 8));
              await expect(
                paymentPROClonableV2Reference.makeOpenPayment(
                  mockPRO.address,
                  ethers.utils.parseUnits("500", 8),
                  ethers.utils.parseEther("0.0005"),
                  "UNRESERVED_REFERENCE",
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.emit(paymentPROClonableV2Reference, "OpenPaymentReceived")
              await expect(
                paymentPROClonableV2Reference.connect(sweeperSigner).sweepETHByFullBalance(
                  sweepReceiverSigner.address
                )
              ).to.emit(paymentPROClonableV2Reference, "ETHSwept")
            });
          })
        });
      })
      context("payment functions", async function () {
        context("function makeOpenPayment", async function () {
          context("Failure cases", async function () {
            it("Should NOT allow an open payment from an unapproved token address", async function () {
              await expect(
                paymentPROClonableV2Reference.makeOpenPayment(
                  mockUnapprovedERC20.address,
                  ethers.utils.parseUnits("500", 8),
                  ethers.utils.parseEther("0.0005"),
                  "REFERENCE",
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.be.revertedWith("NOT_APPROVED_TOKEN")
            });
            it("Should NOT allow an open payment amount of zero", async function () {
              await expect(
                paymentPROClonableV2Reference.makeOpenPayment(
                  mockPRO.address,
                  0,
                  ethers.utils.parseEther("0.0005"),
                  "REFERENCE",
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.be.revertedWith("NO_ZERO_AMOUNT")
            });
            it("Should NOT allow an open payment amount with a reserved reference", async function () {
              await expect(
                paymentPROClonableV2Reference.makeOpenPayment(
                  mockPRO.address,
                  ethers.utils.parseUnits("500", 8),
                  ethers.utils.parseEther("0.0005"),
                  DEFAULT_RESERVED_REFERENCE,
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.be.revertedWith("REFERENCE_RESERVED")
            });
            it("Should NOT allow an open payment if the ETH value sent does not match the param value provided", async function () {
              await mockPRO.approve(paymentPROClonableV2Reference.address, ethers.utils.parseUnits("500", 8));
              await expect(
                paymentPROClonableV2Reference.makeOpenPayment(
                  mockPRO.address,
                  ethers.utils.parseUnits("500", 8),
                  ethers.utils.parseEther("0.0005"),
                  "UNRESERVED_REFERENCE",
                  {
                    value: ethers.utils.parseEther("0.0004")
                  }
                )
              ).to.be.revertedWith("INCORRECT_ETH_AMOUNT")
            });
          })
          context("Success cases", async function () {
            it("Should allow an open payment with an approved token address of a non-zero amount, with an unreserved reference", async function () {
              await mockPRO.approve(paymentPROClonableV2Reference.address, ethers.utils.parseUnits("500", 8));
              await expect(
                paymentPROClonableV2Reference.makeOpenPayment(
                  mockPRO.address,
                  ethers.utils.parseUnits("500", 8),
                  ethers.utils.parseEther("0.0005"),
                  "UNRESERVED_REFERENCE",
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.emit(paymentPROClonableV2Reference, "OpenPaymentReceived")
            });
          })
        });
        context("function makeDefaultPayment", async function () {
          context("Failure cases", async function () {
            it("Should NOT allow a default payment if the default payment token address has been unapproved", async function () {
              await paymentPROClonableV2Reference.connect(approverSigner).setApprovedPaymentToken(mockPRO.address, false);
              await expect(
                paymentPROClonableV2Reference.makeDefaultPayment(
                  "REFERENCE",
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.be.revertedWith("NOT_APPROVED_TOKEN")
            });
            it("Should NOT allow a default payment with a reserved reference", async function () {
              await mockPRO.approve(paymentPROClonableV2Reference.address, ethers.utils.parseUnits("500", 8));
              await expect(
                paymentPROClonableV2Reference.makeDefaultPayment(
                  DEFAULT_RESERVED_REFERENCE,
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.be.revertedWith("REFERENCE_RESERVED")
            });
            it("Should NOT allow a default payment with an ETH value sent which doesn't match the default payment config ETH value", async function () {
              await mockPRO.approve(paymentPROClonableV2Reference.address, ethers.utils.parseUnits("500", 8));
              await expect(
                paymentPROClonableV2Reference.makeDefaultPayment(
                  "UNRESERVED_REFERENCE",
                  {
                    value: ethers.utils.parseEther("0.0004")
                  }
                )
              ).to.be.revertedWith("INCORRECT_ETH_AMOUNT")
            });
            it("Should NOT allow a default payment reference to be reused", async function () {
              await mockPRO.approve(paymentPROClonableV2Reference.address, ethers.utils.parseUnits("500", 8));
              await expect(
                paymentPROClonableV2Reference.makeDefaultPayment(
                  "UNRESERVED_REFERENCE",
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.emit(paymentPROClonableV2Reference, "DefaultPaymentReceived")
              await mockPRO.approve(paymentPROClonableV2Reference.address, ethers.utils.parseUnits("500", 8));
              await expect(
                paymentPROClonableV2Reference.makeDefaultPayment(
                  "UNRESERVED_REFERENCE",
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.be.revertedWith("REFERENCE_USED")
            });
          })
          context("Success cases", async function () {
            it("Should allow an open payment with an approved token address of a non-zero amount, with an unreserved reference", async function () {
              await mockPRO.approve(paymentPROClonableV2Reference.address, ethers.utils.parseUnits("500", 8));
              await expect(
                paymentPROClonableV2Reference.makeDefaultPayment(
                  "UNRESERVED_REFERENCE",
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.emit(paymentPROClonableV2Reference, "DefaultPaymentReceived")
            });
          })
        });
        context("function makeStrictPayment", async function () {
          context("Failure cases", async function () {
            it("Should NOT allow a strict payment to use an unreserved reference", async function () {
              await paymentPROClonableV2Reference.connect(approverSigner).setApprovedPaymentToken(mockPRO.address, false);
              await expect(
                paymentPROClonableV2Reference.makeStrictPayment(
                  "REFERENCE",
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.be.revertedWith("REFERENCE_NOT_RESERVED")
            });
            it("Should NOT allow a strict payment to be made if the associated token address has been unapproved", async function () {
              await paymentPROClonableV2Reference.connect(approverSigner).setApprovedPaymentToken(mockPRO.address, false);
              await expect(
                paymentPROClonableV2Reference.makeStrictPayment(
                  DEFAULT_RESERVED_REFERENCE,
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.be.revertedWith("NOT_APPROVED_TOKEN")
            });
            it("Should NOT allow a strict payment to be made from a non-matched payer address when enforcePayer is set to true", async function () {
              await expect(
                paymentPROClonableV2Reference.makeStrictPayment(
                  DEFAULT_RESERVED_REFERENCE,
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.be.revertedWith("PAYER_MISMATCH")
            });
            it("Should NOT allow a strict payment to be made if it has been deleted", async function () {
              await expect(
                paymentPROClonableV2Reference.connect(paymentManagerSigner).deleteStrictPayment(
                  DEFAULT_RESERVED_REFERENCE,
                )
              ).to.emit(paymentPROClonableV2Reference, "PaymentReferenceDeleted")
              await mockPRO.transfer(payerSigner.address, ethers.utils.parseUnits("500", 8));
              await mockPRO.connect(payerSigner).approve(paymentPROClonableV2Reference.address, ethers.utils.parseUnits("500", 8));
              await expect(
                paymentPROClonableV2Reference.connect(payerSigner).makeStrictPayment(
                  DEFAULT_RESERVED_REFERENCE,
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.be.revertedWith("REFERENCE_NOT_RESERVED")
            });
            it("Should NOT allow a strict payment with an ETH value sent which doesn't match the referenced payment config ETH value", async function () {
              await mockPRO.transfer(payerSigner.address, ethers.utils.parseUnits("500", 8));
              await mockPRO.connect(payerSigner).approve(paymentPROClonableV2Reference.address, ethers.utils.parseUnits("500", 8));
              await expect(
                paymentPROClonableV2Reference.connect(payerSigner).makeStrictPayment(
                  DEFAULT_RESERVED_REFERENCE,
                  {
                    value: ethers.utils.parseEther("0.0004")
                  }
                )
              ).to.be.revertedWith("INCORRECT_ETH_AMOUNT")
            });
          })
          context("Success cases", async function () {
            it("Should allow strict payment to be made from a matched payer address when enforcePayer is set to true", async function () {
              await mockPRO.transfer(payerSigner.address, ethers.utils.parseUnits("500", 8));
              await mockPRO.connect(payerSigner).approve(paymentPROClonableV2Reference.address, ethers.utils.parseUnits("500", 8));
              await expect(
                paymentPROClonableV2Reference.connect(payerSigner).makeStrictPayment(
                  DEFAULT_RESERVED_REFERENCE,
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.emit(paymentPROClonableV2Reference, "StrictPaymentReceived")
            });
            it("Should allow strict payment to be made from an unmatched payer address when enforcePayer is set to false", async function () {
              await mockPRO.approve(paymentPROClonableV2Reference.address, ethers.utils.parseUnits("500", 8));
              await expect(
                paymentPROClonableV2Reference.makeStrictPayment(
                  DEFAULT_RESERVED_REFERENCE_UNENFORCED_PAYER,
                  {
                    value: ethers.utils.parseEther("0.0005")
                  }
                )
              ).to.emit(paymentPROClonableV2Reference, "StrictPaymentReceived")
            });
          })
        });
      })
    });
    context("read-only functions", async function () {
      context("function viewStrictPaymentByStringReference", async function () {
        it("Should allow a strict payment to be queried by reserved reference", async function () {
          let strictPayment = await paymentPROClonableV2Reference.viewStrictPaymentByStringReference(DEFAULT_RESERVED_REFERENCE);
          expect(
            strictPayment.paymentReference
          ).to.equal("DEFAULT_RESERVED_REFERENCE");
          expect(
            strictPayment.paymentReferenceHash
          ).to.equal("0x0269305198f72f2734645179826e1c3d574a643c27c862abcbee656fc664ca5d");
          expect(
            strictPayment.ethAmount
          ).to.equal(ethers.utils.parseEther("0.0005"));
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
          let strictPayment = await paymentPROClonableV2Reference.viewStrictPaymentByHashedReference("0x0269305198f72f2734645179826e1c3d574a643c27c862abcbee656fc664ca5d");
          expect(
            strictPayment.paymentReference
          ).to.equal("DEFAULT_RESERVED_REFERENCE");
          expect(
            strictPayment.ethAmount
          ).to.equal(ethers.utils.parseEther("0.0005"));
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
});

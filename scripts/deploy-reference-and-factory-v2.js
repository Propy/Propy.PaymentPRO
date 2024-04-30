// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

const etherscanChainIds = [
    1, // Mainnet
    3, // Ropsten
    4, // Rinkeby
    5, // Goerli
    11155111, // Sepolia
    'base',
    'baseSepolia',
    'sepolia',
    'goerli',
    'homestead',
    'mainnet',
]

async function main() {

  let [deployerSigner] = await hre.ethers.getSigners();

  console.log(`Deploying from: ${deployerSigner.address}, hre.network: ${hre.network.name}`);

  const APPROVER_ROLE = "0x408a36151f841709116a4e8aca4e0202874f7f54687dcb863b1ea4672dc9d8cf";
  const SWEEPER_ROLE = "0x8aef0597c0be1e090afba1f387ee99f604b5d975ccbed6215cdf146ffd5c49fc";
  const PAYMENT_MANAGER_ROLE = "0xa624ddbc4fb31a463e13e6620d62eeaf14248f89110a7fda32b4048499c999a6";

  let mockPRO;
  let adminAddress;
  let paymentTokenAddress;
  let approverAddress;
  let sweeperAddress;
  let paymentManagerAddress;
  let defaultPaymentAmount;
  let defaultEthAmount;
  if(hre.network.name === "mainnet") {
    // mainnet config
    adminAddress = "0x48608159077516aFE77A04ebC0448eC32E6670c1";
    defaultPaymentAmount = ethers.utils.parseUnits("20", 8);
    paymentTokenAddress = "0x226bb599a12C826476e3A771454697EA52E9E220";
    approverAddress = "0x48608159077516aFE77A04ebC0448eC32E6670c1";
    sweeperAddress = "0x48608159077516aFE77A04ebC0448eC32E6670c1";
    paymentManagerAddress = "0x48608159077516aFE77A04ebC0448eC32E6670c1";
    defaultEthAmount = 0
  } else if (hre.network.name == "base") {

    adminAddress = "0x48608159077516aFE77A04ebC0448eC32E6670c1";
    defaultPaymentAmount = ethers.utils.parseUnits("20", 8);
    paymentTokenAddress = "0x18dD5B087bCA9920562aFf7A0199b96B9230438b";
    approverAddress = "0x48608159077516aFE77A04ebC0448eC32E6670c1";
    sweeperAddress = "0x48608159077516aFE77A04ebC0448eC32E6670c1";
    paymentManagerAddress = "0x48608159077516aFE77A04ebC0448eC32E6670c1";
    defaultEthAmount = 0
    
  } else if (["goerli", "sepolia", "hardhat"].indexOf(hre.network.name) > -1) {
    // testnet config
    // adminAddress = deployerSigner.address;

    // defaultPaymentAmount = ethers.utils.parseUnits("10", 8);
    defaultPaymentAmount = 0;
    adminAddress = "0x48608159077516aFE77A04ebC0448eC32E6670c1";
    
    // const MockPRO = await ethers.getContractFactory("MockPRO");
    // mockPRO = await MockPRO.deploy(
    //   ethers.utils.parseUnits("100000", 8),
    //   8,
    //   "TestPropy",
    //   "TESTPRO"
    // );
    // await mockPRO.deployed();
    // await mockPRO.transfer("0x48608159077516aFE77A04ebC0448eC32E6670c1", ethers.utils.parseUnits("100000", 8));
    paymentTokenAddress = "0xa7423583D3b0B292E093aAC2f8900396EC110960";

    // paymentTokenAddress = "0xa7423583D3b0B292E093aAC2f8900396EC110960";
    approverAddress = adminAddress;
    sweeperAddress = adminAddress;
    paymentManagerAddress = adminAddress;
    defaultEthAmount = ethers.utils.parseUnits("0.001", 18);
    // defaultEthAmount = 0;
  } else if (hre.network.name == "baseSepolia") {
    // defaultPaymentAmount = ethers.utils.parseUnits("20", 8);
    defaultPaymentAmount = 0;
    adminAddress = "0x48608159077516aFE77A04ebC0448eC32E6670c1";
    paymentTokenAddress = "0x3660925E58444955c4812e42A572e532e69Dac7B";
    approverAddress = "0x48608159077516aFE77A04ebC0448eC32E6670c1";
    sweeperAddress = "0x48608159077516aFE77A04ebC0448eC32E6670c1";
    paymentManagerAddress = "0x48608159077516aFE77A04ebC0448eC32E6670c1";
    // defaultEthAmount = 0;
    defaultEthAmount = ethers.utils.parseUnits("0.001", 18);
  }

  if(adminAddress && paymentTokenAddress && approverAddress && sweeperAddress && paymentManagerAddress) {

    const PaymentPROClonable = await ethers.getContractFactory("PaymentPROClonableV2");
    let paymentPROClonableReference = await PaymentPROClonable.deploy();
    await paymentPROClonableReference.deployed();

    console.log("PaymentPROClonable contract deployed to:", paymentPROClonableReference.address);

    // initializeContract(
    //   address _roleAdmin,
    //   address _approvedPaymentToken,
    //   address _approvedSweepingToken,
    //   address _approvedTokenSweepRecipient,
    //   uint256 _defaultTokenAmount
    // )

    await paymentPROClonableReference.initializeContract(
      adminAddress,
      paymentTokenAddress,
      paymentTokenAddress,
      adminAddress,
      defaultPaymentAmount,
      defaultEthAmount,
    );

    console.log("PaymentPROClonable initialized");

    // console.log("Granting APPROVER_ROLE to:", approverAddress);
    // await paymentPROClonableReference.grantRole(APPROVER_ROLE, approverAddress);
    // console.log("Granting SWEEPER_ROLE to:", sweeperAddress);
    // await paymentPROClonableReference.grantRole(SWEEPER_ROLE, sweeperAddress);
    // console.log("Granting PAYMENT_MANAGER_ROLE to:", paymentManagerAddress);
    // await paymentPROClonableReference.grantRole(PAYMENT_MANAGER_ROLE, paymentManagerAddress);

    // console.log("Setting defaultPaymentConfig to:", {paymentTokenAddress, amount: ethers.utils.parseUnits("50", 8)});
    // await paymentPRO.setDefaultPaymentConfig(paymentTokenAddress, ethers.utils.parseUnits("5000", 8));


    const PaymentPROFactory = await ethers.getContractFactory("PaymentPROFactoryV2");
    let paymentPROFactory = await PaymentPROFactory.deploy(paymentPROClonableReference.address);
    await paymentPROFactory.deployed();

    console.log("PaymentPROFactory contract deployed to:", paymentPROFactory.address);

    // We run verification on Etherscan
    // If there is an official Etherscan instance of this network we are deploying to
    if(etherscanChainIds.indexOf(hre.network.name) > -1) {
      console.log('Deploying to a network supported by Etherscan, running Etherscan contract verification')
      
      // First we pause for a minute to give Etherscan a chance to update with our newly deployed contracts
      console.log('First waiting a minute to give Etherscan a chance to update...')
      await new Promise((resolve) => setTimeout(resolve, 60000));

      // We can now run Etherscan verification of our contracts
      if (["goerli", "sepolia", "hardhat"].indexOf(hre.network.name) > -1) {
        // try {
        //   await hre.run('verify:verify', {
        //     address: mockPRO.address,
        //     constructorArguments: [
        //       ethers.utils.parseUnits("100000", 8),
        //       8,
        //       "TestPropy",
        //       "TESTPRO"
        //     ]
        //   });
        // } catch (err) {
        //   console.log(`Verification error for reference contract: ${err}`);
        // }
      }

      try {
        await hre.run('verify:verify', {
          address: paymentPROClonableReference.address,
          constructorArguments: []
        });
      } catch (err) {
        console.log(`Verification error for reference contract: ${err}`);
      }

      try {
        await hre.run('verify:verify', {
          contract: "contracts/PaymentPROFactoryV3.sol:PaymentPROFactoryV3",
          address: paymentPROFactory.address,
          constructorArguments: [
            paymentPROClonableReference.address
          ]
        });
      } catch (err) {
        console.log(`Verification error for reference contract: ${err}`);
      }
      
    } else {
      console.log('Not deploying to a network supported by Etherscan, skipping Etherscan contract verification');
    }

  } else {
    console.error("ERROR: adminAddress required");
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

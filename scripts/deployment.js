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
  if(hre.network.name === "mainnet") {
    // mainnet config
    // adminAddress = "";
  } else if (["goerli", "sepolia", "hardhat"].indexOf(hre.network.name) > -1) {
    // testnet config
    // adminAddress = deployerSigner.address;
    adminAddress = "0x657C0eCF07f6e2B2D01c13F328B230F07b824a57";
    const MockPRO = await ethers.getContractFactory("MockPRO");
    mockPRO = await MockPRO.deploy(
      ethers.utils.parseUnits("100000", 8),
      8,
      "TestPropy",
      "TESTPRO"
    );
    await mockPRO.deployed();
    await mockPRO.transfer(adminAddress, ethers.utils.parseUnits("100000", 8));
    paymentTokenAddress = mockPRO.address;
    approverAddress = adminAddress;
    sweeperAddress = adminAddress;
    paymentManagerAddress = adminAddress;
  }

  if(adminAddress && paymentTokenAddress && approverAddress && sweeperAddress && paymentManagerAddress) {

    const PaymentPRO = await ethers.getContractFactory("PaymentPRO");
    const paymentPRO = await PaymentPRO.deploy(deployerSigner.address, paymentTokenAddress, paymentTokenAddress, adminAddress);
    await paymentPRO.deployed();

    await paymentPRO.grantRole(APPROVER_ROLE, approverAddress);
    await paymentPRO.grantRole(SWEEPER_ROLE, sweeperAddress);
    await paymentPRO.grantRole(PAYMENT_MANAGER_ROLE, paymentManagerAddress);

    console.log("PaymentPRO contract deployed to:", paymentPRO.address);

    // We run verification on Etherscan
    // If there is an official Etherscan instance of this network we are deploying to
    if(etherscanChainIds.indexOf(hre.network.name) > -1) {
      console.log('Deploying to a network supported by Etherscan, running Etherscan contract verification')
      
      // First we pause for a minute to give Etherscan a chance to update with our newly deployed contracts
      console.log('First waiting a minute to give Etherscan a chance to update...')
      await new Promise((resolve) => setTimeout(resolve, 60000));

      // We can now run Etherscan verification of our contracts
      if (["goerli", "sepolia", "hardhat"].indexOf(hre.network.name) > -1) {
        try {
          await hre.run('verify:verify', {
            address: mockPRO.address,
            constructorArguments: [
              ethers.utils.parseUnits("100000", 8),
              8,
              "TestPropy",
              "TESTPRO"
            ]
          });
        } catch (err) {
          console.log(`Verification error for reference contract: ${err}`);
        }
      }

      try {
        await hre.run('verify:verify', {
          address: paymentPRO.address,
          constructorArguments: [deployerSigner.address, paymentTokenAddress, paymentTokenAddress, adminAddress]
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

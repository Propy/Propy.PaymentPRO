require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-gas-reporter");
require("hardhat-contract-sizer");
require("solidity-coverage");
require("dotenv").config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.4",
      },
      {
        version: "0.5.11",
      },
      {
        version: "0.4.18",
      },
    ],
  },
  networks: {
    hardhat: {
      accounts: {
        count: 20, // Adjust the number of accounts available when using the local Hardhat network
      }
    },
    // rinkeby: {
    //   url: `https://eth-rinkeby.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
    //   accounts: [`${process.env.DEPLOYMENT_ADDRESS_PRIVATE_KEY}`]
    // },
    // goerli: {
    //   url: `https://eth-goerli.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
    //   accounts: [`${process.env.DEPLOYMENT_ADDRESS_PRIVATE_KEY}`]
    // },
    // sepolia: {
    //   url: `https://eth-sepolia.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
    //   accounts: [`${process.env.DEPLOYMENT_ADDRESS_PRIVATE_KEY}`]
    // },
    // mainnet: {
    //   url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
    //   accounts: [`${process.env.DEPLOYMENT_ADDRESS_PRIVATE_KEY}`]
    // },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
  }
};

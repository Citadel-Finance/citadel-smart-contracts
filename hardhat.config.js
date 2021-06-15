require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ganache");
require('dotenv').config();

const fs = require('fs');
const privkey = fs.readFileSync(".secret").toString().trim();

module.exports = {
  defaultNetwork: "bsc_test",
  networks: {
    ganache: {
      url: "http://127.0.0.1:8545",
    },
    development: {
      url: "http://127.0.0.1:8545",
      //from: "0749c6397aa953755a2a5904d2a0a29a99b2df8b",
    },
    bsc_test: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      accounts: [process.env.SECRET_KEY]
    },
    bsc_test_2: {
      url: "https://data-seed-prebsc-2-s3.binance.org:8545",
      chainId: 97,
      accounts: [process.env.SECRET_KEY]
    }
  },
  solidity: {
    version: "0.7.6",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  mocha: {
    timeout: 20000
  }
}



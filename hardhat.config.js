require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ganache");


const fs = require('fs');
const privkey = fs.readFileSync(".secret").toString().trim();

module.exports = {
  defaultNetwork: "bsc_test",
  networks: {
    development: {
      url: "http://127.0.0.1:8545",
      //from: "0749c6397aa953755a2a5904d2a0a29a99b2df8b",
    },
    bsc_test: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      accounts: [privkey],
    }
  },
  solidity: {
    version: "0.7.0",
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



require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ganache");
require('./tasks');
require('dotenv').config();

let secretkey;
if (!process.env.SECRET_KEY) {
  throw new Error('Please set your SECRET_KEY in a .env file');
} else {
  secretkey = process.env.SECRET_KEY;
}

module.exports = {
  defaultNetwork: "ganache",
  networks: {
    ganache: {
      url: "http://127.0.0.1:8545",
    },
    bsctestnet: {
      url: "https://data-seed-prebsc-2-s3.binance.org:8545",
      chainId: 97,
      accounts: [secretkey]
    },
    bscmainnet: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      gasPrice: 20000000000,
      accounts: [secretkey],
    },
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



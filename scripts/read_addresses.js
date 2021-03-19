const fs = require("fs");

pool_addr=fs.readFileSync(
    ".liquidity_pool.addr",
    (err, data) => {
      if (err) return console.log(err);
      console.log(data);
    }
).toString();

main_token_addr=fs.readFileSync(
    ".main_token.addr",
    (err, data) => {
      if (err) return console.log(err);
      console.log(data);
    }
).toString();

lp_token_addr=fs.readFileSync(
    ".lp_token.addr",
    (err, data) => {
        if (err) return console.log(err);
        console.log(data);
    }
).toString();

  const pool = await Pool.attach(pool_addr);
  const main_token = await MainToken.attach(main_token_addr);
  const lp_token = await MainToken.attach(lp_token_addr);
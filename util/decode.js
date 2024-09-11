const crypto = require('crypto');

var algorithm = "aes-256-ctr";
var secretKey = "ckvosejfkeldh";
var stationKey = "N2QxZmY0ZWE=";
var algorithm2 = "des-ecb";
var kbs = "cac4d4e664757c1d5e805bcec4a2ca6ff7046e08a88de41f55a5f0626e4b00f7f0e17e8e5e4da22da8f8963c9486";
var mbc = "cac4d4e664757c1e50825ac9d3e0c074aa436005e5c8f55f59ffe56b225a1cffd6ae6a895e1b";
var sbs = "cac4d4e664757c0c4d82478ed0eed223e745230cf4c9e65c55a9a96b31435faf81b0249d5911b724b4b5823d8cc91a2187f3";
var kbsAgent = "e9f2f3dd111414";
var kbsTs = "cac4d4e664757c1d5e805bcec4a2ca6ff7046e08a88de41f55a5f0626e4d15eaf0f36e884006a01aacb4cd3e90cb";
var kbsParam = "cac4d4e664757c1d5e805bcec4a2ca6ff7046e08a88de41f59bbeb64260511eec6ae7b92465cb335b1988d2f95de422c83aa2b62e12dcaaee4e580ca19adb776e90eff30731dfff70eb2f7acc77b4d30a69f6631c5d425795f2c6e9a83ee4207878adaf7aacff108689f63c3";
var kbsMeta = "cac4d4e664757c1d5e805bcec4a2ca6ff7046e08a88de41f59bbeb64260511eec6ae7b92465cb335b1988d2f95de42278fa8114ef72bceaef7d7d5cd14beba60e034d43f6214b7fb58b9f0a3cc334a398d9d34658680";
var decipherObj = crypto.createDecipher(algorithm, secretKey);
var streamUrl = "";
var sbsKey = (new Buffer(stationKey, 'base64')).toString('ascii');

console.log(sbsKey);

streamUrl = decipherObj.update(kbs, 'hex', 'utf8');
streamUrl += decipherObj.final('utf8');
console.log(streamUrl)
decipherObj = crypto.createDecipher(algorithm, secretKey);
streamUrl = decipherObj.update(kbsAgent, 'hex', 'utf8');
streamUrl += decipherObj.final('utf8');
console.log(streamUrl)
decipherObj = crypto.createDecipher(algorithm, secretKey);
streamUrl = decipherObj.update(kbsTs, 'hex', 'utf8');
streamUrl += decipherObj.final('utf8');
console.log(streamUrl)
decipherObj = crypto.createDecipher(algorithm, secretKey);
streamUrl = decipherObj.update(kbsParam, 'hex', 'utf8');
streamUrl += decipherObj.final('utf8');
decipherObj = crypto.createDecipher(algorithm, secretKey);
console.log(streamUrl)
streamUrl = decipherObj.update(kbsMeta, 'hex', 'utf8');
streamUrl += decipherObj.final('utf8');
decipherObj = crypto.createDecipher(algorithm, secretKey);
console.log(streamUrl)
streamUrl = decipherObj.update(mbc, 'hex', 'utf8');
streamUrl += decipherObj.final('utf8');
console.log(streamUrl)
decipherObj = crypto.createDecipher(algorithm, secretKey);
streamUrl = decipherObj.update(sbs, 'hex', 'utf8');
streamUrl += decipherObj.final('utf8');
console.log(streamUrl)

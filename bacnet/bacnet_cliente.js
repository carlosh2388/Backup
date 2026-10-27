const Bacnet = require("bacstack");

const client = new Bacnet({
  port: 47808,
  apduTimeout: 8000
});

const WISE_IP = "192.168.71.247";
const DEVICE_ID = 661001;

module.exports = {
  client,
  WISE_IP,
  DEVICE_ID
};

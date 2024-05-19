import fsp from "fs/promises";

const _key = await fsp.readFile("your-key-path");
const _cert = await fsp.readFile("your-cert-path");
const _HOST = "localhost";
const _PORT = 4444;

let config = {
  HOST:_HOST,
  PORT:_PORT,
  path:"/",
  key:_key,
  cert:_cert
};

export default config;

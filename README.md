# powt / powtserver 

A Simple WebTransport javascript library for client and server.

## [powt.mjs] client Library

[`lib/powt.mjs`](./lib/powt.mjs)

Please See details below a client example.

[`example/client/index.html`](./example/client/index.html)

## [powtserver.mjs] server Library

[`lib/powtserver.mjs`](./lib/powtserver.mjs)

Please See details below a server example.

[`example/app.mjs`](./example/app.mjs)

## Run example

[live demo](https://wtapp.4191333.xyz:4445)

### run server

#### 1. Make your config.mjs to `/example/config.mjs`

#### 2. npm i

```
cd powt/example
npm i
node ./app.mjs
```
### client

Please access `https://your-host-url:your-port-number` by browser.

> Please check the website below for compatible browsers.
> https://caniuse.com/webtransport

## dependencies

### powtserver.mjs

- [@fails-components/webtransport](https://github.com/fails-components/webtransport)
- [nanoid](https://github.com/ai/nanoid)

### An example server application (app.mjs)

- [express](https://github.com/expressjs/express)
- [cors (express middleware)](https://www.npmjs.com/package/cors)

## License

MIT



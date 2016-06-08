# NovaJS Backend

Backend Service in [Node.js](https://nodejs.org) for NovaJS

## Installation

```bash
npm install
gulp
npm start
```

## TODO

* [ ] Implement reCapatcha on the new user API and possible login API.
* [x] Implement SCRYPT on the user credentials.
* [x] Implement the storage backend (via docker Volumes now)
* [x] Implement API to interact with docker hosts.
* [ ] Implement letsencrypt auto cert gen for subdomains
## Testing

```bash
npm install --dev

# If you don't have mocha already
sudo npm install -g mocha

mocha
```

Please run the tests before contributing.

## License

MIT

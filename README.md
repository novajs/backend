![Triton](https://github.com/tritonjs/ui/raw/master/public/css/img/tb.png)

A backend for managing Cloud9 Core SDK Instances for a Classroom Environment.

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
* [x] Drop support for /etc/hosts and just cache IPs.
* [x] Implement assignments.
* [x] Implement initializing volumes and containers for assignment using same container.
* [x] Implement INIT script fetching assignments.
* [x] Implement Email as Username on /user
* [x] Implement GET /user for user info.
* [ ] Realtime status websocket/socket.io on /workspace.
* [ ] Authentication on Workspaces via http-proxy. Cookie?
* [ ] Have backend notify ide on ip collisions

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

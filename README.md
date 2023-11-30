# Walkingpad TUI

Bun TUI script that connects locally to a Python Flask websocket server that uses [https://github.com/ph4r05/ph4-walkingpad](https://github.com/ph4r05/ph4-walkingpad)https://github.com/ph4r05/ph4-walkingpad to communicate with the treadmill over BLE. 


# Running
> TODO: improve how scanning works, right now you have to set the address of the treadmill in the config file

Run the WS server:
```
> cd ./server
> python wsserver.py
```

Run the TUI:
```
> bun run index.ts
```

from flask import Flask
from flask_sock import Sock
from flask_cors import CORS

import asyncio
import yaml
from datetime import date

from ph4_walkingpad import pad
from ph4_walkingpad.pad import WalkingPad, Controller
from ph4_walkingpad.utils import setup_logging

import json

minimal_cmd_space = 0.69

log = setup_logging()
pad.logger = log
ctler = Controller()

app = Flask(__name__)
#app.config['SOCK_SERVER_OPTIONS'] = {'ping_interval': 25}
CORS(app, resources={r"/*": {"origins": "*"}})

sock = Sock(app)

current_record = {
    
}

def load_config():
    with open("config.yaml", 'r') as stream:
        try:
            return yaml.safe_load(stream)
        except yaml.YAMLError as exc:
            print(exc)

def get_or_create_eventloop():
    try:
        return asyncio.get_event_loop()
    except RuntimeError as ex:
        if "There is no current event loop in thread" in str(ex):
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            return asyncio.get_event_loop()

async def connect():
    address = load_config()['address']
    print("Connecting to {0}".format(address))
    await ctler.run(address)
    await asyncio.sleep(minimal_cmd_space)
    

async def disconnect():
    await ctler.disconnect()
    await asyncio.sleep(minimal_cmd_space)

async def run():
    await ctler.switch_mode(WalkingPad.MODE_STANDBY) # Ensure we start from a known state, since start_belt is actually toggle_belt
    await asyncio.sleep(minimal_cmd_space)
    await ctler.switch_mode(WalkingPad.MODE_MANUAL)
    await asyncio.sleep(minimal_cmd_space)
    await ctler.start_belt()
    await asyncio.sleep(minimal_cmd_space)
    await ctler.ask_hist(0)
    await asyncio.sleep(minimal_cmd_space)

async def stop():
    await ctler.switch_mode(WalkingPad.MODE_STANDBY)
    await asyncio.sleep(minimal_cmd_space)
    await ctler.ask_hist(0)
    await asyncio.sleep(minimal_cmd_space)

async def set_speed(params):
    await ctler.change_speed(params['speed'])



methods = {
    "connect": connect,
    "disconnect": disconnect,
    "run": run,
    "stop": stop,
    "set_speed": set_speed,
    # "set_to_standby": set_to_standby,
    # "get_stats": get_stats
}

async def handle_ws(ws):
    global current_record
    def on_new_status(sender, record):
        global current_record
        print("Received Record: {0}".format(record))
        current_record = record
        ws.send(record)

    ctler.on_cur_status_received = on_new_status

    while True:
        try:
            data = ws.receive()
            print("Received data: " + data)

            json_data = json.loads(data)
            method = json_data['method']

            if method in methods:
                if 'params' in json_data:
                    await methods[method](json_data['params'])
                else:
                    await methods[method]()
                await asyncio.sleep(minimal_cmd_space)
                await ctler.ask_stats()
                stats = ctler.last_status
                print("stats", stats)
            else:
                print("Unknown method: " + data)
        except Exception as e:
            print("Exception in handle_ws: " + str(e))
            break

@sock.route('/echo')
def echo(ws):
    print("Websocket connected")
    loop = get_or_create_eventloop()
    loop.run_until_complete(handle_ws(ws))

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5678, threaded=True)
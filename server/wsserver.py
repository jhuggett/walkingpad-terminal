import asyncio
import websockets

# To install deps:
# python3 -m pip install --no-cache-dir -r requirements.txt


import asyncio
import yaml
from datetime import date

from ph4_walkingpad import pad
from ph4_walkingpad.pad import WalkingPad, Controller
from ph4_walkingpad.utils import setup_logging


import logging
import json
import threading

import logging
logger = logging.getLogger('websockets')
logger.setLevel(logging.DEBUG)
logger.addHandler(logging.StreamHandler())


minimal_cmd_space = 0.69

log = setup_logging()
pad.logger = log
ctler = Controller()

# app = Flask(__name__)
# #app.config['SOCK_SERVER_OPTIONS'] = {'ping_interval': 25}
# CORS(app, resources={r"/*": {"origins": "*"}})

# sock = Sock(app)

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

async def connect(params):
    print("Connecting")
    address = load_config()['address']
    print("Connecting to {0}".format(address))
    await ctler.run(address)
    await asyncio.sleep(minimal_cmd_space)
    

async def disconnect(params):
    await ctler.disconnect()
    await asyncio.sleep(minimal_cmd_space)

async def run(params):
    await ctler.switch_mode(WalkingPad.MODE_STANDBY) # Ensure we start from a known state, since start_belt is actually toggle_belt
    await asyncio.sleep(minimal_cmd_space)
    await ctler.switch_mode(WalkingPad.MODE_MANUAL)
    await asyncio.sleep(minimal_cmd_space)
    await ctler.start_belt()
    await asyncio.sleep(minimal_cmd_space)
    await ctler.ask_hist(0)
    await asyncio.sleep(minimal_cmd_space)

async def stop(params):
    await ctler.switch_mode(WalkingPad.MODE_STANDBY)
    await asyncio.sleep(minimal_cmd_space)
    await ctler.ask_hist(0)
    await asyncio.sleep(minimal_cmd_space)

async def set_speed(params):
    await ctler.change_speed(params['speed'])


async def get_stats(params):
    # global current_record
    # print("stats", current_record)
    await ctler.ask_stats()
    await asyncio.sleep(minimal_cmd_space)
    stats = ctler.last_status

    return {
        "dist": stats.dist,
        "time": stats.time,
        "speed": stats.speed,
        "state": stats.belt_state,
        "steps": stats.steps,
    }


async def pong(params):
  return {
      "method": "pong"
  }


methods = {
    "connect": connect,
    "disconnect": disconnect,
    "run": run,
    "stop": stop,
    "set_speed": set_speed,
    # "set_to_standby": set_to_standby,
    "get_stats": get_stats,
    "ping": pong
}

async def handle_method(ws, id, method, params):
  result = await methods[method](params)

  if result is not None:
    await ws.send(json.dumps({
      "id": id,
      "result": result
    }))
  else:
    await ws.send(json.dumps({
      "id": id,
      "result": "ok"
    }))

async def consumer(data, ws):
    if data == "pong":
        print("Pong received")
        return

    json_data = json.loads(data)
    method = json_data['method']

    if method in methods:
        # if 'params' in json_data:
        #     print("Params")
        #     asyncio.ensure_future(methods[method](json_data['params']))
        # else:
        #     print("No params")
        #     cb = methods[method]
        #     print("cb", cb)
        #     asyncio.ensure_future(cb())

        asyncio.ensure_future(handle_method(ws, json_data.get('id'), method, json_data.get(
            'params'
        )))

        # await asyncio.sleep(minimal_cmd_space)
        # await ctler.ask_stats()
        # stats = ctler.last_status
        # print("stats", stats)

        # await asyncio.sleep(minimal_cmd_space)
        # await ctler.ask_stats()
        # stats = ctler.last_status
    else:
        print("Unknown method: " + data)

async def consumer_handler(websocket):
    async for message in websocket:
        print("Received message: " + message)
        await consumer(message, websocket)

# async def handle_ws(ws):
#     # greeting = f"Hello {name}!"

#     # await websocket.send(greeting)
#     # print(f">>> {greeting}")

#     while True:
#         print("Waiting for data")
#         try:
#             data = await ws.recv()
#             print("Received data: " + data)

#             json_data = json.loads(data)
#             method = json_data['method']

#             if method in methods:
#                 if 'params' in json_data:
#                     print("Params")
#                     asyncio.ensure_future(methods[method](json_data['params']))
#                 else:
#                     print("No params")
#                     cb = methods[method]
#                     print("cb", cb)
#                     asyncio.ensure_future(cb())
#                 await asyncio.sleep(minimal_cmd_space)
#                 await ctler.ask_stats()
#                 stats = ctler.last_status
#                 # print("stats", stats)
#             else:
#                 print("Unknown method: " + data)
#         except Exception as e:
#             print("Exception in handle_ws: " + str(e))
            
#     print("Done handling ws")



# @sock.route('/echo')
# def echo(ws):
#     print("Websocket connected")

#     #loop.run_until_complete(handle_ws(ws, loop))

#     loop = get_or_create_eventloop()

#     def on_new_status(sender, record):
#         global current_record
#         print("Received Record: {0}".format(record))
#         current_record = record
#         ws.send(json.dumps({
#             "dist": record.dist,
#             "time": record.time,
#             "speed": record.speed,
#             "state": record.belt_state,
#         }))

#     ctler.on_cur_status_received = on_new_status
    
#     asyncio.ensure_future(handle_ws(ws))

#     loop.run_forever()
#     # handle_ws(ws, loop)

# if __name__ == '__main__':
#     app.logger.setLevel(logging.DEBUG)
#     app.run(debug=True, host='0.0.0.0', port=5678, threaded=True)
    
# async def ws(websocket):
#     print("Websocket connected")
    
#     async def on_new_status(sender, record):
#       global current_record
#       print("Received Record: {0}".format(record))
#       current_record = record
#       await websocket.send(json.dumps({
#           "dist": record.dist,
#           "time": record.time,
#           "speed": record.speed,
#           "state": record.belt_state,
#       }))

#     ctler.on_cur_status_received = on_new_status


#     await handle_ws(websocket)


async def main():
    async with websockets.serve(consumer_handler, "localhost", 8765, ping_timeout=None, ping_interval=None):
        print("Server is ready")
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
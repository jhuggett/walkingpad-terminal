import { SubscribableEvent } from "@jhuggett/terminal/subscribable-event";
import Database from "bun:sqlite";
import { Session } from "./data/models/session";
import { debug } from ".";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Stats = {
  dist: number;
  time: number;
  speed: number;
  state: number;
  steps: number;
};

const parseStats = (stats: object): Stats => {
  return { ...stats } as Stats;
};

export class Treadmill {
  constructor(private db: Database) {}

  private connection?: WebSocket;

  onSpeedChanged = new SubscribableEvent<number>();
  currentSpeed = 16;

  onStatusUpdate = new SubscribableEvent<void>();

  get connected() {
    return this.connection?.readyState === WebSocket.OPEN;
  }

  expectedResponses: Map<
    string,
    {
      resolve: (value: string | PromiseLike<string>) => void;
      reject: (reason?: any) => void;
    }
  > = new Map();

  private send(method: string, params?: any) {
    const id = Math.random().toString(36).substr(2, 9);

    this.connection?.send(JSON.stringify({ id, method, params }));

    const response = new Promise<any>((resolve, reject) => {
      this.expectedResponses.set(id, {
        resolve,
        reject,
      });
    });

    return response;
  }

  receiveResponse(id: string, result: string) {
    const expectedResponse = this.expectedResponses.get(id);
    if (!expectedResponse) {
      return;
    }
    expectedResponse.resolve(result);
  }

  async connectToService() {
    this.connection = new WebSocket("ws://127.0.0.1:8765");

    this.connection.onmessage = (event) => {
      const message = JSON.parse(event.data as string);
      if (message.id) {
        this.receiveResponse(message.id, message.result);
      } else {
        debug.log("treadmill", "warning", `unknown message: ${event}`);
        //console.warn("unknown message", event);
      }
    };

    return new Promise<void>((resolve, reject) => {
      this.connection!.addEventListener("open", () => {
        debug.log("treadmill", "info", "connected");
        resolve();
      });

      this.connection!.addEventListener("close", () => {
        //console.log("disconnected");
        debug.log("treadmill", "info", "disconnected");
      });

      this.connection!.addEventListener("error", (error) => {
        debug.log("treadmill", "error", `error: ${error}`);
        reject(error);
      });
    });
  }

  bleConnected = false;
  onBleConnected = new SubscribableEvent<void>();
  async connect() {
    await this.send("connect");
    this.bleConnected = true;
    this.onBleConnected.emit();
  }

  disconnect() {
    return this.send("disconnect");
  }

  running = false;

  lastRun?: Date;
  async run() {
    if (this.running) {
      return;
    }
    await this.send("run");
    this.running = true;
    this.lastRun = new Date();

    this.watchStatus();
  }

  stats?: Stats;
  async getStats() {
    debug.log("treadmill", "info", "getting stats");
    const stats = await this.send("get_stats");

    const parsedStats = parseStats(stats);

    debug.log("treadmill", "debug", { parsedStats });

    this.stats = parsedStats;

    debug.log("treadmill", "info", "got stats");
    this.onStatusUpdate.emit();
  }

  async watchStatus() {
    while (this.running) {
      await this.getStats();
      await sleep(5000);
    }
  }

  async stop() {
    if (!this.running) {
      return;
    }
    debug.log("treadmill", "info", "stopping");

    await this.send("stop");

    await this.getStats();

    this.running = false;

    Session.create(this.db, {
      distance: this.stats?.dist ?? 0,
      duration: this.stats?.time ?? 0,
      steps: this.stats?.steps ?? 0,
    });

    this.stats = undefined;
    this.onStatusUpdate.emit();
    this.currentSpeed = 16;

    debug.log("treadmill", "info", "stopped");
  }

  private async setSpeed(speed: number) {
    debug.log("treadmill", "info", `setting speed to ${speed}`);
    await this.send("set_speed", { speed });
    this.onSpeedChanged.emit(speed);
    debug.log("treadmill", "info", `speed set to ${speed}`);
  }

  private increment = 4;

  increaseSpeed() {
    this.currentSpeed += this.increment;
    if (this.currentSpeed > 60) {
      this.currentSpeed = 60;
    }
    return this.setSpeed(this.currentSpeed);
  }

  decreaseSpeed() {
    this.currentSpeed -= this.increment;
    if (this.currentSpeed < 0) {
      this.currentSpeed = 0;
    }
    return this.setSpeed(this.currentSpeed);
  }
}

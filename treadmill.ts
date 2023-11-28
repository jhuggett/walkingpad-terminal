import { SubscribableEvent } from "@jhuggett/terminal/subscribable-event";

export class Treadmill {
  private connection?: WebSocket;

  onSpeedChanged = new SubscribableEvent<number>();
  currentSpeed = 16;

  get connected() {
    return this.connection?.readyState === WebSocket.OPEN;
  }

  private send(method: string, params?: any) {
    this.connection?.send(JSON.stringify({ method, params }));
  }

  async connectToService() {
    this.connection = new WebSocket("ws://127.0.0.1:5678/echo");

    return new Promise<void>((resolve, reject) => {
      this.connection!.addEventListener("open", () => {
        resolve();
      });

      this.connection!.addEventListener("error", (error) => {
        reject(error);
      });
    });
  }

  connect() {
    this.send("connect");
  }

  disconnect() {
    this.send("disconnect");
  }

  running = false;

  run() {
    if (this.running) {
      return;
    }
    this.send("run");
    this.running = true;
  }

  stop() {
    if (!this.running) {
      return;
    }
    this.send("stop");
    this.running = false;
    this.currentSpeed = 16;
  }

  private setSpeed(speed: number) {
    this.send("set_speed", { speed });
    this.onSpeedChanged.emit(speed);
  }

  private increment = 4;

  increaseSpeed() {
    this.currentSpeed += this.increment;
    if (this.currentSpeed > 60) {
      this.currentSpeed = 60;
    }
    this.setSpeed(this.currentSpeed);
  }

  decreaseSpeed() {
    this.currentSpeed -= this.increment;
    if (this.currentSpeed < 0) {
      this.currentSpeed = 0;
    }
    this.setSpeed(this.currentSpeed);
  }
}

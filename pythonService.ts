import { spawn, ChildProcess } from "child_process";
import { debug } from "./index";

export class PythonService {
  private process?: ChildProcess;

  shutdown() {
    this.process?.kill();
  }

  static async start() {
    const service = new PythonService();

    await service.spawn();

    return service;
  }

  private async spawn() {
    const pythonProcess = spawn("python3", ["./wsserver.py"], {
      cwd: "./server",
    });

    this.process = pythonProcess;

    let processIsReady = false;

    pythonProcess.stdout.on("data", (data) => {
      //this.debug && console.log(`stdout: ${data}`);
      debug.log("python", "info", `stdout: ${data}`);
    });

    pythonProcess.stderr.on("data", (data) => {
      if (data.includes("server listening on 127.0.0.1:8765")) {
        processIsReady = true;
      }
      debug.log("python", "debug", `stderr: ${data}`);

      //this.debug && console.error(`stderr: ${data}`);
    });

    const waitForProcess = () =>
      new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (processIsReady) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });

    await waitForProcess();
  }
}

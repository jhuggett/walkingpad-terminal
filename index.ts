import { BunShell, gray, green } from "@jhuggett/terminal";
import { within } from "@jhuggett/terminal/bounds/bounds";
import { Treadmill } from "./treadmill";
import { timeSince } from "./timeSince";
import { spawn } from "child_process";
import { sleep } from "bun";
import { PythonService } from "./pythonService";
import { getDBConnection } from "./data/database";
import { Session } from "./data/models/session";

// For sqlite replication
// https://litestream.io/

export const db = await getDBConnection();

let report = Session.summaryOfToday(db);

const rerunReport = () => {
  report = Session.summaryOfToday(db);
};

Session.onCreate.subscribe(rerunReport);

const pythonService = await PythonService.start();

const treadmill = new Treadmill(db);

await treadmill.connectToService();

treadmill.connect();

const shell = new BunShell();
shell.showCursor(false);
shell.clear();

const root = shell.rootElement;

shell.onWindowResize(() => {
  shell.invalidateCachedSize();
  shell.clear();
  root.recalculateBounds();
  shell.render();
});

let stopProgram = false;

try {
  const container = root.createChildElement(
    () => within(root, { paddingLeft: 2, paddingTop: 1 }),
    {}
  );

  container.renderer = ({ cursor }) => {
    cursor.write(
      `Treadmill ${treadmill.bleConnected ? "connected" : "connecting"}`,
      {
        foregroundColor: gray(0.75),
        bold: true,
      }
    );
    cursor.newLine();
    cursor.write(
      `TODAY Distance: ${report.distance} | Steps: ${report.steps} | Time: ${report.duration}`,
      {
        foregroundColor: gray(0.75),
        bold: true,
      }
    );

    cursor.newLine();
    cursor.write(
      `CURRENT Distance: ${treadmill.stats?.dist ?? 0} | Steps: ${
        treadmill.stats?.steps ?? 0
      } | Time: ${treadmill.stats?.time ?? 0} | Speed: ${
        treadmill.stats?.speed ?? 0
      }`,
      {
        foregroundColor: gray(0.75),
        bold: true,
      }
    );

    cursor.newLine();
    cursor.newLine();

    if (treadmill.running) {
      cursor.write("Treadmill Running", {
        foregroundColor: green(0.75),
        bold: true,
      });
      if (treadmill.lastRun) {
        cursor.write(` (${timeSince(treadmill.lastRun)})`, {
          foregroundColor: gray(0.75),
        });
      }
      cursor.newLine();
      cursor.newLine();
      cursor.write("<- ", {
        foregroundColor: gray(0.75),
        bold: true,
      });
      cursor.write(`${(treadmill.currentSpeed / 4) * 0.25}`, {
        foregroundColor: {
          r: 255,
          g: 0,
          b: 255,
          a: 1,
        },
        bold: true,
      });
      cursor.write(" ->", {
        foregroundColor: gray(0.75),
        bold: true,
      });
    } else {
      cursor.write("Treadmill stopped", {
        foregroundColor: gray(0.5),
        italic: true,
      });
    }
  };

  treadmill.onSpeedChanged.subscribe((speed) => {
    container.render();
    shell.render();
  });

  treadmill.onStatusUpdate.subscribe(() => {
    container.render();
    shell.render();
  });

  treadmill.onBleConnected.subscribe(() => {
    container.render();
    shell.render();
  });

  container.focus();

  container.on("Enter", () => {
    if (treadmill.running) {
      treadmill.stop();
    } else {
      treadmill.run();
    }
  });

  container.on("Space", () => {
    if (treadmill.running) {
      treadmill.stop();
    } else {
      treadmill.run();
    }
  });

  container.on("Arrow Left", () => {
    treadmill.decreaseSpeed();
  });

  container.on("Arrow Right", () => {
    treadmill.increaseSpeed();
  });

  container.on("Escape", () => {
    stopProgram = true;
  });

  while (!stopProgram) {
    container.render();
    shell.render();
    await shell.userInteraction();
  }
} catch (error) {
  console.error(error);
}

treadmill.disconnect();

shell.disableMouseTracking();
shell.showCursor(true);

pythonService.shutdown();

process.exit();

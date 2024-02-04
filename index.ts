import { BunShell, blue, gray, green, red, yellow } from "@jhuggett/terminal";
import { within } from "@jhuggett/terminal/bounds/bounds";
import { Treadmill } from "./treadmill";
import { timeSince } from "./timeSince";
import { spawn } from "child_process";
import { sleep } from "bun";
import { PythonService } from "./pythonService";
import { getDBConnection } from "./data/database";
import { Session } from "./data/models/session";
import { Debug } from "./debug";

// For sqlite replication
// https://litestream.io/

const toMiles = (km: number) => {
  return (km * 0.621371).toFixed(2);
};

export const debug = new Debug();

const representTime = (time: number) => {
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time - hours * 3600) / 60);
  const seconds = Math.floor(time - hours * 3600 - minutes * 60);

  return `${hours}:${minutes}:${seconds}`;
};

export const db = await getDBConnection();

let todaysReport = Session.summary(Session.today(db));
let weeksReport = Session.summary(Session.thisWeek(db));

const rerunReports = () => {
  todaysReport = Session.summary(Session.today(db));
  weeksReport = Session.summary(Session.thisWeek(db));
};

Session.onCreate.subscribe(rerunReports);

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
  const content = root.createChildElement(() => {
    return {
      start: {
        x: root.bounds.globalStart.x,
        y: root.bounds.globalStart.y,
      },
      end: {
        x: root.bounds.globalEnd.x,
        y: Math.floor(root.bounds.globalEnd.y / 2),
      },
    };
  }, {});

  content.renderer = ({ cursor }) => {
    cursor.properties.backgroundColor = blue(0.05);
    cursor.fill(" ");
  };

  content.render();

  const debugElement = root.createChildElement(() => {
    return {
      start: {
        x: root.bounds.globalStart.x,
        y: Math.floor(root.bounds.globalEnd.y / 2),
      },
      end: {
        x: root.bounds.globalEnd.x,
        y: root.bounds.globalEnd.y,
      },
    };
  }, {});

  debug.registerElement(debugElement);

  const container = root.createChildElement(
    () => within(content, { paddingLeft: 2, paddingTop: 1 }),
    {}
  );

  container.renderer = ({ cursor }) => {
    cursor.write("Week's total", {
      foregroundColor: gray(0.75),
      bold: true,
      underline: true,
    });
    cursor.newLine();

    cursor.write(
      `${representTime(weeksReport.duration)} • ${toMiles(
        weeksReport.distance / 100
      )}mi • ${weeksReport.steps} steps`,
      {
        foregroundColor: gray(0.75),
        bold: true,
      }
    );

    cursor.newLine();
    cursor.newLine();

    cursor.write("Today's total", {
      foregroundColor: gray(0.75),
      bold: true,
      underline: true,
    });
    cursor.newLine();

    cursor.write(
      `${representTime(todaysReport.duration)} • ${toMiles(
        todaysReport.distance / 100
      )}mi • ${todaysReport.steps} steps`,
      {
        foregroundColor: gray(0.75),
        bold: true,
      }
    );

    cursor.newLine();
    cursor.newLine();

    cursor.write("Current Session", {
      foregroundColor: gray(0.75),
      bold: true,
      underline: true,
    });
    cursor.newLine();
    cursor.write(
      `${representTime(treadmill.stats?.time ?? 0)} • ${
        treadmill.stats?.dist ? toMiles(treadmill.stats.dist / 100) : 0
      }mi • ${treadmill.stats?.steps ?? 0} steps`,
      {
        foregroundColor: gray(0.75),
        bold: true,
      }
    );

    cursor.newLine();
    cursor.newLine();

    cursor.write(
      `Treadmill is ${treadmill.bleConnected ? "connected" : "connecting"}`,
      {
        foregroundColor: treadmill.bleConnected ? green(0.5) : yellow(0.5),
        bold: true,
      }
    );
    cursor.newLine();
    cursor.newLine();

    if (treadmill.running) {
      cursor.write("Belt is running", {
        foregroundColor: yellow(0.75),
        bold: true,
      });
      cursor.newLine();
      cursor.newLine();
      cursor.write("<- ", {
        foregroundColor: gray(0.75),
        bold: true,
      });
      cursor.write(`${(treadmill.currentSpeed / 4) * 0.25}mi/h`, {
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
      cursor.write("Belt is stopped", {
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
  //console.error(error);
}

treadmill.disconnect();

shell.disableMouseTracking();
shell.showCursor(true);

pythonService.shutdown();

process.exit();

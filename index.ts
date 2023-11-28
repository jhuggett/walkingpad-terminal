import {
  BunShell,
  TargetMap,
  blue,
  gray,
  green,
  mergeRBGs,
  red,
  userInput,
  yellow,
} from "@jhuggett/terminal";
import { within } from "@jhuggett/terminal/bounds/bounds";
import axios from "axios";
import { Treadmill } from "./treadmill";

const treadmill = new Treadmill();

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
    cursor.write("Treadmill", {
      underline: true,
      foregroundColor: mergeRBGs(blue(1, 0.6), yellow(1)),
    });
    cursor.newLine();
    cursor.newLine();

    if (treadmill.running) {
      cursor.write("Speed: < ", {
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
      });
      cursor.write(" >", {
        foregroundColor: gray(0.75),
        bold: true,
      });

      cursor.newLine();
      cursor.newLine();

      cursor.write("Running", {
        foregroundColor: green(0.75),
        bold: true,
      });
      cursor.write(" Press [Enter] to stop", {
        foregroundColor: gray(0.5),
        italic: true,
      });
    } else {
      cursor.write("Stopped", {
        foregroundColor: red(0.75),
        bold: true,
      });
      cursor.write(" Press [Enter] to start", {
        foregroundColor: gray(0.5),
        italic: true,
      });
    }
  };

  treadmill.onSpeedChanged.subscribe((speed) => {
    container.render();
  });

  container.focus();

  container.on("Enter", () => {
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

process.exit();

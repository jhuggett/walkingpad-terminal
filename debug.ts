import { Element, OutOfBoundsError } from "@jhuggett/terminal/elements/element";

const LogLevels = [
  {
    name: "info",
    color: { r: 100, g: 255, b: 100, a: 1 },
    shorthand: "inf",
  },
  {
    name: "warning",
    color: { r: 255, g: 255, b: 100, a: 1 },
    shorthand: "wrn",
  },
  {
    name: "error",
    color: { r: 255, g: 100, b: 100, a: 1 },
    shorthand: "err",
  },
  {
    name: "debug",
    color: { r: 100, g: 100, b: 255, a: 1 },
    shorthand: "dbg",
  },
] as const;

type LogLevel = (typeof LogLevels)[number]["name"];

const Topics = [
  {
    name: "general",
    color: { r: 255, g: 255, b: 100, a: 1 },
    shorthand: "General",
  },
  {
    name: "python",
    color: { r: 200, g: 100, b: 100, a: 1 },
    shorthand: "Python",
  },
  {
    name: "treadmill",
    color: { r: 50, g: 100, b: 55, a: 1 },
    shorthand: "Treadmill",
  },
] as const;
type Topic = (typeof Topics)[number]["name"];

type Log = {
  topic: (typeof Topics)[number];
  level: (typeof LogLevels)[number];
  message: string;
  timestamp: Date;
};

export class Debug {
  maxLogs = 5000;

  element?: Element<void>;

  logs: Log[] = [];

  log(topic: Topic, level: LogLevel, message: any) {
    this.logs.unshift({
      level: LogLevels.find((l) => l.name === level)!,
      message: Bun.inspect(message).replaceAll("\t", ""),
      topic: Topics.find((t) => t.name === topic)!,
      timestamp: new Date(),
    });

    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    if (this.element) {
      this.element.render();
      this.element.shell.render();
    }
  }

  registerElement(element: Element<any>) {
    element.renderer = ({ cursor, bounds }) => {
      let availableHeight = bounds.height - 1;

      for (const log of this.logs) {
        const timestamp = log.timestamp.toLocaleTimeString();
        const topic = log.topic.shorthand;
        const level = log.level.shorthand;
        const message = log.message.replaceAll("\n", "");

        const length =
          timestamp.length +
          1 +
          topic.length +
          1 +
          level.length +
          1 +
          message.length;

        availableHeight -= Math.ceil(length / bounds.width);

        if (availableHeight <= 0) {
          break;
        }

        cursor.moveTo({ x: 0, y: availableHeight });

        try {
          cursor.write(timestamp + " ", {
            foregroundColor: { r: 100, g: 100, b: 100, a: 1 },
          });
          cursor.write(topic + " ", {
            foregroundColor: log.topic.color,
          });
          cursor.write(level + " ", {
            foregroundColor: log.level.color,
          });
          cursor.write(message, {
            foregroundColor: { r: 255, g: 255, b: 255, a: 1 },
          });
        } catch (error) {
          if (error instanceof OutOfBoundsError) {
            break;
          } else {
            throw error;
          }
        }
      }
    };

    this.element = element;

    element.render();
    this.element.shell.render();
  }
}

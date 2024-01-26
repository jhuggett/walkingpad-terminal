import Database from "bun:sqlite";
import { DBTable } from "../table";
import { SubscribableEvent } from "@jhuggett/terminal/subscribable-event";

type SessionProps = {
  id: number;
  distance: number;
  steps: number;
  duration: number;
};

export type CreateSessionProps = Omit<SessionProps, "id" | "created_at">;

class SessionsTable extends DBTable<CreateSessionProps, SessionProps> {
  tableName = "sessions";
}

export class Session {
  static table(db: Database) {
    return new SessionsTable(db);
  }

  constructor(public props: SessionProps) {}

  save(db: Database) {
    Session.table(db).updateRow(this.props.id, this.props);
  }

  static onCreate: SubscribableEvent<Session> = new SubscribableEvent();
  static create(db: Database, payload: CreateSessionProps) {
    const row = Session.table(db).createRow(payload);

    if (row === null) throw new Error("Could not find created Session");

    return new Session(row);
  }

  static find(db: Database, id: number) {
    const row = Session.table(db).getRow(id);
    return new Session(row as SessionProps);
  }

  static all(db: Database) {
    const rows = Session.table(db).allRows();
    return rows.map((row) => new Session(row as SessionProps));
  }

  static today(db: Database) {
    const startOfDay = new Date();
    startOfDay.setHours(0, startOfDay.getTimezoneOffset(), 0, 0);

    console.log({ startOfDay, iso: startOfDay.toISOString() });

    return Session.table(db)
      .since(startOfDay)
      .map((row) => new Session(row));
  }

  static summaryOfToday(db: Database) {
    const sessions = Session.today(db);

    const totalDistance = sessions.reduce((acc, session) => {
      return acc + session.props.distance;
    }, 0);

    const totalSteps = sessions.reduce((acc, session) => {
      return acc + session.props.steps;
    }, 0);

    const totalDuration = sessions.reduce((acc, session) => {
      return acc + session.props.duration;
    }, 0);

    return {
      distance: totalDistance,
      steps: totalSteps,
      duration: totalDuration,
    };
  }
}

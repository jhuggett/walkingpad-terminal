import { Database } from "bun:sqlite";
import { readdirSync } from "fs";
import { join } from "path";

const DB_PATH = "db.sqlite";

const createMigrationsTable = (db: Database) => {
  db.run(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

const migrate = async (db: Database) => {
  const migrations = readdirSync(join(import.meta.dir, "db-migrations"));

  const orderedMigrations = migrations.sort((a, b) => {
    const aVersion = parseInt(a.split("_")[0]);
    const bVersion = parseInt(b.split("_")[0]);

    return aVersion - bVersion;
  });

  for (const migration of orderedMigrations) {
    const migrationName = migration.split(".")[0];

    const migrationExistsQuery = db.query(
      "SELECT * FROM migrations WHERE name = $migrationName"
    );

    const migrationExists = migrationExistsQuery.get({
      $migrationName: migrationName,
    });

    migrationExistsQuery.finalize();

    if (migrationExists) {
      continue;
    }

    const migrationFile = Bun.file(
      join(import.meta.dir, "db-migrations", migration)
    );

    db.run(await migrationFile.text());

    db.prepare("INSERT INTO migrations (name) VALUES ($migrationName)").run({
      $migrationName: migrationName,
    });
  }
};

export const getDBConnection = async () => {
  const db = new Database(DB_PATH);

  db.run(`PRAGMA foreign_keys = ON;`);

  createMigrationsTable(db);

  await migrate(db);

  return db;
};

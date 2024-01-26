import Database from "bun:sqlite";

export abstract class DBTable<
  TCreateProps extends object,
  TPayload extends object
> {
  abstract tableName: string;

  constructor(public db: Database) {}

  lastRowId() {
    const rowid = this.db
      .query("SELECT last_insert_rowid()")
      .values()?.[0]?.[0];

    if (typeof rowid !== "number") {
      throw new Error("Could not get last inserted rowid");
    }

    return rowid as number;
  }

  getRow(id: number) {
    const row = this.db
      .query(`SELECT * FROM ${this.tableName} WHERE id = $id`)
      .get({ $id: id });

    if (row === null) return null;

    return row as TPayload;
  }

  createRow(props: TCreateProps) {
    const columns = Object.keys(props);
    const values = Object.values(props);

    const columnsString = columns.join(", ");
    const columnsStringWith$ = columns.map((column) => `$${column}`).join(", ");

    this.db
      .query(
        `INSERT INTO ${this.tableName} (${columnsString}) VALUES (${columnsStringWith$})`
      )
      .run(
        Object.fromEntries(
          columns.map((column, i) => [`$${column}`, values[i]])
        )
      );

    const rowid = this.lastRowId();

    return this.getRow(rowid);
  }

  allRows() {
    return this.db.query(`SELECT * FROM ${this.tableName}`).all() as TPayload[];
  }

  where(props: Partial<TPayload>) {
    const columns = Object.keys(props);
    const values = Object.values(props);

    const conditions = columns
      .map((column) => `${column} = $${column}`)
      .join(" AND ");

    const query = this.db.query(
      `SELECT * FROM ${this.tableName} WHERE ${conditions}`
    );
    const results = query.all(
      Object.fromEntries(
        columns.map((column, i) => [`$${column}`, values[i]])
      ) as any
    ) as TPayload[];

    return results;
  }

  updateRow(id: number, props: Partial<TPayload>) {
    const columns = Object.keys(props);
    const values = Object.values(props);

    const conditions = columns
      .map((column) => `${column} = $${column}`)
      .join(", ");

    const query = this.db.query(
      `UPDATE ${this.tableName} SET ${conditions} WHERE id = $id`
    );
    query.run(
      Object.fromEntries(
        columns.map((column, i) => [`$${column}`, values[i]])
      ) as any
    );

    return this.getRow(id);
  }

  since(date: Date) {
    const query = this.db.query(
      `SELECT * FROM ${this.tableName} WHERE created_at >= date($date)`
    );
    const results = query.all({ $date: date.toISOString() }) as TPayload[];

    return results;
  }
}

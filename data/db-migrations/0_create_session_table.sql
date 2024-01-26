create table sessions (
    id        integer primary key not null,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    distance integer not null,
    duration integer not null,
    steps integer not null
);

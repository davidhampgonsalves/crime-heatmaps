create table crimes_by_year (
  year int not null,
  crimes jsonb default '[]',
  primary key(year)
);

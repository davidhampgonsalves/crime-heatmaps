create table crimes (
  id int not null,
  type text not null,
  latitude decimal(10,5) not null,
  longitude decimal(10,5) not null,
  at timestamp not null,
  primary key(id)
);

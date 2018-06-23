const pg = require('pg');
const parse = require('pg-connection-string').parse;
const R = require('ramda');

const pgUrl = process.env.DATABASE_URL;
const pgOptions = R.merge(parse(pgUrl), {ssl: true});

const years = R.range(2013, 2019);

const client = new pg.Client(pgOptions);
client.connect(function (err) {
  if (err)
    return console.error(err);

  R.forEach(year => {
    client.query(`SELECT * from crimes where at between '${year}-01-01'::DATE and '${year+1}-01-01'::DATE order by at`, function(err, result) {
      if(err)
        return console.error('error running query', err);

      const crimes = R.map((c) => {
        const date = new Date(c.at);
        return {
          latitude: Number(c.latitude),
          longitude: Number(c.longitude),
          type: c.type,
          at: date,
        };
      }, result.rows);

      client.query('insert into crimes_by_year(year, crimes) values($1::int, $2::jsonb)', [year, JSON.stringify(crimes)], function (err, result) {
        if (err)
          return console.error(err);
        else
          console.log(`inserted crimes for ${year}`);
      });
    });
  }, years);
});

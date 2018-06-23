var express = require("express");

var path = require('path');

const pg = require('pg');
const parse = require('pg-connection-string').parse;
const R = require('ramda');

const pgUrl = process.env.DATABASE_URL;
const pgOptions = R.merge(parse(pgUrl), {ssl: true});

const pool = new pg.Pool(pgOptions);

var app = express();
app.configure(function(){
  app.set('views', __dirname + '/views');
  app.engine('html', require('ejs').renderFile);

  app.use(express.static(path.join(__dirname, 'js')));
  app.use(express.static(path.join(__dirname, 'img')));
  app.use(express.favicon(__dirname + '/images/favicon.ico'));

  app.use(express.logger());
});

const crimeTypes = {'THEFT FROM VEHICLE':0, 'THEFT OF VEHICLE': 1, 'BREAK AND ENTER':2, 'ASSAULT': 3, 'ROBBERY': 4};
app.get('/', handleDataRequest);
app.get('/:year', handleDataRequest);

function handleDataRequest(req, res) {
  res.header("Content-Type", "text/html; charset=utf-8");

  pool.connect(function(err, client, done) {
    if(err) {
      return console.error('error fetching client from pool', err);
    }

    const currentYear = new Date().getFullYear();
    const requestedYear = Number(req.params.year) || currentYear;
    console.log(requestedYear);
    client.query(`SELECT crimes from crimes_by_year where year = ${requestedYear}`, function(err, result) {
      done();

      if(err)
        return console.error('error running query', err);

      const crimes = R.pipe(
        R.path(['rows', 0, 'crimes']),
        R.sortBy(R.prop('at')),
        R.map((c) => {
          const date = new Date(c.at);
          return [Number(c.latitude), Number(c.longitude), crimeTypes[c.type], date.getMonth(), date.getDate()];
        }),
      )(result);


      const data = {
        years: R.range(2013, currentYear+1),
        crimes: crimes,
        year: requestedYear,
      };

      res.render('index.html', { data: data });
      return;
    });
  });
}

var port = process.env.PORT || 5000;
app.listen(port, function() {
  console.log("Listening on " + port);
});

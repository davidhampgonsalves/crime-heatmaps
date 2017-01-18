const fs = require('fs');
const request = require('request');
const pg = require('pg');
const parse = require('pg-connection-string').parse;
const R = require('ramda');

const pgUrl = process.env.DATABASE_URL;
const pgOptions = R.merge(parse(pgUrl), {ssl: true});
const url = 'https://services2.arcgis.com/11XBiaBYA9Ep0yNJ/ArcGIS/rest/services/Crime/FeatureServer/0/query?f=json&where=1%3D1&returnGeometry=true&spatialRel=esriSpatialRelIntersects&outFields=*&outSR=102100&resultOffset=0&resultRecordCount=1000';

request({url:url, json:true}, (error, response, json) => {
  if (!error && response.statusCode == 200) {
    writeJsonToDatabase(json);
  }
})

const writeJsonToDatabase = (json) => {
  const crimes = R.map((crime) => {
    const a = crime.attributes;
    const point = toGeographic(crime.geometry.x, crime.geometry.y);
    return {
      id: a['EVT_RIN'],
      type: a['RUCR_EXT_D'],
      at: new Date(a['EVT_DATE']),
      latitude: point.latitude,
      longitude: point.longitude,
    };
  }, json.features);

  console.log(`writing ${crimes.length} to database`);
  storeCrimes(crimes);
}

function toGeographic(xMercator, yMercator) {
  if (Math.abs(xMercator) < 180 && Math.abs(yMercator) < 90)
     return null;
  if ((Math.abs(xMercator) > 20037508.3427892) || (Math.abs(yMercator) > 20037508.3427892))
      return null;
  var x = xMercator;
  var y = yMercator;
  var w1 = x = x / 6378137.0;
  var w2 = x * 57.295779513082323;
  var w3 = Math.floor((x + 180.0) / 360.0);
  x = w2 - (w3 * 360.0);
  y = (1.5707963267948966 - (2.0 * Math.atan(Math.exp((-1.0 * y) / 6378137.0)))) * 57.295779513082323;
  return {
    longitude: x,
    latitude: y
  }
}

//fs.readFile('base-data.xml', 'utf8', function(err, data) { writeXmlToDatabase(data); });
function writeXmlToDatabase(data) {
  var index = 0;
  var tag;
  var count = 0;
  var coordinateAccuracy = 3;
  var newCrimes = [];
  while(true) {
    tag = getNextTagValue('EVT_RIN', data, index);
    if(tag === null)
      break;
    index = tag.index;
    var id = tag.value;

    tag = getNextTagValue('EVT_DATE', data, index);
    index = tag.index;
    var date = new Date(tag.value);

    tag = getNextTagValue('RUCR_EXT', data, index);
    index = tag.index;
    var type = tag.value;

    tag = getNextTagValue('coordinates', data, index);
    // HACK - sometimes there aren't coords, api must have changed so just skip these
    if( tag === null )
      continue;

    index = tag.index;
    var latAndLon = tag.value.split(",");
    var longitude = round(new Number(latAndLon[0]), coordinateAccuracy);
    var latitude = round(new Number(latAndLon[1]), coordinateAccuracy);

    count += 1;

    newCrimes.push({id: id, latitude: latitude, longitude: longitude, type: type, at: date});
  }

  storeCrimes(newCrimes);
}

const storeCrimes = (crimes) => {
  if(R.isEmpty(crimes)) {
    console.log('done');
    return
  }

  const crime = R.last(crimes);
  const client = new pg.Client(pgOptions);
  client.connect(function (err) {
    if (err)
      console.error(err);

    console.log(`persisting ${crime.id} to db`);
    client.query('insert into crimes(id, latitude, longitude, type, at) values($1::int, $2::float, $3::float, $4::text, $5::date)',
        [crime.id, crime.latitude, crime.longitude, crime.type, crime.at], function (err, result) {
      if (err)
        console.error(err);

      client.end(function (err) {
        if (err) throw err;
        storeCrimes(R.dropLast(1, crimes));
      });
    });
  });
}

function round(value, places) {
  var multiplier = Math.pow(10, places);
  return (Math.round(value * multiplier) / multiplier);
}

function getNextTagValue(name, xml, index) {
  index = xml.indexOf(name, index);
  if(index === -1)
    return null;
  else
    index += name.length;

  index =  xml.indexOf('>', index) + 1;
  end =  xml.indexOf('<', index);

  return {value: xml.substring(index, end), index: end};
}

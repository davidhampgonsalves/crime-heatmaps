var fs = require('fs');
var Shred = require("shred");
var mongo = require('mongodb');

var mongoUri = process.env.MONGOHQ_URL ||
  'mongodb://crimes:theendhasnoend@paulo.mongohq.com:10029/app17982596';

var shred = new Shred();
shred.get({
  url: "http://catalogue.hrm.opendata.arcgis.com/datasets/f6921c5b12e64d17b5cd173cafb23677_0.kml",
  on: {
    // You can use response codes as events
    200: function(response) {
      console.log('writing crimes to db')
      writeCrimesToDatabase(response.content.body);
    }, response : function(response) {
      console.log('oh no!! ' + response.content.body);
    }
  }
});

//Write base data to mongo
//fs.readFile('data.xml', 'utf8', function(err, data) { writeCrimesToDatabase(data); });
function writeCrimesToDatabase(data) {
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

		//write crime data to db
		//insert into crimes(esid, lat, lon, type, date) values($1, $2, $3, $4, $5)
    newCrimes.push({_id: id, latitude: latitude, longitude: longitude, type: type, date: date});
	}

	mongo.Db.connect(mongoUri, {safe:true}, function (err, db) {
	  db.collection('crimes', function(er, crimesCollection) {
	  	while(newCrimes.length > 0)
	    	crimesCollection.insert(newCrimes.pop(), function() {});

	    console.log('added ' + count + ' new records.');
	    db.close();
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

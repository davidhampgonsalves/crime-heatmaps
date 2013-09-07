var fs = require('fs');
var Shred = require("shred");


//Set PATH=c:/node;%PATH%

//https://www.halifaxopendata.ca/api/geospatial/kxfq-iuxg?method=export&format=KML
var shred = new Shred();
shred.get({
  url: "https://www.halifaxopendata.ca/api/geospatial/kxfq-iuxg?method=export&format=KML",
  on: {
    // You can use response codes as events
    200: function(response) {
		writeCrimesToDatabase(response.content.body);
	},
	response : function(response) {
		console.log('shit! ' + response.content.body);
	}
  }
});

//pull latest crime data
//fs.readFile('data.xml', 'utf8', function(err, data) { writeCrimesToDatabase(data); });

function writeCrimesToDatabase(data) {
	var index = 0;
	var tag;
	var count = 0;
	var coordinateAccuracy = 3;
	while(true) {
		tag = getNextTagValue('EVT_RIN</span>:</strong>', data, index);
		if(tag === null)
			break;
		index = tag.index;
		var id = tag.value;

		tag = getNextTagValue('EVT_DATE</span>:</strong>', data, index);
		index = tag.index;
		var date = new Date(tag.value);

		tag = getNextTagValue('RUCR_EXT_D</span>:</strong>', data, index);
		index = tag.index;
		var type = tag.value;

		tag = getNextTagValue('longitude', data, index);
		index = tag.index;
		var longitude = round(new Number(tag.value), coordinateAccuracy);

		tag = getNextTagValue('latitude', data, index);
		index = tag.index;
		var latitude = round(new Number(tag.value), coordinateAccuracy);

		count += 1;

		//write crime data to db
		//insert into crimes(esid, lat, lon, type, date) values($1, $2, $3, $4, $5)
	    console.log(JSON.stringify([latitude, longitude, '', date]));
	}

	console.log('added ' + count + ' new records.');
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
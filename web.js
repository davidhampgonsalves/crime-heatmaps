var express = require("express");
var mongo = require('mongodb');

var path = require('path');

var mongoUri = process.env.MONGOHQ_URL ||
  process.env.MONGOHQ_URL ||
  'mongodb://crimes:theendhasnoend@paulo.mongohq.com:10029/app17982596';

var app = express();
app.configure(function(){
  app.set('views', __dirname + '/views');
  app.engine('html', require('ejs').renderFile);

  app.use(express.static(path.join(__dirname, 'js')));
  app.use(express.logger());

  app.use(express.bodyParser());
  app.use(express.methodOverride());
});


app.get('/', function(req, res) {
	var serverData = {};

	mongo.Db.connect(mongoUri, function (err, db) {
	  db.collection('crimes', function(er, collection) {
		var cursor = collection.find({}).sort({'​date':1});
		var crimes = [];
		cursor.each(function(err, crime) {
			//when our cusor is exhausted then render template
			if(crime === null) {
				serverData.crimes = crimes;
				res.render('index.html', { data: serverData });
				return;
			}
			crimes.push([crime.latitude, crime.longitude, crime.type, new Date(crimes.date).getTime()]);
		});

	  });
	});
});

var port = process.env.PORT || 5000;
app.listen(port, function() {
  console.log("Listening on " + port);
});
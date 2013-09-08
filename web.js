var express = require("express");
var app = express();
app.use(express.logger());

var mongo = require('mongodb');

var mongoUri = process.env.MONGOHQ_URL ||
  process.env.MONGOHQ_URL ||
  'mongodb://crimes:theendhasnoend@paulo.mongohq.com:10029/app17982596';

app.get('/', function(request, response) {
	mongo.Db.connect(mongoUri, function (err, db) {
	  db.collection('mydocs', function(er, collection) {
	    collection.insert({'mykey': 'myvalue'}, {safe: true}, function(er,rs) {
	    });
	  });
	});
});

var port = process.env.PORT || 5000;
app.listen(port, function() {
  console.log("Listening on " + port);
});
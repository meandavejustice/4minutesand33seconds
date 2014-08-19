var st = require("st");
var http = require("http");
var Router = require("routes-router");
var sendJson = require("send-data/json");

var send2s3 = require("./lib/send2s3.js");
var MultipartyForm = require("./lib/multipart-form.js");
var filetracker = require("./lib/filetracker.js");

var port = Number(process.env.PORT || 3000);

// bootstrap the filelist
filetracker.freshList();

var app = Router();

app.addRoute("/upload", function (req, res, opts, cb) {
  var form = MultipartyForm(req, res, {
    handlePart: function(part) {
      send2s3(part, function(err, filename) {
        if (err) console.log(err);
        filetracker.addFile(filename);
      });
    }
  }, function (err, values) {
    if (err) {
      console.log('error in multipart form', err);
    }
    console.log('File uploaded succesfully');
  });
});

app.addRoute("/files", function (req, res) {
  sendJson(req, res, filetracker.getFiles());
});

app.addRoute("/*", st({
  path: __dirname + "/public",
  url: '/',
  index: 'index.html'
}));

var server = http.createServer(app);
server.listen(port);
console.log("multipart server listening on port " + port);

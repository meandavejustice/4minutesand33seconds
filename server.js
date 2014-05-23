var express = require('express');
var crypto = require('crypto');
var http = require('http');
var path = require('path');
var logfmt = require('logfmt');
var port = Number(process.env.PORT || 3000);
var app = express();
var knox = require('knox');
var client = knox.createClient({
  key: 'AKIAIAKD3ENJNMDNTYPQ',
  secret: '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',
  bucket: '4minutesand33seconds'
});

app.use(logfmt.requestLogger());
app.use('/public', express.static(__dirname + '/public'));
// app.use(express.favicon(__dirname + 'public/images/favicon.ico'));

app.get('/', function(req, res){
  res.sendfile(__dirname + '/index.html');
});

app.post("/upload", function(req, res) {
  
  console.log('hit post handler', req.files);
  res.send('uploaded!');
});
app.listen(port);
console.log('Server running on port:', port);

function streamToS3(data, filename) {
  var headers = {
    'Content-Length': data['content-length'],
    'Content-Type': data['content-type']
  };

  client.putStream(data, '/' + filename, headers, function(err, res) {
    if (err) console.error(err);
  });
}

function getFileList() {
  client.list({ prefix: 'my-prefix' }, function(err, data){
    var urls = [];
    console.log('file list', data);

    function parseFiles(idx) {
      if (idx > data.Contents.length) {
        return urls;
      }

      urls.push(client.http(data.Contents[idx].key));
      parseFiles(idx + 1);
    }

    parseFiles(0);

    /* `data` will look roughly like:

       {
       Prefix: 'my-prefix',
       IsTruncated: true,
       MaxKeys: 1000,
       Contents: [
       {
       Key: 'whatever'
       LastModified: new Date(2012, 11, 25, 0, 0, 0),
       ETag: 'whatever',
       Size: 123,
       Owner: 'you',
       StorageClass: 'whatever'
       },
       ⋮
       ]
       }

    */
  });
}

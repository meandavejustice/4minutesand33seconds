var config = require('../config.json');
var path = require('path');
var knox = require('knox');

var client = knox.createClient({
  key: config.accessKeyId,
  secret: config.secretAccessKey,
  region: "us-west-2",
  bucket: '4minutesand33seconds'
});

var files = [];
var baseURL = "https://4minutesand33seconds.s3-us-west-2.amazonaws.com/"

module.exports = {
  freshList: function () {
    files = [];
    client.list(function(err, data){
      data.Contents.forEach(function(file) {
        if (!path.extname(file.Key) === '.wav') return;
        var imgname = path.basename(file.Key, '.wav') + '.png';
        files.push({
          filename: file.Key,
          url: baseURL + file.Key,
          imgurl: baseURL + imgname
        });
      });
    });
  },

  addFile: function (filename) {
    files.push({
      filename: filename,
      url: baseURL + filename
    });
  },

  getFiles: function () {
    return files;
  }
}

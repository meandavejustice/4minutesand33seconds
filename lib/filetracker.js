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

function formatFileObj(filename) {
  return {
    filename: filename,
    url: baseURL + filename,
    imgurl: baseURL + path.basename(filename, '.wav') + '.png'
  };
}

module.exports = {
  freshList: function () {
    files = [];
    client.list(function(err, data){
      if (err) {
        console.log('wtf', err);
      } else {
        data.Contents.forEach(function(file) {
          if (path.extname(file.Key) === '.wav') {
            files.push(formatFileObj(file.Key));
          }
        });
      }
      console.log('fresh list', files);
    });
  },

  addFile: function (filename) {
    if (path.extname(filename) === '.wav') {
      files.push(formatFileObj(filename));
    }
  },

  getFiles: function () {
    return files.reverse();
  }
}

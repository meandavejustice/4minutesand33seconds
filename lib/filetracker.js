var knox = require('knox');

var client = knox.createClient({
  key: process.env.S3ID,
  secret: process.env.S3SECRET,
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
        files.push({
          filename: file.Key,
          url: baseURL + file.Key
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

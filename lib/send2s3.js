var Uploader = require('s3-upload-stream').Uploader;

var bucketConfig = {
  "Bucket": "4minutesand33seconds",
  "ACL": "public-read",
  ContentType: "audio/mpeg"
};

var s3Config = {
  "accessKeyId": process.env.S3ID,
  "secretAccessKey": process.env.S3SECRET,
  "region": "us-west-2"
};


module.exports = function (part, cb) {
  bucketConfig.Key = part.filename;

  function processStream(err, uploadStream) {
    if(err) {
      console.log(err, uploadStream);
    } else {
      // uploadStream.on('chunk', function (data) {});
      uploadStream.on('uploaded', function (data) {
        cb(null, part.filename);
      });

      part.pipe(uploadStream);
    }
  }

  var streamObj = new Uploader(s3Config, bucketConfig, processStream);
};

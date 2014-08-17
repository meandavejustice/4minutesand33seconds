4minutesand33seconds
====================

4'33"


# installation

* npm install
* npm run start

# Running locally

You'll need to set process.env variables for Amazon s3
`S3ID=AWS-KEY-HERE S3SECRET=AWS-SECRET-HERE node server.js`

I do this by running:
`S3ID=`heroku config:get S3ID` S3SECRET=`heroku config:get S3SECRET` nodemon server.js`

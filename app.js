// Requirements
const express = require('express');
const app = express();
const fs = require('fs');
const responseTime = require('response-time');
require('dotenv').config();
const AWS = require('aws-sdk');
const imagesRouter = require('./routes/images');

// Middleware
app.use("/public", express.static('./public/'));
app.use(express.json({limit: '50mb'}));
app.use(responseTime());
app.use("/images", imagesRouter);
app.use(express.urlencoded({limit: '50mb', extended: true }));

// Cloud Service Setup
const bucketName = "tuton-bingham-a2-store";
const s3 = new AWS.S3({ apiVersion: "2006-03-01" });
(async () => {
  try {
    await s3.createBucket({ Bucket: bucketName }).promise();
    console.log(`>> Created Bucket: ${bucketName}`);
  } catch (error) {
    // Ignoring code indicating bucket already created
    if (error.statusCode !== 409) {
      console.log(`Error creating bucket: ${error}`);
    } else {
      console.log(">> Bucket Accessed Successfully")
    }
  }

})();

// Home View
app.get('/', (req, res) => {
  res.writeHead(200, {'content-type': 'text/html'});
  fs.readFile('./views/index.html', 'utf8', (err, data) => {
    if (err) {
      res.end("Could not find/open file for reading\n");
    } else {
      res.end(data);
    }
  });
});

// Listening Location
const port = 3001;
const host = 'localhost';
app.listen(port, () => {
  console.log(`Server listening at http://${host}:${port}/`);
  console.log(">> Accessing S3 bucket...");
});

module.exports = app;

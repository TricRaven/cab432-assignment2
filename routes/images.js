const AWS = require('aws-sdk');
const express = require('express');
const router = express.Router();
const sharp = require("sharp");
const redis = require('redis');
const crypto = require("crypto");
const axios = require("axios");
const JSZip = require("jszip");
// Bucket Details
const s3 = new AWS.S3({ apiVersion: "2006-03-01" });
const bucketName = "tuton-bingham-a2-store";

// Redis Setup
const redisClient = redis.createClient();
(async () => {
  try {
    await redisClient.connect();
    console.log(">> Redis Connected Successfully")
  } catch (error) {
    console.log("* Make sure Redis is running *");
    console.log(error);
  }
})();

// Gets Images to Display
router.get('/collect', async (req, res) => {    
    // Get first 6 Entries from Redis
    var images = [];

    const keyList = await redisClient.keys('*');
    for (let i = 0; i < 6; i++) {
        var imageGroup = {};
        const value = await redisClient.get(keyList[i]);
        imageGroup["nameKey"] = keyList[i]
        imageGroup["urlValue"] = value;
        images.push(imageGroup);
    };
    res.send(images);
});

// Adds a new image to the bucket and redis storage
router.post('/add/:name', async (req, res) => {
    // Get Image Details for Addition
    const uri = req.body.image.split(";base64,").pop();
    const nameGiven = req.params.name;
    let imgBuffer = Buffer.from(uri, "base64");
    const imageDetails = sharp(imgBuffer);
    
    // Creating unique name
    const rawBytes = crypto.randomBytes(16);
    const imgHex = rawBytes.toString("hex");
    const baseName = `${nameGiven}-${imgHex}`;
    const imageName = `${baseName}.jpeg`

    // Uploads to external stores
    await s3_upload(imageName, imageDetails);
    const imageURL = await getImageURL(imageName);
    await redis_upload(imageName, imageURL);

    res.send({imageURL});
});

// Uploads Image to S3
const s3_upload = async (imgName, imgDetails) => {
    uploadedImage = await s3
      .upload({
        Bucket: bucketName,
        Key: imgName,
        Body: imgDetails,
      })
      .promise();
    console.log(`>> Image Uploaded to S3: ${imgName}`);
};

// Uploads Image ID to Redis
const redis_upload = async (imgName, data) => {
    try {
      const redisKey = imgName;
      const redisData = data;
      redisClient.setEx(
        redisKey,
        3600,
        redisData
      );
      console.log(`>> Image Uploaded to Redis: ${imgName}`);
    } catch (error) {
      console.log("ERROR >> Failed to Upload to Redis");
    }
};

// Get Image S3 URL
const getImageURL = async (imageName) => {
    try {
        const url = await s3.getSignedUrlPromise("getObject", {
            Bucket: bucketName,
            Key: imageName,
            Expires: 31536000,
            });
        return url; 
    } catch (error) {
        console.log("Error in URL fetch: " + error);
    } 
};

// Download image
router.post("/download", async (req, res) => {
    const img = req.body.image;
    const input = (await axios.get(img, { responseType: "arraybuffer" })).data;
    const zip = new JSZip();
  
    //Create zip file
    zip.file(`image.jpeg`, await input);
    const content = await zip.generateAsync({ type: "nodebuffer" });
  
    //Send zip file to client
    res.send(content);
  });

//Gets images URL from s3 if not in Redis already
(async (prefix) => {
    let isTruncated = true;
    let marker;

    // Gets object keys from bucket until no more objects
    while(isTruncated) {
        let params = { Bucket: bucketName };
        if (prefix) params.Prefix = prefix;
        if (marker) params.Marker = marker;
        try {
            const response = await s3.listObjects(params).promise();
            response.Contents.forEach(async item => {
                // Checks key exists in Redis - only adds item if not in Redis
                const hasURL = await redisClient.get(item.Key);
                if (!hasURL) {
                    // Adds to Redis if not found already
                    console.log("Key NOT FOUND in Redis; Collecting...");
                    const imageKey = item.Key;
                    const imageUrl = await getImageURL(imageKey);
                    await redis_upload(imageKey, imageUrl);
                } else {
                    console.log("Key already in Redis");
                }
            });
            isTruncated = response.IsTruncated;
            if (isTruncated) {
                marker = response.Contents.slice(-1)[0].Key;
            }
        } catch(error) {
            console.log("Error in Bucket List Get");
            throw error;
        };
    };
    console.log(">> Mass Image Upload Complete");
})();

// // Creates a Thumbnail of the Image
// const thumbName = `${baseName}-thumbnail.jpeg`;
// const thumbnailImage = sharp(imgBuffer).resize(100, 100);
// console.log(thumbName);
// console.log(imgBuffer);

module.exports = router;

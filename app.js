const express = require('express');
const multer = require('multer');
const path = require('path');
const app = express();
var AWS = require('aws-sdk');
var Async=require('async');
var fs = require('fs');
// Create an S3 client
var s3 = new AWS.S3();
AWS.config.update({
  region: "us-west-2"
  //endpoint: "http://34.209.142.211:8000" //dynamodb位置
});
var docClient = new AWS.DynamoDB.DocumentClient();

var dynamodb= new AWS.DynamoDB();
app.use(express.static('./public'));


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.resolve('public/uploads'));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
 function getDesc(da,cb) {
  var desc=[];
  for (var i=0;i<da.Contents.length;i++) {
    var pics = {};
    pics['picname'] = da.Contents[i].Key;
    pics['desc'] = '';
    console.log(pics.picname)
    var params = {
      'TableName': 'pictureslabel',
      'Key': {
        'year': 2019,
        'picname':pics.picname
      }
    };

      desc.push(pics);
    }
   var query = {
     TableName: "weiyao",
     Limit: 1000
   };

     dynamodb.scan(query,function (err, data) {

         console.log("啊"+JSON.stringify(data));
         var Items=data.Items;
         for (var i=0;i<desc.length;i++){
           for (var j=0;j<data.Count;j++)
           {
             console.log(desc[i].picname)
             console.log(Items[j].picname)
             if (desc[i].picname==Items[j].picname.S){
               desc[i].desc=Items[j].desc.S;
             }
           }
         }
       console.log(desc)
         cb(null,desc);
       }

     )
   }

const upload = multer({storage: storage});
app.post('/getpic', function (req,res,next) {
  Async.waterfall([
    function (cb) {
      let getParams = {
        Bucket: 'weiyao-store',
      };
      s3.listObjectsV2(getParams,function (err, da) {
        cb(err,da)
      });
    },
    function (da,cb) {

        getDesc(da,function (err,picD) {
          console.log("picD"+picD);
          cb(err,picD);
        })
    }
  ],function (err,picD) {
    if (err){
      console.log("错误"+err);
      res.send(err);
    }else {
      var datas=[];
      console.log(picD.length)
      var prefix='https://weiyao-store.s3-us-west-2.amazonaws.com/'
      for(var i=0;i<picD.length;i++){
        var data={};
        data['pic']=prefix+picD[i].picname;
        data['desc']=picD[i].desc;
        datas.push(data);
      }
      res.send(datas);
    }
  });

})
app.post('/profile', upload.single('avatar'), function(req, res, next) {
  console.log(req.file.originalname);
  var text=req.body.desc;

  var params = {
    Item: {
      "picname": {
        S: req.file.originalname
      },
      "desc": {
        S: text
      }
    },
    ReturnConsumedCapacity: "TOTAL",
    TableName: "weiyao"
  };
    dynamodb.putItem(params,function(err, data) {
      if (err) {
        console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
      } else {
        console.log("Added item:", JSON.stringify(data, null, 2));
      }});
  fs.readFile(req.file.path, function (err, data) {
    if (err) { throw err; }

    s3.putObject({
      Bucket: 'weiyao-store',
      Key: req.file.originalname,
      Body: data,
      ContentType:'image/jpeg',
      ACL:'public-read'
    }, function (err, data) {
      if(err) console.log(err, err.stack);
      else
        console.log('Successfully uploaded package.');
    });
  });

  res.send({
    err: null,
    filePath: 'uploads/' + path.basename(req.file.path)
  });
});


app.listen(3000, function () {
  console.log("app is listening");
});
var express = require('express');
var formidable = require('formidable');
var fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
var bodyParser = require('body-parser');
var path = require('path');
var exphbs = require('express-handlebars');
var validator = require('express-validator');
var mongo = require('mongodb-bluebird');
var mongoose = require('mongoose');
mongoose.Promise = require('bluebird');
const { check, validationResult } = require('express-validator/check');


const SCOPES = ['https://www.googleapis.com/auth/drive'];
const TOKEN_PATH = 'token.json';

//Init App 
var app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

//view engine
app.set('views', path.join(__dirname, 'views'));
app.engine('handlebars', exphbs({ defaultLayout: 'layout' }));
app.set('view engine', 'handlebars');

//BodyParser Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(function (req, res, next) {
  res.locals.err = null;
  next();
});


//Set Static Folder
app.use(express.static(path.join(__dirname, 'public')));


// ========== MODELS ============ //

mongoose.connect('mongodb://localhost/careers', { useNewUrlParser: true });
const Schema = mongoose.Schema;
const CandidateInfo = new Schema({
  firstName: String,
  lastName: String,
  email: String,
  phone: Number,
  dob: String,
  addr: String,
  state: String,
  city: String,
  pin: Number,
  univ: String,
  degree: String,
  course: String,
  pdate: String,
  score: Number,
  emp_stat: Boolean,
  company: String,
  position: String,
  project: String,
  resp: String,
  expFrom: String,
  expTo: String
},
  { versionKey: false }
);


var Candidate = mongoose.model('Candidate', CandidateInfo, 'candidate');



// =================== ROUTES ==========================//

app.get('/', function (req, res) {
  res.render('careers')
});

app.get('/jobDesc', function (req, res) {
  res.render('jobDesc')
})

app.get('/upload', function (req, res) {
  res.render('apply')
});

app.post('/upload', function (req, res) {
  var form = new formidable.IncomingForm();
  form.uploadDir = "uploads/";
  var file_name, file_ext, file_size, file_mimetype;
  form.parse(req, function (err, fields, files) {

    oldpath = files.file.path;
    newpath = form.uploadDir + files.file.name;
    file_name = files.file.name;
    file_ext = files.file.type;
    file_size = files.file.size;
    file_mimetype = files.file.mimetype;

    const filetypes = /pdf|doc|dox|txt/;
    const extname = filetypes.test(file_ext.toLowerCase());
    const mimetype = filetypes.test(file_mimetype);

    fs.rename(oldpath, newpath, function (err) {
      if (err) throw err;
      console.log("Uploading file...");
      res.render('applicationForm');
    });

    // Load client secrets from a local file.
    fs.readFile('credentials.json', (err, content) => {
      if (err) return console.log('Error loading client secret file:', err);
      // Authorize a client with credentials, then call the Google Drive API.
      authorize(JSON.parse(content), uploadFile);//------
    });

    /**
     * Create an OAuth2 client with the given credentials, and then execute the
     * given callback function.
     * @param {Object} credentials The authorization client credentials.
     * @param {function} callback The callback to call with the authorized client.
     */
    function authorize(credentials, callback) {
      const { client_secret, client_id, redirect_uris } = credentials.installed;
      const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

      // Check if we have previously stored a token.
      fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getAccessToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
      });
    }

    /**
     * Get and store new token after prompting for user authorization, and then
     * execute the given callback with the authorized OAuth2 client.
     * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
     * @param {getEventsCallback} callback The callback for the authorized client.
     */
    function getAccessToken(oAuth2Client, callback) {
      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
      });
      console.log('Authorize this app by visiting this url:', authUrl);
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
          if (err) return console.error('Error retrieving access token', err);
          oAuth2Client.setCredentials(token);
          // Store the token to disk for later program executions
          fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
            if (err) return console.error(err);
            console.log('Token stored to', TOKEN_PATH);
          });
          callback(oAuth2Client);
        });
      });
    }

    // Target folder for the Uploaded file.
    const targetFolderId = "1AdJJwkxq9VnH4ut7a_UXyW0Eh69ww3WP";
    function uploadFile(auth) {
      const drive = google.drive({ version: 'v3', auth });

      var fileMetadata = {
        'name': file_name,
        parents: [targetFolderId]
      };
      var media = {
        mimeType: file_ext,
        body: fs.createReadStream(path.join(__dirname, 'uploads/', file_name))
      };


      if (extname) {
        if (file_size < 50000) {

          drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id'
          }, function (err, file) {
            if (err) {
              // Handle error
              console.error(err);
            } else {
              console.log(`file Id:${file.data.id}`);
              console.log("file size " + file_size);
            }
          });
        }
        else {
          console.log("Error: File too large!");
          // alert('File too large!');
          res.end();
        }
      } else {
        console.log("Incorrect format!");
        // window.alert('Incorrect format!');
        // res.redirect('/upload');
      }

    }
  })

});


app.get('/applicationForm', function (req, res) {
  res.render('applicationForm')
});

app.get('/success', function (req, res) {
  res.render('success')
});

app.post('/applicationForm', function (req, res) {
  const err = validationResult(req);
  if (!err.isEmpty()) {
    console.log(err);
  } else {


    var newCandidate = new Candidate({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      phone: req.body.phone,
      dob: req.body.dob,
      addr: req.body.addr,
      state: req.body.state,
      city: req.body.city,
      pin: req.body.pin,
      univ: req.body.univ,
      degree: req.body.degree,
      course: req.body.course,
      pdate: req.body.pdate,
      score: req.body.score,
      emp_stat: req.body.emp_stat,
      company: req.body.company,
      position: req.body.position,
      project: req.body.project,
      resp: req.body.resp,
      expFrom: req.body.expFrom,
      expTo: req.body.expTo
    });

    console.log(newCandidate.firstName);
    newCandidate.save(function (errs, data) {
      if (errs) {
        return console.log(errs);
      }
      res.redirect('/success');
    });
  }
});








// ========== PORT ============ //

app.listen(4000, function () {
  console.log('Listening to port 4000');
});



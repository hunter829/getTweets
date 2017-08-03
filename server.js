var express = require("express");
var path = require("path");
var app = express();
var passport = require("passport");
var Strategy = require("passport-twitter").Strategy;
var config = require('./config.json');
var twitter = require("twitter");
var session = require("express-session");
var async = require("async");
var bodyParser = require("body-parser");
var _ = require("underscore");
// var tweetController = require('./controller/getTweetController.js')

app.listen(process.env.PORT||3000,function(){
   console.log("Listening the Port 3000");
});

//use the express npm install express@">=3.0.0 <4.0.0" --save
app.use(express.bodyParser());
app.set('view engine','ejs');
// app.get("/", function(req, res) {
//      res.sendFile(path.join(__dirname+'/views/index.html'));
// });
app.use(session({
    secret: 'Auth For Tweets',
    resave: true,
    saveUninitialized: true,
    cookie: { secure: false }
}));

var client = new twitter({
    consumer_key: config.consumerKey,
    consumer_secret: config.consumerSecret,
    access_token_key: config.access_token_key,
    access_token_secret: config.access_token_secret
});

passport.use(new Strategy({
    consumerKey: config.consumerKey,
    consumerSecret: config.consumerSecret,
    callbackURL:config.callbackURL
}, function(token, tokenSecret, profile, cb) {
    process.nextTick(function() {
        client.access_token_key = token;
        client.access_token_secret = tokenSecret;
        return cb(null, profile);
    });
}));

console.log("###", client);

passport.serializeUser(function(user, cb) {
    cb(null, user);
});
passport.deserializeUser(function(obj, cb) {
    cb(null, obj);
});
app.use(passport.initialize());
app.use(passport.session());

app.get("/", function(req, res) {
    res.render("index", { user: req.user,tweets: null,searched: false});
});

app.get('/login', function(req, res) {
    res.redirect('/auth/twitter');
});
app.get('/auth/twitter', passport.authenticate('twitter'));

app.get('/auth/twitter/callback', passport.authenticate('twitter', {
    successRedirect: '/',
    failureRedirect: '/login'
}), function(req, res) {
    res.redirect('/');
});

app.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/');
});

app.post('/',function(req,res){
  console.log(req.body);

  async.parallel({
      favorites: function(cb) {
          var params = {
              screen_name: req.body.handle,
              count: 3
          };
          client.get('favorites/list', params, function(error, tweets, response) {
              if (!error) {
                  cb(null, tweets);
              }
              else {
                  cb(null, error);
              }
          });
      },
      recent: function(cb) {
          var params = {
              screen_name: req.body.handle,
              count: 10
          };
          client.get('statuses/user_timeline', params, function(error, tweets, response) {
              if (!error) {
                  cb(null, tweets);
              }
              else {
                  cb(null, error);
              }
          });
      }
  }, function(error, results) {
      console.log("************TOP TEN FAVO TWEETS**************",results.favorites);
      console.log("************TOP TEN RECENTLY TWEETS**********",results.recent);
      var ret_list = [results.favorites,results.recent];

      var tweetList = [];
      ret_list.forEach(function(list) {
          if (list.length > 0) {
              list.forEach(function(tweet) {
                  if (tweet) {
                      tweetList.push(tweet);
                  }
              });
          }
      });
      tweetList = _.uniq(tweetList, 'text');
      var oembedTweetList = [];
      var count = 0;
      async.forEachOf(tweetList, function(elem, key, cb) {
          if (key < 10) {
              var paramsList = {
                  url: "https://www.twitter.com/filler/status/" + elem.id_str,
                  omit_script: 1,
                  theme:"dark"
              };
              client.get('statuses/oembed', paramsList, function(error, output, response) {
                  if (!error) {
                      oembedTweetList.push(output.html);
                      return cb(null);
                  }
                  else {
                      return cb(error);
                  }
              });
          }
          else {
              cb(error);
          }
      }, function(error) {
          if (!error) {
              res.render("index", {
                  user: req.user,
                  searched: true,
                  search_handle: req.body.handle,
                  tweetList: oembedTweetList
              });
          }
          else {
              console.log(error);
          }
      });
  });
});

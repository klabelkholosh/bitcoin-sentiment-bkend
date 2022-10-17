const functions = require('firebase-functions');
require('dotenv').config();
const Sentiment = require('sentiment');
const Twitter = require('twitter');
const R = require('request');
const sentiment = new Sentiment();
const cat =
  process.env.TWITTER_CONSUMER_KEY + ':' + process.env.TWITTER_CONSUMER_SECRET;
const credentials = new Buffer(cat).toString('base64');
const url = 'https://api.twitter.com/oauth2/token';
var bearertoken = '';

// sort out the cors, man. for firebase functions..
const cors = require('cors')({ origin: true });

//little function used for calculating sentiment.
function calcSentiment(twitChunk) {
  let sentCalc = JSON.parse(twitChunk.body).statuses.reduce(
    (add, el) => add + Number(sentiment.analyze(el.text).score),
    0
  );
  return sentCalc;
}

exports.helloWorld = functions.https.onRequest((request, response) => {
  functions.logger.info('Hello logs!', { structuredData: true });
  response.send('Hello from Firebase!');
});

//ok, so someone wants to search for Tweets! Let's do this...
exports.twitterSearch = functions.https.onRequest((req, res) => {
  // wrap it in cors, otherwise it won't connect locally..
  cors(req, res, () => {
    //let's get the user's search parameters and flesh them out a bit..
    let twitQ = req.body.q;
    let twitDate = req.body.until;
    let twitResType = req.body.result_type;
    let twitLang = req.body.lang;
    let twitIncEnt = req.body.include_entities;
    let twitCount = req.body.count;

    //request a bearer token from Twitter oauth2 API
    R(
      {
        url: url,
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + credentials,
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: 'grant_type=client_credentials',
      },
      function (err, resp, body) {
        //the bearer token...
        bearertoken = JSON.parse(body).access_token;

        console.log('Begin Twitter API consummation...');

        //Twitter client object, used for searches and stuffs
        var client = new Twitter({
          consumer_key: process.env.TWITTER_CONSUMER_KEY,
          consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
          bearer_token: bearertoken,
        });

        console.log('Getting tweets at ' + twitDate + '...');

        //search Twitter and get some tweets!
        client.get(
          'search/tweets',
          {
            q: twitQ,
            until: twitDate,
            result_type: twitResType,
            lang: twitLang,
            include_entities: twitIncEnt,
            count: twitCount,
          },
          function (error, tweets, response) {
            let latestTweets = JSON.stringify(response);

            //calculate the sentiment on these tweets.
            let sentTot = calcSentiment(response);

            //send back an object of both latestTweets for printing, plus the final sentiment score
            res.send({
              latestTweets,
              sentTot,
            });

            if (error) throw error;
            console.log('Twitter search done.');
          }
        );
      }
    );
  });
});

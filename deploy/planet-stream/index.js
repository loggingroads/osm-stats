// OSM Planet Stream service
// Mostly from https://github.com/developmentseed/planet-stream/tree/master/examples/kinesis

var Log = require('log');
var log = new Log(process.env.LOG_LEVEL || 'info');
log.debug(process.env);

var redis_host = process.env.REDIS_PORT_6379_TCP_ADDR || process.env.REDIS_HOST || '127.0.0.1';
var redis_port = process.env.REDIS_PORT_6379_TCP_PORT || process.env.REDIS_PORT || 6379;

var forgettable_host = process.env.FORGETTABLE_PORT_8080_TCP_ADDR || '127.0.0.1';
var forgettable_port = process.env.FORGETTABLE_PORT_8080_TCP_PORT || 8080;

var kinesis = require('./lib/kinesis.js');
var R = require('ramda');
var Redis = require('ioredis');
var request = require('request-promise');

var redis = new Redis({
  host: redis_host,
  port: redis_port
});
var toGeojson = require('./lib/toGeojson.js');

var tracked = ['#logging-roads'];

// parse comments into hashtag list
function getHashtags (str) {
  if (!str) return [];
  var wordlist = str.split(' ');
  var hashlist = [];
  wordlist.forEach(function (word) {
    if (word.startsWith('#') && !R.contains(word, hashlist)) {
      word = word.trim();
      word = word.replace(/,\s*$/, '');
      hashlist.push(word);
    }
  });
  return hashlist;
}
function addToKinesis (obj) {
  var data = JSON.stringify(obj);
  log.debug('[kinesis obj metadata]:' + obj.metadata);
  var geo = null;
  if (obj.elements && obj.elements.length > 0) {
    geo = toGeojson(obj.elements);
  }

  // Only add if there are features
  if (geo && geo.features.length) {
    geo.properties = obj.metadata;
    var hashtags = getHashtags(obj.metadata.comment);
    hashtags.forEach(function (hashtag) {
      redis.lpush('osmstats::map::' + hashtag, JSON.stringify(geo));
      redis.ltrim('osmstats::map::' + hashtag, 0, 100);

      // Add to forgettable
      if (R.match(/logging\-roads/, R.toLower(hashtag)).length === 0) {
        request('http://' + forgettable_host + ':' + forgettable_port +
                     '/incr?distribution=hashtags&field=' + R.slice(1, Infinity, hashtag) + '&N=10').then(function (result) {
        }).catch(function (error) {
          console.error('error', error);
        });
      }
    });
  }

  if (process.env.PS_OUTPUT_DEBUG) {
    log.debug(JSON.stringify(geo));
  } else {
    if (obj.metadata) {
      log.debug('About to add ' + obj.metadata.id);
      var dataParams = {
        Data: data,
        PartitionKey: obj.metadata.id.toString(),
        StreamName: process.env.KINESIS_STREAM
      };
      kinesis.kin.putRecord(dataParams, function (err, data) {
        if (err) {
          log.error(err);
        } else {
          log.info('Added ' + obj.metadata.id);
          log.debug('object:' + JSON.stringify(data));
        }
      });
    } else {
      log.info('No metadata for ' + obj);
    }
  }
}

if (process.env.SIMULATION) {
  console.log('simulating!');

  var Simulator = require('planet-stream/lib/simulator');
  var simulation = new Simulator();

  setInterval(function () {
    var changeset = simulation.randomChangeset();
    addToKinesis(changeset);
  }, 1000);
} else {
  // Start planet-stream
  var diffs = require('planet-stream')({
    limit: process.env.LIMIT || 25,
    host: redis_host,
    port: redis_port
  });

  // filter data for hashtags
  diffs.map(JSON.parse)
  .filter(function (data) {
    if (!data.metadata || !data.metadata.comment) {
      return false;
    }
    log.debug('id: ' + data.metadata.id + ' - Comment: ' + data.metadata.comment);
    data.metadata.comment = R.toLower(data.metadata.comment);
    var hashtags = getHashtags(data.metadata.comment);
    if (process.env.ALL_HASHTAGS) {
      return hashtags.length > 0;
    }
    var intersection = R.intersection(hashtags, tracked);
    return intersection.length > 0;
  })
  // add a complete record to kinesis
  .onValue(addToKinesis);
}

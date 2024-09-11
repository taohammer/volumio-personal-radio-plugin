'use strict';

// This Volumio plugin provides Korean radios (SBS, KBS, MBC) and Linn radio.

const libQ = require('kew');
const fs = require('fs-extra');
const config = require('v-conf');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const urlModule = require('url');
const querystring = require('querystring');
const fetch = require('node-fetch')

module.exports = ControllerPersonalRadio;

function ControllerPersonalRadio(context) {
  var self = this;

  self.context = context;
  self.commandRouter = this.context.coreCommand;
  self.logger = this.context.logger;
  self.configManager = this.context.configManager;
  self.state = {};
  self.metaRetry = { max: 5, count: 0};
  self.timer = null;
  self.stateMachine = self.commandRouter.stateMachine;

  self.logger.info("ControllerPersonalRadio::constructor");
}

ControllerPersonalRadio.prototype.onVolumioStart = function()
{
  var self = this;

  self.configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
  self.getConf(self.configFile);

  return libQ.resolve();
};

ControllerPersonalRadio.prototype.getConfigurationFiles = function () {
  return ['config.json'];
};

ControllerPersonalRadio.prototype.onStart = function() {
  var self = this;

  self.mpdPlugin = this.commandRouter.pluginManager.getPlugin('music_service','mpd');

  self.loadRadioI18nStrings();
  self.addRadioResource();
  self.addToBrowseSources();

  self.serviceName = "personal_radio";

  return libQ.resolve();
};

ControllerPersonalRadio.prototype.onStop = function() {
  var self = this;

  return libQ.resolve();
};

ControllerPersonalRadio.prototype.onRestart = function() {
  var self = this;

  return libQ.resolve();
};


// Configuration Methods -----------------------------------------------------
ControllerPersonalRadio.prototype.getConf = function(configFile) {
  var self = this;

  self.config = new (require('v-conf'))();
  self.config.loadFile(configFile);
};

ControllerPersonalRadio.prototype.setConf = function(conf) {
  var self = this;

  fs.writeJsonSync(self.configFile, JSON.stringify(conf));
};

ControllerPersonalRadio.prototype.getUIConfig = function() {
  var self = this;
  var defer = libQ.defer();
  var lang_code = this.commandRouter.sharedVars.get('language_code');

  self.getConf(this.configFile);
  self.commandRouter.i18nJson(__dirname+'/i18n/strings_' + lang_code + '.json',
      __dirname + '/i18n/strings_en.json',
      __dirname + '/UIConfig.json')
  .then(function(uiconf)
  {
    defer.resolve(uiconf);
  })
  .fail(function()
  {
    defer.reject(new Error());
  });

  return defer.promise;
};

ControllerPersonalRadio.prototype.setUIConfig = function(data)
{
  var self = this;

  var uiconf=fs.readJsonSync(__dirname+'/UIConfig.json');

  return libQ.resolve();
};

// Playback Controls ---------------------------------------------------------
ControllerPersonalRadio.prototype.addToBrowseSources = function () {
  var self = this;

  self.commandRouter.volumioAddToBrowseSources({
    name: self.getRadioI18nString('PLUGIN_NAME'),
    uri: 'kradio',
    plugin_type: 'music_service',
    plugin_name: "personal_radio",
    albumart: '/albumart?sourceicon=music_service/personal_radio/personal_radio.svg'
  });
};

ControllerPersonalRadio.prototype.handleBrowseUri = function (curUri) {
  var self = this;
  var response;

  if (curUri.startsWith('kradio')) {
    if (curUri === 'kradio') {
      response = self.getRootContent();
    }
    else if (curUri === 'kradio/kbs') {
      response = self.getRadioContent('kbs');
    }
    else if (curUri === 'kradio/sbs') {
        response = self.getRadioContent('sbs');
    }
    else if (curUri === 'kradio/mbc') {
      response = self.getRadioContent('mbc');
    }
    else if (curUri === 'kradio/linn') {
      response = self.getRadioContent('linn');
    }
    else {
      response = libQ.reject();
    }
  }

  return response
    .fail(function (e) {
      self.logger.info('ControllerPersonalRadio:handleBrowseUri [' + Date.now() + '] ' + 'ControllerPersonalRadio::handleBrowseUri failed=', e);
      libQ.reject(new Error());
    });
};

ControllerPersonalRadio.prototype.getRootContent = function() {
  var self=this;
  var response;

  response = self.rootNavigation;
  response.navigation.lists[0].items = [];
  for (var key in self.rootStations) {
      var radio = {
        service: self.serviceName,
        type: 'folder',
        title: self.rootStations[key].title,
        uri: self.rootStations[key].uri,
        albumart: '/albumart?sourceicon=music_service/personal_radio/logos/'+key+'.png'
      };
      response.navigation.lists[0].items.push(radio);
  }

  return libQ.resolve(response);
};

ControllerPersonalRadio.prototype.getRadioContent = function(station) {
  var self=this;
  var response;
  var radioStation;

  switch (station) {
    case 'kbs':
      radioStation = self.radioStations.kbs;
      break;
    case 'sbs':
      radioStation = self.radioStations.sbs;
      break;
    case 'mbc':
      radioStation = self.radioStations.mbc;
      break;
    case 'linn':
      radioStation = self.radioStations.linn;
  }

  response = self.radioNavigation;
  response.navigation.lists[0].items = [];
  for (var i in radioStation) {
    var channel = {
      service: self.serviceName,
      type: 'song',
      title: radioStation[i].title,
      artist: '',
      album: '',
      uri: radioStation[i].uri,
      albumart: '/albumart?sourceicon=music_service/personal_radio/logos/'+station+i+'.png'
    };
    response.navigation.lists[0].items.push(channel);
  }

  return libQ.resolve(response);
};

ControllerPersonalRadio.prototype.clearAddPlayTrack = function(track) {
  var self = this;
  var defer = libQ.defer();

  return self.mpdPlugin.sendMpdCommand('stop', [])
    .then(function() {
        return self.mpdPlugin.sendMpdCommand('clear', []);
    })
    .then(function() {
        return self.mpdPlugin.sendMpdCommand('add "'+track.realUri+'"',[]);
    })
    .then(function () {
      self.commandRouter.pushToastMessage('info',
        self.getRadioI18nString('PLUGIN_NAME'),
        self.getRadioI18nString('WAIT_FOR_RADIO_CHANNEL'));

      return self.mpdPlugin.sendMpdCommand('play', []).then(function () {
        self.commandRouter.checkFavourites({uri: track.uri}).then(function(favouriteStatus) {
          self.commandRouter.emitFavourites(
              {service: self.service, uri: track.uri, favourite: favouriteStatus.favourite}
          );
        })

        switch (track.radioType) {
          case 'kbs':
          case 'sbs':
          case 'mbc':
            return self.mpdPlugin.getState().then(function (state) {
              return self.commandRouter.stateMachine.syncState(state, self.serviceName);
            });
            break;
          default:
            self.commandRouter.stateMachine.setConsumeUpdateService('mpd');
            return libQ.resolve();
        }
      })
    })
    .fail(function (e) {
      self.logger.error("[ControllerPersonalRadio::clearAddPlayTrack] Error=", e)
      return defer.reject(new Error());
    });
};

ControllerPersonalRadio.prototype.seek = function (position) {

  return libQ.resolve();
};

ControllerPersonalRadio.prototype.stop = function() {
	var self = this;

  if (self.timer) {
    self.timer.clear();
  }

  self.commandRouter.pushToastMessage(
      'info',
      self.getRadioI18nString('PLUGIN_NAME'),
      self.getRadioI18nString('STOP_RADIO_CHANNEL')
  );
  return self.mpdPlugin.stop().then(function () {
      return self.mpdPlugin.getState().then(function (state) {
          return self.commandRouter.stateMachine.syncState(state, self.serviceName);
      });
  });
};

ControllerPersonalRadio.prototype.pause = function() {
  var self = this;

  if (self.timer) {
    self.timer.clear();
  }

  return self.mpdPlugin.pause().then(function () {
    return self.mpdPlugin.getState().then(function (state) {
        return self.commandRouter.stateMachine.syncState(state, self.serviceName);
    });
  });
};

ControllerPersonalRadio.prototype.resume = function() {
  var self = this;

  return self.mpdPlugin.resume().then(function () {
    return self.mpdPlugin.getState().then(function (state) {

      self.commandRouter.stateMachine.syncState(state, self.serviceName);
    });
  });
};

ControllerPersonalRadio.prototype.pushState = function(state) {
  var self = this;

  return self.commandRouter.servicePushState(state, self.serviceName);
};

ControllerPersonalRadio.prototype.explodeUri = function (uri) {
  var self = this;
  var defer = libQ.defer();
  var uris = uri.split("/");
  var channel = parseInt(uris[1]);
  var response, responseResult=[];
  var query;
  var station;

  // radio_station/channel
  station = uris[0].substring(3);
  response = {
      service: self.serviceName,
      type: 'track',
      trackType: self.getRadioI18nString('PLUGIN_NAME'),
      radioType: station,
      albumart: '/albumart?sourceicon=music_service/personal_radio/logos/'+station+channel+'.png'
  };

  switch (uris[0]) {
    case 'webkbs':
      var streamUrl = self.rootStations.kbs.baseStreamUrl + self.radioStations.kbs[channel].channel;
      self.fetchRadioUrl(station, streamUrl, "")
        .then(function (responseUrl) {
          if (responseUrl !== null) {
            response["uri"] = uri;
            response["realUri"] = JSON.parse(responseUrl).channel_item[0].service_url;
            response["name"] = self.radioStations.kbs[channel].title;
          }
          self.state = {
            station: station
          }
          responseResult.push(response);
          defer.resolve(responseResult);
        });
      break;

    case 'websbs':
      var streamUrl = self.rootStations.sbs.baseStreamUrl + self.radioStations.sbs[channel].channel;
      self.fetchRadioUrl(station, streamUrl, {device: "mobile"})
        .then(function (responseUrl) {
          if (responseUrl  !== null) {
            var decipher = crypto.createDecipheriv("des-ecb", '7d1ff4ea', "");
            var streamUrl = decipher.update(responseUrl, 'base64', 'utf8');
            streamUrl += decipher.final('utf8');

            response["uri"] = uri;
            response["realUri"] = streamUrl;
            response["name"] = self.radioStations.sbs[channel].title;
          }
          self.state = {
            station: station
          }
          responseResult.push(response);
          defer.resolve(responseResult);
        });
      break;

    case 'webmbc':
      query = {
        channel: self.radioStations.mbc[channel].channel,
        agent: "webapp",
        protocol: "M3U8",
        nocash: Math.random()
      };
      var streamUrl = self.rootStations.mbc.baseStreamUrl;
      self.fetchRadioUrl(station, streamUrl, query)
        .then(function (responseUrl) {
          if (responseUrl  !== null) {
            response["uri"] = uri;
            response["realUri"] = responseUrl;
            response["name"] = self.radioStations.mbc[channel].title;
          }
          self.state = {
            station: station
          }
          responseResult.push(response);
          defer.resolve(responseResult);
        });
      break;

    case 'weblinn':
      response["uri"] = uri;
      response["realUri"] = self.radioStations.linn[channel].url;
      response["name"] = self.radioStations.linn[channel].title;
      self.state = {
        station: station
      }
      responseResult.push(response);
      defer.resolve(responseResult);
      break;

    default:
      responseResult.push(response);
      defer.resolve(responseResult);
  }

  return defer.promise;
};

// Stream and resource functions for Radio -----------------------------------
ControllerPersonalRadio.prototype.fetchRadioUrl = function (station, url, query) {
  var self = this;
  var defer = libQ.defer();
  var newUrl = url

  if (query) {
    newUrl = newUrl + "?" + querystring.stringify(query)
  }

  const options = {
    headers: {
      'Accept': '*/*',
      'User-Agent': 'Mozilla/5.0'
    },
    method: 'GET',
    credentials: 'same-origin'
  };

  fetch(newUrl, options)
  .then((response) => response.text())
  .then((response) => {
    defer.resolve(response);
  })
  .catch((error) => {
    if (urlModule.parse(newUrl).hostname.startsWith('raw.'))
      self.errorRadioToast(null,'ERROR_SECRET_KEY_SERVER');
    else
      self.errorRadioToast(station, 'ERROR_STREAM_SERVER');

    self.logger.info('ControllerPersonalRadio:fetchRadioUrl Error: ' + error);
    defer.reject(null);
  })

  return defer.promise;
}

ControllerPersonalRadio.prototype.addRadioResource = function() {
  var self=this;

  var radioResource = fs.readJsonSync(__dirname+'/radio_stations.json');
  var baseNavigation = radioResource.baseNavigation;

  self.rootStations = radioResource.rootStations;
  self.radioStations = radioResource.stations;
  self.rootNavigation = JSON.parse(JSON.stringify(baseNavigation));
  self.radioNavigation = JSON.parse(JSON.stringify(baseNavigation));
  self.rootNavigation.navigation.prev.uri = '/';

  // i18n resource localization
  self.rootStations.kbs.title =  self.getRadioI18nString('KBS');
  self.rootStations.sbs.title =  self.getRadioI18nString('SBS');
  self.rootStations.mbc.title =  self.getRadioI18nString('MBC');

  self.radioStations.kbs[2].title =  self.getRadioI18nString('KBS1_RADIO');
  self.radioStations.kbs[3].title =  self.getRadioI18nString('KBS2_RADIO');
  self.radioStations.kbs[4].title =  self.getRadioI18nString('KBS3_RADIO');
  self.radioStations.kbs[5].title =  self.getRadioI18nString('KBS_WORLD');
  self.radioStations.mbc[0].title =  self.getRadioI18nString('MBC_STANDARD');
  self.radioStations.mbc[1].title =  self.getRadioI18nString('MBC_FM4U');
  self.radioStations.mbc[2].title =  self.getRadioI18nString('MBC_CHANNEL_M');
  self.radioStations.sbs[0].title =  self.getRadioI18nString('SBS_LOVE_FM');
  self.radioStations.sbs[1].title =  self.getRadioI18nString('SBS_POWER_FM');
  self.radioStations.sbs[2].title =  self.getRadioI18nString('SBS_INTERNET_RADIO');
};

ControllerPersonalRadio.prototype.loadRadioI18nStrings = function () {
  var self=this;

  try {
    var language_code = this.commandRouter.sharedVars.get('language_code');
    self.i18nStrings=fs.readJsonSync(__dirname+'/i18n/strings_'+language_code+".json");
  } catch(e) {
    self.i18nStrings=fs.readJsonSync(__dirname+'/i18n/strings_en.json');
  }

  self.i18nStringsDefaults=fs.readJsonSync(__dirname+'/i18n/strings_en.json');
};

ControllerPersonalRadio.prototype.getRadioI18nString = function (key) {
  var self=this;

  if (self.i18nStrings[key] !== undefined)
    return self.i18nStrings[key];
  else
    return self.i18nStringsDefaults[key];
};

ControllerPersonalRadio.prototype.errorRadioToast = function (station, msg) {
  var self=this;

  var errorMessage = self.getRadioI18nString(msg);
  if (station !== null)
    errorMessage.replace('{0}', station.toUpperCase());
  self.commandRouter.pushToastMessage('error', self.getRadioI18nString('PLUGIN_NAME'), errorMessage);
};

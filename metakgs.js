(function() {
  "use strict";

  var MetaKGS = function(args) {
    this.apiEndpoint = 'http://metakgs.org/api';
  };

  MetaKGS.prototype.uriFor = function(path) {
    return path.match(/^https?:\/\//) ? path : this.apiEndpoint+'/'+path;
  };

  MetaKGS.prototype.get = function(path, callback) {
    var url = this.uriFor( path );
    var request = new MetaKGS.Request( 'GET', url );

    request.send(function(response) {
      if ( response.code() === 200 ) {
        callback( response.body(), response, request );
      }
      else {
        callback( null, response, request );
      }
    });
  };

  MetaKGS.prototype.getContent = function(path, callback) {
    var that = this;
    var url = this.uriFor( path );

    this.get(url, function(body, response, request) {
      var content = body && body.content;
      var link = body && body.link;

      if ( link && content ) {
        content = that.paginate(content, {
          getLink: function(rel) {
            return link[rel];
          },
          get: function(path, cb) {
            that.getContent( path, cb || callback );
          }
        });
      }

      callback( content, response, request );
    });
  };

  MetaKGS.prototype.paginate = function(prototype, args) {
    var object = Object.create( prototype );
    var params = args || {};

    object.get = params.get || function(path, callback) {
      throw new Error("call to abstract method 'get'");
    };

    object.getLink = params.getLink || function(rel) {
      throw new Error("call to abstract method 'getLink'");
    };

    object.isFirst = function() {
      return !this.hasPrev();
    };

    object.hasPrev = function() {
      return this.getLink('prev') ? true : false;
    };

    object.hasNext = function() {
      return this.getLink('next') ? true : false;
    };

    object.isLast = function() {
      return !this.hasNext();
    };

    object.getFirst = function(callback) {
      this.get( this.getLink('first'), callback );
    };

    object.getPrev = function(callback) {
      if ( this.hasPrev() ) {
        this.get( this.getLink('prev'), callback );
      }
    };

    object.getNext = function(callback) {
      if ( this.hasNext() ) {
        this.get( this.getLink('next'), callback );
      }
    };

    object.getLast = function(callback) {
      this.get( this.getLink('last'), callback );
    };
 
    return object;
  };

  MetaKGS.prototype.getArchives = function(args, callback) {
    var query = args || {};
    var path = [ 'archives' ];

    if ( query.user && query.user.match(/^[a-zA-Z][a-zA-Z0-9]{0,9}$/) ) {
      path.push( query.user );
    }
    else if ( query.hasOwnProperty('user') ) {
      throw new Error("'user' is invalid: '"+query.user+"'");
    }
    else {
      throw new Error("'user' is required");
    }

    if ( query.year && query.year >= 2000 ) {
      path.push( Math.floor(query.year) );
    }
    else if ( query.hasOwnProperty('year') ) {
      throw new Error("'year' is invalid: '"+query.year+"'");
    }

    if ( query.month && query.month >= 1 && query.month <= 12 ) {
      if ( path.length === 3 ) {
        path.push( Math.floor(query.month) );
      } else {
        throw new Error("'year' is required");
      }
    }
    else if ( query.hasOwnProperty('month') ) {
      throw new Error("'month' is invalid: '"+query.month+"'");
    }

    this.getContent( path.join('/'), callback );
  };

  MetaKGS.prototype.getGames = function(args, callback) {
    this.getArchives(args, function(archives, response, request) {
      callback( archives && archives.games, response, request );
    });
  };

  MetaKGS.prototype.getLatestRankByName = function(name, callback) {
    var requestCount = 0;

    this.getArchives({
      user: name
    },
    function(archives, response, request) {
      var games = archives && archives.games;
      var game = games && archives.games[0];
      var i, players;

      requestCount++;

      if ( game && game.owner ) {
        callback( game.owner.rank || '', response, request );
      }
      else if ( game ) {
        players = game.black.concat( game.white );
        for ( i = 0; i < players.length; i += 1 ) {
          if ( players[i].name === name ) {
            callback( players[i].rank || '', response, request );
            break;
          }
        }
      }
      else if ( !archives || archives.isFirst() || requestCount === 6 ) {
        callback( null, response, request );
      }
      else {
        archives.getPrev();
      }
    });
  };

  MetaKGS.prototype.getTop100 = function(args, callback) {
    this.getContent( 'top100', callback );
  };

  MetaKGS.prototype.getTop100Players = function(args, callback) {
    this.getTop100(args, function(top100, response, request) {
      callback( top100 && top100.players, response, request );
    });
  };

  MetaKGS.prototype.getTournaments = function(args, callback) {
    var query = args || {};
    var path = [ 'tournaments' ];

    if ( query.year && query.year >= 2000 ) {
      path.push( Math.floor(query.year) );
    }
    else if ( query.hasOwnProperty('year') ) {
      throw new Error("'year' is invalid: '"+query.year+"'");
    }

    this.getContent( path.join('/'), callback );
  };

  MetaKGS.prototype.getTournamentList = function(args, callback) {
    this.getTournaments(args, function(tournaments, response, request) {
      callback( tournaments && tournaments.tournaments, response, request );
    });
  };

  MetaKGS.prototype.getTournament = function(args, callback) {
    var query = args || {};
    var path = [ 'tournament' ];

    if ( query.id && query.id > 0 ) {
      path.push( Math.floor(query.id) );
    }
    else if ( query.hasOwnProperty('id') ) {
      throw new Error("'id' is invalid: '"+query.id+"'");
    }
    else {
      throw new Error("'id' is required");
    }

    this.getContent( path.join('/'), callback );
  };

  MetaKGS.prototype.getTournamentRounds = function(args, callback) {
    this.getTournament(args, function(tournament, response, request) {
      callback( tournament && tournament.rounds, response, request );
    });
  };

  MetaKGS.prototype.getTournamentEntrants = function(args, callback) {
    var query = args || {};
    var path = [ 'tournament' ];

    if ( query.id && query.id > 0 ) {
      path.push( Math.floor(query.id) );
    }
    else if ( query.hasOwnProperty('id') ) {
      throw new Error("'id' is invalid: '"+query.id+"'");
    }
    else {
      throw new Error("'id' is required");
    }

    path.push( 'entrants' );

    this.getContent( path.join('/'), callback );
  };

  MetaKGS.prototype.getTournamentEntrantList = function(args, callback) {
    this.getTournamentEntrants(args, function(entrants, response, request) {
      callback( entrants && entrants.entrants, response, request );
    });
  };

  MetaKGS.prototype.getTournamentRound = function(args, callback) {
    var query = args || {};
    var path = [ 'tournament' ];

    if ( query.id && query.id > 0 ) {
      path.push( Math.floor(query.id) );
    }
    else if ( query.hasOwnProperty('id') ) {
      throw new Error("'id' is invalid: '"+query.id+"'");
    }
    else {
      throw new Error("'id' is required");
    }

    path.push( 'round' );

    if ( query.round && query.round > 0 ) {
      path.push( Math.floor(query.round) );
    }
    else if ( query.hasOwnProperty('round') ) {
      throw new Error("'round' is invalid: '"+query.round+"'");
    }
    else {
      throw new Error("'round' is required");
    }

    this.getContent( path.join('/'), callback );
  };

  MetaKGS.prototype.getTournamentGames = function(args, callback) {
    this.getTournamentRound(args, function(round, response, request) {
      callback( round && round.games, response, request );
    });
  };

  MetaKGS.prototype.getTournamentByes = function(args, callback) {
    this.getTournamentRound(args, function(round, response, request) {
      callback( round && round.byes, response, request );
    });
  };

  (function() {
    this.archives         = this.getArchives;
    this.games            = this.getGames;
    this.top100           = this.getTop100;
    this.top100Players    = this.getTop100Players;
    this.tourns           = this.getTournaments;
    this.tournList        = this.getTournamentList;
    this.tourn            = this.getTournament;
    this.tournRounds      = this.getTournamentRounds;
    this.tournRound       = this.getTournamentRound;
    this.tournGames       = this.getTournamentGames;
    this.tournByes        = this.getTournamentByes;
    this.tournEntrants    = this.getTournamentEntrants;
    this.tournEntrantList = this.getTournamentEntrantList;
  }).apply(MetaKGS.prototype);

  /*
   * HTTP Request
   */

  MetaKGS.Request = function(method, url, headers, body) {
    var h = headers || {};

    this.method = method;
    this.uri = url;
    this.headers = {};
    this.body = body;

    for ( field in h ) {
      if ( h.hasOwnProperty(field) ) {
        this.setHeader( field, h[value] );
      }
    }
  };

  MetaKGS.Request.prototype.getHeader = function(field) {
    var values = this.headers[ field.toLowerCase() ];
    return values && values.join(', ');
  };

  MetaKGS.Request.prototype.setHeader = function(field, value) {
    this.headers[ field.toLowerCase() ] = [ value ];
  };

  MetaKGS.Request.prototype.pushHeader = function(field, value) {
    var key = field.toLowerCase();
    this.headers[key] = this.headers[key] || [];
    this.headers[key].push( value );
  };

  MetaKGS.Request.prototype.eachHeader = function(callback) {
    var i, field, values;
    for ( field in this.headers ) {
      if ( this.headers.hasOwnProperty(field) ) {
        values = this.headers[field];
        for ( i = 0; i < values.length; i++ ) {
          callback( field, values[i] );
        }
      }
    }
  };

  MetaKGS.Request.prototype.send = function(callback) {
    var xhr = new XMLHttpRequest();
    var body = typeof this.body === 'undefined' ? null : this.body;

    xhr.onreadystatechange = function() {
      if ( this.readyState === 4 ) {
        callback( new MetaKGS.Response(this) );
      }
    };

    xhr.open( this.method, this.uri );

    this.eachHeader(function(field, value) {
      xhr.setRequestHeader( field, value );
    });

    xhr.send( body );
  };

  /*
   * HTTP Response 
   */

  MetaKGS.Response = function(xhr) {
    this.xhr = xhr;
  };

  MetaKGS.Response.prototype.code = function() {
    return this.xhr.status;
  };

  MetaKGS.Response.prototype.isInformation = function() {
    return this.code() >= 100 && this.code() < 200;
  };

  MetaKGS.Response.prototype.isSuccess = function() {
    return this.code() >= 200 && this.code() < 300;
  };

  MetaKGS.Response.prototype.isRedirection = function() {
    return this.code() >= 300 && this.code() < 400;
  };

  MetaKGS.Response.prototype.isClientError = function() {
    return this.code() >= 400 && this.code() < 500;
  };

  MetaKGS.Response.prototype.isServerError = function() {
    return this.code() >= 500 && this.code() < 600;
  };

  MetaKGS.Response.prototype.getHeader = function(field) {
    return this.xhr.getResponseHeader( field );
  };

  MetaKGS.Response.prototype.stringifyHeader = function() {
    return this.xhr.getAllResponseHeaders();
  };

  MetaKGS.Response.prototype.contentType = function() {
    var contentType = this.getHeader('Content-Type') || '';
    var mediaType = contentType.split(/;\s*/)[0];
    return mediaType.replace(/\s+/, '').toLowerCase();
  };

  MetaKGS.Response.prototype.body = function() {
    var body = this.xhr.responseText;

    if ( this.contentType() === 'application/json' ) {
      body = JSON.parse( body );
    }

    return body;
  };

  MetaKGS.noConflict = (function() {
    var _MetaKGS = window.MetaKGS;

    return function() {
      window.MetaKGS = _MetaKGS;
      return MetaKGS;
    };
  })();

  window.MetaKGS = MetaKGS;

})();


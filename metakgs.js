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
        callback( undefined, response, request );
      }
    });
  };

  MetaKGS.prototype.getContent = function(path, callback) {
    var that = this;
    var url = this.uriFor( path );

    this.get(url, function(body, response, request) {
      var content = body && body.content;
      var link = body && body.link;

      if ( link ) {
        content = that.paginate( content, link, callback );
      }

      callback( content, response, request );
    });
  };

  MetaKGS.prototype.paginate = function(prototype, link, callback) {
    var that = this;
    var content = Object.create( prototype );

    content.get = function(path, cb) {
      that.getContent( path, cb || callback );
    };

    content.hasPrev = function() {
      return link.prev ? true : false;
    };

    content.hasNext = function() {
      return link.next ? true : false;
    };

    content.getFirst = function(cb) {
      this.get( link.first, cb );
    };

    content.getPrev = function(cb) {
      if ( this.hasPrev() ) {
        this.get( link.prev, cb );
      }
    };

    content.getNext = function(cb) {
      if ( this.hasNext() ) {
        this.get( link.next, cb );
      }
    };

    content.getLast = function(cb) {
      this.get( link.last, cb );
    };
 
    return content;
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
        callback( game.owner.rank, response, request );
      }
      else if ( game ) {
        players = game.black.concat( game.white );
        for ( i = 0; i < players.length; i += 1 ) {
          if ( players[i].name === name ) {
            callback( players[i].rank, response, request );
            break;
          }
        }
      }
      else if ( !archives || !archives.hasPrev() || requestCount === 6 ) {
        callback( undefined, response, request );
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

  /*
   * HTTP Request
   */

  MetaKGS.Request = function(method, url, headers, body) {
    this.method = method;
    this.uri = url;
    this.body = body;
  };

  MetaKGS.Request.prototype.send = function(callback) {
    var xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function() {
      if ( this.readyState === 4 ) {
        callback( new MetaKGS.Response(this) );
      }
    };

    xhr.open( this.method, this.uri );

    xhr.send( this.body );
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

  MetaKGS.Response.prototype.header_get = function(field) {
    return this.xhr.getResponseHeader( field );
  };

  MetaKGS.Response.prototype.header_stringify = function() {
    return this.xhr.getAllResponseHeaders();
  };

  MetaKGS.Response.prototype.contentType = function() {
    var contentType = this.header_get('Content-Type') || '';
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


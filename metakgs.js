(function(global) {

  var metakgs = function(args) {
    var that = {};
    var spec = args || {};
    var http = spec.http || metakgs.http();

    that.http = function() {
      return http;
    };

    that.archives = function(user) {
      return metakgs.resource.archives({
        http: this.http(),
        user: user
      });
    };

    that.top100 = function() {
      return metakgs.resource.top100({
        http: this.http()
      });
    };

    that.tournament = function(id) {
      return metakgs.resource.tournament({
        http: this.http(),
        id: id
      });
    };

    return that;
  };

  metakgs.resource = function(args) {
    var that = {};
    var spec = args || {};
    var http = spec.http || metakgs.http();

    that.http = function() {
      return http;
    };

    that.getContent = function(path, callback) {
      var that = this;

      this.http().get(path, function(body, response, request) {
        var content = body && body.content;
        var link = body && body.link;

        if ( link && content ) {
          content = metakgs.resource.paginate(content, {
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

    return that;
  };

  metakgs.resource.paginate = function(prototype, args) {
    var that = Object.create( prototype );
    var spec = args || {};

    that.get = spec.get || function(path, callback) {
      throw new Error("call to abstract method 'get'");
    };

    that.getLink = spec.getLink || function(rel) {
      throw new Error("call to abstract method 'getLink'");
    };

    that.isFirst = function() {
      return !this.hasPrev();
    };

    that.hasPrev = function() {
      return this.getLink('prev') ? true : false;
    };

    that.hasNext = function() {
      return this.getLink('next') ? true : false;
    };

    that.isLast = function() {
      return !this.hasNext();
    };

    that.getFirst = function(callback) {
      this.get( this.getLink('first'), callback );
    };

    that.getPrev = function(callback) {
      if ( this.hasPrev() ) {
        this.get( this.getLink('prev'), callback );
      }
    };

    that.getNext = function(callback) {
      if ( this.hasNext() ) {
        this.get( this.getLink('next'), callback );
      }
    };

    that.getLast = function(callback) {
      this.get( this.getLink('last'), callback );
    };
 
    return that;
  };

  metakgs.resource.archives = function(args) {
    var that = metakgs.resource(args);
    var spec = args || {};
    var user = spec.user;

    if ( typeof user !== 'string' || !user.match(/^[a-z][a-z\d]{0,9}$/i) ) {
      throw new Error("'user' is invalid: '"+user+"'");
    }

    that.user = function() {
      return user;
    };

    that.get = function(args, callback) {
      var query = args || {};
      var year = query.year;
      var month = query.month;
      var path = [ 'archives', this.user() ];

      if ( typeof year !== 'undefined' ) {
        if ( metakgs.util.isInteger(year) && year >= 2000 ) {
          path.push( year );
        }
        else {
          throw new Error("'year' is invalid: '"+year+"'");
        }
      }

      if ( typeof month !== 'undefined' ) {
        if ( path.length === 3 ) {
          if ( metakgs.util.isInteger(month) && month >= 1 && month <= 12 ) {
            path.push( month );
          }
          else {
            throw new Error("'month' is invalid: '"+month+"'");
          }
        }
        else {
          throw new Error("'year' is required");
        }
      }

      this.getContent( path.join('/'), callback );
    };

    that.getGames = function(args, callback) {
      this.get(args, function(archives, response, request) {
        callback( archives && archives.games, response, request );
      });
    };

    that.getLatestRank = function(callback) {
      var user = this.user();
      var requestCount = 0;

      this.get({}, function(archives, response, request) {
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
            if ( players[i].name === user ) {
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

    return that;
  };

  metakgs.resource.top100 = function( args ) {
    var that = metakgs.resource(args);

    that.get = function(callback) {
      this.getContent( 'top100', callback );
    };

    that.getPlayers = function(callback) {
      this.get(function(top100, response, request) {
        callback( top100 && top100.players, response, request );
      });
    };

    return that;
  };

  metakgs.resource.tournament = function(args) {
    var that = metakgs.resource(args);
    var spec = args || {};
    var id = spec.id;

    if ( !metakgs.util.isInteger(id) || id < 1 ) {
      throw new Error("'id' is invalid: '"+id+"'");
    }

    that.id = function() {
      return id;
    };

    that.get = function(callback) {
      var path = [ 'tournament', this.id() ];
      this.getContent( path.join('/'), callback );
    };

    that.getRounds = function(callback) {
      this.get(function(content, response, request) {
        callback( content && content.rounds, response, request );
      });
    };

    that.getEntrants = function(callback) {
      var path = [ 'tournament', this.id(), 'entrants' ];
      this.getContent(path.join('/'), function(content, response, request) {
        callback( content && content.entrants, response, request );
      });
    };

    that.round = function(round) {
      return metakgs.resource.tournamentRound({
        http: this.http(),
        id: this.id(),
        round: round
      });
    };

    return that;
  };

  metakgs.resource.tournamentRound = function(args) {
    var that = metakgs.resource(args);
    var spec = args || {};
    var id = spec.id;
    var round = spec.round;

    if ( !metakgs.util.isInteger(id) || id < 1 ) {
      throw new Error("'id' is invalid: '"+id+"'");
    }

    if ( !metakgs.util.isInteger(round) || round < 1 ) {
      throw new Error("'round' is invalid: '"+round+"'");
    }

    that.id = function() {
      return id;
    };

    that.round = function() {
      return round;
    };

    that.get = function(callback) {
      var path = [ 'tournament', this.id(), 'round', this.round() ];
      this.getContent( path.join('/'), callback );
    };

    that.getGames = function(callback) {
      this.get(function(content, response, request) {
        callback( content && content.games, response, request );
      });
    };

    that.getByes = function(callback) {
      this.get(function(content, response, request) {
        callback( content && content.byes, response, request );
      });
    };

    return that;
  };

  metakgs.http = function(args) {
    var that = {};
    var spec = args || {};
    var baseURL = spec.baseURL || 'http://metakgs.org/api';

    that.baseURL = function() {
      return baseURL;
    };

    that.uriFor = function(path) {
      return path.indexOf('//') >= 0 ? path : this.baseURL()+'/'+path;
    };

    that.buildRequest = function() {
      return metakgs.http.request.apply( null, arguments );
    };

    that.get = function(path, callback) {
      var url = this.uriFor( path );
      var request = this.buildRequest( 'GET', url );

      request.send(function(response) {
        if ( response.code() === 200 ) {
          callback( response.body(), response, request );
        }
        else {
          callback( null, response, request );
        }
      });
    };

    return that;
  };

  metakgs.http.request = function(method, uri, headers, body) {
    var that = {};

    that.method = function() {
      return method;
    };

    that.uri = function() {
      return uri;
    };

    that.buildResponse = function(xhr) {
      return metakgs.http.response(xhr);
    };

    that.send = function(callback) {
      var that = this;
      var xhr = new XMLHttpRequest();

      xhr.onreadystatechange = function() {
        if ( this.readyState === 4 ) {
          callback( that.buildResponse(this) );
        }
      };

      xhr.open( this.method(), this.uri() );

      xhr.send();
    };

    return that;
  };

  metakgs.http.response = function(xhr) {
    var that = {};

    that.xhr = function() {
      return xhr;
    };

    that.code = function() {
      return this.xhr().status;
    };

    that.headerGet = function(field) {
      return this.xhr().getResponseHeader(field);
    };

    that.contentType = function() {
      var contentType = this.headerGet('Content-Type') || '';
      var mediaType = contentType.split(/;\s*/)[0].replace(/\s+/, '');
      return mediaType.toLowerCase();
    };

    that.body = function() {
      var body = this.xhr().responseText;

      switch ( this.contentType() ) {
        case 'application/json':
          body = JSON.parse( body );
          break;
      }

      return body;
    };

    return that;
  };

  metakgs.util = {};

  metakgs.util.isNumber = function(value) {
    return typeof value === 'number' && isFinite(value);
  };

  metakgs.util.isInteger = function(value) {
    return metakgs.util.isNumber(value) && Math.floor(value) === value;
  };

  metakgs.noConflict = (function() {
    var orig = global.metakgs;

    return function() {
      global.metakgs = orig;
      return metakgs;
    };
  })();

  global.metakgs = metakgs;

})(this);


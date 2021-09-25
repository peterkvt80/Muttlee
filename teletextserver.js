const fs = require('fs');
const readline = require('readline');
const path = require('path');

const http = require('http');
const https = require('https');

const express = require('express');
const nunjucks = require('nunjucks');

// socket.io documentation is helpful: https://socket.io/docs/emit-cheatsheet/
const socket = require('socket.io');


// import constants and config for use server-side
const CONST = require('./constants.js');
const CONFIG = require('./config.js');

// import package.json so we can get the current version
const PACKAGE_JSON = require('./package.json');


// import logger
const LOG = require('./log.js');


// output logo in console?
if (CONFIG[CONST.CONFIG.SHOW_CONSOLE_LOGO] === true) {
  // determine logo char array length
  const logoCharLength = CONFIG[CONST.CONFIG.CONSOLE_LOGO_CHAR_ARRAY].reduce(
    (previousValue, currentValue) => {
      return Math.max(
        (typeof previousValue === 'string') ?
          previousValue.length :
          previousValue,
        currentValue.length,
      );
    }
  );

  // output logo char array lines to console
  console.log(''.padStart(logoCharLength));

  for (let i in CONFIG[CONST.CONFIG.CONSOLE_LOGO_CHAR_ARRAY]) {
    console.log(CONFIG[CONST.CONFIG.CONSOLE_LOGO_CHAR_ARRAY][i]);
  }

  // include current version under the logo
  const versionString = 'v' + PACKAGE_JSON.version;
  console.log(''.padStart(logoCharLength - versionString.length) + versionString);

  console.log(''.padStart(logoCharLength));
}


// output basic server information
LOG.fn(
  null,
  `Server is running on ${process.platform}`,
  LOG.LOG_LEVEL_MANDATORY,
);


// import modules
require('./weather.js');      // Should check if this is obsolete
require('./service.js');
require('./utils.js');        // Prestel and other string handling
require('./keystroke.js');    // Editing data from clients


// list of services
let services = [];


// instantiate Express app
const app = express();


// instantiate Nunjucks templating system
const env = nunjucks.configure(
  'html',
  {
    autoescape: true,
    express: app
  }
);

app.set('view engine', 'html');

env.addFilter(
  'featureEnabled',
  function(features, featureName) {
    return (features && (features[featureName] === true));
  }
);


// define shared template variables
let templateVars = {
  TITLE: CONFIG.TITLE,
};

// read in logo SVG to pass into the template
try {
  templateVars.LOGO_SVG = fs.readFileSync(CONFIG.LOGO_SVG_PATH);
} catch (e) { }


// define app routes
app.use(
  '/constants.js',
  function (req, res) {
    res.sendFile(
      __dirname + '/constants.js',
    );
  }
);

app.use(
  '/config.js',
  function (req, res) {
    // only generate line for config keys we have explicitly whitelisted in config.js
    let content = {};

    for (let key in CONFIG) {
      if (CONFIG[CONST.CONFIG.FRONTEND_CONFIG_KEYS].includes(key)) {
        content[key] = CONFIG[key];
      }
    }

    content = 'const CONFIG = ' + JSON.stringify(content) + ';';

    res.send(
      content
    );
  }
);

app.use(
  express.static(__dirname + '/public')
);

app.use(
  '*',
  function (req, res) {
    res.render(
      'index.html',
      templateVars,
    );
  }
);


// serve over HTTP?
let serverHttp;

if (CONFIG.TELETEXT_VIEWER_SERVE_HTTP) {
  serverHttp = http.createServer(app).listen(
    CONFIG.TELETEXT_VIEWER_SERVE_HTTP_PORT
  );

  LOG.fn(
    null,
    `Serving on port ${CONFIG.TELETEXT_VIEWER_SERVE_HTTP_PORT}`,
    LOG.LOG_LEVEL_MANDATORY,
  );
}


// serve over HTTPS?
let serverHttps;

if (CONFIG.TELETEXT_VIEWER_SERVE_HTTPS) {
  // read in key and cert files
  const options = {
    key: fs.readFileSync(CONFIG.TELETEXT_VIEWER_SERVE_HTTPS_KEY_PATH),
    cert: fs.readFileSync(CONFIG.TELETEXT_VIEWER_SERVE_HTTPS_CERT_PATH),
  };

  serverHttps = https.createServer(options, app).listen(
    CONFIG.TELETEXT_VIEWER_SERVE_HTTPS_PORT
  );

  LOG.fn(
    null,
    `Serving on port ${CONFIG.TELETEXT_VIEWER_SERVE_HTTPS_PORT}`,
    LOG.LOG_LEVEL_MANDATORY,
  );
}

LOG.blank();


// instantiate socket.io server
const io = socket(
  (CONFIG.TELETEXT_VIEWER_SERVE_HTTPS) ?
    serverHttps :
    serverHttp
);

io.sockets.on('connection', newConnection);


// instantiate keystroke class
var keystroke = new KeyStroke();


// instantiate Weather module
var weather = new Weather(doLoad);

app.get(
  '/weather.tti',
  weather.doLoadWeather
);



var initialPage = CONST.PAGE_MIN;
var connectionList = new Object(); // Associative array links user id to service: connectionList['/#NODc31jxxFTSm_SaAAAC']='d2k'
var missingPage = 0;




function save() {
  LOG.fn(
    ['teletextserver', 'save'],
    `Autosave`,
    LOG.LOG_LEVEL_VERBOSE,
  );

  keystroke.saveEdits();
}

setInterval(save, 60000);  // every minute we save away the edits


function newConnection(socket) {
  // Try to split the parameters from ?service=BBCNEWS&page=120
  let queryString = {};

  let uri = decodeURI(socket.handshake.headers.referer);
  uri.replace(
    new RegExp('([^?=&]+)(=([^&]*))?', 'g'),
    function ($0, $1, $2, $3) {
      queryString[$1] = $3;
    }
  );

  LOG.fn(
    ['teletextserver', 'newConnection'],
    [
      `Service: ${queryString['service']}`,
      `Page: ${queryString['page']}`
    ],
    LOG.LOG_LEVEL_VERBOSE,
  );

  let p = parseInt('0x' + queryString['page'], 16);

  // If there was no page supplied we default to 100.
  if (queryString['page'] === undefined) {
    p = CONST.PAGE_MIN;
  }

  const serviceString = queryString['service'];

  connectionList[socket.id] = serviceString;     // Register that this user is linked to this service.

  // If there is no page=nnn in the URL then default to CONST.PAGE_MIN
  if ((p >= CONST.PAGE_MIN) && (p <= CONST.PAGE_MAX)) {
    initialPage = p;

    const data = {
      p: initialPage,
      S: serviceString
    };

    io.sockets.emit('setpage', data);

  } else {
    initialPage = CONST.PAGE_MIN;
  }

  LOG.fn(
    ['teletextserver', 'newConnection'],
    `socket.id=${socket.id}`,
    LOG.LOG_LEVEL_INFO,
  );

  // check if request IP address is banned (in config.js)
  const clientIp = socket.request.connection.remoteAddress;

  if (CONFIG.BANNED_IP_ADDRESSES.includes(clientIp)) {
    return;
  }

  // Send the socket id back. If a message comes in with this socket we know where to send the setpage to.
  socket.emit('id', socket.id);

  // Set up handlers for this socket
  socket.on('keystroke', keyMessage);

  function keyMessage(data) {
    // socket.broadcast.emit('keystroke', data) // To all but sender
    io.emit('keystroke', data); // To everyone

    // Also send this keymessage to our pages
    // Or maybe to our services who can then switch the message as needed?
    for (let i = 0; i < services.length; i++) {
      services[i].keyMessage(data);
    }
    // Temporary hack. Use ] to trigger the writeback mechanism.
    if (data.k === ']') {
      keystroke.saveEdits();
    } else {
      keystroke.addEvent(data);
    }
  }

  socket.on('load', doLoad);
  socket.on('initialLoad', doInitialLoad);
  socket.on('create', doCreate);
  socket.on('clearPage', doClearPage);

  // When this connection closes we remove the connection id
  socket.on('disconnect', function () {
    delete connectionList[socket.id];
  });
}

/** Clear the current page to blank
 */
function doClearPage(data) {
  LOG.fn(
    ['teletextserver', 'doClearPage'],
    [
      `Clearing page=${data.p.toString(16)}`,
      `keyMessage S=${data.S}, p=${data.p}, s=${data.s}`,
    ],
    LOG.LOG_LEVEL_VERBOSE,
  );

  keystroke.clearPage(data); // Clear the page

  io.sockets.emit('blank', data); // Clear down the old data on te clients
}

/** Create the page and load it
 */
function doCreate(data) {
  LOG.fn(
    ['teletextserver', 'doCreate'],
    `Creating page=${data.p.toString(16)}`,
    LOG.LOG_LEVEL_VERBOSE,
  );

  // Create a page from template
  createPage(
    data,
    function () {
      doLoad(data)
    }
  );
}

function doInitialLoad(data) {
  LOG.fn(
    ['teletextserver', 'doInitialLoad'],
    '',
    LOG.LOG_LEVEL_VERBOSE,
  );

  data.p = parseInt(initialPage);
  doLoad(data);
}

function doLoad(data) {
  // if client request has data.x==CONST.SIGNAL_INITIAL_LOAD, we load the initial page.
  if (data.x === CONST.SIGNAL_INITIAL_LOAD) {
    data.p = initialPage;
    data.x = 0;
  }

  let serviceString = connectionList[data.id];

  if (typeof serviceString === 'undefined') {
    serviceString = 'onair';
  }

  const filename = path.join(
    CONFIG.BASE_DIR,
    serviceString,
    'p' + data.p.toString(16) + '.tti'
  );

  // !!! Here we want to check if the page is already in cache
  let found = findService(serviceString);

  if (found === false) {
    LOG.fn(
      ['teletextserver', 'doLoad'],
      `Adding service=${serviceString}, buffered key count=${keystroke.length}`,
      LOG.LOG_LEVEL_VERBOSE,
    );

    services.push(new Service(serviceString));  // create the service
    found = services.length - 1; // The index of the service we just created
  }

  // Now we have a service number. Does it contain our page?
  const svc = services[found];
  const page = svc.findPage(data.p);

  LOG.fn(
    ['teletextserver', 'doLoad'],
    `Found serviceString=${serviceString}, page=${page}, filename=${filename}, data.x=${data.x}, data.id=${data.id}`,
    LOG.LOG_LEVEL_VERBOSE,
  );

  /////// SKIP THIS 410 STUFF. NOT USED ANY MORE
  /*
    if (data.y==0 && data.p==0x410) // Special hack. Intercept P410. First time we will load weather
    {
      data.x = CONST.SIGNAL_PAGE_NOT_FOUND;
    }
    // The next time x=1 so we will load the page we just created.
    if (data.x<0)
    {
      filename='/var/www/'+serviceString+'/p404.tti' // this must exist or we get into a deadly loop
      data.S=serviceString
      // filename='http://localhost:8080/weather.tti'
      if (data.p==0x410)
      {
        weather.doLoadWeather(0,0)
        return
      }
    }
  */

  io.sockets.emit('blank', data); // Clear down the old data. // TODO This should emit only to socket.emit, not all units


  // don't crash the server if the page file does not exist!
  if (!fs.existsSync(filename)) {
    return false;
  }

  var instream;

  instream = fs.createReadStream(filename, { encoding: 'ascii' }); // Ascii strips bit 7 without messing up the rest of the text. latin1 does not work :-(

  instream.on('error', function () {
    let data2;

    LOG.fn(
      ['teletextserver', 'doLoad'],
      `ERROR! data.p=${data.p.toString(16)}`,
      LOG.LOG_LEVEL_ERROR,
    );

    // If this comes in as 404 it means that the 404 doesn't exist either. Set back to the default initial page
    if (data.p === CONST.PAGE_404) {
      LOG.fn(
        ['teletextserver', 'doLoad'],
        `404 double error`,
        LOG.LOG_LEVEL_INFO,
      );

      data.p = initialPage;
      data.S = undefined;
      data2 = data; // Hmm, do we need to do a deep copy here?
      data2.x = 0;
      connectionList[data.id] = undefined; // Force this user back to the default service

    } else {
      data2 = data; // Could this do better with a deep copy?
      data2.y = data2.p; // Save the page number, we will ask the user if they want to create the page
      data2.p = CONST.PAGE_404; // This page must exist or we get into a deadly loop
      data2.x = CONST.SIGNAL_PAGE_NOT_FOUND; // Signal a 404 error
      data2.S = connectionList[data.id]; // How do we lose the service type? This hack shouldn't be needed

      LOG.fn(
        ['teletextserver', 'doLoad'],
        `404 single error, service=${JSON.stringify(data2)}`,
        LOG.LOG_LEVEL_INFO,
      );
    }

    io.sockets.emit('setpage', data2);

    doLoad(data2);
  });

  var rl = readline.createInterface({
    input: instream,
    //    output: outstream,
    terminal: false
  });

  rl.on('line', function (line) {
    if (line.indexOf('PN') === 0) {
      // Need to implement carousels    @todo
      data.line = line.substring(6);
      io.sockets.emit('subpage', data);

    } else if (line.indexOf('DE,') === 0) {   // Detect a description row
      data.desc = line.substring(3);

      // Hacky hack. Page 404 gets the failed page number in data.y
      if (data.p === CONST.PAGE_404) {
        data.desc += " Failed to load " + data.y.toString(16);
        missingPage = data.y.toString(16);
      }

      io.sockets.emit('description', data);

      LOG.fn(
        ['teletextserver', 'doLoad'],
        `Sending desc=${data.desc}`,
        LOG.LOG_LEVEL_VERBOSE,
      );

    } else if (line.indexOf('FL,') === 0) {    // Detect a Fastext link
      var ch;
      var ix = 3;
      data.fastext = [];

      for (let link = 0; link < 4; link++) {
        let flink = '';
        for (ch = line.charAt(ix++); ch !== ',';) {
          flink = flink + ch;
          ch = line.charAt(ix++);
        }

        data.fastext[link] = flink;
      }

      // Hacky hack: 404 page signals the missing page in data.y
      // We will offer to make the page from template eventually
      if (data.p === CONST.PAGE_404) {
        data.fastext[2] = '1' + missingPage.toString(16); // Flag that this page doesn't exist
      }

      io.sockets.emit('fastext', data);

      return;

    } else if (line.indexOf('CT,') === 0) {     // Counter timer
      // Hack: Send the time in Fastext[0]
      data.fastext = [];
      data.fastext[0] = line[3];  // Need allow numbers greater than 9!

      io.sockets.emit('timer', data);

      return;

    } else if (line.indexOf('OL,') === 0) {    // Detect a teletext row
      var p = 0;
      var ix = 3;
      var row = 0;

      var ch = line.charAt(ix);
      if (ch !== ',') {
        row = ch;
      }

      ix++;

      ch = line.charAt(ix);
      if (ch !== ',') {
        row = row + ch; // haha. Strange maths
        ix++;
      }

      row = parseInt(row);
      ix++; // Should be pointing to the first character now

    } else {
      return; // Not a row. Not interested
    }

    data.y = row;

    // Here is a line at a time
    var result = line.substring(ix); // snip out the row data

    // Pad strings shorter than 40 characters
    if (result.length < 40) {
      result += "                                        ";
      result = result.substring(0, 40);
    }

    // @todo Different services need different permissions
    if (data.S === 'wtf' && row === 22 && data.p === CONST.PAGE_404) { // Special hack for 404 page. Replace this field with the missing page number
      var first = result.substring(0, 32);
      var second = result.substr(35);

      result = first + missingPage.toString(16) + second;
    } // end of 404 hack

    result = DeEscapePrestel(result); // remove Prestel escapes

    data.k = '?'; // @todo Not sure what these values should be, if anything
    data.x = -1;
    data.y = row; // The row that we are sending out
    data.rowText = result;

    io.sockets.emit('row', data);
  });

  rl.on(
    'close',
    function () {
      LOG.fn(
        ['teletextserver', 'doLoad'],
        `end of file`,
        LOG.LOG_LEVEL_VERBOSE,
      );

      // When the file has been read, we want to send any keystrokes that might have been added to this page
      keystroke.replayEvents(io.sockets);
      // How are we going to send this?
    }
  );
}

/** Finds the service with the required name.
* @return Index of service, or false
*/
function findService(name) {
  if (services.length === 0) {
    return false; // No services
  }

  for (var i = 0; i < services.length; i++) {
    if (services[i].matchName(name)) {
      return i;
    }
  }

  return false; // Not found
}


/** Create a page from template number data.p
 */
function createPage(data, callback) {
  LOG.fn(
    ['teletextserver', 'createPage'],
    `Starts`,
    LOG.LOG_LEVEL_VERBOSE,
  );

  // what is my page name? /var/www/<service>/p<page number>.tti
  // @todo Check for service being undefined
  const filename = path.join(
    CONFIG.BASE_DIR,
    data.S,
    'p' + data.p.toString(16) + '.tti'
  );

  LOG.fn(
    ['teletextserver', 'createPage'],
    `filename=${filename}`,
    LOG.LOG_LEVEL_VERBOSE,
  );

  // open write file stream
  var wstream = fs.createWriteStream(filename);

  // write the template
  wstream.write('DE,Topic: Created by user\n');
  wstream.write('DS,muttlee\n');
  wstream.write('SP,' + filename + '\n');
  wstream.write('CT,8,T\n');
  wstream.write('PN,' + data.p.toString(16) + '00\n'); // @todo How can we add subpages?
  wstream.write('SC,0000\n');
  wstream.write('PS,8000\n'); // To do languages
  wstream.write('RE,0\n');
  wstream.write('OL,0,XXXXXXXXWT-FAX mpp DAY dd MTH C hh:nn.ss\n');
  wstream.write('OL,1,Q73#35R7ss35S7sskT]C| Wiki |FFacts at  |\n');
  wstream.write('OL,2,Q55555R5 5 5S5=$jT]C| Tel  |Fyour      |\n');
  wstream.write('OL,3,Qussq5Rupqp5SuqpzT]C| Fax  |Ffingertips|\n');
  wstream.write('OL,4,MTemplate                               \n');
  wstream.write('OL,5,Q                                       \n');
  wstream.write('OL,6, ```````````````````````````````````````\n');
  wstream.write('OL,7,CTemplateGhighlights other entries in   \n');
  wstream.write('OL,8,CyellowGwith the first paragraph white. \n');
  wstream.write('OL,9,F                                       \n');
  wstream.write('OL,10,FSubsequent paragraphs should be cyan.  \n');
  wstream.write('OL,11,FThe last line is reserved for Fastext  \n');
  wstream.write('OL,12, To find out more about editing, press  \n');
  wstream.write('OL,13, theFcyanGbutton.                       \n');
  wstream.write('OL,14,F                                       \n');
  wstream.write('OL,15,F                                       \n');
  wstream.write('OL,16,M  NOW PRESSHESCAPEIAND EDIT THIS   \n');
  wstream.write('OL,17,F                                       \n');
  wstream.write('OL,18,F                                       \n');
  wstream.write('OL,19,F                                       \n');
  wstream.write('OL,20,F                                       \n');
  wstream.write('OL,21,F  PRO TIP: To clear the screen, press  \n');
  wstream.write('OL,22,F           Escape then Z               \n');
  wstream.write('OL,23,F                                       \n');
  wstream.write('OL,24,A Next   B....       C....      FHelp   \n');
  // Write hex then read as decimal, so we don't increment to any hex pages.
  wstream.write('FL,' + (parseInt(data.p.toString(16)) + 1) + ',8ff,8ff,700,8ff,8ff  \n');
  wstream.end();

  // signal completion
  wstream.on('finish', callback);
}

const fs = require('fs');
const readline = require('readline');
const path = require('path');
const { URL } = require('url');

const http = require('http');
const https = require('https');

const parseUrl = require('parseurl');
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


function renderLogo(includeEndBlankLine = false) {
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

  let str = '';

  // output logo char array lines
  str += ''.padStart(logoCharLength) + '\n';

  for (let i in CONFIG[CONST.CONFIG.CONSOLE_LOGO_CHAR_ARRAY]) {
    str += CONFIG[CONST.CONFIG.CONSOLE_LOGO_CHAR_ARRAY][i] + '\n';
  }

  // include current version under the logo
  const versionString = 'v' + PACKAGE_JSON.version;
  str += ''.padStart(logoCharLength - versionString.length) + versionString + '\n';

  if (includeEndBlankLine) {
    str += ''.padStart(logoCharLength) + '\n';
  }

  return str;
}


// output logo in console?
if (CONFIG[CONST.CONFIG.SHOW_CONSOLE_LOGO] === true) {
  // output logo char array lines to console
  console.log(
    renderLogo(true)
  );
}


// output basic server information
LOG.fn(
  null,
  [
    `Server is running on ${process.platform}`,
    `Serving service page files from ${CONFIG[CONST.CONFIG.SERVICE_PAGES_SERVE_DIR]}`,
  ],
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
  IS_DEV: CONFIG[CONST.CONFIG.IS_DEV],

  TITLE: CONFIG[CONST.CONFIG.TITLE],

  SERVICES_AVAILABLE: CONFIG[CONST.CONFIG.SERVICES_AVAILABLE],
};

if (CONFIG[CONST.CONFIG.SHOW_CONSOLE_LOGO] === true) {
  templateVars.LOGO_CHARS = renderLogo();
}

// read in logo SVG to pass into the template
try {
  templateVars.LOGO_SVG = fs.readFileSync(CONFIG[CONST.CONFIG.LOGO_SVG_PATH]);
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
        let configKeyData = CONFIG[key];

        // further modify / filter this config key's data?
        if (key === CONST.CONFIG.SERVICES_AVAILABLE) {
          for (let i in configKeyData) {
            configKeyData[i] = {
              name: configKeyData[i].name,
              url: configKeyData[i].url,
              port: configKeyData[i].port,
              isEditable: configKeyData[i].isEditable || false,
            };
          }
        }

        content[key] = configKeyData;
      }
    }

    const output = 'const CONFIG = ' + JSON.stringify(content) + ';';

    res.send(
      output
    );
  }
);

app.use(
  '/manifest.json',
  function (req, res) {
    let output = {};

    try {
      const searchParams = new URLSearchParams(parseUrl(req).search);
      const service = searchParams.get('service');

      // deep clone before modification
      output = JSON.parse(
        JSON.stringify(
          loadServiceManifest(service)
        )
      );

      // only output relevant page object keys...
      if (typeof output.pages === 'object') {
        let pages = {};

        for (let pageNumber in output.pages) {
          // skip non-numeric page numbers
          if (/[A-F]+/i.test(pageNumber)) {
            continue;
          }

          pages[pageNumber] = {
            p: output.pages[pageNumber].p,
          };

          if (output.pages[pageNumber].d) {
            pages[pageNumber].d = output.pages[pageNumber].d;
          }
        }

        output.pages = pages;
      }

    } catch (e) { }

    res.setHeader('Content-Type', 'application/json');
    res.send(
      JSON.stringify(output)
    );
  }
);

app.use(
  '/pages',
  function (req, res) {
    res.sendFile(
      path.join(
        CONFIG[CONST.CONFIG.SERVICE_PAGES_SERVE_DIR],
        parseUrl(req).path,
      )
    );
  }
);

app.use(
  express.static(__dirname + '/public')
);

app.use(
  '*',
  function (req, res) {
    let customTemplateVars = {
      ...templateVars,
    };

    // read in zapper SVG's to pass into the template
    try {
      customTemplateVars.ZAPPER_STANDARD_SVG = fs.readFileSync(CONFIG[CONST.CONFIG.ZAPPER_STANDARD_SVG_PATH]);
      customTemplateVars.ZAPPER_COMPACT_SVG = fs.readFileSync(CONFIG[CONST.CONFIG.ZAPPER_COMPACT_SVG_PATH]);
    } catch (e) { }

    res.render(
      'index.html',
      customTemplateVars,
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
    key: fs.readFileSync(CONFIG[CONST.CONFIG.TELETEXT_VIEWER_SERVE_HTTPS_KEY_PATH]),
    cert: fs.readFileSync(CONFIG[CONST.CONFIG.TELETEXT_VIEWER_SERVE_HTTPS_CERT_PATH]),
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
    serverHttp,

  {
    handlePreflightRequest: (req, res) => {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST',
        'Referrer-Policy': 'no-referrer-when-downgrade',
      });
      res.end();
    },
  },
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

var initialPage;

// Associative array links user id to service: connectionList['/#NODc31jxxFTSm_SaAAAC']=CONST.SERVICE_DIGITISER
var connectionList = new Object();

var missingPage = 0;

let serviceManifests = {};




function autosave() {
  LOG.fn(
    ['teletextserver', 'autosave'],
    `Autosave`,
    LOG.LOG_LEVEL_VERBOSE,
  );

  keystroke.saveEdits();
}


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


function loadServiceManifest(service) {
  if (!serviceManifests[service]) {
    const serviceManifestFile = path.join(
      CONFIG[CONST.CONFIG.SERVICE_PAGES_SERVE_DIR],
      service,
      'manifest.json',
    );

    try {
      serviceManifests[service] = JSON.parse(
        fs.readFileSync(serviceManifestFile)
      );

    } catch (e) { }
  }

  return serviceManifests[service];
}


function newConnection(socket) {
  // check if request IP address is banned (in config.js)
  const clientIp = socket.request.connection.remoteAddress;

  if (CONFIG.BANNED_IP_ADDRESSES.includes(clientIp)) {
    return;
  }

  // determine parameters from socket URL
  const viewerUrl = new URL(socket.handshake.headers.referer);
  const viewerSearchParams = new URLSearchParams(viewerUrl.search);

  const socketUrl = new URL(socket.handshake.url, 'http://example.com');
  const socketSearchParams = new URLSearchParams(socketUrl.search);

  let service = socketSearchParams.get('service');
  const page = viewerSearchParams.get('page');

  // ensure service name is valid
  const serviceData = CONFIG[CONST.CONFIG.SERVICES_AVAILABLE];

  if (!service || !serviceData[service]) {
    service = CONFIG[CONST.CONFIG.DEFAULT_SERVICE];
  }

  // register that this user is linked to this service
  connectionList[socket.id] = service;

  LOG.fn(
    ['teletextserver', 'newConnection'],
    `service=${service}, page=${page}`,
    LOG.LOG_LEVEL_VERBOSE,
  );

  // set default page number if none supplied
  let p;

  if (page === undefined) {
    p = CONST.PAGE_MIN;

  } else {
    p = parseInt(`0x${page}`, 16);
  }

  // If there is no page=nnn in the URL then default to CONST.PAGE_MIN
  if ((p >= CONST.PAGE_MIN) && (p <= CONST.PAGE_MAX)) {
    initialPage = p;

    const data = {
      p: initialPage,
      S: service
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

  // Send the socket id back. If a message comes in with this socket we know where to send the setpage to.
  socket.emit('id', socket.id);

  // Set up handlers for this socket
  socket.on('keystroke', keyMessage);
  socket.on('load', doLoad);
  socket.on('initialLoad', doInitialLoad);
  socket.on('create', doCreate);
  socket.on('clearPage', doClearPage);

  // When this connection closes we remove the connection id
  socket.on('disconnect', function () {
    delete connectionList[socket.id];
  });


  // for editable services...
  if (service && serviceData[service] && serviceData[service].isEditable) {
    LOG.fn(
      ['teletextserver', 'newConnection'],
      `This service is editable, service=${service}`,
      LOG.LOG_LEVEL_VERBOSE,
    );

    // ...every minute autosave the edits
    setInterval(
      autosave,
      60000,
    );
  }
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
  if (typeof data.p !== 'number') {
    data.p = CONST.PAGE_MIN;
  }

  // @todo: This should emit only to socket.emit, not all units
  // clear the existing page
  io.sockets.emit('blank', data);

  // if client request has data.x==CONST.SIGNAL_INITIAL_LOAD, we load the initial page.
  if (data.x === CONST.SIGNAL_INITIAL_LOAD) {
    data.p = initialPage;
    data.x = 0;
  }


  // get service (and set to default service if not found)
  let service = connectionList[data.id];

  if (!service) {
    service = CONFIG[CONST.CONFIG.DEFAULT_SERVICE];
  }


  // determine what to serve...
  let filename;

  if (data.x === CONST.SIGNAL_PAGE_NOT_FOUND) {
    // determine 404 page file to serve...
    filename = CONFIG[CONST.CONFIG.PAGE_404_PATH];

    const serviceData = CONFIG[CONST.CONFIG.SERVICES_AVAILABLE];

    // if service is editable, serve editable 404 page
    if (serviceData[data.S] && serviceData[data.S].isEditable) {
      filename = CONFIG[CONST.CONFIG.PAGE_404_EDITABLE_PATH];
    }

    // serve custom 404 page, or leave existing blanked page?
    if (!fs.existsSync(filename)) {
      // custom 404 page does not exist, leave existing blanked page
      return false;
    }

  } else {
    // attempt serve a standard page...
    const serviceManifest = loadServiceManifest(service);

    if (serviceManifest && serviceManifest.pages && serviceManifest.pages[data.p.toString(16)] && serviceManifest.pages[data.p.toString(16)].f) {
      // ...use page filename as defined in service manifest
      filename = path.join(
        CONFIG[CONST.CONFIG.SERVICE_PAGES_SERVE_DIR],
        service,
          serviceManifest.pages[data.p.toString(16)].f,
      );

    } else {
      // service manifest does not exist, use standard page-number-based filename format
      filename = path.join(
        CONFIG[CONST.CONFIG.SERVICE_PAGES_SERVE_DIR],
        service,
        `p${data.p.toString(16)}.tti`,
      );
    }
  }


  // check if the page is already in cache
  let found = findService(service);

  if (found === false) {
    LOG.fn(
      ['teletextserver', 'doLoad'],
      `Adding service=${service}, buffered key count=${keystroke.length}`,
      LOG.LOG_LEVEL_VERBOSE,
    );

    // create the service
    services.push(
      new Service(service)
    );

    // the index of the service we just created
    found = services.length - 1;
  }

  // Now we have a service number. Does it contain our page?
  const svc = services[found];
  const page = svc.findPage(data.p);      // @todo: this will always be false, since we're not doing svc.addPage()

  // determine if page file exists...
  let is404 = false;

  if (!fs.existsSync(filename)) {
    LOG.fn(
      ['teletextserver', 'doLoad'],
      `Error: Page TTI file not found. service=${service}, page=${page}, filename=${filename}, data.x=${data.x}, data.id=${data.id}`,
      LOG.LOG_LEVEL_ERROR,
    );

    is404 = true;

  } else {
    LOG.fn(
      ['teletextserver', 'doLoad'],
      `Found service=${service}, page=${page}, filename=${filename}, data.x=${data.x}, data.id=${data.id}`,
      LOG.LOG_LEVEL_VERBOSE,
    );
  }


  const pageNotFound = function () {
    const data2 = {
      ...data,

      ...{
        y: data.p,                          // Save the page number, we will ask the user if they want to create the page
        p: data.p,
        x: CONST.SIGNAL_PAGE_NOT_FOUND,     // Signal a 404 error
        S: connectionList[data.id],         // How do we lose the service type? This hack shouldn't be needed
      },
    };

    io.sockets.emit('setpage', data2);

    doLoad(data2);
  };


  // if page file is not available, immediately serve 404 page
  if (is404) {
    pageNotFound();

    return;
  }


  // attempt to read page file contents...
  const instream = fs.createReadStream(
    filename,
    {
      // ascii strips bit 7 without messing up the rest of the text. latin1 does not work :-(
      encoding: CONST.ENCODING_ASCII,
    },
  );

  instream.on('error', pageNotFound);


  const rl = readline.createInterface({
    input: instream,
    terminal: false
  });

  rl.on('line', function (line) {
    if (line.indexOf('PN') === 0) {
      // Need to implement carousels    @todo
      data.line = line.substring(6);
      io.sockets.emit('subpage', data);

    } else if (line.indexOf('DE,') === 0) {   // Detect a description row
      data.desc = line.substring(3);

      // if page has page not found signal set, append the failed page number to the page description display
      if (data.x === CONST.SIGNAL_PAGE_NOT_FOUND) {
        missingPage = data.y.toString(16);

        data.desc += ` - page ${missingPage}`;
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

      // if page has page not found signal set...
      if (data.x === CONST.SIGNAL_PAGE_NOT_FOUND) {
        // ...and service is editable, change the yellow fastext link to allow creating of a new page at this page number
        const serviceData = CONFIG[CONST.CONFIG.SERVICES_AVAILABLE];

        if (serviceData[data.S] && serviceData[data.S].isEditable) {
          data.fastext[2] = `1${missingPage}`;
        }
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

    // Special hack for 404 page. Replace this field with the missing page number
    // @todo Different services need different permissions
    if (
      (data.S === CONST.SERVICE_WIKI) &&
      (data.p === CONST.PAGE_404) &&
      (row === 22)
    ) {
      const first = result.substring(0, 32);
      const second = result.substr(35);

      result = first + missingPage + second;
    }

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
  const serviceData = CONFIG[CONST.CONFIG.SERVICES_AVAILABLE];

  // don't create page if service is not defined, or is not a known service
  if (!data.S || !serviceData[data.S]) {
    LOG.fn(
      ['teletextserver', 'createPage'],
      `Error: Could not create page, service=${data.S} unknown`,
      LOG.LOG_LEVEL_ERROR,
    );

    return false;
  }

  // don't create page if service is not editable
  if (!serviceData[data.S].isEditable) {
    LOG.fn(
      ['teletextserver', 'createPage'],
      `Error: Could not create page, service=${data.S} is not editable`,
      LOG.LOG_LEVEL_ERROR,
    );

    return false;
  }

  LOG.fn(
    ['teletextserver', 'createPage'],
    `Creating page=${data.p.toString(16)}`,
    LOG.LOG_LEVEL_VERBOSE,
  );

  const filename = path.join(
    CONFIG[CONST.CONFIG.SERVICE_PAGES_SERVE_DIR],
    data.S,
    `p${data.p.toString(16)}${CONST.PAGE_EXT_TTI}`
  );

  LOG.fn(
    ['teletextserver', 'createPage'],
    `filename=${filename}`,
    LOG.LOG_LEVEL_VERBOSE,
  );

  // open write file stream
  const wstream = fs.createWriteStream(filename);

  // write the template
  wstream.write('DE,Topic: Created by user\n');
  wstream.write('DS,' + CONFIG[CONST.CONFIG.TITLE] + '\n');
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

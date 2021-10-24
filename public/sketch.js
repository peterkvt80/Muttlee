// current state values (initialize to defaults)
let service = CONFIG[CONST.CONFIG.DEFAULT_SERVICE];
let controls = CONFIG[CONST.CONFIG.DEFAULT_CONTROLS];
let display = CONFIG[CONST.CONFIG.DEFAULT_DISPLAY];
let scale = CONFIG[CONST.CONFIG.DEFAULT_SCALE];
let autoplay = CONFIG[CONST.CONFIG.DEFAULT_AUTOPLAY];
let menuOpen = CONFIG[CONST.CONFIG.DEFAULT_MENU_OPEN];

// remember current state values
let currentPixelDensity;

// initialise edit mode
let editMode = CONST.EDITMODE_NORMAL;

// teletext
let myPage, ttxFont, ttxFontDH;

// metrics
let gTtxW, gTtxH;
const gTtxFontSize = 20;
const gridOffsetVertical = 4;

// page selection
let digit1 = '1';
let digit2 = '0';
let digit3 = '0';

// comms
let socket;
let gClientID = null; // Our unique connection id

// fetched service manifests
let serviceManifests = {};

// autoplay interval
let autoplayInterval;

// array of manifest page numbers, which can be reduced in random autoplay mode so that we don't repeat pages
let manifestPageNumbers = [];

// DOM
let inputPage;
let menuButton;
let serviceSelector, serviceSelector2, scaleSelector, controlsSelector, displaySelector, autoplaySelector;
let manifestModal, instructionsModal, aboutModal;

// timer for expiring incomplete keypad entries
let expiredState = true; // True for four seconds after the last keypad number was typed OR until a valid page number is typed
let forceUpdate = false; // Set true if the screen needs to be updated
let timeoutVar;

// canvas
let cnv;
let canvasElement;

// indicate changes that have not been processed by the server yet
let changed;

// block
let blockStart; // block select


/** mapKey
 *  \brief Maps a keyboard key to a teletext code
 * Currently only maps English but should be extended to at least WST
 * \return The mapped key
 */
function mapKey(key) {
  // These are english mappings
  // Don't need to do $, @, ^, | because they are the same
  // Don't need to do  [, ], \, ¬  because they can't be mapped
  switch (key) {
    // '@' // 0x40 ampersand
    // '[' // 0x5b left arrow
    // '\' // 0x5c half
    // ']' // 0x5d right arrow
    // '^' // 0x5e up arrow
    // Only these need mapping where the ASCII code does not match the teletext
    case '£':
      return '#'; // 0x23 -> 0x24
    case '#':
      return '_'; // 0x24 -> 0x5f
    case '_':
      return '`'; // 0x5f -> 0x60

    // '{' quarter 0x7b
    // '|' pipe 0x7c
    // '}' three quarters 0x7d
    // '~' divide 0x7e
  }

  return key;
}


function startTimer() {
  expiredState = false;

  // If there is a timeout active then clear it
  if (timeoutVar == null) {   // A new keypad entry starts
    digit1 = '0';
    digit2 = '0';
    digit3 = '0';

  } else {
    clearTimeout(timeoutVar); // Continue an existing keypad entry
  }

  timeoutVar = setTimeout(
    function () {
      expiredState = true;

      // @todo: Restore the page number. Enable the refresh loop
      let p = myPage.pageNumber;
      digit1 = (String)((p >> 8) & 0xf);
      digit2 = (String)((p >> 4) & 0xf);
      digit3 = (String)(p & 0xf);

      myPage.pageNumberEntry = digit1 + digit2 + digit3;

      // @todo: Put this into row 0
      myPage.rows[0].setpagetext(digit1 + digit2 + digit3);

      timeoutVar = null;
    },
    4000,
  );
}


function autoplayChangePage() {
  if (
    (autoplay === CONST.AUTOPLAY_NONE) ||
    (!serviceManifests[service] || (typeof serviceManifests[service].pages !== 'object'))
  ) {
    return;
  }

  // refresh manifest page numbers store?
  if (manifestPageNumbers.length === 0) {
    manifestPageNumbers = Object.keys(serviceManifests[service].pages);
  }

  const currentPageNumber = hex(myPage.pageNumber, 3);

  let newPageNumber;

  if (autoplay === CONST.AUTOPLAY_SEQUENTIAL) {
    const currentPageNumberManifestIndex = manifestPageNumbers.indexOf(currentPageNumber);

    if (currentPageNumberManifestIndex !== -1) {
      // get next page from manifest
      if (currentPageNumberManifestIndex >= (manifestPageNumbers.length - 1)) {
        newPageNumber = CONST.PAGE_MIN.toString(16);
      } else {
        newPageNumber = manifestPageNumbers[(currentPageNumberManifestIndex + 1)];
      }

      // change to the new page number
      changePage(newPageNumber);
    }

  } else if (autoplay === CONST.AUTOPLAY_RANDOM) {
    // get random page from manifest
    const randomIndex = (manifestPageNumbers.length * Math.random() | 0);

    newPageNumber = manifestPageNumbers[randomIndex];

    // remove chosen random page index from manifestPageNumbers store,
    // so that we don't revisit the same page until exhaustion
    manifestPageNumbers.splice(randomIndex, 1);

    // change to the new page number
    changePage(newPageNumber);
  }
}


function preload() {
  // load font files
  ttxFont = loadFont('assets/teletext2.ttf'); // Normal
  ttxFontDH = loadFont('assets/teletext4.ttf'); // Double height
}


function setup() {
  let page;

  // allow specific settings values to be set via querystring params
  const searchParams = new URLSearchParams(window.location.search);

  for (let [key, value] of searchParams) {
    if (key === 'service') {
      service = value;

    } else if (key === 'scale') {
      scale = value;

    } else if (key === 'controls') {
      controls = value;

    } else if (key === 'display') {
      display = value;

    } else if (key === 'autoplay') {
      autoplay = value;

    } else if (key === 'page') {
      page = value;

      if (typeof page !== 'number') {
        page = CONST.PAGE_MIN.toString(16);
      }
    }
  }


  // override specific settings based on other initial settings values
  if (
    [
      CONST.CONTROLS_ZAPPER,
      CONST.CONTROLS_MINIMAL,
      CONST.CONTROLS_BIGSCREEN,
    ].includes(controls)
  ) {
    menuOpen = false;
  }

  if (controls === CONST.CONTROLS_BIGSCREEN) {
    display = CONST.DISPLAY_FITSCREEN;
  }

  // ensure service name is valid
  if (!service || !CONFIG[CONST.CONFIG.SERVICES_AVAILABLE][service]) {
    service = CONFIG[CONST.CONFIG.DEFAULT_SERVICE];
  }

  const serviceData = CONFIG[CONST.CONFIG.SERVICES_AVAILABLE][service];

  // determine socket server URL
  let serviceUrl = serviceData.url + ':' + serviceData.port;
  if ((window.location.protocol === 'http:') && (serviceData.port === 443)) {
    // if viewer is being served over http and requests a https service, prefix its URL with 'https'
    serviceUrl = 'https:' + serviceUrl;

  } else if ((window.location.protocol === 'https:') && (serviceData.port === 80)) {
    // if viewer is being served over https and requests a http service, prefix its URL with 'http'
    serviceUrl = 'http:' + serviceUrl;
  }

  // connect via socket.io to server
  socket = io.connect(
    `${serviceUrl}/?service=${service}`,
    {
      rejectUnauthorized: CONFIG[CONST.CONFIG.TELETEXT_VIEWER_HTTPS_REJECT_UNAUTHORIZED],
    },
  );


  // preload service manifest data
  loadManifestData();


  // font metrics
  textFont(ttxFont);
  textSize(gTtxFontSize);

  gTtxW = parseInt(textWidth('M'), 10);       // ensure calculated character width is an int (not a float) for sharpest rendering quality
  gTtxH = gTtxFontSize;


  // create the p5 canvas, and move it into the #canvas DOM element
  cnv = createCanvas(
    (
      CONFIG[CONST.CONFIG.CANVAS_WIDTH] +
      (
        !serviceData.isEditable && CONFIG[CONST.CONFIG.CANVAS_PADDING_RIGHT_SINGLE_COLUMN] ?
          gTtxW :
          0
      )
    ),
    CONFIG[CONST.CONFIG.CANVAS_HEIGHT]
  );
  cnv.parent('canvas');

  // observe mouse press events on p5 canvas
  cnv.mousePressed(
    function () {
      if (editMode !== CONST.EDITMODE_NORMAL) {
        // Only need to do this in edit mode
        const xLoc = int((mouseX / currentPixelDensity) / gTtxW);
        const yLoc = int(((mouseY / currentPixelDensity) - gridOffsetVertical) / gTtxH);

        if (
          (xLoc >= 0) && (xLoc < CONFIG[CONST.CONFIG.NUM_COLUMNS]) &&
          (yLoc >= 0) && (yLoc < CONFIG[CONST.CONFIG.NUM_ROWS])
        ) {
          myPage.cursor.moveTo(xLoc, yLoc);

          LOG.fn(
            ['sketch', 'setup', 'mousePressed'],
            `The mouse was clicked at x=${xLoc}, y=${yLoc}`,
            LOG.LOG_LEVEL_VERBOSE,
          );
        }
      }

      return false; // Prevent default behaviour
    }
  );


  // initialise page
  myPage = new TTXPAGE();
  myPage.init(
    page ?
      parseInt(page, 16) :
      CONST.PAGE_MIN,

    service,
  );

  // message events
  socket.on('keystroke', newCharFromServer);
  socket.on('row', setRow); // A teletext row
  socket.on('blank', setBlank); // Clear the page
  socket.on('fastext', setFastext);
  socket.on('setpage', setPageNumber); // Allow the server to change the page number (Page 404 etc)
  socket.on('description', setDescription);
  socket.on('subpage', setSubPage); // Subpage number for carousels (Expect two digits 00..99) [99 is higher than actual spec]
  socket.on('timer', setTimer); // Subpage timing. Currently this is just an overall value. Need to implement for animations
  socket.on('id', setID); // id is a socket id that identifies this client. Use this when requesting a page load


  // create page number input field
  inputPage = select('#pageNumber');

  // set frame rate
  frameRate(10);


  // set specific initial state values as a custom attribute on the body element (for CSS targeting)
  document.body.setAttribute(CONST.ATTR_DATA_SERVICE, service);
  document.body.setAttribute(CONST.ATTR_DATA_SERVICE_EDITABLE, serviceData.isEditable);

  document.body.setAttribute(CONST.ATTR_DATA_SCALE, scale);
  document.body.setAttribute(CONST.ATTR_DATA_CONTROLS, controls);
  document.body.setAttribute(CONST.ATTR_DATA_DISPLAY, display);
  document.body.setAttribute(CONST.ATTR_DATA_MENU_OPEN, menuOpen);


  // store a reference to the DOM elements
  menuButton = document.querySelector('#menuButton');
  canvasElement = document.querySelector('#defaultCanvas0');

  serviceSelector = document.querySelector('#serviceSelector');
  serviceSelector2 = document.querySelector('#serviceSelector2');
  scaleSelector = document.querySelector('#scaleSelector');
  controlsSelector = document.querySelector('#controlsSelector');
  displaySelector = document.querySelector('#displaySelector');
  autoplaySelector = document.querySelector('#autoplaySelector');

  manifestModal = document.querySelector('#manifest');
  instructionsModal = document.querySelector('#instructions');
  aboutModal = document.querySelector('#about');


  // set initial state values into their UI elements...
  if (serviceSelector) {
    serviceSelector.value = service;
  }
  if (serviceSelector2) {
    serviceSelector2.value = service;
  }

  if (scaleSelector) {
    scaleSelector.value = scale;
  }

  if (controlsSelector) {
    controlsSelector.value = controls;
  }

  if (displaySelector) {
    displaySelector.value = display;
  }

  if (autoplaySelector) {
    autoplaySelector.value = autoplay;
  }


  // show service credit?
  if (serviceData.credit) {
    const credit = document.querySelector('#credit');

    if (credit) {
      credit.innerHTML = serviceData.credit.replace('<a ', '<a target="_blank" rel="noopener noreferrer" ');
    }
  }


  // set the initial canvas scale
  updateScale();

  // indicate changes that have not been processed by the server yet
  changed = new CHARCHANGED();


  // update custom attribute on body element, indicating that rendering setup has complete
  document.body.setAttribute(CONST.ATTR_DATA_READY, true);


  // initialise autoplay?
  if (
    !serviceData.isEditable &&
    [CONST.AUTOPLAY_SEQUENTIAL, CONST.AUTOPLAY_RANDOM].includes(autoplay)
  ) {
    autoplayInterval = window.setInterval(
      autoplayChangePage,
      ((CONFIG[CONST.CONFIG.DEFAULT_AUTOPLAY_INTERVAL] || 35) * 1000),
    );
  }
}


function openService(serviceId) {
  LOG.fn(
    ['sketch', 'openService'],
    `Opening service=${serviceId}`,
    LOG.LOG_LEVEL_VERBOSE,
  );

  // set service param of URL
  const params = new URLSearchParams(location.search);
  params.set('service', serviceId);
  params.delete('page');      // don't carry current page number over when changing service

  const newUrl = `${location.pathname}?${params}`;

  // open in same, or new window?
  if (CONFIG[CONST.CONFIG.OPEN_SERVICE_IN_NEW_WINDOW] === true) {
    window.open(newUrl);

  } else {
    window.location.href = newUrl;
  }
}


function updateLocationUrl(key, value) {
  if (history.pushState) {
    const loc = window.location;
    let searchParams = new URLSearchParams(loc.search);
    searchParams.set(key, value);

    const newUrl = `${loc.protocol}//${loc.host}${loc.pathname}?${searchParams.toString()}`;

    window.history.pushState({ path: newUrl }, '', newUrl);
  }
}


function serviceChange(event) {
  if (event.target) {
    openService(
      event.target.value
    );
  }
}


function randomPage(event) {
  if (event) {
    event.preventDefault();
  }

  if (serviceManifests[service] && serviceManifests[service].pages) {
    const manifestPageNumbers = Object.keys(serviceManifests[service].pages);

    // get random page from manifest
    const randomIndex = (manifestPageNumbers.length * Math.random() | 0);

    // change to the new page number
    changePage(
      manifestPageNumbers[randomIndex]
    );
  }

  return false;
}


function controlsChange() {
  if (controlsSelector) {
    controls = controlsSelector.value;

    // update custom attribute on body element
    document.body.setAttribute(CONST.ATTR_DATA_CONTROLS, controls);

    // update the URL with the current controls mode (without reloading the page)
    updateLocationUrl('controls', controls);
  }
}


function displayChange() {
  if (displaySelector) {
    display = displaySelector.value;

    // update custom attribute on body element
    document.body.setAttribute(CONST.ATTR_DATA_DISPLAY, display);

    // update the URL with the current display mode (without reloading the page)
    updateLocationUrl('display', display);

    // update canvas scale
    updateScale();

    window.setTimeout(
      updateScale,
      0,
    );
  }
}


function scaleChange() {
  if (scaleSelector) {
    scale = scaleSelector.value;

    // update custom attribute on body element
    document.body.setAttribute(CONST.ATTR_DATA_SCALE, scale);

    // update the URL with the current scale (without reloading the page)
    updateLocationUrl('scale', scale);

    // update canvas scale
    updateScale();
  }
}


function autoplayChange() {
  if (autoplaySelector) {
    const serviceData = CONFIG[CONST.CONFIG.SERVICES_AVAILABLE][myPage.service];

    autoplay = autoplaySelector.value;

    if (autoplay === CONST.AUTOPLAY_NONE) {
      // cancel currently-active autoplay
      window.clearInterval(autoplayInterval);
      autoplayInterval = undefined;

    } else if (!serviceData.isEditable && [CONST.AUTOPLAY_SEQUENTIAL, CONST.AUTOPLAY_RANDOM].includes(autoplay)) {
      // initialise autoplay
      autoplayInterval = window.setInterval(
        autoplayChangePage,
        ((CONFIG[CONST.CONFIG.DEFAULT_AUTOPLAY_INTERVAL] || 35) * 1000),
      );
    }

    // update custom attribute on body element
    document.body.setAttribute(CONST.ATTR_DATA_AUTOPLAY, autoplay);

    // update the URL with the current autoplay (without reloading the page)
    updateLocationUrl('autoplay', autoplay);
  }
}


function setTimer(data) {
  myPage.setTimer(data.fastext[0])
}


function setSubPage(data) {
  if (data.id !== gClientID && gClientID !== null) {
    // Not for us?
    return;
  }

  myPage.setSubPage(
    parseInt(data.line)
  );
}

/** We MUST be sent the connection ID or we won't be able to display anything
 */
function setID(id) {
  LOG.fn(
    ['sketch', 'setID'],
    `Our connection ID is ${id}`,
    LOG.LOG_LEVEL_INFO,
  );

  gClientID = id;

  // Now we can load the initial page
  let data = {
    S: myPage.service, // The codename of the service. eg. d2k or undefined
    p: myPage.pageNumber, // Page mpp
    s: myPage.subPage,
    x: CONST.SIGNAL_INITIAL_LOAD, // A secret flag to do an initial load
    y: 0,
    rowText: '',
    id: gClientID
  };

  socket.emit('load', data);
}


function setDescription(data) {
  if (data.id !== gClientID && gClientID !== null) {
    return;  // Not for us?
  }

  myPage.description = data.desc;
  document.getElementById('description').innerHTML = '<strong>Page info:</strong> ' + data.desc;
}


function setPageNumber(data) {
  if ((data.id !== gClientID) && (gClientID !== null)) {
    return;  // Not for us?
  }

  LOG.fn(
    ['sketch', 'setPageNumber'],
    `Setting page=${data.p.toString(16)}, service=${data.S}`,
    LOG.LOG_LEVEL_VERBOSE,
  );

  myPage.setPage(data.p);
  myPage.setService(data.S);
}


// Handle the button UI
function fastextR()
{
  fastext(1)
}

function fastextG()
{
  fastext(2)
}

function fastextY()
{
  fastext(3)
}

function fastextC()
{
  fastext(4)
}

function fastextIndex()
{
  fastext(6)
}


/**
 * Load the fastext link
 * @param index 1-4, 6
 */
function fastext(index) {
  let createPage = false; // Special case. If yellow link is >0x0fff then create a page

  switch (index) {
    case 1:
      page = myPage.redLink;
      break;

    case 2:
      page = myPage.greenLink;
      break;

    case 3:
      // if yellow fastext has been set to a number greater than 0x0fff then it is a request to create the page
      page = myPage.yellowLink;

      if (page > 0x0fff) {
        page &= 0x0fff;
        createPage = true;
      }

      break;

    case 4:
      page = myPage.cyanLink;
      break;

    case 6:
      page = myPage.indexLink;
      break;

    default:
      page = myPage.redLink;
  }

  LOG.fn(
    ['sketch', 'fastext'],
    `Fastext pressed, index=${index}, link to 0x${page.toString(16)} (${page})`,
    LOG.LOG_LEVEL_VERBOSE,
  );

  // if page in range...
  if (page >= CONST.PAGE_MIN && page <= CONST.PAGE_MAX) {
    myPage.setPage(page);   // We now have a different page number

    let data = {
      S: myPage.service,
      p: page, // Page mpp
      s: 0,    // @ todo subpage
      x: 0,
      y: 0,
      rowText: '',
      id: gClientID
    };

    if (createPage) {   // Special case
      socket.emit('create', data);

    } else {
      socket.emit('load', data);
    }
  }
}

function setFastext(data) {
  if (!matchpage(data)) {
    return; // Data is not for our page?
  }

  if (data.id !== gClientID && gClientID != null) {
    return;  // Not for us?
  }

  myPage.redLink = parseInt('0x' + data.fastext[0]);
  myPage.greenLink = parseInt('0x' + data.fastext[1]);
  myPage.yellowLink = parseInt('0x' + data.fastext[2]);
  myPage.cyanLink = parseInt('0x' + data.fastext[3]);
  myPage.indexLink = parseInt('0x' + data.fastext[5]);
}

function draw() {
  // No updating while we are pressing the mouse OR while typing in a page number
  if (!forceUpdate) {
    if (((blockStart !== undefined) && (blockStart !== null)) || !expiredState) {
      return;
    }

  } else {
    forceUpdate = false;
  }

  // @todo We only need to update this during updates. No more than twice a second. Could save a lot of CPU
  background(0);
  noStroke();
  fill(255, 255, 255);

  myPage.draw(changed);
}

// Does our page match the incoming message?
function matchpage(data) {
  if (myPage.service !== data.S) return false;
  if (myPage.pageNumber !== data.p) return false;

  return true;
}

/** newCharFromServer only differs from newChar in that it does not move the cursor
 */
function newCharFromServer(data) {
  newChar(data, false);
}

/** alphaInGraphics
 *  \param key - Key to test
 * \return - true if it is a printable character when in graphics mode
 * Note that this is only valid for the England character set
 * When processKey translates keys, we probably don't need to alter this?
 */
function alphaInGraphics(key) {
  return ((key.charCodeAt(0) >= 0x40) && (key.charCodeAt(0) < 0x60));
}

// Message handlers....
/** newChar
 * \param data - keyStroke
 * \param local - default true. Set local to false if the keystroke came from the server
 This is because 1) we don't want the remote user to move our cursor. 2) We don't want to interpret qwaszx from a remote user
 * \return The data key is returned and if graphics then the mosaic
 *
 */
function newChar(data, local = true) // 'keystroke'
{
  // If nothing else, we note that our character returned and can be marked as 'processed'
  if (local) {
    changed.set(data.x, data.y); // local change

    LOG.fn(
      ['sketch', 'newChar'],
      `Set x=${data.x}`,
      LOG.LOG_LEVEL_VERBOSE,
    );

  } else {
    changed.clear(data.x, data.y); // remote change

    LOG.fn(
      ['sketch', 'newChar'],
      `Cleared x=${data.x}`,
      LOG.LOG_LEVEL_VERBOSE,
    );
  }

  // @todo page number test
  if (!matchpage(data)) return; // Char is not for our page?
  let key = data.k;

  // We should now look if graphic mode is set at this char.
  // If graphics mode is set, only allow qwaszx and map the bits of the current character
  // At (x,y) on subpage s, place the character k
  let graphicsMode = myPage.IsGraphics(data); // what about the subpage???
  let advanceCursor = local; // Cursor advances, unless it is a remote user or a graphics twiddle

  if (local) {
    // Do the graphics, unless this an edit tf escape. Or an upper case letter.
    if (graphicsMode && editMode !== CONST.EDITMODE_INSERT && !alphaInGraphics(key)) {     // Take the original pixel and xor our selected bit
      key = data.k.toUpperCase(); // @todo. Do we need to consider subpages and services? Maybe just subpages.
      let bit = 0;
      advanceCursor = false;

      switch (key) {
        // sixel modifying
        case 'Q' :
          bit = 0x01;
          break;
        case 'W' :
          bit = 0x02;
          break;
        case 'A' :
          bit = 0x04;
          break;
        case 'S' :
          bit = 0x08;
          break;
        case 'Z' :
          bit = 0x10;
          break;
        case 'X' :
          bit = 0x40;
          break; // Note the discontinuity due to the gap.
          // R=Reverse, F=fill
        case 'R' :
          bit = 0x5f;
          break; // reverse all bits
        case 'F' :
          bit = 0xff;
          break; // set all bits
        case 'C' :
          bit = 0x00;
          break; // clear all bits

        default:
          return key;
      }

      if (bit === 0) {
        key = 0x20; // All pixels off
      } else if (bit === 0xff) {
        key = 0x7f; // All pixels on
      } else {
        key = myPage.getChar(data); // Get the original character
        key = key ^ bit | 0x20; // And set bit 5 so we only make mosaics
      }
      key = String.fromCharCode(key); // Convert to ascii

      LOG.fn(
        ['sketch', 'newChar'],
        `Graphics key=${key}, bit=bit`,
        LOG.LOG_LEVEL_VERBOSE,
      );

      // What is the problem? The data is being inserted as an ascii number rather than the code
    }

  } else {
    advanceCursor = false;
  }

  if (advanceCursor) {
    myPage.cursor.right();  // advance the cursor if it is the local user
  }

  myPage.drawchar(key, data.x, data.y, data.s); // write the character

  if (editMode === CONST.EDITMODE_INSERT) {
    editMode = CONST.EDITMODE_EDIT;
  }

  return key;
}

// A whole line is updated at a time
function setRow(r) {
  if (!matchpage(r)) return;
  if (r.id !== gClientID && gClientID !== null) return;  // Not for us?
  myPage.setRow(r.y, r.rowText);
}

// Clear the page to blank (all black)
function setBlank(data) {   // 'blank'
  if (!matchpage(data)) return;
  if (data.id !== gClientID && gClientID !== null) return;  // Not for us?

  myPage.setBlank();

  // clear the description too
  data.desc = '';
  setDescription(data);
}


function inputNumber() {
  LOG.fn(
    ['sketch', 'inputNumber'],
    `InputNumber changed`,
    LOG.LOG_LEVEL_VERBOSE,
  );

  if (inputPage && inputPage.elt) {
    const pageValue = inputPage.elt.value;

    LOG.fn(
      ['sketch', 'inputNumber'],
      `Opening page=${pageValue}`,
      LOG.LOG_LEVEL_INFO,
    );

    // if a 3 digit page number has been entered...
    if (pageValue.length === 3) {
      // change to the new page number
      changePage(pageValue);

      // blur the page number input DOM element
      inputPage.elt.blur();
    }
  }
}


/** built in function.
 *  Fires on all key presses - This is called before keyTyped
 */
function keyPressed() {
  LOG.fn(
    ['sketch', 'keyPressed'],
    `k=${keyCode}`,
    LOG.LOG_LEVEL_VERBOSE,
  );

  let handled = true;

  if ((inputPage && inputPage.elt) && (document.activeElement === inputPage.elt)) {
    // Don't prevent native event propagation on input element
    handled = false;

  } else {
    // todo: Kill refresh cycles while the input is active.
    switch (keyCode) {
      case LEFT_ARROW:
        if (editMode === CONST.EDITMODE_EDIT) myPage.cursor.left();
        break;

      case RIGHT_ARROW:
        if (editMode === CONST.EDITMODE_EDIT) myPage.cursor.right();
        break;

      case UP_ARROW:
        if (editMode === CONST.EDITMODE_EDIT) myPage.cursor.up();
        break;

      case DOWN_ARROW:
        if (editMode === CONST.EDITMODE_EDIT) myPage.cursor.down();
        break;

      case ESCAPE:
        const serviceData = CONFIG[CONST.CONFIG.SERVICES_AVAILABLE][myPage.service];

        // Services that are editable
        if (serviceData.isEditable) {
          switch (editMode) {
            case CONST.EDITMODE_NORMAL:
              editMode = CONST.EDITMODE_EDIT;
              break;

            case CONST.EDITMODE_EDIT:
              editMode = CONST.EDITMODE_ESCAPE;
              break;

            case CONST.EDITMODE_ESCAPE:
              editMode = CONST.EDITMODE_NORMAL;
              break;
          }

          myPage.editSwitch(editMode);
        }

        break;

      case TAB: // Insert a space
        myPage.insertSpace(); // Do our page
        insertSpace();       // Any other clients
        editMode = CONST.EDITMODE_EDIT;
        break;

      case BACKSPACE: // Remove current character, move the remainder one char left.
        myPage.backSpace();
        backSpace();
        editMode = CONST.EDITMODE_EDIT;
        break;

      case 33: // PAGE_UP (next subpage when in edit mode)
        if (editMode === CONST.EDITMODE_EDIT) {
          myPage.nextSubpage();
        }
        break;

      case 34: // PAGE_DOWN (prev subpage when in edit mode)
        if (editMode === CONST.EDITMODE_EDIT) {
          myPage.prevSubpage();
        }
        break;

      case 35: // END - move to the last character on this line (ideally the first blank character after the last non-blank)
        myPage.end();
        break;

      case 36: // HOME - move to the first character on this line
        myPage.home();
        break;

      case 45: // INSERT - Add a subpage
        myPage.addSubPage();
        break;

      case 46: // DELETE - Delete a subpage
        myPage.removeSubPage();
        break;

      default:
        handled = false;
    }
  }

  // Signal whether the key should be processed any further
  return !handled;
}

/** This inserts a space on the server and any listening client,
 *  Not our own page.
 */
function insertSpace() {
  let xp = 39;
  let txt = {
    S: myPage.service, // service number
    p: myPage.pageNumber,
    s: myPage.subPage,
    k: 'q',
    x: myPage.cursor.x,
    y: myPage.cursor.y,
    id: gClientID
  };

  for (let xp = 39; xp > myPage.cursor.x; xp--) {
    // This looks a bit weird, but keystroke automatically advances the insert position
    txt.x = xp;
    let ch = myPage.getChar(txt);
    txt.k = String.fromCharCode(ch);

    socket.emit('keystroke', txt);
  }

  // Finally insert a space
  txt.k=' ';
  txt.x=myPage.cursor.x;

  socket.emit('keystroke', txt);
}

/** Delete the current character by shifting all characters to the right by 1
 * This deletes on the server and any listening client,
 *  Not on our own page.
 */
function backSpace() {
  let txt = {
    S: myPage.service, // service number
    p: myPage.pageNumber,
    s: myPage.subPage,
    k: 'q',
    x: myPage.cursor.x,
    y: myPage.cursor.y,
    id: gClientID
  };

  for (let xp = myPage.cursor.x; xp < CONFIG[CONST.CONFIG.NUM_COLUMNS]; xp++) {
    txt.x = xp;
    let ch = myPage.getChar(txt);
    txt.k = String.fromCharCode(ch);

    socket.emit('keystroke', txt);
  }

  // Finally insert a space
  txt.k = ' ';
  txt.x = 39;

  socket.emit('keystroke', txt);
}

/** edit mode is entered if any non numeric code is typed
 *  edit mode exits if <esc> is pressed
 *  This p5js function doesn't fire on Ctrl, Alt, Shift etc.
 */
function keyTyped() {
  LOG.fn(
    ['sketch', 'keyTyped'],
    `k=${keyCode}`,
    LOG.LOG_LEVEL_VERBOSE,
  );

  if ((inputPage && inputPage.elt) && (document.activeElement === inputPage.elt)) {
    // keypress in the page number input field...
    setTimeout(
      function () {
        if (inputPage.elt.value.length === 3) {
          // trigger blur event, in order to trigger input element onchange function
          inputPage.elt.blur();
        }
      },
      0,
    );

    return true;    // Don't prevent native event propagation on input element

  } else {
    // keypress anywhere else...
    key = mapKey(key);
    processKey(key);

    return false;   // Prevent triggering any other behaviour
  }
}

/**
 *
 */
function processKey(keyPressed)
{
  // @todo need to map codes to national options at this point.
  // @todo Also need to fix alphaInGraphics when I do this
  if (editMode === CONST.EDITMODE_ESCAPE) {
    editMode = CONST.EDITMODE_INSERT;
    myPage.editSwitch(editMode);

    editTF(key);

    return;
  }

  if (editMode !== CONST.EDITMODE_NORMAL) { // Numbers are typed into the page
    let data = {
      S: myPage.service, // service number
      p: myPage.pageNumber,
      s: myPage.subPage,
      k: keyPressed,
      x: myPage.cursor.x,
      y: myPage.cursor.y,
      id: gClientID
    };

    data.k = newChar(data);  // Return the key in case we are in mosaic twiddle mode. ie. don't return qwaszx.
    socket.emit('keystroke', data);

  } else {
    // navigation from the keyboard (same as vbit-iv)
    // uiop are red/green/yellow/cyan Fastext buttons.
    if (keyPressed === 'u') {
      // press the red button
      fastext(1);
      return;

    } else if (keyPressed === 'i') {
      // press the green button
      fastext(2);
      return;

    } else if (keyPressed === 'o') {
      // press the yellow button
      fastext(3);
      return;

    } else if (keyPressed === 'p') {
      // press the cyan button
      fastext(4);
      return;

    } else if (keyPressed === 'h') {
      // hold
      khold();
      return;

    } else if (keyPressed === 'r') {
      // reveal
      krvl();
      return;

    } else if (keyPressed === 'b') {
      // back one page
      kback();
      return;

    } else if (keyPressed === 'f') {
      // forward one page
      kfwd();
      return;

    } else if (keyPressed === 'd') {
      // random page
      randomPage();
      return;
    }

    // Numbers are used for the page selection
    if (keyPressed >= '0' && keyPressed <= '9') {
      if (inputPage && inputPage.elt) {
        // Don't want the number input to steal keystrokes
        inputPage.elt.blur();
      }

      startTimer(); // This also clears out the other digits (first time only)

      forceUpdate = true;
      digit1 = digit2;
      digit2 = digit3;
      digit3 = keyPressed;

      if (digit1 !== ' ') {
        let page = parseInt('0x' + digit1 + digit2 + digit3);
        myPage.pageNumberEntry = digit1 + digit2 + digit3;

        if (page >= CONST.PAGE_MIN) {
          LOG.fn(
            ['sketch', 'processKey'],
            `Page number is 0x${page.toString(16)}`,
            LOG.LOG_LEVEL_VERBOSE,
          );

          myPage.setPage(page); // We now have a different page number

          const data = {
            S: myPage.service, // service
            p: page, // Page mpp
            s: myPage.subPage,  // @ todo check that subpage is correct
            x: 0,
            y: 0,
            rowText: '',
            id: gClientID
          };

          socket.emit('load', data);
        }
      }
    }
  }
}

function k0() { processKey('0') }
function k1() { processKey('1') }
function k2() { processKey('2') }
function k3() { processKey('3') }
function k4() { processKey('4') }
function k5() { processKey('5') }
function k6() { processKey('6') }
function k7() { processKey('7') }
function k8() { processKey('8') }
function k9() { processKey('9') }

function krvl() {
  myPage.toggleReveal();
}

function kback() {
  prevPage();
}

function kfwd() {
  nextPage();
}

function khold() {
  myPage.toggleHold();
}

/* Block editing. Touch marks the first corner of an area
*/
function touchStarted(event) {
  // only start block if touch event is within the page canvas, and is not on an overlaid non-canvas elment
  if (
    (event.target !== canvasElement) ||
    (touchX > (CONFIG[CONST.CONFIG.CANVAS_WIDTH] * currentPixelDensity)) ||
    (touchY > (CONFIG[CONST.CONFIG.CANVAS_HEIGHT] * currentPixelDensity))
  ) {
    // touch event not within canvas
    return;
  }

  blockStart = createVector(touchX, touchY);

  return false;
}

function touchEnded() {
  let blockEnd = createVector(touchX, touchY);
  blockEnd.sub(blockStart);
  blockStart = null; // Need this to be null in case we return!

  // only start block if touch event is within the page canvas, and is not on an overlaid non-canvas elment
  if (
    (event.target !== canvasElement) ||
    (touchX > (CONFIG[CONST.CONFIG.CANVAS_WIDTH] * currentPixelDensity)) ||
    (touchY > (CONFIG[CONST.CONFIG.CANVAS_HEIGHT] * currentPixelDensity))
  ) {
    // touch event not within canvas
    return;
  }

  // Block needs to be a minimum distance (& possibly velocity?
  let mag = blockEnd.mag();
  if (mag < CONFIG[CONST.CONFIG.NUM_COLUMNS]) {
    return;
  }

  let heading = blockEnd.heading();
  let dir = 4 * heading / PI;

  return false;
}

function nextPage() {
  let p = myPage.pageNumber;
  p++;

  // don't allow navigation to hexadecimal page numbers, skip to next valid decimal page number
  while (/[A-F]+/i.test(p.toString(16))) {
    p += 6;
  }

  // don't allow navigation to a page above our maximum page number
  if (p > CONST.PAGE_MAX) {
    p = CONST.PAGE_MAX;
  }

  myPage.setPage(p); // We now have a different page number

  const data = {
    S: myPage.service,
    p: p, // Page mpp
    s: 0,
    y: 0,
    rowText: '',
    id: gClientID
  };

  socket.emit('load', data);

  LOG.fn(
    ['sketch', 'nextPage'],
    `page=${hex(data.p)}`,
    LOG.LOG_LEVEL_VERBOSE,
  );
}

function prevPage() {
  let p = myPage.pageNumber;
  p--;

  // don't allow navigation to hexadecimal page numbers, skip to next valid decimal page number
  while (/[A-F]+/i.test(p.toString(16))) {
    p -= 6;
  }

  // don't allow navigation to a page below our minimum page number
  if (p < CONST.PAGE_MIN) {
    p = CONST.PAGE_MIN;
  }

  myPage.setPage(p); // We now have a different page number

  const data = {
    S: myPage.service,
    p: p, // Page mpp
    s: 0,
    y: 0,
    rowText: '',
    id: gClientID
  };

  socket.emit('load', data);

  LOG.fn(
    ['sketch', 'prevPage'],
    `page=${hex(data.p)}`,
    LOG.LOG_LEVEL_VERBOSE,
  );
}

/** Execute an editTF escape command
 *  This is the key that follows the escape key
 *  As zxnet keys are handled the same way, we add aliases for those too
 */
function editTF(key) {
  let chr;    // The character that the editTF escape creates

  switch (key) {
    case '8' :
      // zxnet
    case 'k' :
      chr = '\x00';
      break; // alpha black
    case '1' :
      // zxnet
    case 'r' :
      chr = '\x01';
      break; // alpha 5c
    case '2' :
      // zxnet
    case 'g' :
      chr = '\x02';
      break; // alpha green
    case '3' :
      // zxnet
    case 'y' :
      chr = '\x03';
      break; // alpha yellow
    case '4' :
      // zxnet
    case 'b' :
      chr = '\x04';
      break; // alpha blue
    case '5' :
      // zxnet
    case 'm' :
      chr = '\x05';
      break; // alpha magenta
    case '6' :
      // zxnet
    case 'c' :
      chr = '\x06';
      break; // alpha cyan
    case '7' :
      // zxnet
    case 'w' :
      chr = '\x07';
      break; // alpha white

    case 'F' :
      chr = '\x08';
      break; // flash on (same as zxnet)
    case 'f' :
      chr = '\x09';
      break; // steady (same as zxnet)

      // chr='\x0a';break; // endbox
      // chr='\x0b';break; // startbox

    case 'd' :
      chr = '\x0c';
      break; // normal height (same as zxnet)
    case 'D' :
      chr = '\x0d';
      break; // double height (same as zxnet)

      // 0x0e SO - SHIFT OUT
      // 0x0f SI - SHIFT IN

    case '*' :
      // zxnet
    case 'K' :
      chr = '\x10';
      break; // graphics black
    case '!' :
      // zxnet
    case 'R' :
      chr = '\x11';
      break; // graphics red
    case '"' :
      // zxnet
    case 'G' :
      chr = '\x12';
      break; // graphics green
    case '£' :
      // zxnet
    case '#' :
      ; // alternate character
    case 'Y' :
      chr = '\x13';
      break; // graphics yellow
    case '$' :
      // zxnet
    case 'B' :
      chr = '\x14';
      break; // graphics blue
    case '%' :
      // zxnet
    case 'M' :
      chr = '\x15';
      break; // graphics magenta
    case '^' :
      // zxnet
    case 'C' :
      chr = '\x16';
      break; // graphics cyan
    case '&' :
      // zxnet
    case 'W' :
      chr = '\x17';
      break; // graphics white

    case 'O' :
      chr = '\x18';
      break; // conceal

    case 's' :
      chr = '\x19';
      break; // Contiguous graphics
    case 'S' :
      chr = '\x1a';
      break; // Separated graphics

    case 'n' :
      chr = '\x1c';
      break; // 28 black background (same as zxnet)
    case 'N' :
      chr = '\x1d';
      break; // 29: new background (same as zxnet)
    case 'H' :
      chr = '\x1e';
      break; // 30: Hold graphics mode (same as zxnet)
    case 'h' :
      chr = '\x1f';
      break; // 31 Release hold mode (same as zxnet)

    case 'x' :
      myPage.showGrid = !myPage.showGrid;
      return; // toggle grid display

    case 'i' : // Insert row
      editMode = CONST.EDITMODE_EDIT;

      var y = myPage.cursor.y;
      if (y <= 0 || y >= 24) // Can't insert row on the header or fastext row
      {
        return;
      }

      // @TODO All this must be duplicated in keyevents
      for (let r = (23 - 1); r >= y; r--) {
        let row = myPage.getRow(r);
        myPage.setRow(r + 1, row);
        sendRow(r + 1, row);
      }

      // Clear the current row
      myPage.setRow(y, '                                        ');
      sendRow(y, '                                        ');

      return;

    case 'I' : // Delete row
      editMode = CONST.EDITMODE_EDIT;

      var y = myPage.cursor.y;
      if (y <= 0 || y >= 24) {    // Can't delete header or fastext
        return;
      }

      for (let r = y; r < 23; r++) {
        let row = myPage.getRow(r + 1);

        myPage.setRow(r, row);
        sendRow(r, row);
      }

      // Clear the current row
      myPage.setRow(23, '                                        ');
      sendRow(23, '                                        ');

      return;

    case 'J' : // block
      chr = '\x7f';
      break;

    case 'Z' : // clear screen
      // @todo At this point, send a signal to the server
      // Send the page details so we know which page to clear!
      const data = {
        S: myPage.service, // service number
        p: myPage.pageNumber,
        s: myPage.subPage,
        k: ' ',
        x: myPage.cursor.x,
        y: myPage.cursor.y,
        id: gClientID
      };

      socket.emit('clearPage', data);

      editMode = CONST.EDITMODE_EDIT;

      return;

      /*
      edit.tf functions not implemented
      Number pad: need to find out what the keys do
      'i' : // insert row
      'I' : // delete row
      'z' : // redraw screen
      '&' : // cycle character set
      '<' : // narrow screen
      '<' : // widen screen
      '=' : // trace image
      'U' : // Duplicate row
      'Q' : // toggle control codes
      '-' : // Toggle conceal/reveal

      editing with blocks
      Select blocks with <esc> arrow keys
      X: cut, C: paste, <shift< arrows: move sixels
      */
    default: // nothing matched?
      editMode = CONST.EDITMODE_EDIT;

      return;
  }

  // Construct object to define exactly where this key code will go
  const data = {
    S: myPage.service,
    p: myPage.pageNumber, // Page mpp
    s: myPage.subPage,
    x: myPage.cursor.x,
    y: myPage.cursor.y,
    k: chr
  };

  socket.emit('keystroke', data);

  newChar(data);
}

/** Transmit a row of text
 *  Woefully inefficient. Really need to implement whole row transmission
 * \param r : row number
 * \param txt : Row of teletext
 */
function sendRow(r, txt) {
  for (let c = 0; c < txt.length; c++) {
    const data = {
      S: myPage.service,
      p: myPage.pageNumber, // Page mpp
      s: myPage.subPage,
      x: c,
      y: r,
      k: txt[c]
    };

    socket.emit('keystroke', data);
  }
}


function updateScale() {
  // get current viewport size
  const viewportInner = document.body.getBoundingClientRect();

  const windowWidth = viewportInner.width;
  const windowHeight = viewportInner.height;

  // if pixel density has changed, update canvas pixel density
  let newPixelDensity;

  if (display === CONST.DISPLAY_STANDARD) {
    newPixelDensity = parseFloat(scale);

  } else if ([CONST.DISPLAY_FITSCREEN, CONST.DISPLAY_FULLSCREEN].includes(display)) {
    // round to 2 decimal places
    newPixelDensity = (
      Math.round(
        Math.min(
          (windowHeight / CONFIG[CONST.CONFIG.CANVAS_HEIGHT]),
          (windowWidth / CONFIG[CONST.CONFIG.CANVAS_WIDTH]),
        ) * 100
      ) / 100
    );
  }

  if (newPixelDensity !== currentPixelDensity) {
    pixelDensity(
      newPixelDensity
    );

    canvasElement.removeAttribute('style');

    currentPixelDensity = newPixelDensity;
  }
}


function windowResized() {
  updateScale();
}


function toggleMenu() {
  // toggle menu state
  menuOpen = !menuOpen;

  // update custom attribute on body element
  document.body.setAttribute(CONST.ATTR_DATA_MENU_OPEN, menuOpen);
}


function changePage(pageNumber) {
  const pageNumberHex = parseInt(pageNumber, 16);

  myPage.setPage(pageNumberHex);

  const data = {
    S: myPage.service,
    p: pageNumberHex,
    s: 0,
    y: 0,
    rowText: '',
    id: gClientID
  };

  socket.emit('load', data);
}


function selectManifestPage(event) {
  event.preventDefault();

  let target = event.target;

  if (target) {
    while (target.tagName !== 'A') {
      target = target.parentNode;

      if (target.tagName === 'BODY') {
        break;
      }
    }

    // get selected page number
    const pageNumber = target.getAttribute('data-page');

    // change to selected new page number
    changePage(pageNumber);

    // unfocus the clicked DOM link element
    event.target.blur();

    // change the visually-selected item to highlight the new page
    const manifestSelectedItem = manifestModal.querySelector('.manifestContentInner ul li.selected');
    const manifestNewSelectedItem = manifestModal.querySelector(`.manifestContentInner ul li a[data-page="${pageNumber}"]`);

    if (manifestSelectedItem && manifestNewSelectedItem) {
      manifestSelectedItem.className = '';
      manifestNewSelectedItem.parentNode.className = 'selected';
    }
  }

  return false;
}


function renderManifestData(data) {
  if (data.pages) {
    // update header lastUpdated timestamp display
    const manifestLastUpdated = manifestModal.querySelector('#lastUpdated');

    if (data.lastUpdated && manifestLastUpdated) {
      const lastUpdatedDate = new Date(data.lastUpdated);
      let displayLastUpdated = '';

      if (Intl && Intl.RelativeTimeFormat) {
        const deltaDays = Math.ceil((lastUpdatedDate.getTime() - Date.now()) / (1000 * 3600 * 24));

        const rtf = new Intl.RelativeTimeFormat(
          'en',
          {
            localeMatcher: 'best fit',
            numeric: 'auto',
            style: 'long',
          }
        );

        displayLastUpdated = rtf.format(deltaDays, 'day');

      } else {
        const lastUpdatedDateDay = lastUpdatedDate.getDate().toString().padStart(2, '0');
        const lastUpdatedDateMonth = (lastUpdatedDate.getMonth() + 1).toString().padStart(2, '0');
        const lastUpdatedDateYear = lastUpdatedDate.getFullYear().toString();

        displayLastUpdated = `${lastUpdatedDateDay}/${lastUpdatedDateMonth}/${lastUpdatedDateYear}`;
      }

      manifestLastUpdated.innerText = `@ ${displayLastUpdated}`;
      manifestLastUpdated.setAttribute('title', `lastUpdated: ${data.lastUpdated}`);
    }


    // update main modal content...
    const manifestContentInner = manifestModal.querySelector('.manifestContentInner');

    if (manifestContentInner) {
      // clear existing content
      manifestContentInner.innerHTML = '';

      // generate a list from the manifest page items...
      let manifestList = document.createElement('ul');

      const currentPageNumber = hex(myPage.pageNumber, 3);

      for (let i in data.pages) {
        let manifestListItem = document.createElement('li');

        if (data.pages[i].p === currentPageNumber) {
          manifestListItem.className = 'selected';
        }

        let manifestListItemLink = document.createElement('a');

        manifestListItemLink.href = '#';
        manifestListItemLink.setAttribute('data-page', data.pages[i].p);
        manifestListItemLink.onclick = selectManifestPage;
        manifestListItemLink.innerHTML = `<dl><dt>p${data.pages[i].p}</dt><dd>${data.pages[i].d ? data.pages[i].d : ''}</dd></dl>`;

        manifestListItem.appendChild(manifestListItemLink);
        manifestList.appendChild(manifestListItem);
      }

      manifestContentInner.appendChild(manifestList);
    }
  }
}


function loadManifestData() {
  if (!serviceManifests[service]) {
    fetch(`/manifest.json?service=${service}`)
      .then((response) => response.json())
      .then((data) => {
        serviceManifests[service] = data;

        if (data && data.pages) {
          // update custom attribute on body element
          document.body.setAttribute(CONST.ATTR_DATA_SERVICE_MANIFEST, 'true');
        }
      });
  }
}


function toggleManifest() {
  if (manifestModal) {
    manifestModal.classList.toggle('manifest--visible');

    renderManifestData(
      serviceManifests[service]
    );
  }
}


function toggleInstructions() {
  if (instructionsModal) {
    instructionsModal.classList.toggle('instructions--visible');
  }
}


function toggleAbout() {
  if (aboutModal) {
    aboutModal.classList.toggle('about--visible');
  }
}


function reloadService(event) {
  event.preventDefault();

  const params = new URLSearchParams(location.search);
  params.delete('page');      // don't carry current page number over when changing service

  window.location.href = `${location.pathname}${params.toString() ? `?${params}` : ''}`;

  return false;
}


function toggleGrid() {
  if (myPage && (typeof myPage.toggleGrid === 'function')) {
    const newGridState = myPage.toggleGrid();

    // update custom attribute on body element
    document.body.setAttribute(CONST.ATTR_DATA_GRID, newGridState);
  }
}


function exportPage() {
  const grabSelectLinks = document.querySelector('#grabSelectLinks');

  // determine if hiding or showing grab links...
  const isShow = grabSelectLinks.getAttribute('data-visible') === 'false';

  if (isShow) {
    // @todo language
    let cset = 0;

    // get page number
    let pg = hex(myPage.pageNumber, 3);

    // edit.tf
    let website = 'http://edit.tf';
    let url = save_to_hash(cset, website, myPage);

    // zxnet
    website = 'https://zxnet.co.uk/teletext/editor';
    let url2 = save_to_hash(cset, website, myPage);

    // Download the tti page
    let svc = myPage.getService();
    let url3 = `/pages/${svc}/p${pg}${CONST.PAGE_EXT_TTI}`;


    // update grab link items text and URL...
    const dynamicLink = document.querySelector('#dynamicLink');

    if (dynamicLink) {
      dynamicLink.href = url;
      dynamicLink.innerHTML = 'open P' + pg + '<br/>in edit.tf';
    }

    const dynamicLink2 = document.querySelector('#dynamicLink2');

    if (dynamicLink2) {
      dynamicLink2.href = url2;
      dynamicLink2.innerHTML = 'open P' + pg + '<br/>in zxnet';
    }

    const dynamicLink3 = document.querySelector('#dynamicLink3');

    if (dynamicLink3) {
      dynamicLink3.href = url3;
      dynamicLink3.innerHTML = `download <br/>P${pg}${CONST.PAGE_EXT_TTI}`;
    }


    // show links
    grabSelectLinks.setAttribute('data-visible', 'true');

  } else {
    // hide links
    grabSelectLinks.setAttribute('data-visible', 'false');
  }
}

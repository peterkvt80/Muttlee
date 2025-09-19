'use strict'
/* global CONFIG, CONST, loadFont, hex, io, textFont, textSize, textWidth, createCanvas, int, mouseX, mouseY, location, exportPage */
/* global saveToHash, LOG, touchStarted, touchX, touchY, PI, createVector, pixelDensity, windowResized */
/* global key, keyTyped, keyCode */
/* global page, TTXPAGE, background, noStroke, fill */
/* global LEFT_ARROW, RIGHT_ARROW, UP_ARROW, DOWN_ARROW, TAB, BACKSPACE, ESCAPE. ENTER */
/* global select, frameRate, CHARCHANGED, history, event */
// current state values (initialize to defaults)
let service = CONFIG[CONST.CONFIG.DEFAULT_SERVICE]
let controls = CONFIG[CONST.CONFIG.DEFAULT_CONTROLS]
let display = CONFIG[CONST.CONFIG.DEFAULT_DISPLAY]
let scale = CONFIG[CONST.CONFIG.DEFAULT_SCALE]
let autoplay = CONFIG[CONST.CONFIG.DEFAULT_AUTOPLAY]
let menuOpen = CONFIG[CONST.CONFIG.DEFAULT_MENU_OPEN]

// remember current state values
let currentPixelDensity

// initialise edit mode
let editMode = CONST.EDITMODE_NORMAL

// teletext
let myPage, ttxFont, ttxFontDH

// metrics
let gTtxW, gTtxH
// const gTtxFontSize = 20
const gridOffsetVertical = 4

// page selection
let digit1 = '1'
let digit2 = '0'
let digit3 = '0'

// description
let focusedDescription = false

// comms
let socket
let gClientID = null // Our unique connection id

// fetched service manifests
const serviceManifests = {}

// autoplay interval
let autoplayInterval

// array of manifest page numbers, which can be reduced in random autoplay mode so that we don't repeat pages
let manifestPageNumbers = []

// DOM
let inputPage
let inputDescription
let menuButton
let serviceSelector, serviceSelector2, scaleSelector, controlsSelector, displaySelector, autoplaySelector
let manifestModal, instructionsModal, aboutModal

// timer for expiring incomplete keypad entries
let expiredState = true // True for four seconds after the last keypad number was typed OR until a valid page number is typed
let forceUpdate = false // Set true if the screen needs to be updated
let timeoutVar

// canvas
let cnv
let canvasElement

// indicate changes that have not been processed by the server yet
let changed

// block
let blockStart // block select

/** mapKey
 *  \brief Maps a keyboard key to a teletext code
 * Currently only maps English but should be extended to at least WST
 * \return The mapped key
 */
function mapKey (key) {
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
      return '#' // 0x23 -> 0x24
    case '#':
      return '_' // 0x24 -> 0x5f
    case '_':
      return '`' // 0x5f -> 0x60

    // '{' quarter 0x7b
    // '|' pipe 0x7c
    // '}' three quarters 0x7d
    // '~' divide 0x7e
  }

  return key
}

function startTimer () {
  expiredState = false

  // If there is a timeout active then clear it
  if (timeoutVar == null) { // A new keypad entry starts
    digit1 = '0'
    digit2 = '0'
    digit3 = '0'
  } else {
    clearTimeout(timeoutVar) // Continue an existing keypad entry
  }

  timeoutVar = setTimeout(
    function () {
      expiredState = true

      // @todo: Restore the page number. Enable the refresh loop
      const p = myPage.pageNumber
      digit1 = (String)((p >> 8) & 0xf)
      digit2 = (String)((p >> 4) & 0xf)
      digit3 = (String)(p & 0xf)

      myPage.pageNumberEntry = digit1 + digit2 + digit3

      // @todo: Put this into row 0
      myPage.rows[0].setpagetext(digit1 + digit2 + digit3)

      timeoutVar = null
    },
    4000
  )
}

function autoplayChangePage () {
  if (
    (autoplay === CONST.AUTOPLAY_NONE) ||
    (!serviceManifests[service] || (typeof serviceManifests[service].pages !== 'object'))
  ) {
    return
  }

  // refresh manifest page numbers store?
  if (manifestPageNumbers.length === 0) {
    manifestPageNumbers = Object.keys(serviceManifests[service].pages)
  }

  const currentPageNumber = hex(myPage.pageNumber, 3)

  let newPageNumber

  if (autoplay === CONST.AUTOPLAY_SEQUENTIAL) {
    const currentPageNumberManifestIndex = manifestPageNumbers.indexOf(currentPageNumber)

    if (currentPageNumberManifestIndex !== -1) {
      // get next page from manifest
      if (currentPageNumberManifestIndex >= (manifestPageNumbers.length - 1)) {
        newPageNumber = CONST.PAGE_MIN.toString(16)
      } else {
        newPageNumber = manifestPageNumbers[(currentPageNumberManifestIndex + 1)]
      }

      // change to the new page number
      changePage(newPageNumber)
    }
  } else if (autoplay === CONST.AUTOPLAY_RANDOM) {
    // get random page from manifest
    const randomIndex = (manifestPageNumbers.length * Math.random() | 0)

    newPageNumber = manifestPageNumbers[randomIndex]

    // remove chosen random page index from manifestPageNumbers store,
    // so that we don't revisit the same page until exhaustion
    manifestPageNumbers.splice(randomIndex, 1)

    // change to the new page number
    changePage(newPageNumber)
  }
}

function preload () {
  // load font files
  ttxFont = loadFont('assets/teletext2.ttf') // Normal
  ttxFontDH = loadFont('assets/teletext4.ttf') // Double height
}

function setup () {
  let page

  // allow specific settings values to be set via querystring params
  const searchParams = new URLSearchParams(window.location.search)

  for (const [key, value] of searchParams) {
    if (key === 'service') {
      service = value
    } else if (key === 'scale') {
      scale = value
    } else if (key === 'controls') {
      controls = value
    } else if (key === 'display') {
      display = value
    } else if (key === 'autoplay') {
      autoplay = value
    } else if (key === 'page') {
      page = value

      if (typeof page !== 'number') {
        page = CONST.PAGE_MIN.toString(16)
      }
    }
  }

  // override specific settings based on other initial settings values
  if (
    [
      CONST.CONTROLS_ZAPPER,
      CONST.CONTROLS_MINIMAL,
      CONST.CONTROLS_BIGSCREEN
    ].includes(controls)
  ) {
    menuOpen = false
  }

  if (controls === CONST.CONTROLS_BIGSCREEN) {
    display = CONST.DISPLAY_FITSCREEN
  }

  // ensure service name is valid
  if (!service || !CONFIG[CONST.CONFIG.SERVICES_AVAILABLE][service]) {
    service = CONFIG[CONST.CONFIG.DEFAULT_SERVICE]
  }

  const serviceData = CONFIG[CONST.CONFIG.SERVICES_AVAILABLE][service]

  // determine socket server URL
  let serviceUrl = serviceData.url + ':' + serviceData.port
  if ((window.location.protocol === 'http:') && (serviceData.port === 443)) {
    // if viewer is being served over http and requests a https service, prefix its URL with 'https'
    serviceUrl = 'https:' + serviceUrl
  } else if ((window.location.protocol === 'https:') && (serviceData.port === 80)) {
    // if viewer is being served over https and requests a http service, prefix its URL with 'http'
    serviceUrl = 'http:' + serviceUrl
  }

  // connect via socket.io to server
  socket = io.connect(
    `${serviceUrl}/?service=${service}`,
    {
      rejectUnauthorized: CONFIG[CONST.CONFIG.TELETEXT_VIEWER_HTTPS_REJECT_UNAUTHORIZED]
    }
  )

  // preload service manifest data
  loadManifestData()

  // font metrics
  textFont(ttxFont)
  textSize(CONFIG[CONST.CONFIG.TELETEXT_FONT_SIZE])

  gTtxW = parseInt(textWidth('M'), 10) // ensure calculated character width is an int (not a float) for sharpest rendering quality
  gTtxH = CONFIG[CONST.CONFIG.TELETEXT_FONT_SIZE]

  console.log('gTtxW = ' + gTtxW + ' gTtxH = ' + gTtxH)

  // create the p5 canvas, and move it into the #canvas DOM element
  cnv = createCanvas(
    (
      CONFIG[CONST.CONFIG.CANVAS_WIDTH] +
      (
        !serviceData.isEditable && CONFIG[CONST.CONFIG.CANVAS_PADDING_RIGHT_SINGLE_COLUMN]
          ? gTtxW
          : 0
      )
    ),
    CONFIG[CONST.CONFIG.CANVAS_HEIGHT]
  )
  cnv.parent('canvas')

  // observe mouse press events on p5 canvas
  cnv.mousePressed(
    function () {
      const xLoc = int((mouseX) / gTtxW)
      const yLoc = int(((mouseY) - gridOffsetVertical) / gTtxH)

      // Did we click on the canvas?
      if (
        (xLoc >= 0) && (xLoc < CONFIG[CONST.CONFIG.NUM_COLUMNS]) &&
        (yLoc >= 0) && (yLoc < CONFIG[CONST.CONFIG.NUM_ROWS])
      ) {
        // Make sure the description input is not focussed
        inputDescription.blur()
        blurDescription()

        // Move the cursor if we are editing
        if (editMode !== CONST.EDITMODE_NORMAL) {
          myPage.cursor.moveTo(xLoc, yLoc)
          LOG.fn(
            ['sketch', 'setup', 'mousePressed'],
            `The mouse was clicked at x=${xLoc}, y=${yLoc}`,
            LOG.LOG_LEVEL_VERBOSE
          )
        }
      }
      return false // Prevent default behaviour
    }
  )

  // initialise page
  myPage = new TTXPAGE()
  myPage.init(
    page
      ? parseInt(page, 16)
      : CONST.PAGE_MIN,

    service
  )

  // message events
  socket.on('keystroke', newCharFromServer)
  socket.on('row', setRow) // A teletext row
  socket.on('blank', setBlank) // Clear the page
  socket.on('fastext', setFastext)
  socket.on('setpage', setPageNumber) // Allow the server to change the page number (Page 404 etc)
  socket.on('description', setDescription)
  socket.on('subpage', setSubPage) // Subpage number for carousels (Expect two digits 00..99) [99 is higher than actual spec]
  socket.on('timer', setTimer) // Subpage timing. Currently this is just an overall value. Need to implement for animations
  socket.on('id', setID) // id is a socket id that identifies this client. Use this when requesting a page load
  socket.on('locked', setLocked) // A page with "LK," can not be edited
  socket.on('control', setControl) // A 16 bit integer containing MiniTED flags in Fastext[0]

  // create page number input field
  inputPage = select('#pageNumber')
  inputDescription = select('description')

  // set frame rate
  frameRate(4) // Low because Muttlee chews CPU

  // set specific initial state values as a custom attribute on the body element (for CSS targeting)
  document.body.setAttribute(CONST.ATTR_DATA_SERVICE, service)
  document.body.setAttribute(CONST.ATTR_DATA_SERVICE_EDITABLE, serviceData.isEditable)

  document.body.setAttribute(CONST.ATTR_DATA_SCALE, scale)
  document.body.setAttribute(CONST.ATTR_DATA_CONTROLS, controls)
  document.body.setAttribute(CONST.ATTR_DATA_DISPLAY, display)
  document.body.setAttribute(CONST.ATTR_DATA_MENU_OPEN, menuOpen)

  // store a reference to the DOM elements
  menuButton = document.querySelector('#menuButton')
  canvasElement = document.querySelector('#defaultCanvas0')
  

  serviceSelector = document.querySelector('#serviceSelector')
  serviceSelector2 = document.querySelector('#serviceSelector2')
  scaleSelector = document.querySelector('#scaleSelector')
  controlsSelector = document.querySelector('#controlsSelector')
  displaySelector = document.querySelector('#displaySelector')
  autoplaySelector = document.querySelector('#autoplaySelector')

  manifestModal = document.querySelector('#manifest')
  instructionsModal = document.querySelector('#instructions')
  aboutModal = document.querySelector('#about')

  // set initial state values into their UI elements...
  if (serviceSelector) {
    serviceSelector.value = service
  }
  if (serviceSelector2) {
    serviceSelector2.value = service
  }

  if (scaleSelector) {
    scaleSelector.value = scale
  }

  if (controlsSelector) {
    controlsSelector.value = controls
  }

  if (displaySelector) {
    displaySelector.value = display
  }

  if (autoplaySelector) {
    autoplaySelector.value = autoplay
  }

  // show service credit?
  if (serviceData.credit) {
    const credit = document.querySelector('#credit')

    if (credit) {
      credit.innerHTML = serviceData.credit.replace('<a ', '<a target="_blank" rel="noopener noreferrer" ')
    }
  }

  // set the initial canvas scale
  updateScale()

  // indicate changes that have not been processed by the server yet
  changed = new CHARCHANGED()

  // update custom attribute on body element, indicating that rendering setup has complete
  document.body.setAttribute(CONST.ATTR_DATA_READY, true)

  // initialise autoplay?
  if (
    !serviceData.isEditable &&
    [CONST.AUTOPLAY_SEQUENTIAL, CONST.AUTOPLAY_RANDOM].includes(autoplay)
  ) {
    autoplayInterval = window.setInterval(
      autoplayChangePage,
      ((CONFIG[CONST.CONFIG.DEFAULT_AUTOPLAY_INTERVAL] || 35) * 1000)
    )
  }
}

function openService (serviceId) {
  LOG.fn(
    ['sketch', 'openService'],
    `Opening service=${serviceId}`,
    LOG.LOG_LEVEL_VERBOSE
  )

  // set service param of URL
  const params = new URLSearchParams(location.search)
  params.set('service', serviceId)
  params.delete('page') // don't carry current page number over when changing service

  const newUrl = `${location.pathname}?${params}`

  // open in same, or new window?
  if (CONFIG[CONST.CONFIG.OPEN_SERVICE_IN_NEW_WINDOW] === true) {
    window.open(newUrl)
  } else {
    window.location.href = newUrl
  }
}

function updateLocationUrl (key, value) {
  if (history.pushState) {
    const loc = window.location
    const searchParams = new URLSearchParams(loc.search)
    searchParams.set(key, value)

    const newUrl = `${loc.protocol}//${loc.host}${loc.pathname}?${searchParams.toString()}`

    window.history.pushState({ path: newUrl }, '', newUrl)
  }
}

function serviceChange (event) {
  if (event.target) {
    openService(
      event.target.value
    )
  }
}

function randomPage (event) {
  if (event) {
    event.preventDefault()
  }

  if (serviceManifests[service] && serviceManifests[service].pages) {
    const manifestPageNumbers = Object.keys(serviceManifests[service].pages)

    // get random page from manifest
    const randomIndex = (manifestPageNumbers.length * Math.random() | 0)

    // change to the new page number
    changePage(
      manifestPageNumbers[randomIndex]
    )
  }

  return false
}

function controlsChange () {
  if (controlsSelector) {
    controls = controlsSelector.value

    // update custom attribute on body element
    document.body.setAttribute(CONST.ATTR_DATA_CONTROLS, controls)

    // update the URL with the current controls mode (without reloading the page)
    updateLocationUrl('controls', controls)
  }
}

function displayChange () {
  if (displaySelector) {
    display = displaySelector.value

    // update custom attribute on body element
    document.body.setAttribute(CONST.ATTR_DATA_DISPLAY, display)

    // update the URL with the current display mode (without reloading the page)
    updateLocationUrl('display', display)

    // update canvas scale
    updateScale()

    window.setTimeout(
      updateScale,
      0
    )
  }
}

function scaleChange () {
  if (scaleSelector) {
    scale = scaleSelector.value

    // update custom attribute on body element
    document.body.setAttribute(CONST.ATTR_DATA_SCALE, scale)

    // update the URL with the current scale (without reloading the page)
    updateLocationUrl('scale', scale)

    // update canvas scale
    updateScale()
  }
}

function autoplayChange () {
  if (autoplaySelector) {
    const serviceData = CONFIG[CONST.CONFIG.SERVICES_AVAILABLE][myPage.service]

    autoplay = autoplaySelector.value

    if (autoplay === CONST.AUTOPLAY_NONE) {
      // cancel currently-active autoplay
      window.clearInterval(autoplayInterval)
      autoplayInterval = undefined
    } else if (!serviceData.isEditable && [CONST.AUTOPLAY_SEQUENTIAL, CONST.AUTOPLAY_RANDOM].includes(autoplay)) {
      // initialise autoplay
      autoplayInterval = window.setInterval(
        autoplayChangePage,
        ((CONFIG[CONST.CONFIG.DEFAULT_AUTOPLAY_INTERVAL] || 35) * 1000)
      )
    }

    // update custom attribute on body element
    document.body.setAttribute(CONST.ATTR_DATA_AUTOPLAY, autoplay)

    // update the URL with the current autoplay (without reloading the page)
    updateLocationUrl('autoplay', autoplay)
  }
}

function setTimer (data) {
  myPage.setTimer(data.fastext[0])
}

function setSubPage (data) {
  if (data.id !== gClientID && gClientID !== null) {
    // Not for us?
    return
  }

  if (!myPage.subPageZeroBase) {
    myPage.subPageZeroBase = data.s === 0 // Subpages start from 0, not 1
  }

  // [!] TODO. If the first number we are given is not 00
  // then we end up having a phantom blank 00 page in a carousel.
  // We should ideally overwrite the blank subpage instead of creating a new subpage.
  // Or less ideally, we should just get everything to ignore the blank 00.
  myPage.setSubPage(
    parseInt(data.line)
  )
}

/** Mark the page as locked
 */
function setLocked(r) {
  if (!matchpage(r)) return // Not for us

  LOG.fn(
    ['sketch', 'setLocked'],
    `This page is locked`,
    LOG.LOG_LEVEL_INFO
  )
  myPage.setLocked(true)
}

/** Page control bits
 */
function setControl(data) {
  if (!matchpage(data)) return // Not for us
  print(data)
  LOG.fn(
    ['sketch', 'setControl'],
    `MiniTED page control bits = ${data.control}`,
    LOG.LOG_LEVEL_INFO
  )
  // Really should decode these bits into TPOF for convenience
  // myPage.setControl(data.control)
  
  // For now, just grab the language bits
  let language = (data.control >> 7) & 0x07
  LOG.fn(
    ['sketch', 'setControl'],
    `Language =   ${language}`,
    LOG.LOG_LEVEL_INFO
  )
  myPage.mapChar.setCountry(language)
}

/** We MUST be sent the connection ID or we won't be able to display anything
 */
function setID (id) {
  LOG.fn(
    ['sketch', 'setID'],
    `Our connection ID is ${id}`,
    LOG.LOG_LEVEL_INFO
  )

  gClientID = id

  // Now we can load the initial page
  const data = {
    S: myPage.service, // The codename of the service. eg. d2k or undefined
    p: myPage.pageNumber, // Page mpp
    s: myPage.subPage,
    x: CONST.SIGNAL_INITIAL_LOAD, // A secret flag to do an initial load
    y: 0,
    rowText: '',
    id: gClientID
  }

  socket.emit('load', data)
}

function setDescription (data) {
  if (data.id !== gClientID && gClientID !== null) {
    return // Not for us?
  }

  myPage.description = data.desc
  // [!] probably what is wrong is that "description" is not unique. It is both the outer div and the input ID.
  // Got to change that!
  const inputHTML = '<input type="text" id="description" name="description" maxLength="40" value="' + data.desc + '" onchange="inputDescriptionText();" onfocus="focusDescription();" onblur="blurDescription();" </input>'
  document.getElementById('descriptionDiv').innerHTML = '<strong> Page info:</strong> ' + inputHTML
  inputDescription = document.getElementById('description')
}

function setPageNumber (data) {
  if ((data.id !== gClientID) && (gClientID !== null)) {
    return // Not for us?
  }

  LOG.fn(
    ['sketch', 'setPageNumber'],
    `Setting page=${data.p.toString(16)}, service=${data.S}`,
    LOG.LOG_LEVEL_VERBOSE
  )

  myPage.setPage(data.p)
  myPage.setService(data.S)
}

// Handle the button UI
function fastextR () {
  fastext(1)
}

function fastextG () {
  fastext(2)
}

function fastextY () {
  fastext(3)
}

function fastextC () {
  fastext(4)
}

function fastextIndex () {
  fastext(6)
}

/**
 * Load the fastext link
 * @param index 1-4, 6
 */
function fastext (index) {
  // Ignore fastext if we are in edit mode
  if (myPage.getEditMode() >= CONST.EDITMODE_EDIT) {
    return
  }
  
  let createPage = false // Special case. If yellow link is >0x0fff then create a page
  let page = 0

  switch (index) {
    case 1:
      page = myPage.redLink
      break

    case 2:
      page = myPage.greenLink
      break

    case 3:
      // if yellow fastext has been set to a number greater than 0x0fff then it is a request to create the page
      page = myPage.yellowLink

      if (page > 0x0fff) { // Is this flagged to create a new page?
        page &= 0x0fff // Mask off the flag to get the page number
        createPage = true
      }

      break

    case 4:
      page = myPage.cyanLink
      break

    case 6:
      page = myPage.indexLink
      break

    default:
      page = myPage.redLink
  }
  
  // ETSI 7.3 pages XFF are time fillers, not a real page, so don't create a page or jump there
  if ((page & 0xff) === 0xff) {
    page = 0
    createPage = false
  }

  LOG.fn(
    ['sketch', 'fastext'],
    `Fastext pressed, index=${index}, link to 0x${page.toString(16)} (${page})`,
    LOG.LOG_LEVEL_VERBOSE
  )

  // if page in range...
  if (page >= CONST.PAGE_MIN && page <= CONST.PAGE_MAX) {
    myPage.setPage(page) // We now have a different page number

    const data = {
      S: myPage.service,
      p: page, // Page mpp
      s: undefined, // subpage doesn't default to 0
      x: 0,
      y: 0,
      rowText: '',
      id: gClientID
    }

    if (createPage) { // Special case
      socket.emit('create', data)
    } else {
      socket.emit('load', data)
    }
  }
}

function setFastext (data) {
  if (!matchpage(data)) {
    return // Data is not for our page?
  }

  if (data.id !== gClientID && gClientID != null) {
    return // Not for us?
  }

  myPage.redLink = parseInt('0x' + data.fastext[0])
  myPage.greenLink = parseInt('0x' + data.fastext[1])
  myPage.yellowLink = parseInt('0x' + data.fastext[2])
  myPage.cyanLink = parseInt('0x' + data.fastext[3])
  myPage.spareLink = parseInt('0x' + data.fastext[4])
  myPage.indexLink = parseInt('0x' + data.fastext[5])
}

function draw () {
  // No updating while we are pressing the mouse OR while typing in a page number
  if (!forceUpdate) {
    if (((blockStart !== undefined) && (blockStart !== null)) || !expiredState) {
      return
    }
  } else {
    forceUpdate = false
  }

  // We only need to update this during updates. We get here four times a second
  background(0)
  noStroke()
  fill(255, 255, 255)

  myPage.draw(changed)
}

// Does our page match the incoming message?
function matchpage (data) {
  if (myPage.service !== data.S) return false
  if (myPage.pageNumber !== data.p) return false

  return true
}

/** newCharFromServer only differs from newChar in that it does not move the cursor
 */
function newCharFromServer (data) {
  newChar(data, false)
}

/** alphaInGraphics
 *  \param key - Key to test
 * \return - true if it is a printable character when in graphics mode
 * Note that this is only valid for the England character set
 * When processKey translates keys, we probably don't need to alter this?
 */
function alphaInGraphics (key) {
  return ((key.charCodeAt(0) >= 0x40) && (key.charCodeAt(0) < 0x60))
}

// Message handlers....
/** newChar
 * \param data - keyStroke
 * \param local - default true. Set local to false if the keystroke came from the server
 This is because 1) we don't want the remote user to move our cursor. 2) We don't want to interpret qwaszx from a remote user
 * \return The data key is returned and if graphics then the mosaic
 *
 */
function newChar (data, local = true) { // 'keystroke'
  // If nothing else, we note that our character returned and can be marked as 'processed'
  if (local) {
    changed.set(data.x, data.y) // local change

    LOG.fn(
      ['sketch', 'newChar'],
      `Set x=${data.x}`,
      LOG.LOG_LEVEL_VERBOSE
    )
  } else {
    changed.clear(data.x, data.y) // remote change

    LOG.fn(
      ['sketch', 'newChar'],
      `Cleared x=${data.x}`,
      LOG.LOG_LEVEL_VERBOSE
    )
  }

  // @todo page number test
  if (!matchpage(data)) return // Char is not for our page?
  let key = data.k

  // We should now look if graphic mode is set at this char.
  // If graphics mode is set, only allow qwaszx and map the bits of the current character
  // At (x,y) on subpage s, place the character k
  const graphicsMode = myPage.IsGraphics(data) // what about the subpage???
  let advanceCursor = local // Cursor advances, unless it is a remote user or a graphics twiddle

  if (local) {
    // Do the graphics, unless this is an edit tf escape. Or an upper case letter.
    if (graphicsMode && editMode !== CONST.EDITMODE_INSERT && !alphaInGraphics(key)) { // Take the original pixel and xor our selected bit
      key = data.k.toUpperCase() // @todo. Do we need to consider subpages and services? Maybe just subpages.
      let bit = 0
      advanceCursor = false

      switch (key) {
        // sixel modifying
        case 'Q' :
          bit = 0x01
          break
        case 'W' :
          bit = 0x02
          break
        case 'A' :
          bit = 0x04
          break
        case 'S' :
          bit = 0x08
          break
        case 'Z' :
          bit = 0x10
          break
        case 'X' :
          bit = 0x40
          break // Note the discontinuity due to the gap.
          // R=Reverse, F=fill
        case 'R' :
          bit = 0x5f
          break // reverse all bits
        case 'F' :
          bit = 0xff
          break // set all bits
        case 'C' :
          bit = 0x00
          break // clear all bits

        default:
          return key
      }

      if (bit === 0) {
        key = 0x20 // All pixels off
      } else if (bit === 0xff) {
        key = 0x7f // All pixels on
      } else {
        key = myPage.getChar(data) // Get the original character
        key = key ^ bit | 0x20 // And set bit 5 so we only make mosaics
      }
      key = String.fromCharCode(key) // Convert to ascii

      LOG.fn(
        ['sketch', 'newChar'],
        `Graphics key=${key}, bit=bit`,
        LOG.LOG_LEVEL_VERBOSE
      )

      // What is the problem? The data is being inserted as an ascii number rather than the code
    }
  } else {
    advanceCursor = false
  }

  if (advanceCursor) {
    myPage.cursor.right() // advance the cursor if it is the local user
  }

  myPage.drawchar(key, data.x, data.y, data.s) // write the character

  if (editMode === CONST.EDITMODE_INSERT) {
    editMode = CONST.EDITMODE_EDIT
    myPage.setEditMode(editMode)
  }

  return key
}

// A whole line is updated at a time
function setRow (r) {
  // If this happens when in X28 properties mode....
  // we can ignore it and so lose updates
  // or execute it and our X28 properties page is overwritten and the UI is confusing
  // @todo Set a flag if while in X28 properties mode the page is updated but
  // ignore the update. Then on exiting ask to load the current state.
  
  // If we are on the properties page then ignore any incoming page update
  if (editMode > CONST.EDITMODE_INSERT) {
    /// @todo Set a flag so that we can request a full page update when we exit the properties page
    return
  }
  if (!matchpage(r)) return
  if (r.id !== gClientID && gClientID !== null) return // Not for us?
  if (r.y < 25) {
    myPage.setRow(r.y, r.rowText)    
  } else if (r.y === 28) { // @wsfn clrt1
    console.log(r.X28F1) // here is the data
    if (myPage.subPage < myPage.metadata.length ) { // [!] Problem! The PN or SC number is greater than the actual subpages that we have
      let clut = myPage.metadata[myPage.subPage].clut
      for (let i = 0; i < 16; i++) {
        let val = r.X28F1.colourMap[i] // The 12 bit colour value
        // convert to a p5.Color object
        let hash = '#'+hex(val).substring(5) // eg. #c8f
        let colourValue = color(hash)
        let clutIndex = 2 + Math.trunc(i / 8) // Either CLUT 2 or 3 are updatable
        let colourIndex = i % 8
        clut.setValue(colourValue, clutIndex, colourIndex)
      }
      clut.setDC(r.X28F1.dc)
      clut.setPageFunction(r.X28F1.pageFunction)
      clut.setPageCoding(r.X28F1.pageCoding)
      clut.setDefaultG0G2CharacterSet(r.X28F1.defaultG0G2CharacterSet)
      clut.setSecondG0G2CharacterSet(r.X28F1.secondG0G2CharacterSet)
      clut.setDefaultScreenColour(r.X28F1.defaultScreenColour)
      clut.setDefaultRowColour(r.X28F1.defaultRowColour)
      clut.setRemap(r.X28F1.colourTableRemapping)
      clut.setBlackBackgroundSub(r.X28F1.backBackgroundSubRow)
      clut.setEnableLeftPanel(r.X28F1.enableLeftPanel)
      clut.setEnableRightPanel(r.X28F1.enableRightPanel)
      clut.setSidePanelStatusFlag(r.X28F1.sidePanelStatusFlag)
      clut.setLeftColumns(r.X28F1.leftColumns)
    } else {
      LOG.fn(
        ['sketch', 'setRow'],
        `Subpage out of range subpages=${myPage.metadata.length} requested subpage=${myPage.subPage}`, // PN are probably out of sequence
        LOG.LOG_LEVEL_ERROR
      )      
    }
    // @TODO Save packet
    // remembering to clear packet on carousel, new or load page etc
  }
}

// Clear the page to blank (all black)
function setBlank (data) { // 'blank' wsfn cpb
  if (!matchpage(data)) return
  if (data.id !== gClientID && gClientID !== null) return // Not for us?

  myPage.setBlank()
  myPage.setLocked(false)
  
  // For some reason, we can end up with CONST.EDITMODE_INSERT and this stops the cursor from blinking
  if (myPage.getEditMode() > CONST.EDITMODE_EDIT) {    myPage.setEditMode(CONST.EDITMODE_EDIT)
  }

  // clear the description too
  data.desc = 'Edit here to change description'
  setDescription(data)
}

function inputNumber () {
  LOG.fn(
    ['sketch', 'inputNumber'],
    'InputNumber changed',
    LOG.LOG_LEVEL_VERBOSE
  )

  if (inputPage && inputPage.elt) {
    const pageValue = inputPage.elt.value

    LOG.fn(
      ['sketch', 'inputNumber'],
      `Opening page=${pageValue}`,
      LOG.LOG_LEVEL_INFO
    )

    // if a 3 digit page number has been entered...
    if (pageValue.length === 3) {
      // change to the new page number
      changePage(pageValue)

      // blur the page number input DOM element
      inputPage.elt.blur()
    }
  }
}

/**
 * When the description changes, send it back to the server
 */
function inputDescriptionText () {
  LOG.fn(
    ['sketch', 'inputDescription'],
    'InputDescription changed',
    LOG.LOG_LEVEL_VERBOSE
  )
  console.log('[sketch] inputDescription TRIGGERED')
  // Get the new description
  const newDescription = document.getElementById('description').value
  myPage.description = newDescription
  // Build the description message
  const data = {
    S: myPage.service, // The codename such as artfax or wtf
    p: myPage.pageNumber, // Page mpp
    s: myPage.subPage, // Subcode
    desc: newDescription,
    id: gClientID
  }

  // send it
  socket.emit('description', data)
}

function focusDescription () {
  LOG.fn(
    ['sketch', 'focusDescription'],
    'focusDescription triggered',
    LOG.LOG_LEVEL_VERBOSE
  )
  console.log('[sketch] focusDescription TRIGGERED')
  focusedDescription = true
}

function blurDescription () {
  LOG.fn(
    ['sketch', 'blurDescription'],
    'blurDescription triggered',
    LOG.LOG_LEVEL_VERBOSE
  )
  focusedDescription = false
}
/** built in function.
 *  Fires on all key presses - This is called before keyTyped
 */
function keyPressed () {
  LOG.fn(
    ['sketch', 'keyPressed'],
    `k=${keyCode}`,
    LOG.LOG_LEVEL_VERBOSE
  )

  let handled = true

  if (
    ((inputPage && inputPage.elt) && (document.activeElement === inputPage.elt)) ||
    ((inputDescription && inputDescription.value) && (document.activeElement === inputDescription))
  ) {
    // Allow native event propagation on input elements. (ie. Make special keys work like cursor, backspace etc.)
    handled = false
  } else {
    // todo: Kill refresh cycles while the input is active.
    switch (keyCode) {
      case LEFT_ARROW:
        if ( (editMode === CONST.EDITMODE_EDIT) ||
            (editMode === CONST.EDITMODE_PROPERTIES) ) {
            myPage.cursor.left()
        }
        break

      case RIGHT_ARROW:
        if ( (editMode === CONST.EDITMODE_EDIT) ||
            (editMode === CONST.EDITMODE_PROPERTIES) ) {
            myPage.cursor.right()
        }
        break

      case UP_ARROW:
        if ( (editMode === CONST.EDITMODE_EDIT) ||
            (editMode === CONST.EDITMODE_PROPERTIES) ) {
            myPage.cursor.up()
        }
        break

      case DOWN_ARROW:
        if ( (editMode === CONST.EDITMODE_EDIT) ||
            (editMode === CONST.EDITMODE_PROPERTIES) ) {
            myPage.cursor.down()
        }
        break
        
      case ENTER:
        if (editMode === CONST.EDITMODE_EDIT) myPage.cursor.newLine()
        break

      case ESCAPE: {
      
        if (myPage.isLocked()) // If the page has an "LK," command, don't allow editing
          break
          
        // Property page does not use Escapes
        if (myPage.getEditMode() >= CONST.EDITMODE_PROPERTIES) {
          break
        }
          
        const serviceData = CONFIG[CONST.CONFIG.SERVICES_AVAILABLE][myPage.service]

        // Services that are editable
        if (serviceData.isEditable) {
          switch (editMode) {
            case CONST.EDITMODE_NORMAL:
              editMode = CONST.EDITMODE_EDIT
              break

            case CONST.EDITMODE_EDIT:
              editMode = CONST.EDITMODE_ESCAPE
              break

            case CONST.EDITMODE_ESCAPE:
              editMode = CONST.EDITMODE_NORMAL
              break
          }

          myPage.setEditMode(editMode)
        }

        break
      }
      case TAB: // Insert a space
        if (editMode === CONST.EDITMODE_PROPERTIES) {
          // Forward this tab to the properties page
          myPage.handlePropertiesKey(keyCode + 0x80) // Special flag

        } else {
          myPage.insertSpace() // Do our page
          insertSpace() // Any other clients
          editMode = CONST.EDITMODE_EDIT
        }
        break

      case BACKSPACE: // Remove current character, move the remainder one char left.
        myPage.backSpace()
        backSpace()
        editMode = CONST.EDITMODE_EDIT
        break

      case 33: // PAGE_UP (next subpage when in edit mode)
        if (editMode === CONST.EDITMODE_PROPERTIES) {
          // Forward page up to the properties page
          myPage.handlePropertiesKey(keyCode + 0x80) // Special flag

        } else {
          if (editMode === CONST.EDITMODE_EDIT) {
            myPage.nextSubpage()
          }
        }
        break

      case 34: // PAGE_DOWN (prev subpage when in edit mode)
        if (editMode === CONST.EDITMODE_PROPERTIES) {
          // Forward page down to the properties page
          myPage.handlePropertiesKey(keyCode + 0x80) // Special flag
        } else {
          if (editMode === CONST.EDITMODE_EDIT) {
            myPage.prevSubpage()
          }
        }
        break

      case 35: // END - move to the last character on this line (ideally the first blank character after the last non-blank)
        myPage.end()
        break

      case 36: // HOME - move to the first character on this line
        myPage.home()
        break

      case 45: // INSERT - Add a subpage then revert to edit mode
        if (editMode === CONST.EDITMODE_ESCAPE) {
          myPage.addSubPage()
        }
        editMode = CONST.EDITMODE_EDIT
        myPage.setEditMode(editMode)
        break

      case 46: // DELETE - Delete a subpage then revert to edit mode
        if (editMode === CONST.EDITMODE_ESCAPE) {
          let saveSubpage = myPage.subPage
          if (myPage.removeSubPage()) { // Remove the subpage locally
            // If OK then also do it on the server
            deleteSubpage(saveSubpage)
          }
          editMode = CONST.EDITMODE_EDIT
          myPage.setEditMode(editMode)
        }
        break

      default:
        handled = false
    }
  }

  // Signal whether the key should be processed any further
  return !handled
}

/** This deletes a subpage on the server and any listening client,
 *  Not on our own page as we have already done this.
 */
function deleteSubpage (subpage) {
  LOG.fn(
    ['sketch', 'deleteSubpage'],
    `subpage s=${subpage}`,
    LOG.LOG_LEVEL_VERBOSE
  )

  const txt = {
    S: myPage.service, // service number
    p: myPage.pageNumber,
    s: subpage,
    k: ' ',
    x: CONST.SIGNAL_DELETE_SUBPAGE,
    y: 0,
    id: gClientID
  }
  socket.emit('deleteSubpage', txt)
}

/** This inserts a space on the server and any listening client,
 *  Not our own page.
 */
function insertSpace () {
  const xp = 39
  const txt = {
    S: myPage.service, // service number
    p: myPage.pageNumber,
    s: myPage.subPage,
    k: 'q',
    x: myPage.cursor.x,
    y: myPage.cursor.y,
    id: gClientID
  }

  for (let xp = 39; xp > myPage.cursor.x; xp--) {
    // This looks a bit weird, but keystroke automatically advances the insert position
    txt.x = xp
    const ch = myPage.getChar(txt)
    txt.k = String.fromCharCode(ch)

    socket.emit('keystroke', txt)
  }

  // Finally insert a space
  txt.k = ' '
  txt.x = myPage.cursor.x

  socket.emit('keystroke', txt)
}

/** Delete the current character by shifting all characters to the right by 1
 * This deletes on the server and any listening client,
 *  Not on our own page.
 */
function backSpace () {
  const txt = {
    S: myPage.service, // service number
    p: myPage.pageNumber,
    s: myPage.subPage,
    k: 'q',
    x: myPage.cursor.x,
    y: myPage.cursor.y,
    id: gClientID
  }

  for (let xp = myPage.cursor.x; xp < CONFIG[CONST.CONFIG.NUM_COLUMNS]; xp++) {
    txt.x = xp
    const ch = myPage.getChar(txt)
    txt.k = String.fromCharCode(ch)

    socket.emit('keystroke', txt)
  }

  // Finally insert a space
  txt.k = ' '
  txt.x = 39

  socket.emit('keystroke', txt)
}

/** edit mode is entered if any non numeric code is typed
 *  edit mode exits if <esc> is pressed
 *  This p5js function doesn't fire on Ctrl, Alt, Shift etc.
 */
function keyTyped () {
  LOG.fn(
    ['sketch', 'keyTyped'],
    `k=${keyCode}`,
    LOG.LOG_LEVEL_VERBOSE
  )

  if ((inputPage && inputPage.elt) && (document.activeElement === inputPage.elt)) {
    // keypress in the page number input field...
    setTimeout(
      function () {
        if (inputPage.elt.value.length === 3) {
          // trigger blur event, in order to trigger input element onchange function
          inputPage.elt.blur()
        }
      },
      0
    )

    return true // Don't prevent native event propagation on input element
  } else if (focusedDescription) {
    // keypress in the description input field...
    console.log('[sketch, keyTyped] inputDescription happened. key = ' + key)
    // If key is Enter we are done editing the description
    // so blur the input
    if (key === 'Enter') {
      inputDescription.blur()
      blurDescription()
    }
    return true // Don't prevent native event propagation on input element
  } else {
    // keypress anywhere else...
    key = mapKey(key)
    processKey(key)

    return false // Prevent triggering any other behaviour
  }
}

/**
 *
 */
function processKey (keyPressed) {
  // @todo need to map codes to national options at this point.
  // @todo Also need to fix alphaInGraphics when I do this
  
  // In properties mode, the keys work completely differently, as does the page renderer
  if (editMode === CONST.EDITMODE_PROPERTIES) {
    // Now we handle the UI elements on the properties pages.
    myPage.handlePropertiesKey(key)
    
    
    if (key ==='x' || key === 'q') {
      editMode = CONST.EDITMODE_EDIT
      myPage.setEditMode(editMode)
      // Return the modified clut to the server
      /// TEST - Delete this section
      print("Clut exits\n" + myPage.metadata[myPage.subPage].clut)
      /// \TEST
      if (key === 'q') { // Restore the original CLUT
        Clut.copyClut(myPage.editProperties.savedClut, myPage.metadata[myPage.subPage].clut)
      }
      if (key === 'x') { // Transmit the changed CLUT back to the server
        // Copy the clut to the corresponding X28F1 message format
        // Make a row 28 object
        let clut = myPage.metadata[myPage.subPage].clut
        print(clut) // @wsfn
        let X28F1 = {
          dc : clut.dc,
          pageFunction : clut.pageFunction,
          pageCoding : clut.pageCoding,
          defaultG0G2CharacterSet : clut.defaultG0G2CharacterSet,
          secondG0G2CharacterSet : clut.secondG0G2CharacterSet,
          colourMap : [],
          defaultScreenColour : clut.defaultScreenColour, // 5 bits
          defaultRowColour : clut.defaultRowColour, // 5 bits
          colourTableRemapping : clut.remap, // 3 bits
          blackBackgroundSubRow : clut.blackBackgroundSub, // 1 bit
          enableLeftPanel : clut.enableLeftPanel, // 1 bit
          enableRightPanel : clut.enableRightPanel, // 1 bit
          sidePanelStatusFlag : clut.sidePanelStatusFlag, // 1 bit
          leftColumns : clut.leftColumns  // 4 bits
        }
        // Packet X28 only affects CLUT 2 and 3
        for (let i=0; i<16; ++i) {
          let clutIndex = Math.floor(i/8) + 2
          let colourIndex = i % 8
          let colour = clut.getValue(clutIndex, colourIndex)
          X28F1.colourMap.push(Clut.colour24to12(colour))
        }
        // Send X28F1 to the server        
        print(X28F1)
        // Wrap it up in an identifier packet
        let packet28 = {
          S: myPage.service,
          p: myPage.pageNumber,
          s: myPage.subPage,
          y: 28,
          x28f1: X28F1,
          id: gClientID
        }
        socket.emit('x28f1', packet28)
        // Metadata (fastext, page timing, transmission flags etc.)
        // @todo :
        // Make a fastext json packet
        // Copy the fastext links from ttxproperties
        // Send fastext to the server
        
        let fastextPacket = {
          S: myPage.service,
          p: myPage.pageNumber,
          s: myPage.subPage,
          x: CONST.SIGNAL_FASTEXT_CHANGE,
          y: 9999, // big invalid number so the server scans the whole page
          id: gClientID,
          fastext: []
        }
        fastextPacket.fastext[0] = myPage.editProperties.redLink
        fastextPacket.fastext[1] = myPage.editProperties.greenLink
        fastextPacket.fastext[2] = myPage.editProperties.yellowLink
        fastextPacket.fastext[3] = myPage.editProperties.cyanLink
        fastextPacket.fastext[4] = myPage.editProperties.spareLink
        fastextPacket.fastext[5] = myPage.editProperties.indexLink
        socket.emit('fastext', fastextPacket)
        // @todo Page timing
        // @todo transmission flags
      }
    }
    // @todo Think about this. If we delete the object, it loses all state.
    // The UI might be nicer if it remembers state, like which properties page it was on last.
    //delete myPage.editProperties // Finished editing.
    return
  }
  
  if (editMode === CONST.EDITMODE_ESCAPE) {
    editMode = CONST.EDITMODE_INSERT
    myPage.setEditMode(editMode)

    editTF(key)

    return
  }

  if (editMode !== CONST.EDITMODE_NORMAL) { // Numbers are typed into the page
    const data = {
      S: myPage.service, // service number
      p: myPage.pageNumber,
      s: myPage.subPage,
      k: keyPressed,
      x: myPage.cursor.x,
      y: myPage.cursor.y,
      id: gClientID
    }

    data.k = newChar(data) // Return the key in case we are in mosaic twiddle mode. ie. don't return qwaszx.
    socket.emit('keystroke', data)
  } else {
    // navigation from the keyboard (same as vbit-iv)
    // uiop are red/green/yellow/cyan Fastext buttons.
    if (keyPressed === 'u') {
      // press the red button
      fastext(1)
      return
    } else if (keyPressed === 'i') {
      // press the green button
      fastext(2)
      return
    } else if (keyPressed === 'o') {
      // press the yellow button
      fastext(3)
      return
    } else if (keyPressed === 'p') {
      // press the cyan button
      fastext(4)
      return
    } else if (keyPressed === 'h') {
      // hold
      khold()
      return
    } else if (keyPressed === 'r') {
      // reveal
      krvl()
      return
    } else if (keyPressed === 'b') {
      // back one page
      kback()
      return
    } else if (keyPressed === 'f') {
      // forward one page
      kfwd()
      return
    } else if (keyPressed === 'd') {
      // random page
      randomPage()
      return
    }

    // Numbers are used for the page selection
    if (keyPressed >= '0' && keyPressed <= '9') {
      if (inputPage && inputPage.elt) {
        // Don't want the number input to steal keystrokes
        inputPage.elt.blur()
      }

      startTimer() // This also clears out the other digits (first time only)

      forceUpdate = true
      digit1 = digit2
      digit2 = digit3
      digit3 = keyPressed

      if (digit1 !== ' ') {
        const page = parseInt('0x' + digit1 + digit2 + digit3)
        myPage.pageNumberEntry = digit1 + digit2 + digit3

        if (page >= CONST.PAGE_MIN) {
          LOG.fn(
            ['sketch', 'processKey'],
            `Page number is 0x${page.toString(16)}`,
            LOG.LOG_LEVEL_VERBOSE
          )

          myPage.setPage(page) // We now have a different page number

          const data = {
            S: myPage.service, // service
            p: page, // Page mpp
            s: myPage.subPage, // @ todo check that subpage is correct
            x: 0,
            y: 0,
            rowText: '',
            id: gClientID
          }

          socket.emit('load', data)
        }
      }
    }
  }
}

function k0 () { processKey('0') }
function k1 () { processKey('1') }
function k2 () { processKey('2') }
function k3 () { processKey('3') }
function k4 () { processKey('4') }
function k5 () { processKey('5') }
function k6 () { processKey('6') }
function k7 () { processKey('7') }
function k8 () { processKey('8') }
function k9 () { processKey('9') }

function krvl () {
  myPage.toggleReveal()
}

function kback () {
  prevPage()
}

function kfwd () {
  nextPage()
}

function khold () {
  myPage.toggleHold()
}

/* Block editing. Touch marks the first corner of an area
*/
function touchStarted (event) {
  // only start block if touch event is within the page canvas, and is not on an overlaid non-canvas elment
  // Assume it is a mouse click
  let xLoc = mouseX
  let yLoc = mouseY
  // unless we have touches
  if (touches.length > 0) {
    xLoc = touches[0].x
    yLoc = touches[0].y
  }
  if (
    (event.target !== canvasElement) ||
    (xLoc > (CONFIG[CONST.CONFIG.CANVAS_WIDTH] * currentPixelDensity)) ||
    (yLoc > (CONFIG[CONST.CONFIG.CANVAS_HEIGHT] * currentPixelDensity))
  ) {
    // touch event not within canvas
    return
  }

  blockStart = createVector(xLoc, yLoc)

  return false
}

function touchEnded () {
  // Assume it is a mouse click
  let xLoc = mouseX
  let yLoc = mouseY
  if (touches.length > 0) {
    xLoc = touches.at(-1).x
    yLoc = touches.at(-1).y
  }
  const blockEnd = createVector(xLoc, yLoc)
  blockEnd.sub(blockStart)
  blockStart = null // Need this to be null in case we return!

  // only start block if touch event is within the page canvas, and is not on an overlaid non-canvas elment
  if (
    (event.target !== canvasElement) ||
    (xLoc > (CONFIG[CONST.CONFIG.CANVAS_WIDTH] * currentPixelDensity)) ||
    (yLoc > (CONFIG[CONST.CONFIG.CANVAS_HEIGHT] * currentPixelDensity))
  ) {
    // touch event not within canvas
    return
  }

  // Block needs to be a minimum distance (& possibly velocity)?
  const mag = blockEnd.mag()
  if (mag < CONFIG[CONST.CONFIG.NUM_COLUMNS]) {
    return
  }

  /* Guess we aren't doing this yet. Stop "standard" from complaining
  const heading = blockEnd.heading()
  const dir = 4 * heading / PI
  */ 
  return false
}

function nextPage () {
  let p = myPage.pageNumber
  p++

  // don't allow navigation to hexadecimal page numbers, skip to next valid decimal page number
  while (/[A-F]+/i.test(p.toString(16))) {
    p += 6
  }

  // don't allow navigation to a page above our maximum page number
  if (p > CONST.PAGE_MAX) {
    p = CONST.PAGE_MAX
  }

  myPage.setPage(p) // We now have a different page number

  const data = {
    S: myPage.service,
    p, // Page mpp
    s: 0,
    y: 0,
    rowText: '',
    id: gClientID
  }

  socket.emit('load', data)

  LOG.fn(
    ['sketch', 'nextPage'],
    `page=${hex(data.p)}`,
    LOG.LOG_LEVEL_VERBOSE
  )
}

function prevPage () {
  let p = myPage.pageNumber
  p--

  // don't allow navigation to hexadecimal page numbers, skip to next valid decimal page number
  while (/[A-F]+/i.test(p.toString(16))) {
    p -= 6
  }

  // don't allow navigation to a page below our minimum page number
  if (p < CONST.PAGE_MIN) {
    p = CONST.PAGE_MIN
  }

  myPage.setPage(p) // We now have a different page number

  const data = {
    S: myPage.service,
    p, // Page mpp
    s: 0,
    y: 0,
    rowText: '',
    id: gClientID
  }

  socket.emit('load', data)

  LOG.fn(
    ['sketch', 'prevPage'],
    `page=${hex(data.p)}`,
    LOG.LOG_LEVEL_VERBOSE
  )
}

/** Execute an editTF escape command
 *  This is the key that follows the escape key
 *  As zxnet keys are handled the same way, we add aliases for those too
 *  Most keys return a keystroke in which case we use break.
 *  If we do not want a keystroke then use return
 */
function editTF (key) {
  let chr // The character that the editTF escape creates

  switch (key) {
    case '8' : // intentional fall through. Alpha black
      // zxnet
    case '0' : // intentional fall through Alpha black
    case 'k' :
      chr = '\x00'
      break // alpha black
    case '1' : // intentional fall through
      // zxnet
    case 'r' :
      chr = '\x01'
      break // alpha 5c
    case '2' : // intentional fall through
      // zxnet
    case 'g' :
      chr = '\x02'
      break // alpha green
    case '3' : // intentional fall through
      // zxnet
    case 'y' :
      chr = '\x03'
      break // alpha yellow
    case '4' : // intentional fall through
      // zxnet
    case 'b' :
      chr = '\x04'
      break // alpha blue
    case '5' : // intentional fall through
      // zxnet
    case 'm' :
      chr = '\x05'
      break // alpha magenta
    case '6' : // intentional fall through
      // zxnet
    case 'c' :
      chr = '\x06'
      break // alpha cyan
    case '7' : // intentional fall through
      // zxnet
    case 'w' :
      chr = '\x07'
      break // alpha white

    case 'F' :
      chr = '\x08'
      break // flash on (same as zxnet)
    case 'f' :
      chr = '\x09'
      break // steady (same as zxnet)

      // chr='\x0a';break; // endbox
      // chr='\x0b';break; // startbox

    case 'd' :
      chr = '\x0c'
      break // normal height (same as zxnet)
    case 'D' :
      chr = '\x0d'
      break // double height (same as zxnet)

      // 0x0e SO - SHIFT OUT
      // 0x0f SI - SHIFT IN

    case '*' : // intentional fall through
      // zxnet
    case ')' : // intentional fall through
      // alpha black
    case 'K' :
      chr = '\x10'
      break // graphics black
    case '!' : // intentional fall through
      // zxnet
    case 'R' :
      chr = '\x11'
      break // graphics red
    case '"' : // intentional fall through
      // zxnet
    case 'G' :
      chr = '\x12'
      break // graphics green
    case '£' : // intentional fall through
      // zxnet
    case '#' :
      ; // alternate character
    case 'Y' :
      chr = '\x13'
      break // graphics yellow
    case '$' : // intentional fall through
      // zxnet
    case 'B' :
      chr = '\x14'
      break // graphics blue
    case '%' : // intentional fall through
      // zxnet
    case 'M' :
      chr = '\x15'
      break // graphics magenta
    case '^' : // intentional fall through
      // zxnet
    case 'C' :
      chr = '\x16'
      break // graphics cyan
    case '&' : // intentional fall through
      // zxnet
    case 'W' :
      chr = '\x17'
      break // graphics white

    case 'O' :
      chr = '\x18'
      break // conceal

    case 's' :
      chr = '\x19'
      break // Contiguous graphics
    case 'S' :
      chr = '\x1a'
      break // Separated graphics

    case 'n' :
      chr = '\x1c'
      break // 28 black background (same as zxnet)
    case 'N' :
      chr = '\x1d'
      break // 29: new background (same as zxnet)
    case 'H' :
      chr = '\x1e'
      break // 30: Hold graphics mode (same as zxnet)
    case 'h' :
      chr = '\x1f'
      break // 31 Release hold mode (same as zxnet)

    case 'x' :
      myPage.showGrid = !myPage.showGrid
      return // toggle grid display
      
    // Enter properties mode, for setting page properties like description
    case 'X' :
      if (editMode === CONST.EDITMODE_PROPERTIES) { // This doesn't work
        editMode = CONST.EDITMODE_NORMAL
      }
      else
      {
        editMode = CONST.EDITMODE_PROPERTIES
      }
      myPage.setEditMode(editMode)
      return // no more processing needed

    case 'i' : { // Insert row
      editMode = CONST.EDITMODE_EDIT
      myPage.setEditMode(editMode)

      const y = myPage.cursor.y
      if (y <= 0 || y >= 24) { // Can't insert row on the header or fastext row
        return
      }

      // @TODO All this must be duplicated in keyevents
      for (let r = (23 - 1); r >= y; r--) {
        const row = myPage.getRow(r)
        myPage.setRow(r + 1, row)
        sendRow(r + 1, row)
      }
      // Clear the current row
      myPage.setRow(y, '                                        ')
      sendRow(y, '                                        ')
    }

      return

    case 'I' : // Delete row and shuffle up the rows below @todo Add this command to the cheat sheet
      editMode = CONST.EDITMODE_EDIT
      myPage.setEditMode(editMode)

      {
        const y = myPage.cursor.y
        if (y <= 0 || y >= 24) { // Can't delete header or fastext
          return
        }
        for (let r = y; r < 23; r++) {
          const row = myPage.getRow(r + 1)

          myPage.setRow(r, row)
          sendRow(r, row)
        }
      }

      // Clear the current row
      myPage.setRow(23, '                                        ')
      sendRow(23, '                                        ')

      return

    case 'J' : // block
      chr = '\x7f'
      break

    case 'Z' : { // clear screen // wsfn cpb clear page bug
      // @todo At this point, send a signal to the server
      // Send the page details so we know which page to clear!
      
      // This bit was added as clearPage seems to have a bug in it, but it makes it worse. Race hazard?
      if (false) for (let i=1; i<24; i++) {
        myPage.setRow(i, '                                        ')
        sendRow(i, '                                        ')
      }
      // @todo Add the default header and fastext
      // @todo Put "click here to add description" in the description field
      
      const data = {
        S: myPage.service, // service number
        p: myPage.pageNumber,
        s: myPage.subPage,
        k: ' ',
        x: myPage.cursor.x,
        y: myPage.cursor.y,
        id: gClientID
      }

      socket.emit('clearPage', data)

      editMode = CONST.EDITMODE_EDIT

      return
    }
    
    // Go to page 990 special edit page
    case '?' : { 
      let page = 0x0990
      myPage.setPage(page) // We now have a different page number

      const data = {
        S: myPage.service,
        p: page, // Page mpp
        s: undefined, // subpage doesn't default to 0
        x: 0,
        y: 0,
        rowText: '',
        id: gClientID
      }

      //if (createPage) { // Special case
//        socket.emit('create', data)
      //} else {
        socket.emit('load', data)
      //}
      return
    }
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
      editMode = CONST.EDITMODE_EDIT
      return
  }

  // Construct object to define exactly where this key code will go
  const data = {
    S: myPage.service,
    p: myPage.pageNumber, // Page mpp
    s: myPage.subPage,
    x: myPage.cursor.x,
    y: myPage.cursor.y,
    k: chr
  }

  socket.emit('keystroke', data)

  newChar(data)
  
  // This may need to be at the top of this function?
  // If we have a problem with a vanishing cursor, this would be the problem
  if (editMode === CONST.EDITMODE_INSERT) {
    editMode = CONST.EDITMODE_EDIT
  }  
}

/** Transmit a row of text
 *  Woefully inefficient. Really need to implement whole row transmission
 * \param r : row number
 * \param txt : Row of teletext
 */
function sendRow (r, txt) {
  for (let c = 0; c < txt.length; c++) {
    const data = {
      S: myPage.service,
      p: myPage.pageNumber, // Page mpp
      s: myPage.subPage,
      x: c,
      y: r,
      k: txt[c]
    }

    socket.emit('keystroke', data)
  }
}

function updateScale () {
  // get current viewport size
  const viewportInner = document.body.getBoundingClientRect()

  const windowWidth = viewportInner.width
  const windowHeight = viewportInner.height

  // if pixel density has changed, update canvas pixel density
  let newPixelDensity

  if (display === CONST.DISPLAY_STANDARD) {
    newPixelDensity = parseFloat(scale)
  } else if ([CONST.DISPLAY_FITSCREEN, CONST.DISPLAY_FULLSCREEN].includes(display)) {
    // round to 2 decimal places
    newPixelDensity = (
      Math.round(
        Math.min(
          (windowHeight / CONFIG[CONST.CONFIG.CANVAS_HEIGHT]),
          (windowWidth / CONFIG[CONST.CONFIG.CANVAS_WIDTH])
        ) * 100
      ) / 100
    )
  }

  if (newPixelDensity !== currentPixelDensity) {
    pixelDensity(
      newPixelDensity
    )

    canvasElement.removeAttribute('style')

    currentPixelDensity = newPixelDensity
  }
}

function windowResized () {
  updateScale()
}

function toggleMenu () {
  event.preventDefault()
  // toggle menu state
  menuOpen = !menuOpen

  // update custom attribute on body element
  document.body.setAttribute(CONST.ATTR_DATA_MENU_OPEN, menuOpen)
}

function changePage (pageNumber) {
  const pageNumberHex = parseInt(pageNumber, 16)

  myPage.setPage(pageNumberHex)

  const data = {
    S: myPage.service,
    p: pageNumberHex,
    s: 0,
    y: 0,
    rowText: '',
    id: gClientID
  }

  socket.emit('load', data)
}

function selectManifestPage (event) {
  event.preventDefault()

  let target = event.target

  if (target) {
    while (target.tagName !== 'A') {
      target = target.parentNode

      if (target.tagName === 'BODY') {
        break
      }
    }

    // get selected page number
    const pageNumber = target.getAttribute('data-page')

    // change to selected new page number
    changePage(pageNumber)

    // unfocus the clicked DOM link element
    event.target.blur()

    // change the visually-selected item to highlight the new page
    const manifestSelectedItem = manifestModal.querySelector('.manifestContentInner ul li.selected')
    const manifestNewSelectedItem = manifestModal.querySelector(`.manifestContentInner ul li a[data-page="${pageNumber}"]`)

    if (manifestSelectedItem && manifestNewSelectedItem) {
      manifestSelectedItem.className = ''
      manifestNewSelectedItem.parentNode.className = 'selected'
    }
  }

  return false
}

function renderManifestData (data) {
  if (data.pages) {
    // update header lastUpdated timestamp display
    const manifestLastUpdated = manifestModal.querySelector('#lastUpdated')

    if (data.lastUpdated && manifestLastUpdated) {
      const lastUpdatedDate = new Date(data.lastUpdated)
      let displayLastUpdated = ''

      if (Intl && Intl.RelativeTimeFormat) {
        const deltaDays = Math.ceil((lastUpdatedDate.getTime() - Date.now()) / (1000 * 3600 * 24))

        const rtf = new Intl.RelativeTimeFormat(
          'en',
          {
            localeMatcher: 'best fit',
            numeric: 'auto',
            style: 'long'
          }
        )

        displayLastUpdated = rtf.format(deltaDays, 'day')
      } else {
        const lastUpdatedDateDay = lastUpdatedDate.getDate().toString().padStart(2, '0')
        const lastUpdatedDateMonth = (lastUpdatedDate.getMonth() + 1).toString().padStart(2, '0')
        const lastUpdatedDateYear = lastUpdatedDate.getFullYear().toString()

        displayLastUpdated = `${lastUpdatedDateDay}/${lastUpdatedDateMonth}/${lastUpdatedDateYear}`
      }

      manifestLastUpdated.innerText = `@ ${displayLastUpdated}`
      manifestLastUpdated.setAttribute('title', `lastUpdated: ${data.lastUpdated}`)
    }

    // update main modal content...
    const manifestContentInner = manifestModal.querySelector('.manifestContentInner')

    if (manifestContentInner) {
      // clear existing content
      manifestContentInner.innerHTML = ''

      // generate a list from the manifest page items...
      const manifestList = document.createElement('ul')

      const currentPageNumber = hex(myPage.pageNumber, 3)

      for (const i in data.pages) {
        const manifestListItem = document.createElement('li')

        if (data.pages[i].p === currentPageNumber) {
          manifestListItem.className = 'selected'
        }

        const manifestListItemLink = document.createElement('a')

        manifestListItemLink.href = '#'
        manifestListItemLink.setAttribute('data-page', data.pages[i].p)
        manifestListItemLink.onclick = selectManifestPage
        manifestListItemLink.innerHTML = `<dl><dt>p${data.pages[i].p}</dt><dd>${data.pages[i].d ? data.pages[i].d : ''}</dd></dl>`

        manifestListItem.appendChild(manifestListItemLink)
        manifestList.appendChild(manifestListItem)
      }

      manifestContentInner.appendChild(manifestList)
    }
  }
}

function loadManifestData () {
  if (!serviceManifests[service]) {
    fetch(`/manifest.json?service=${service}`)
      .then((response) => response.json())
      .then((data) => {
        serviceManifests[service] = data

        if (data && data.pages) {
          // update custom attribute on body element
          document.body.setAttribute(CONST.ATTR_DATA_SERVICE_MANIFEST, 'true')
        }
      })
  }
}

function toggleManifest () {
  if (manifestModal) {
    manifestModal.classList.toggle('manifest--visible')

    renderManifestData(
      serviceManifests[service]
    )
  }
}

function toggleInstructions () {
  if (instructionsModal) {
    instructionsModal.classList.toggle('instructions--visible')
  }
}

function toggleAbout () {
  if (aboutModal) {
    aboutModal.classList.toggle('about--visible')
  }
}

function reloadService (event) {
  event.preventDefault()

  const params = new URLSearchParams(location.search)
  params.delete('page') // don't carry current page number over when changing service

  window.location.href = `${location.pathname}${params.toString() ? `?${params}` : ''}`

  return false
}

function toggleGrid () {
  if (myPage && (typeof myPage.toggleGrid === 'function')) {
    const newGridState = myPage.toggleGrid()

    // update custom attribute on body element
    document.body.setAttribute(CONST.ATTR_DATA_GRID, newGridState)
  }
}

function exportPage () {
  const grabSelectLinks = document.querySelector('#grabSelectLinks')

  // determine if hiding or showing grab links...
  const isShow = grabSelectLinks.getAttribute('data-visible') === 'false'

  if (isShow) {
    // @todo language
    const cset = 0

    // get page number
    const pg = hex(myPage.pageNumber, 3)

    // edit.tf
    let website = 'http://edit.tf'
    const url = saveToHash(cset, website, myPage)

    // zxnet
    website = 'https://zxnet.co.uk/teletext/editor'
    const url2 = saveToHash(cset, website, myPage)

    // Download the tti page
    const svc = myPage.getService()
    const url3 = `/pages/${svc}/p${pg}${CONST.PAGE_EXT_TTI}`

    // update grab link items text and URL...
    const dynamicLink = document.querySelector('#dynamicLink')

    if (dynamicLink) {
      dynamicLink.href = url
      dynamicLink.innerHTML = 'open P' + pg + '<br/>in edit.tf'
    }

    const dynamicLink2 = document.querySelector('#dynamicLink2')

    if (dynamicLink2) {
      dynamicLink2.href = url2
      dynamicLink2.innerHTML = 'open P' + pg + '<br/>in zxnet'
    }

    const dynamicLink3 = document.querySelector('#dynamicLink3')

    if (dynamicLink3) {
      dynamicLink3.href = url3
      dynamicLink3.innerHTML = `download <br/>P${pg}${CONST.PAGE_EXT_TTI}`
    }

    // show links
    grabSelectLinks.setAttribute('data-visible', 'true')
  } else {
    // hide links
    grabSelectLinks.setAttribute('data-visible', 'false')
  }
}

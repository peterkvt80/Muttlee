// Defines a teletext page
// page class defines a page and subpages.
// row class defines a teletext row.
'use strict'
/* global CONFIG, CONST, LOG */ // Configuration
/* global TTXCURSOR */ // external classes
/* global history, inputPage, line, gTtxW, gTtxH, gridOffsetVertical, ttxFont, ttxFontDH */ // my externals
/* global nf, hour, minute, int, color, stroke, textFont, textSize, noStroke, fill, red, green, blue, stroke, char, text  */ // externals (p5js)

// Timer for flashing cursor and text
"use strict";
let flashState = false
let tickCounter = 0 // For timing carousels (in steps of half a second)

setInterval(toggle, 500)

let allocationCount = 0

function toggle () {
  tickCounter++
  flashState = !flashState
}

/// /////////////////////////////////////////////////////////////////////////////////////////////////////
// Store subpage data other than the displayable rows
class MetaData {
  constructor(displayTiming, x28Packet) {
    this.timer = displayTiming
    this.x28Packet = x28Packet
    /// @todo Add packets 26, 28, 29

    this.mapping = new MAPCHAR(x28Packet.region(), x28Packet.language()) // Character mappings for region and language
  }
  
  setTimer(t) {
    this.timer = t
  }
  
  setLanguage(lang) {
    this.mapping.setLanguage(lang) // Compatibility with non X28 decoders  
    this.x28Packet.setLanguage(lang) // X28 G0G2 default language
  }
  
  setRegion(region) {
    this.mapping.setRegion(region)
    this.x28Packet.setRegion(region) // X28 G0G2 default language
  }
  
  /** Deep copy
   * Everything in the constructor must be deep copied
   */
  static copyMetadata(src, dest) {
    dest.timer = src.timer
    X28Packet.copyX28Packet(src.x28Packet, dest.x28Packet)
    MAPCHAR.copyMapping(src.mapping, dest.mapping) // @TODO These mappings duplicate X28Packet. Have to simplify
  }

}

/// /////////////////////////////////////////////////////////////////////////////////////////////////////

// cache shorthand reference to services data
const servicesData = CONFIG[CONST.CONFIG.SERVICES_AVAILABLE]

window.TTXPAGE = function () {
  // Basic page properties
  this.pageNumber = CONST.PAGE_MIN
  this.subPage = undefined // Integer: The current sub page being shown or edited
  function dummy (myX, myY) { print('[TTXPAGE]Cursor callback test ' + myX + ' ' + myY) }
  this.cursor = new TTXCURSOR()
  this.cursor.setCallback(dummy) // Temporary test
  this.service = undefined
  this.serviceData = {}
  this.locked = false

  // Misc page properties
  this.redLink = 0x900
  this.greenLink = CONST.PAGE_MIN
  this.yellowLink = CONST.PAGE_MIN
  this.cyanLink = CONST.PAGE_MIN
  this.spareLink = 0x8ff
  this.indexLink = CONST.PAGE_MIN
  this.editMode = CONST.EDITMODE_NORMAL
  this.description = ''
  this.showGrid = false
  this.subPageZeroBase = false
  this.editProperties = new TTXPROPERTIES() // Just in case we are going to edit the properties later


  // this.timer=7 // This is global. Replaced by a per page timer

  // subPageList contains the pages of rows. metadata contains other data like timing.
  // if subPageList is modified, then metadata must be done at the same time
  this.metadata = [] // Metadata contains other things that a subpage needs, such as the timer and language selection
  this.subPageList = [] // Subpage just contains rows.

  this.pageNumberEntry = '100' // Page number as entered (used to allow partial page numbers)

  this.revealMode = false
  this.holdMode = false

  // @todo check range
  this.init = function (number, service) {
    this.pageNumber = number

    this.service = service
    this.serviceData = servicesData[service]

    this.addPage(number)
  }

  // locked
  this.setLocked = function (value) {
    this.locked = value
  }

  this.isLocked = function () {
    return this.locked
  }

  // edit mode
  this.setEditMode = function (mode) {
    if (mode === CONST.EDITMODE_PROPERTIES) {
      // If we are switching to properties mode
      if (this.editMode !== CONST.EDITMODE_PROPERTIES) {
        // create the properties object if it doesn't exist
        if (this.editProperties === undefined) {
          this.editProperties = new TTXPROPERTIES()
        }
        // Hook up the cursor callback so we can edit the properties
        this.cursor.setCallback(this.editProperties.getCursorCallback())
        // populate with data from the current subpage // @wsfn clrt3
        this.editProperties.doInits(this.pageNumber, this.description, this.metadata[this.subPage], this.cursor,
          this.redLink, this.greenLink, this.yellowLink, this.cyanLink, this.spareLink, this.indexLink)
      }
    }
    if (mode < CONST.EDITMODE_MAX) {
      this.editMode = mode
      this.cursor.hide = (mode === CONST.EDITMODE_NORMAL) || (mode === CONST.EDITMODE_PROPERTIES)
    }
  }

  this.getEditMode = function () {
    return this.editMode
  }

  this.getServiceHeader = function () {
    const headerTitle = this.serviceData.headerTitle
      ? this.serviceData.headerTitle
      : CONFIG[CONST.CONFIG.HEADER_TITLE].toUpperCase()

    // allow a custom header title (as defined in config.js)
    const titleStr = headerTitle.padStart(10, ' ')

    return `Pnn ${titleStr} mpp DAY dd MTH  hh:nn.ss`
  }

  this.toggleReveal = function () {
    this.revealMode = !this.revealMode
  }

  this.toggleHold = function () {
    this.holdMode = !this.holdMode
  }

  this.toggleGrid = function () {
    this.showGrid = !this.showGrid

    return this.showGrid
  }

  /** @brief Change the page number for this page and all child rows
   *  Clear the page. We should get a number of rows soon
   */
  this.setPage = function (p) {
    tickCounter = 1

    this.holdMode = false // Don't inherit hold mode from the last page
    this.subPage = undefined // This should be set soon
    this.pageNumber = p /// @todo Convert this to do all sub pages
    this.pageNumberEntry = p.toString(16)

    /// ////// DEVELOPMENT START
    // What may be the problem is that we need to clear subPageList first
    // or we get rows left behind out of reach of the garbage collector
    // Clear all the old rows of the subPage.
    // This doesn't have a noticeable effect
    for (let page of this.subPageList) {
    /* Suspect that this does nothing
      for (let row of page) {
        row=null
      }
      */
      page = []
    }
    console.log('subpages = ' + this.subPageList)
    /// ////// DEVELOPMENT END
    this.subPageZeroBase = false

    this.subPageList = [] // [!] todo Possibly run through the subpages and remove their rows
    // this.clut.resetTable()

    this.addPage(this.pageNumber)

    // update the URL with the current page (without reloading the page)
    if (history.pushState) {
      const loc = window.location
      const searchParams = new URLSearchParams(loc.search)
      searchParams.set('page', this.pageNumberEntry)

      const newUrl = `${loc.protocol}//${loc.host}${loc.pathname}?${searchParams.toString()}`

      window.history.pushState({ path: newUrl }, '', newUrl)
    }

    // keep page number input field synced with the current page number
    if (inputPage && inputPage.elt) {
      if (!/[A-F]+/i.test(this.pageNumberEntry)) {
        inputPage.elt.value = this.pageNumberEntry
      }
    }
  }

  this.setService = function (S) {
    this.service = S
    this.serviceData = servicesData[S]
  }

  this.getService = function () {
    let svc = String(this.service)

    if (!svc) {
      svc = CONFIG[CONST.CONFIG.DEFAULT_SERVICE]
    }

    return svc
  }

  /** @brief Add a page to the sub page list
   * @todo This should INSERT, not APPEND a subpage
   */
  this.addPage = function (number) {
    // clear out data from previous page
    if (this.rows !== undefined) {
    /* Suspect that this doesn't work
      for (let row of this.rows) {
        row = null
      }
      */
    }
    this.rows = []

    const clut = new X28Packet()
    let metadata = new MetaData(7, clut)
    this.metadata.push(metadata)

    // As rows go from 0 to 31 and pages start at 100, we can use the same parameter for both
    this.rows.push(
      new Row(this, number, 0, this.getServiceHeader(), metadata)
    )

    for (let i = 1; i < 26; i++) {
      this.rows.push(
        new Row(this, number, i, ''.padStart(CONFIG[CONST.CONFIG.NUM_COLUMNS]), metadata)
      )
    }
    
    // @todo Copy the Fastext and header from another subpage.
    
    this.subPageList.push(this.rows)
  }
  

  /** Remove a subpage
   *  Splices out the subpage and its associated metadata
   *  @todo Check that the change is saved. [Dear Reader, it isn't yet]
   *  @return true if success, false if failed
   */
  this.removePage = function() {
    // Can't delete the last subpage
    if (this.subPageList.length < 2) {
      return false
    }
    
    // What subpage are we deleting?
    print('[ttxpage::removePage] enters. subpage = ' + this.subPage + ' subPageList.length = ' + this.subPageList.length)
    // Splice out the metadata
    let deletedMetadata = this.metadata.splice(this.subPage, 1)
    // Splice out the current sub page from the list
    let deletedSubpage = this.subPageList.splice(this.subPage, 1)
    // Set the current page to the previous subpage
    if (this.subPage > 0) {
      this.subPage--
    }
    this.setSubPage(this.subPage)
    return true // We got here, so success
  }  

  /**
   * @param s Subpage number. All subsequent row/char updates go to this subpage.
   */
  this.setSubPage = function (s) {
    // [!] @todo If there is an 'undefined' subpage, then replace it with this subpage.
    s = parseInt(s)
    console.log('Setting sub page = ' + s) // wsfn
    // [!] Some carousels start at 1, not 0. We should cope with that
    if ((s < 0) || (s > 79) || (s === undefined)) {
      s = 0 // Single page
    }
    // @todo Check that s is in a subpage that exists and add it if needed.
    if (this.subPageList.length <= s) {
      if (this.subPageList.length >= (s - 1)) {
        // requested subpage is in bounds, add it to subpage list
        this.addPage(this.pageNumber)
      } else {
        // requested subpage is out of bounds, reset it to 0
        // (fixes Teefax p630 having invalid PN,63030 = subpage 30, but no actual subpages defined)
        s = 0
      }
    }
    this.subPage = s
  }

  /** @brief Set row r to txt
   * Note that this is the page level setrow.
   */
  this.setRow = function (r, txt) {
    if ((r >= 0) && (r <= 24)) {
      // don't allow subpage to be less than 0
      if (this.subPage < 0 || this.subPage === undefined) {
        this.subPage = 0
      }

      const v = this.subPageList[this.subPage]
      if (v === undefined) {
        LOG.fn(
          ['ttxpage', 'setRow'],
          'oh noes. v is undefined',
          LOG.LOG_LEVEL_ERROR
        )
      } else {
        v[r].setrow(txt)
      }
    }
  }

  // Return the text of row r on the current subpage
  this.getRow = function (r) {
    if ((r >= 0) && (r <= 24)) {
      // don't allow subpage to be less than 0
      if (this.subPage < 0 || this.subPage === undefined) {
        this.subPage = 0
      }

      const v = this.subPageList[this.subPage]
      if (v === undefined) {
        LOG.fn(
          ['ttxpage', 'setRow'],
          'where is our subpage, dammit?',
          LOG.LOG_LEVEL_ERROR
        )

        return '                                       '
      }

      return v[r].txt
    } else {
      return '                                        '
    }
  }

  // Helpers for navigating subpages
  this.nextSubpage = function () {
    // Cycle from 1 to n, or possibly from 0 to n-1
    // Find out which way the carousel is numbered
    if (this.subPageZeroBase) {
      this.subPage = ((this.subPage + 1) % (this.subPageList.length)) // 0..n-1
    } else {
      this.subPage = 1 + (this.subPage % (this.subPageList.length - 1)) // 1..n
    }
  }

  this.prevSubpage = function () {
    // subPage starts from 0?
    if (this.subPageZeroBase) {
      if (this.subPage > 0) {
        this.subPage--
      } else {
        this.subPage = this.subPageList.length - 1 // wrap
      }
    } else {
      if (this.subPage > 1) {
        this.subPage--
      } else {
        this.subPage = this.subPageList.length // wrap
      }
    }
  }

  /** 
   * @brief Add subpage
   * Add a subpage to the subpage list.
   * @todo Need to INSERT after the current subpage, not to the end of the list
   */
  this.addSubPage = function () {
    this.addPage(this.pageNumber)
    this.setSubPage(this.subPageList.length - 1)
  }

  /** Remove page - delete the current subpage
   *  @return true if it succeeded
   */
  this.removeSubPage = function () {
    // Remove subpage
    LOG.fn(
      ['ttxpage', 'removeSubPage'],
      'Local remove subpage.',
      LOG.LOG_LEVEL_ERROR
    )
    return this.removePage() // Use this value to check if the server also needs to be updated
  }

  this.draw = function (changed) {
    // Properties are special local pages
    if (this.getEditMode() === CONST.EDITMODE_PROPERTIES) {
      this.editProperties.draw()
      return
    }

    // Sometimes the carousel isn't ready
    if (typeof this.subPage === 'undefined') {
      return
    }

    let carouselReady = (typeof this.subPage !== 'undefined')

    if (carouselReady) {
      carouselReady = (typeof this.metadata[this.subPage] !== 'undefined')
    }

    if (!(this.holdMode || this.getEditMode() !== CONST.EDITMODE_NORMAL) && carouselReady) { // Only cycle if we are not in hold mode or edit
      // carousel timing
      if (tickCounter % ((1 + Math.round(this.metadata[this.subPage].timer)) * 2) === 0) { // Times 2 because the tick is 2Hz.
        this.nextSubpage()

        LOG.fn(
          ['ttxpage', 'draw'],
          `Drawing subpage ${this.subPage}`,
          LOG.LOG_LEVEL_VERBOSE
        )

        tickCounter = 1 // Prevent a cascade of page changes!
      }
    }

    for (let rw = 0; rw < this.rows.length; rw++) {
      let cpos = -1
      if (this.getEditMode() === CONST.EDITMODE_EDIT && rw === this.cursor.y) {
        // If in edit mode and it is the correct row...
        cpos = this.cursor.x
      }

      // Single pages tend to have subpage 0000, carousels start from 0001
      if (this.subPage >= this.subPageList.length) { // This shouldn't happen much but it does during start up
        this.subPage = (this.subPageList.length - 1)
      }

      // don't allow subpage to be less than 0
      if (this.subPage < 0) {
        this.subPage = 0
      }

      let v = this.subPageList[this.subPage]

      if (v === undefined) {
        LOG.fn(
          ['ttxpage', 'draw'],
          'v is undefined',
          LOG.LOG_LEVEL_INFO
        )

        // can we fix it?
        v = this.subPageList[0]

        if (v !== undefined) {
          // Move to a subpage that exists
          this.subPage = 0
        }
      }

      if (v !== undefined && v.length > 0) {
        if (rw === 0 && v.length > 0) {
          // Set the page number for the header only
          v[0].setpagetext(this.pageNumberEntry)
        }

        const str = changed.rows[rw]

        if (v[rw].draw(cpos, this.revealMode, this.holdMode, this.getEditMode(), this.subPage, str)) {
          rw++ // If double height, skip the next row
        }
      }
    }

    if (this.showGrid) {
      this.drawGrid()
    }
  }

  /** Draw a character grid overlay for edit guidance
   */
  this.drawGrid = function () {
    stroke(128)

    // draw column separation lines
    for (let x = 0; x <= CONFIG[CONST.CONFIG.NUM_COLUMNS]; x++) {
      line(
        (gTtxW * x),
        0 + gridOffsetVertical,
        (gTtxW * x),
        (gTtxH * CONFIG[CONST.CONFIG.NUM_ROWS]) + gridOffsetVertical
      )
    }

    // draw row separation lines
    for (let y = 0; y <= CONFIG[CONST.CONFIG.NUM_ROWS]; y++) {
      line(
        0,
        (gTtxH * y) + gridOffsetVertical,
        (gTtxW * CONFIG[CONST.CONFIG.NUM_COLUMNS]),
        (gTtxH * y) + gridOffsetVertical
      )
    }
  }

  //  Draw ch at (x,y) on subpage s
  this.drawchar = function (ch, x, y, s) {
    if ( y > 24 || typeof ch==='undefined') {
      return
    }
    // Select the subpage to update
    const v = this.subPageList[s]

    if (v === undefined) {
      LOG.fn(
        ['ttxpage', 'drawchar'],
        'Cannot draw on a subpage that doesn\'t exist :-(',
        LOG.LOG_LEVEL_INFO
      )
    } else {
      v[y].setchar(ch, x)
    }
  }

  /** home
   * Move to the start of the line or the start of text
   */
  this.home = function () {
    let col
    const page = this.subPageList[this.subPage]
    const row = page[this.cursor.y].txt

    // Find the first printable character
    for (col = 0; col < 39; col++) {
      if (row.charAt(col) > ' ') {
        break
      }
    }

    // Did we find a non blank?
    if (col < 39) { // Yes. We found the new position
      if (this.cursor.x !== col) {
        this.cursor.x = col // If we aren't there already, then go there
      } else {
        this.cursor.x = 0 // otherwise go back to the start of the row
      }
    } else { // No. Skip to the start of the line
      this.cursor.x = 0
    }
  }

  this.end = function () {
    const page = this.subPageList[this.subPage]
    const row = page[this.cursor.y].txt
    let x

    // Find the last non blank character
    for (x = 39; x > 0; x--) {
      if (row.charAt(x) !== ' ') {
        break
      }
    }

    // Did we find a non blank character?
    if (x > 0) {
      // Is it before the right hand side?
      if (x < 38) {
        if (this.cursor.x === x + 1) { // Already there?
          this.cursor.x = 39
        } else {
          this.cursor.x = x + 1 // Advance to the blank space
        }
      } else {
        this.cursor.x = 39 // Clip, because we can't advance
      }
    } else { // Another edge case, If the line is entirely blank, move to the right edge
      this.cursor.x = 39
    }
  }

  // Insert a space at the current cursor location (TAB command)
  // WARNING: This is not handled by other clients. Will need some thinking how to do it properly
  // Maybe broadcast the entire row when we are done?
  this.insertSpace = function () {
    const pg = this.subPageList[this.subPage]

    if (pg !== undefined) {
      const x = this.cursor.x
      const y = this.cursor.y

      let str = pg[y].txt
      str = str.substr(0, x) + ' ' + str.substr(x)

      // might want to trim back to CONFIG[CONST.CONFIG.NUM_COLUMNS] chars?
      pg[y].setrow(str)
    }
  }

  // Backspace. Delete current character, move remainder of line one character left
  // Pad with a space at the end. Also update the cursor position.
  // @todo Work out how this edit will get back to the server
  this.backSpace = function () {
    const pg = this.subPageList[this.subPage]

    if (pg !== undefined) {
      const x = this.cursor.x
      const y = this.cursor.y

      this.cursor.left()

      let str = pg[y].txt
      str = str.substr(0, x - 1) + str.substr(x, CONFIG[CONST.CONFIG.NUM_COLUMNS] - x) + ' '

      pg[y].setrow(str)
    }
  }

  /**
   * @brief Clear all rows to blank spaces
   */
  this.setBlank = function () {
    for (let page of this.subPageList) {
    /*
      for (let row of page) {
        row = null
      }
      */
      page = []
    }
    this.subPageList = []
    this.metadata = []

    this.addPage(this.pageNumber)
    this.subPageZeroBase = false
  }

  /**
   * \return true if the character at the location (data.x, data.y) is a graphics character
   * \param data : {p: page x: column y: row s: subpage S: service
   */
  this.IsGraphics = function (data) {
    let gfxMode = false

    if (data === undefined) {
      return gfxMode
    }

    const subpage = data.s
    if (subpage !== this.subPage) {
      // Need to access the subpage data.s rather than the local
      // However things will get complicated.
      // Consider another client sending a keystroke.
      LOG.fn(
        ['ttxpage', 'IsGraphics'],
        'subPage does not match. Need think about what to do',
        LOG.LOG_LEVEL_INFO
      )

      return gfxMode
    }

    const myPage = this.subPageList[data.s]
    let row
    if (data.y < 25) {
      row = myPage[data.y].txt
    }

    if (typeof row === 'undefined' || row === null) {
      return gfxMode
    }

    let len = data.x
    if (len > CONFIG[CONST.CONFIG.NUM_COLUMNS]) {
      len = CONFIG[CONST.CONFIG.NUM_COLUMNS]
    }

    for (let i = 0; i < len; i++) {
      const ch = row.charCodeAt(i) & 0x7f
      if (ch < 0x08) {
        gfxMode = false
      }
      if (ch >= 0x10 && ch < 0x18) {
        gfxMode = true
      }
    }

    return gfxMode
  }

  /** \return the character at location given in data.x and data.y */
  this.getChar = function (data) {
    if (data === undefined) {
      return 0
    }

    const subpage = data.s
    if (subpage !== this.subPage) {
      return false // @todo
    }

    const myPage = this.subPageList[data.s]
    const row = myPage[data.y].txt

    const ch = row.charCodeAt(data.x) & 0x7f

    LOG.fn(
      ['ttxpage', 'getChar'],
      `row=${row}, ch=${ch}`,
      LOG.LOG_LEVEL_VERBOSE
    )

    return ch
  } // getChar

  /** handlePropertiesKey - keystroke on the properties page
   */
  this.handlePropertiesKey = function (key) {
    if (this.editProperties !== undefined) {
      this.editProperties.handleKeyPress(key)
    }
  }
} // Window.TTXPage class

/** \return true if while in graphics mode it is a graphics character */
function isMosaic (ch) {
  ch = ch.charCodeAt(0) & 0x7f

  return (ch >= 0x20 && ch < 0x40) || ch >= 0x60
}

/// ////////////////////////////////////////////////////////////////////////////////////////////

/** Row - Defines the storage and rendering of a teletext row
 *  @param ttxpage - context of the parent page (this)
 *  @param page - page number as a hex value. Used for mpp
 *  @param y - Row number 0..24 Higher row numbers are not handled here
 *  @param str - Text to initialise this row
 *  @param metadata - A metadata object with colour, timing, language etc
 */
function Row (ttxpage, page, y, str, metadata) {
  this.ttxpage = ttxpage

  this.page = page
  this.row = y
  this.txt = str
  this.pagetext = 'xxx'
  this.metadata = metadata

  this.setchar = function (ch, n) {
    // Out of range?
    if (n < 0 || n > 40) {
      return
    }
    // Pad with spaces to 40 characters if needed
    if (this.txt.length < 40) {
      this.txt = this.txt + '                                        '
      this.txt = this.txt.substring(0, 40)
    }
    this.txt = setCharAt(this.txt, n, ch)
  }

  this.setrow = function (txt) {
    // @todo Pad with spaces if needed
    if (txt.length < 40) {
      txt = txt + '                                        '
      this.txt = txt.substring(0, 40)
    }
    this.txt = txt
  }

  /** Expect a three digit page number, or partial page number */
  this.setpagetext = function (txt) {
    this.pagetext = txt
  }

  /** @param cpos is the cursor column position to highlight
   *  @param if revealMode is true overrides conceal
   * @return True if there was a double height code in this row
   */
  this.draw = function (cpos, revealMode, holdMode, editMode, subPage, changed) {
    let txt = this.txt // Copy the row text because a header row will modify it

    // Special treatment for row 0
    if (this.row === 0) {
      if ((cpos < 8) && (editMode === CONST.EDITMODE_NORMAL)) {
        // force render service header (overriding page header)?
        if (this.ttxpage.serviceData.forceServiceHeader) {
          txt = this.ttxpage.getServiceHeader()
        }

        // This is the header row and we are NOT editing
        let leftSpacing = 4

        // substitute TEEFAX service title in header?
        let originalTitle = 'Teefax'.toUpperCase()
        const newTitle = CONFIG[CONST.CONFIG.HEADER_TITLE].toUpperCase()

        if (originalTitle !== newTitle) {
          leftSpacing = leftSpacing - (newTitle.length - originalTitle.length)

          if (txt.indexOf(originalTitle) !== -1) {
            if (newTitle.length > originalTitle.length) {
              originalTitle = ''.padStart(newTitle.length - originalTitle.length, 'X') + originalTitle
            }

            txt = txt.replace(originalTitle, newTitle)
          }

          if (txt.indexOf(originalTitle.toLowerCase() + ' ') !== -1) {
            txt = txt.replace(originalTitle.toLowerCase(), CONFIG[CONST.CONFIG.HEADER_TITLE].toLowerCase())
          }
        }

        if (holdMode) {
          // write HOLD at start of line
          txt = replace(txt, 'HOLD' + ''.padStart(leftSpacing, ' '), 0)
        } else {
          // replace any lingering X characters in the first 8 line characters with blank space characters
          txt = txt.substr(0, 8).replace(/X/g, ' ') + txt.substr(8)

          // write page number at start of line
          txt = replace(txt, 'P' + this.pagetext + ''.padStart(leftSpacing, ' '), 0)
        }

        // Substitute mpp for the page number
        let ix = txt.indexOf('%%#')
        if (ix < 0) {
          ix = txt.indexOf('mpp')
        }
        if (ix > 0) {
          txt = replace(txt, this.page.toString(16), ix)
        }

        // determine the seconds separator to display
        const secondsSeparator = this.ttxpage.serviceData.secondsSeparator || '.'

        // put the current date / time into the header
        const currentDateObj = new Date()

        // Substitute dd for the day 1..31 (or %d)
        ix = txt.indexOf('%d')
        if (ix < 0) {
          ix = txt.indexOf('dd')
        }
        if (ix > 0) {
          txt = replace(txt, currentDateObj.getDate().toString().padStart(2, '0'), ix)
        }

        // Substitute DAY for the three letter abbreviated day
        ix = txt.indexOf('%%a')
        if (ix < 0) {
          ix = txt.indexOf('DAY')
        }
        if (ix > 0) {
          const week = new Date().getDay()
          const str = 'MonTueWedThuFriSatSun'.substr((week - 1) * 3, 3)
          txt = replace(txt, str, ix)
        }

        // Substitute MTH for the three letter abbreviated month
        ix = txt.indexOf('%%b')

        if (ix < 0) {
          ix = txt.indexOf('MTH')
        }
        if (ix > 0) {
          const str = 'JanFebMarAprMayJunJulAugSepOctNovDec'.substr((currentDateObj.getMonth() * 3), 3)
          txt = replace(txt, str, ix)
        }

        // Substitute %m for two digit month
        ix = txt.indexOf('%m')
        if (ix > 0) {
          txt = replace(txt, (currentDateObj.getMonth() + 1).toString().padStart(2, '0'), ix)
        }

        // Substitute %y for two digit year
        ix = txt.indexOf('%y')

        if (ix > 0) {
          const y = (currentDateObj.getFullYear() % 100).toString().padStart(2, '0')
          txt = replace(txt, y, ix)
        }

        // Substitute hh for the two digit hour
        ix = txt.indexOf('%H')
        if (ix < 0) {
          ix = txt.indexOf('hh')
        }
        if (ix > 0) {
          txt = replace(txt, currentDateObj.getHours().toString().padStart(2, '0'), ix)
        }

        // Substitute nn for the two digit minutes
        ix = txt.indexOf('%M')
        if (ix < 0) {
          ix = txt.indexOf('nn')
        }

        if (ix > 0) {
          txt = replace(txt, currentDateObj.getMinutes().toString().padStart(2, '0'), ix)
        }

        // Substitute ss for the two digit seconds
        ix = txt.indexOf('%S')
        if (ix < 0) {
          ix = txt.indexOf('ss')
        }
        if (ix > 0) {
          txt = replace(
            txt,
            `${secondsSeparator}${currentDateObj.getSeconds().toString().padStart(2, '0')}`,
            (ix - 1)
          )
        }
      } else {
        // If editing, then show the page/row number
        // txt=replace(txt,'E'+this.pagetext+'    ',0)
        // Show the page/subpage being edited
        let highlight = '\x03' // Edit mode is yellow
        if (editMode === CONST.EDITMODE_ESCAPE) {
          highlight = '\x02' // Escape mode is green
        }

        txt = replace(txt, highlight + this.pagetext + '.' + nf(subPage, 2) + '\x07', 0) // Show the page/subpage being edited
      }
    }

    // Non header substitutions
    if (this.row > 0 && this.row < CONFIG[CONST.CONFIG.NUM_ROWS] && cpos < 0) { // This is NOT the header row NOR in edit mode.
      // World time. (two values allowed per line)
      for (let i = 0; i < 2; i++) {
        const ix = txt.indexOf('%t')
        if (ix > 0) {
          // Read the half hour offsets
          const offset = txt.substring(ix + 2, ix + 5)

          // add the offset to the time
          // show the HH:MM
          const h = (hour() + int(parseInt(offset) / 2)) % 24
          let m = minute()
          if ((parseInt(offset) % 2) === 1) {
            m = (m + offset * 30) % 60
          }

          txt = replace(txt, `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`, ix)
        }
      }
    }

    // Set up all the display mode initial defaults
    let fgColor = 7 // color(255, 255, 255) // Foreground defaults to white
    let bgColor = 0 // color(0) // Background starts black
    let textmode = true // If false it is graphics mode
    let contiguous = true // if false it is separated graphics
    let concealed = false
    let holdGfx = false
    let holdChar = ' '
    let flashMode = false
    let dblHeight = false

    textFont(ttxFont)
    textSize(CONFIG[CONST.CONFIG.TELETEXT_FONT_SIZE])

    // If there is a double height anywhere on this row, the next row must be skipped.
    // Edge case: Any single height character in this row will copy the background (and only the background) to the row below.
    let hasDblHeight = false

    if (txt !== '') {
      for (let i = 0; i < CONFIG[CONST.CONFIG.NUM_COLUMNS]; i++) {
        const ic = txt.charCodeAt(i) & 0x7f

        if (ic === 0x0d) {
          hasDblHeight = true
          break
        }
      }
    }

    for (let i = 0; i < CONFIG[CONST.CONFIG.NUM_COLUMNS]; i++) {
      let ch = txt.charAt(i)

      const ic = txt.charCodeAt(i) & 0x7f
      let printable = false

      // Do the set-before codes
      switch (ic) {
        case 0: // 0: black. Level 1 purists need not apply
        case 1: // 1:red
        case 2: // 2:green
        case 3: // 3:yellow
        case 4: // 4:blue
        case 5: // 5:magenta
        case 6: // 6:cyan
        case 7: // 7:white
          holdGfx = false
          concealed = false
          break
        case 8: // 8:flash
          flashMode = true
          break
        case 9: // 9:steady
          flashMode = false
          break
        case 10: // 10:endbox
          break
        case 11: // 11:startbox
          break
        case 12: // 12:normalheight SetAt
          dblHeight = false
          textFont(ttxFont)
          textSize(CONFIG[CONST.CONFIG.TELETEXT_FONT_SIZE])
          break
        case 13: // 13:doubleheight SetAfter
          break
        case 16: // intentional fall through
          // 16: Farrimond gfxblack
        case 17:
          // 17: gfxred
        case 18:
          // 18: gfxgreen
        case 19:
          // 19: gfxyellow
        case 20:
          // 20: gfxblue
        case 21:
          // 21: gfxmagenta
        case 22:
          // 22: gfxcyan
        case 23:
          // 23: gfxwhite
          concealed = false
          break
        case 24: // 24: conceal. (SetAt)
          if (!revealMode) concealed = true
          break
        case 25: // 25: Contiguous graphics
          contiguous = true
          break
        case 26: // 26: Separated graphics
          contiguous = false
          break
        case 28: // 28 black background
          bgColor = 0 // color(0)
          break
        case 29: // 29: new background
          bgColor = fgColor
          break
        case 30: // 30: Hold graphics mode (set at)
          holdGfx = true
          printable = true // Because this will be replaced
          break
        case 31: // 31 Release hold mode (set after)
          break
        case 32: // Space is not printable but it is still a mosaic. Intentional fall through
        default:
          if (isMosaic(ch)) {
            holdChar = ic
          }

          printable = true
      }

      // Mosaic hold is always printable
      if (!textmode && holdGfx) {
        printable = true
      }

      // Paint the background colour always
      noStroke()
      let myColour = this.metadata.x28Packet.remapColourTable(bgColor, false)
      if (this.row === 0) { // 9.4.2.2 Don't remap row 0
        myColour = this.metadata.x28Packet.clut0[bgColor]
      }
      fill(myColour) // @todo work out which clut we are using

      // except if this is the cursor position
      if (cpos === i && flashState) {
        // Flash the orange cursor
        fill(255, 100, 0) // However, this is hidden when all sixels are set. @todo
      }

      if (this.row < 23) {
        // edge case: a single height character on a double height row has double height background
        this.drawchar(String.fromCharCode(0xe6df), i, this.row + 1, false)
      }

      this.drawchar(String.fromCharCode(0xe6df), i, this.row, dblHeight)

      if (printable && (flashState || !flashMode) && !concealed) {
        let myColour = this.metadata.x28Packet.remapColourTable(fgColor, true)
        if (this.row === 0) { // Don't remap row 0
          myColour = this.metadata.x28Packet.clut0[fgColor]
        }
        fill(myColour) // Normal

        if (textmode || (ch.charCodeAt(0) >= 0x40 && ch.charCodeAt(0) < 0x60)) {
          ch = this.metadata.mapping.map(ch)
          // If cpos is negative, we can't be editing anything
          if (changed[i] && cpos >= 0) {
            fill(200, 100, 0) // If the text has been edited then make it orange until the server replies that it has been saved
          }

          this.drawchar(ch, i, this.row, dblHeight)
        } else { // mosaics
          let ic2 = ic
          if (holdGfx) {
            ic2 = holdChar // hold char replaces
          }

          if (cpos === i && flashState) {
            const r = red(fgColor) // @todo Probably needs some work after adding clut
            const g = green(fgColor)
            const b = blue(fgColor)

            fill(color(255 - r, 255 - g, 255 - b))
          }

          if (contiguous) {
            let foregroundColour = this.metadata.x28Packet.remapColourTable(fgColor, true)
            if (this.row === 0) { // 9.4.2.2 Don't remap the header colours
              foregroundColour = this.metadata.x28Packet.clut0[fgColor]
            }
            stroke(foregroundColour)
            this.drawchar(String.fromCharCode(ic2 + 0x0e680 - 0x20), i, this.row, dblHeight)
          } else {
            this.drawchar(String.fromCharCode(ic2 + 0x0e680), i, this.row, dblHeight)
          }
        }
      }

      // Set-After codes go here
      switch (ic) {
        case 0: // 0: black. Only for level 1 rebels.
          fgColor = 0 // color(0)
          textmode = true
          break
        case 1: // 1:red
          fgColor = 1 // color(255, 0, 0)
          textmode = true
          break
        case 2: // 2:green
          fgColor = 2 // color(0, 255, 0)
          textmode = true
          break
        case 3: // 3:yellow
          fgColor = 3 // color(255, 255, 0)
          textmode = true
          break
        case 4: // 4:blue
          fgColor = 4 // color(0, 0, 255)
          textmode = true
          break
        case 5: // 5:magenta
          fgColor = 5 // color(255, 0, 255)
          textmode = true
          break
        case 6: // 6:cyan
          fgColor = 6 // color(0, 255, 255)
          textmode = true
          break
        case 7: // 7:white
          fgColor = 7 // color(255, 255, 255)
          textmode = true
          break
        case 13: // 13: double height
          dblHeight = true
          hasDblHeight = true
          textFont(ttxFontDH)
          textSize(CONFIG[CONST.CONFIG.TELETEXT_FONT_SIZE] * 2)
          break
        case 16: // 16: Farrimond gfxblack
          fgColor = 0 // color(0)
          textmode = false
          break
        case 17: // 17:gfxred
          fgColor = 1 // color(255, 0, 0)
          textmode = false
          break
        case 18: // 18:gfxgreen
          fgColor = 2 // color(0, 255, 0)
          textmode = false
          break
        case 19: // 19:gfxyellow
          fgColor = 3 // color(255, 255, 0)
          textmode = false
          break
        case 20: // 20:gfxblue
          fgColor = 4 // color(0, 0, 255)
          textmode = false
          break
        case 21: // 21:gfxmagenta
          fgColor = 5 // color(255, 0, 255)
          textmode = false
          break
        case 22: // 22:gfxcyan
          fgColor = 6 // color(0, 255, 255)
          textmode = false
          break
        case 23: // 23:gfxwhite
          fgColor = 7 // color(255, 255, 255)
          textmode = false
          break
        case 24: // 24:conceal
          break
        case 31: // 31 Release hold mode (set after)
          holdGfx = false
          break
      }
    }

    if (this.row < 1 || this.row > 22) {
      // Can't double height header or last row.

    } else {
      return hasDblHeight
    }
  }

  this.drawchar = function (ch, x, y, dblH) {
    text(ch, x * gTtxW, (y + 1 + (dblH ? 1 : 0)) * gTtxH)
  }

} // Row class

/// ///////////////////////////////////////////////////////////////////////////////////////////////////////////

function setCharAt (str, index, chr) {
  if (index > str.length - 1) return str
  return str.substr(0, index) + chr + str.substr(index + 1)
}

/// @brief replace the characters in str at index with those in str2
function replace (str, str2, index) {
  // Chop the old string and add the inserted string
  let newStr = (str.substring(0, index) + str2)
  // Is the resulting string longer?
  if (newStr.length > str.length) {
    newStr.substring(0, str.length)  // Chop and return an identical length string
  }
  
  // Truncate the new string if it doesn't fit
  const len = str2.length
  if (index + str2.length > str.length) {
    newStr.substring(0, str.length - index)
    return newStr
  }

  newStr = newStr + str.substring(index + len)
  
  // This should normally be 40 characters
  if (newStr.length != 40) {
    LOG.fn(
      ['ttxpage', 'replace'],
      `Expected row length 40. Got ${newStr.length}, str = ${newStr}`,
      LOG.LOG_LEVEL_ERROR
    )  
  }
  return newStr
}

// teletext properties page
// ttxproperties class defines pages for property editing including
// * description
// * x/26 and x/28 enhancements
// * fastext links
// * transmission flags
"use strict";

// What I think it should do is...

// 1) When the properties page is selected:
//      Create the object initialised with the
//      Description, CLUT, Palette, Fastext and everything else
// 2) Do a copy of the settings, so we can revert if needed
// 
class TTXPROPERTIES {
  // Use doInits to pass description, X28 clut and palette etc.
  constructor() {
    print("[TTXPROPERTIES] Constructor")    
    this.totalPages = 4 // How many configuration pages
    this.pageIndex = 0 // Which configuration page we are on
    this.description = 'description not set'
    this.rows = []
    this.savedMetadata = new MetaData(7, new X28Packet()) // Later make a copy of the metadata if we need to revert it
    this.metadata //  = new MetaData(7, new X28Packet())
    
    this.cursor = cursor
    this.cursorCol = -1
    this.cursorRow = 0
    this.editableFields = [] // UI elements that we can interact with
    this.remapField = 0
    this.blackBackgroundSubField = 0 // Allow black background to be substituted
    this.redLink = 0x8ff // fastext links
    this.greenLink = 0x8ff
    this.yellowLink = 0x8ff
    this.cyanLink = 0x8ff
    this.spareLink = 0x8ff
    this.indexLink = 0x100
    this.regions = [0, 1, 2, 3, 4, 6, 8, 10] // Language regions
    
    // Page 3 variables
    this.regionsRadioGroup = []
    this.languagesRadioGroup = []

    
    let self = this // Ensure we use the correct "this" on callbacks
    this.cursorCallback // When the cursor changes
     = function(xLoc, yLoc) {
      print("[TTXPROPERTIES::callback] x,y = ("+xLoc+","+yLoc+")")
      if (self.pageHandler !== undefined && self.pageHandler !== null) {
        self.pageHandler(xLoc, yLoc)    
        self.cursorCol = xLoc
        self.cursorRow = yLoc
      }
      else {
        print("undefined page handler") // We got the wrong "this"?
      }
    }

    this.getCursorCallback = function() {    
      return self.cursorCallback
    }
    
    /** Handle hint text for all the properties pages
     *  Given the cursor position, it scans the editfields to see what hint text is shown
     * Might also need to handle UI widget appearance
     */
    this.hintHandler = function(xLoc, yLoc) {
      print("[TTXPROPERTIES::hintHandler] x,y = ("+xLoc+","+yLoc+")")
      // @todo look at the xLoc/yLoc and see if it affects any UI element
      
      // Check if a UI field hint can be added
      // Scan all the fields
      let foundField
      for (const field of this.editableFields) {
        if (field.inField(xLoc, yLoc) >= 0) {
          foundField = field
          break
        }
      }
      if (typeof foundField === 'undefined') {
        this.rows[23].setrow(String.fromCharCode(0x03) + " q" + String.fromCharCode(0x07) + "=quit," + String.fromCharCode(0x03) + "x" + String.fromCharCode(0x07) + "=save, PgUp/PgDn")    // Default hint.
      } else {
        this.rows[23].setrow(String.fromCharCode(0x03) + " Hint:" + String.fromCharCode(0x07) + foundField.getHint())    // Found UI field, add the hint on row 23
      }
    } // hintHandler

    this.pageHandler = 99 // The page handler that processes cursor changes
    
    // Row 0 
    // We don't care what is in the metadata at the moment, as doInits will fill that later
    // Just need to ensure that each metadata and clut is not a shared reference
    let pageNumber = 999
    this.rows.push(
      new Row(this, pageNumber, 0, "          Muttlee Properties Editor     ", new MetaData(7, new X28Packet()))
    )
    this.rows[0].setpagetext(pageNumber)
    for (let i = 1; i < 26; i++) { // @wsfn clrt2
      this.rows.push(
        new Row(this, pageNumber, i, ''.padStart(CONFIG[CONST.CONFIG.NUM_COLUMNS]), new MetaData(7, new X28Packet()))
      )
      this.rows[i].setrow("                                        ")
    }
    this.updateIndex()    
  } // constructor
  
  /** doInits
   *  When entering ttxproperties, call this to set up the page parameters.
   *  Only needs to be done when going from edit to properties mode.
   *  @param pageNumber - The teletext page number to show to the user
   *  @param description - The page meta description. Don't think we use it
   *  @param metadata - The metadata of the subpage we are editing
   *  @param cursor - The cursor object so that we can move around the page
   *  @param redLink - Red fastext link 0x100 to 0x8fe
   *  @param greenLink - Green fastext link 0x100 to 0x8fe
   *  @param yellowLink - Yellow fastext link 0x100 to 0x8fe
   *  @param cyanLink - Cyan fastext link 0x100 to 0x8fe
   *  @param spareLink - Cyan fastext link 0x100 to 0x8fe
   *  @param indexLink - Cyan fastext link 0x100 to 0x8fe
   */
  doInits(pageNumber, description, metadata, cursor, redLink, greenLink, yellowLink, cyanLink, spareLink, indexLink) {
    LOG.fn(
      ['ttxproperties', 'doInits'],
      `enters`,
      LOG.LOG_LEVEL_VERBOSE
    )  
    // page number is displayed in the header to show in which page we are editing the properties
    this.rows[0].pagetext = pageNumber.toString(16)
    this.rows[0].page = pageNumber
    this.description = description
    this.metadata = metadata // Copy by ref
    MetaData.copyMetadata(metadata, this.savedMetadata) // Copy the working metadata before we modify it
    this.cursor = cursor
    // @todo. Copy the clut to each of the rows.
    // Needs a lot of thought. A bad choice of colours can make the UI completely unusable.
    // Probably want to hack the CLUT to use CLUT 0 for UI and CLUT 2 and 3 to show the chosen colour
    // We should use the foreground for the UI and background for the CLUT colours
    for (let i = 1; i < 25; i++) { // @wsfn clrt4
      let row = this.rows[i]
      if (typeof row !== 'undefined') { // If the row exists
        row.metadata.x28Packet.resetTable()
        // [!] Should be copying the metadata instead? @todo
        X28Packet.copyX28Packet(metadata.x28Packet, row.metadata.x28Packet) // Copy the CLUT to the row
        // Each row gets colours differently
        let remap = 2 // Default clut 0/2        
        row.metadata.x28Packet.setBlackBackgroundSub(false); // Don't want to substitute black in the UI

        // For the properties page, we can use a different X28 per line.
        // Obviously this hack is not possible outside of Muttlee
        /*
        if (this.pageIndex === 0) { // property page 0 needs alternate cluts
          remap = 0
          if (i===7 || i===8) {remap = 0} // clut 0:0
          if (i===11 || i===12) {remap = 1} // clut 0:1
          if (i===15 || i===16) {remap = 2} // clut 0:2
          if (i===19 || i===20) {remap = 7} // clut 2:3
        }
        */
        row.metadata.x28Packet.setRemap(0) // fg0, bg0) // Text and UI colours default teletext
        row.metadata.x28Packet.setDefaultScreenColour(0) // black
        row.metadata.x28Packet.setDefaultRowColour(0) // black
      } else {
        console.log("Crash averted on row " + i + " You are welcome")
        // @todo Make sure that this message never happens and delete this branch
      }
    }
    // In case this is the first time, set up the palette text
    this.drawPalettes()
    
    // Set up the fastext links
    this.redLink = redLink
    this.greenLink = greenLink
    this.yellowLink = yellowLink
    this.cyanLink = cyanLink
    this.spareLink = spareLink
    this.indexLink = indexLink
  }
  
  /** When the user changes the configuration page with pg up/pg dn
   *  load in the new page
   */
  updateIndex() {
    // Blank all the rows
    for (let i = 1; i < 26; i++) {
      this.rows[i].setrow("                                        ")    
    }
    switch (this.pageIndex)
    {
      case 0: this.loadPage0() // X26 Palette editor
        break;
      case 1: this.loadPage1() // Other X26 properties
        break;
      case 2: this.loadPage2() // Metadata: Fastext, Description, Page timing etc.
        break;
      case 3: this.loadPage3() // X28 Language selection
        break;
      default:
        print("[ttxproperties::updateIndex] Invalid index " + this.pageIndex)
    }
  }
  
  draw() {
    // print("[TTXPROPERTIES::draw] called")
    for (let rw = 0; rw < this.rows.length; rw++) {
      let cpos = -1 // Disable the cursor
      // unless this is the correct row, then show it
      if (rw === this.cursorRow) {
        cpos = this.cursorCol
      }
      let revealMode = false // Don't need this
      let holdMode = false // Don't need this
      let subPage = 0
      let changed = '                   ' // Side effect. The first n printable characters go orange when the cursor is on the line
      // TODO: Make this the length of the caption text instead of fixed for all rows.
      editMode = CONST.EDITMODE_PROPERTIES
      if (this.rows[rw].draw(cpos, revealMode, holdMode, editMode, subPage, changed)) {
        rw++ // If double height, skip the next row
      }
    }
  }

  /** Draw a yellow box with a caption
   */
  drawBox(xpos, ypos, xwidth, yheight, caption) {
    // mosaic yellow down the left side
    for (let y=ypos; y<ypos+yheight; y++) {
      this.rows[y].setchar(String.fromCharCode(0x13),xpos)
    }
    // Top bar
    for (let x=0; x<xwidth; x++) {
      let r = this.rows[ypos]
      r.setchar('s',x+xpos+2)
    }
    // Bottom bar
    for (let x=0; x<xwidth; x++) {
      let r = this.rows[ypos+yheight-1]
      r.setchar('s',x+xpos+2)
    }
    //Verticals
    for (let y=ypos+1; y<ypos+yheight-1; y++) {
      this.rows[y].setchar('5',xpos+1)
      this.rows[y].setchar(String.fromCharCode(0x13),xpos+xwidth-2) // Yellow
      this.rows[y].setchar('j',xpos+xwidth-1)
    }
    // corners
    this.rows[ypos].setchar('v',xpos+1) // Top left
    this.rows[ypos].setchar('y',xpos+xwidth-1) // Top right
    this.rows[ypos+yheight-1].setchar('g',xpos+1) // Bottom left
    this.rows[ypos+yheight-1].setchar(";",xpos+xwidth-1) // Bottom right
    // caption
    this.rows[ypos].setrow(replace(this.rows[ypos].txt,String.fromCharCode(0x03)+caption+String.fromCharCode(0x13), xpos+3))
  }
  
  drawHeader(title) {
    // Draw blue double height banner with yellow title text
    this.rows[1].setrow(String.fromCharCode(13) + String.fromCharCode(4) + String.fromCharCode(29) + String.fromCharCode(3) + title.substring(0,39))
  }
  
  /** Draw the page index on row 3
    * eg. 2/5
   */
  drawPageIndex(pageIndex) {
    this.rows[3].setchar(pageIndex,37)
    this.rows[3].setchar('/',38)
    this.rows[3].setchar(this.totalPages,39)
  }
  
  /** Draw the palettes
   */
  drawPalettes() { // @wsfn clrt5
    if (this.pageIndex !== 0) { // Make sure we only do this on page 0 (1/2)
      return
    }
    print('[teletextproperties::drawPalettes] enters')
    let xLeft = 4 // palette origin
    let yLoc = 4 + 2 // palette offset
    let yStep = 4 // rows per palette
    for (let palette=0; palette<4; palette++) {
      // Draw the Clut caption
      let r = this.rows[yLoc++]
      r.setrow(replace(r.txt, String.fromCharCode(0x07) + "Clut " + palette + String.fromCharCode(0x13), xLeft))
      
      r = this.rows[yLoc]
      let r2 = this.rows[yLoc+1]
      // Which clut to use?
      let clutA // Upper row of palette
      let clutB // Lower row of palette
      switch (palette) {
      case 0: 
        clutA = r.metadata.x28Packet.clut0
        clutB = r2.metadata.x28Packet.clut0
        break
      case 1: 
        clutA = r.metadata.x28Packet.clut1
        clutB = r2.metadata.x28Packet.clut1
        break
      case 2: 
        clutA = r.metadata.x28Packet.clut2
        clutB = r2.metadata.x28Packet.clut2
        break
      case 3: 
        clutA = r.metadata.x28Packet.clut3
        clutB = r2.metadata.x28Packet.clut3
        // Also set fg colours in palette 2 for the black and white text
        // These colours are for UI rendering and do not affect the actual page
        r.metadata.x28Packet.setValue(color(0,0,0), 2, 0) // 2:0 is black
        r2.metadata.x28Packet.setValue(color(0,0,0), 2, 0) // 2:0 is black
        r.metadata.x28Packet.setValue(color(255,255,255), 2, 7) // 2:7 is white
        r2.metadata.x28Packet.setValue(color(255,255,255), 2, 7) // 2:7 is white
        break
      }
      if (palette===3) {
        palette = 7 // CLUT 3
      }
      this.rows[yLoc+0].metadata.x28Packet.setRemap(palette)
      this.rows[yLoc+1].metadata.x28Packet.setRemap(palette)
      // Draw a row of the palette
      let palstr1=''
      let palstr2=''
      for (let palcol=0; palcol<4; palcol++) {
        // What colour to make the text?        
        let c = clutA[palcol] // The colour
        let cHex = X28Packet.colourToHex(c)
        let luma =  0.299 * c.levels[0] + 0.587 * c.levels[1] + 0.114 * c.levels[2]
        let textColour = 0x07 // white
        if (luma > 0x60) {
          textColour = 0x00 // black
        }
        palstr1 += String.fromCharCode(0x00+palcol) +
          String.fromCharCode(29) + // new background
          String.fromCharCode(textColour) +
          cHex + '  '
        c = clutB[palcol+4]
        cHex = X28Packet.colourToHex(c)
        luma =  0.299 * c.levels[0] + 0.587 * c.levels[1] + 0.114 * c.levels[2]
        textColour = 0x07 // white
        if (luma > 0x60) {
          textColour = 0x00 // black
        }
        palstr2 += String.fromCharCode(0x04+palcol) +
          String.fromCharCode(29) + // new background
          String.fromCharCode(textColour) +
          cHex + '  '
      }
      // finish the first four colours
      palstr1+=String.fromCharCode(28) + String.fromCharCode(0x13) // new background, yellow mosaic
      r = this.rows[yLoc++]
      r.setrow(replace(r.txt, palstr1, 4))

      // finish the last four colours
      palstr2+=String.fromCharCode(28) + String.fromCharCode(0x13)
      r = this.rows[yLoc++]
      r.setrow(replace(r.txt, palstr2, 4))
      
      yLoc++
    }
  }
  
  // Maybe do something a bit more automated and also record the required actions or targets
  drawFastext(txt) {
    this.rows[24].setrow(txt)    
  }
  
  /** A simple button used as a graphics of a fastext button
   * The button is fixed size 6 characters long and two rows high 
   * @param colour - Button colour 0..7
   * @param xpos - Start column of button (will be a colour graphics code)
   * @param rowNum - Number of the first row of the button.
   */  
  drawButton(colour, xpos, rowNum) {
    // Upper row
    let r = this.rows[rowNum]
    let col = String.fromCharCode(0x10 + colour)
    let button = col + "x|||t"
    r.setrow(replace(r.txt, button, xpos))

    // Lower row
    r = this.rows[rowNum + 1]
    button = col + "o?"
    r.setrow(replace(r.txt, button, xpos))
  }

  /** Radio button
   * The button is 4 or 5 characters long and one row high 
   * @param colour - Button colour 0..7
   * @param xpos - Start column of button (will be a colour graphics code)
   * @param rowNum - Number of the first row of the button.
   * @param width - Width of the button
   * @param value - Button caption
   * @param selected - If true then this button is hiighlighted
   */  
  drawRadioButton(colour, xpos, rowNum, width, value, selected) {
    // Upper row
    let r = this.rows[rowNum]
    let blackText = String.fromCharCode(0x00)
    let redText = String.fromCharCode(0x01)
    let greenText = String.fromCharCode(0x02)
    let blackBG = String.fromCharCode(28)
    let newBG = String.fromCharCode(29)
    // Format is <space><black background><red text><caption (1 or 2 characters)>
    // or when selected: <green><new background><black text><caption (1 or 2 characters)>
    let button = selected
      ? greenText + newBG + blackText + value
      : ' ' + blackBG + redText + value
    button = (button + ' '.repeat(width)).substring(0, width) // pad if needed
    r.setrow(replace(r.txt, button, xpos))
  }

  /** Radio button
   * The button is 4 or 5 characters long and one row high 
   * @param xpos - Start column of button (will be a colour graphics code)
   * @param rowNum - Number of the first row of the button.
   */  
  blankRadioButton(xpos, rowNum, width) {
    let r = this.rows[rowNum]
    let button =  ' '.repeat(width)
    r.setrow(replace(r.txt, button, xpos))
  }

  // X/28 palette editor
  loadPage0() {
    print("loading page 0")
    
    this.drawHeader("PAGE ENHANCEMENTS-X/28/0 format 1")
    this.drawPageIndex(1)
    this.drawBox(1,4,39,19,"Palette")
    this.drawFastext(String.fromCharCode(1)+"Next  " + String.fromCharCode(2) + "Colour remap  "
    + String.fromCharCode(3) + "Metadata  "+String.fromCharCode(6)+"Exit")
    this.pageHandler = this.hintHandler
    // Editable fields
    this.editableFields = []
    // CLUT 0 (not editable)
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR,  7,  7, 3, 1, 0 , "Locked colour", false))
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR, 15,  7, 3, 1, 0  , "Locked colour", false))
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR, 23,  7, 3, 1, 0  , "Locked colour", false))
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR, 31,  7, 3, 1, 0  , "Locked colour", false))
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR,  7,  8, 3, 1, 0  , "Locked colour", false))
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR, 15,  8, 3, 1, 0  , "Locked colour", false))
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR, 23,  8, 3, 1, 0  , "Locked colour", false))
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR, 31,  8, 3, 1, 0  , "Locked colour", false))
    // CLUT 1 (not editable)
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR,  7, 11, 3, 1, 1  , "Locked colour", false))
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR, 15, 11, 3, 1, 1  , "Locked colour", false))
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR, 23, 11, 3, 1, 1  , "Locked colour", false))
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR, 31, 11, 3, 1, 1  , "Locked colour", false))
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR,  7, 12, 3, 1, 1  , "Locked colour", false))
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR, 15, 12, 3, 1, 1  , "Locked colour", false))
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR, 23, 12, 3, 1, 1  , "Locked colour", false))
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR, 31, 12, 3, 1, 1  , "Locked colour", false))
    // CLUT 2
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR,  7, 15, 3, 1, 2  , "Three hex digit colour"))
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR, 15, 15, 3, 1, 2  , "Three hex digit colour"))
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR, 23, 15, 3, 1, 2  , "Three hex digit colour"))
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR, 31, 15, 3, 1, 2  , "Three hex digit colour"))
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR,  7, 16, 3, 1, 2  , "Three hex digit colour"))
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR, 15, 16, 3, 1, 2  , "Three hex digit colour"))
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR, 23, 16, 3, 1, 2  , "Three hex digit colour"))
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR, 31, 16, 3, 1, 2  , "Three hex digit colour"))
    // CLUT 3
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR,  7, 19, 3, 1, 3  , "Three hex digit colour")) 
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR, 15, 19, 3, 1, 3  , "Three hex digit colour"))
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR, 23, 19, 3, 1, 3  , "Three hex digit colour"))
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR, 31, 19, 3, 1, 3  , "Three hex digit colour"))
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR,  7, 20, 3, 1, 3  , "Three hex digit colour"))
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR, 15, 20, 3, 1, 3  , "Three hex digit colour"))
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR, 23, 20, 3, 1, 3  , "Three hex digit colour"))
    this.editableFields.push(new uiField(CONST.UI_FIELD.FIELD_HEXCOLOUR, 31, 20, 3, 1, 3  , "Three hex digit colour"))
    
    this.drawPalettes()
  }
  
  // X/28 clut editor
  loadPage1() {
    print("loading page 1")
    
    // Use the default CLUT for all rows
    for (const i of this.rows) {
      i.metadata.x28Packet.setRemap(0)
    }
    
    this.drawHeader("PAGE ENHANCEMENTS-X/28/0 format 1")
    this.drawPageIndex(2)
    
    // outlines
    this.drawBox(1,14,39,6,"Side panels")
    this.drawBox(1,4,39,16,"Colours")
    // Fix the ends of the "Side Panels" row
    this.rows[14].setchar('w',2)
    this.rows[14].setchar('s',38)
    this.rows[14].setchar('{',39)
    
    // captions
    let cyan = String.fromCharCode(6)
    this.drawCaption(4,  6, "Default screen        \x06CLUT ?:?")
    this.drawCaption(4,  8, "Default row           \x06CLUT ?:?")
    this.drawCaption(4, 10, "CLUT remap mode = x            ")
    this.drawCaption(4, 12, "Blk background sub.      YES   ")
    this.drawCaption(4, 16, "Left columns              0    ")
    this.drawCaption(4, 18, "Right columns             5    ")

    this.drawFastext(String.fromCharCode(1)+"Next  " + String.fromCharCode(2) + "Colour remap  "
    + String.fromCharCode(3) + "Metadata  "+String.fromCharCode(6)+"Exit")
    this.pageHandler = this.hintHandler

    // Editable fields
    this.editableFields = []
    
    // Default screen colour
    let clutIndex = 0 // Use default colours
    let field = new uiField(CONST.UI_FIELD.FIELD_NUMBER, 33, 6, 1, 1, clutIndex, "CLUT 0 to 3" ) // CLUT
    this.editableFields.push(field) 
    field = new uiField(CONST.UI_FIELD.FIELD_NUMBER, 35, 6, 1, 1, clutIndex, "Colour 0 to 7" ) // Colour
    this.editableFields.push(field) 
    
    // Default row colour
    clutIndex = 0 // Use default colours
    field = new uiField(CONST.UI_FIELD.FIELD_NUMBER, 33, 8, 1, 1, clutIndex, "Row CLUT 0 to 3" ) // CLUT
    this.editableFields.push(field) 
    field = new uiField(CONST.UI_FIELD.FIELD_NUMBER, 35, 8, 1, 1, clutIndex, "Colour 0 to 7" ) // Colour
    this.editableFields.push(field) 
    
    // CLUT remap mode
    clutIndex = 0 // Use default colours
    field = new uiField(CONST.UI_FIELD.FIELD_NUMBER, 23, 10, 1, 1, clutIndex, "CLUT remap mode 0 to 7" )
    this.editableFields.push(field) 
    this.remapField = field

    // Blk background sub.
    field = new uiField(CONST.UI_FIELD.FIELD_CHECKBOX, 30, 12, 3, 1, clutIndex, "Y = yes, N = no, <space> = toggle")
    this.editableFields.push(field)
    this.blackBackgroundSubField = field
    
    // Left columns (0..20)
    field = new uiField(CONST.UI_FIELD.FIELD_NUMBER, 30, 16, 2, 1, clutIndex, "Left columns 0 to 20"  )
    this.editableFields.push(field)
    // Right columns are implied. @todo
    
    this.updateFieldsPage1()
  }
  
  // Metadata editor
  loadPage2(pageIndex) {
    print("loading page 2")
    
    // Use the default CLUT for all rows
    for (const i of this.rows) {
      i.metadata.x28Packet.setRemap(0)
    }
    
    this.drawHeader("METADATA")
    this.drawPageIndex(3)

    this.drawBox(1,4,39,16,"Fastext links")
    this.drawBox(1,10,39,4,"Page timing")
    
    // Fastext
    this.drawButton(1, 4,5) // Red
    this.drawButton(2,10,5) // Green 
    this.drawButton(3,16,5) // Yellow
    this.drawButton(6,22,5) // Cyan          

    this.drawCaption( 5,  8, ('00' + this.redLink.toString(16)).slice(-3))
    this.drawCaption(11,  8, ('00' + this.greenLink.toString(16)).slice(-3))
    this.drawCaption(17,  8, ('00' + this.yellowLink.toString(16)).slice(-3))
    this.drawCaption(23,  8, ('00' + this.cyanLink.toString(16)).slice(-3))

    // Editable fields
    this.editableFields = []

//      constructor(uiType, xLoc, yLoc, xWidth, yHeight, clutIndex, hint, enable = true) {
    let clutIndex = 0
    let field = new uiField(CONST.UI_FIELD.FIELD_PAGENUMBER, 6, 8, 3, 1, clutIndex, "Red fastext link" ) // 
    this.editableFields.push(field) 
    field = new uiField(CONST.UI_FIELD.FIELD_PAGENUMBER, 12, 8, 3, 1, clutIndex, "Green fastext link" ) // 
    this.editableFields.push(field) 
    field = new uiField(CONST.UI_FIELD.FIELD_PAGENUMBER, 18, 8, 3, 1, clutIndex, "Yellow fastext link" ) // 
    this.editableFields.push(field) 
    field = new uiField(CONST.UI_FIELD.FIELD_PAGENUMBER, 24, 8, 3, 1, clutIndex, "Cyan fastext link" ) // 
    this.editableFields.push(field) 
    
    this.pageHandler = this.hintHandler

  }
  
  /** Load the page data into the UI
   */
  updateFieldsPage1() {
    // Default screen colour    
    let txt = this.rows[6]
    
    // Values as text
    // Need to choose the text colour for contrast
    txt.setchar(this.metadata.x28Packet.getDefaultScreenClut(), 33)
    txt.setchar(this.metadata.x28Packet.getDefaultScreenColourIndex(), 35)

    /////////////////////////////////// Screen colour
//    txt.setchar(String.fromCharCode(this.metadata.x28Packet.getDefaultScreenColour()), 25) 
    // Fiddle this row's colour palette rather than mess with control codes.
    // We get the colour value and copy it from the page clut to CLUT 0:1
    let c = this.metadata.x28Packet.defaultScreenColour // 5 bit clut and colour
    let clut = (c >> 3) & 0x03
    let clr = c & 0x07
    let colour = this.metadata.x28Packet.getValue(clut, clr) // 12 bit colour
    txt.metadata.x28Packet.setValue(colour, 0,1) // CLUT 0:1 (red)
    
    txt.setchar(String.fromCharCode(1), 25) // colour index 1 (red)
    txt.setchar(String.fromCharCode(29), 26) // new background
    // txt.setchar(String.fromCharCode(7), 27) // foreground colour (text)
    let screenColour = this.metadata.x28Packet.getDefaultScreenRGB()
    let luma = (0.299 * screenColour.levels[0]) + (0.587 * screenColour.levels[1]) + (0.114 * screenColour.levels[2]);
    if (luma > 128) {
      // Set the text colour dark
      txt.setchar('\x00',27) // Black
    } else {
      // Set the text colour light
      txt.setchar('\x07',27) // White
    }
    
    
    /////////////////////////////////// Default row colour
    txt = this.rows[8]
    c = this.metadata.x28Packet.defaultRowColour // 5 bit clut and colour
    clut = (c >> 3) & 0x03
    clr = c & 0x07
    colour = this.metadata.x28Packet.getValue(clut, clr) // 12 bit colour
    txt.metadata.x28Packet.setValue(colour, 0,1) // CLUT 0:1 (Use the red slot for the colour)
    // @todo Choose the colour to contrast with the background
    txt.setchar(this.metadata.x28Packet.getDefaultRowClut().toString(), 33)
    txt.setchar(this.metadata.x28Packet.getDefaultRowColourIndex().toString(), 35)
    
    // Row colour
    // @todo Choose the colour to contrast with the background
//    txt.setchar(String.fromCharCode(this.metadata.x28Packet.getDefaultRowColour()), 25) 
    txt.setchar(String.fromCharCode(1), 25) // colour index 1 (red)
    txt.setchar(String.fromCharCode(29), 26) // new background
    let rowColour = this.metadata.x28Packet.getDefaultRowRGB()
    luma = (0.299 * rowColour.levels[0]) + (0.587 * rowColour.levels[1]) + (0.114 * rowColour.levels[2]);
    if (luma > 128) {
      // Set the text colour dark
      txt.setchar('\x00',27) // Black
    } else {
      // Set the text colour light
      txt.setchar('\x07',27) // White
    }
    
    // CLUT remap mode
    let row = 10 // field.yLoc
    let col = 23 // field.xLoc
    txt = this.rows[row]
    txt.setchar(this.metadata.x28Packet.remap.toString(), col)
    // Also want to update the remap description
    this.updateField(this.remapField)
    
    // Black background substitution
    row = 12
    col = 30
    txt = this.rows[row]
    txt.setrow(
      replace(txt.txt,
        this.metadata.x28Packet.blackBackgroundSub  ? 'Yes' : 'No ',
        col))

    // Left columns
    row = 16
    col = 30
    txt = this.rows[row]
    txt.setrow(
      replace(txt.txt,
        this.metadata.x28Packet.leftColumns.toString() + ' ',
        col))

    // Right columns (I think these are based on left and not explicitly set)
  }
  
  // Metadata editor
  loadPage2(pageIndex) {
    print("loading page 2")
    
    // Use the default CLUT for all rows
    for (const i of this.rows) {
      i.metadata.x28Packet.setRemap(0)
    }
    
    this.drawHeader("METADATA")
    this.drawPageIndex(3)

    this.drawBox(1,4,39,16,"Fastext links")
    this.drawBox(1,10,39,4,"Page timing")
    
    // Fastext
    this.drawButton(1, 4,5) // Red
    this.drawButton(2,10,5) // Green 
    this.drawButton(3,16,5) // Yellow
    this.drawButton(6,22,5) // Cyan          

    this.drawCaption( 5,  8, ('00' + this.redLink.toString(16)).slice(-3))
    this.drawCaption(11,  8, ('00' + this.greenLink.toString(16)).slice(-3))
    this.drawCaption(17,  8, ('00' + this.yellowLink.toString(16)).slice(-3))
    this.drawCaption(23,  8, ('00' + this.cyanLink.toString(16)).slice(-3))

    // Editable fields
    this.editableFields = []

//      constructor(uiType, xLoc, yLoc, xWidth, yHeight, clutIndex, hint, enable = true) {
    let clutIndex = 0
    let field = new uiField(CONST.UI_FIELD.FIELD_PAGENUMBER, 6, 8, 3, 1, clutIndex, "Red fastext link" ) // 
    this.editableFields.push(field) 
    field = new uiField(CONST.UI_FIELD.FIELD_PAGENUMBER, 12, 8, 3, 1, clutIndex, "Green fastext link" ) // 
    this.editableFields.push(field) 
    field = new uiField(CONST.UI_FIELD.FIELD_PAGENUMBER, 18, 8, 3, 1, clutIndex, "Yellow fastext link" ) // 
    this.editableFields.push(field) 
    field = new uiField(CONST.UI_FIELD.FIELD_PAGENUMBER, 24, 8, 3, 1, clutIndex, "Cyan fastext link" ) // 
    this.editableFields.push(field) 
    
    this.pageHandler = this.hintHandler

  }
  
  // X28 language selection
  loadPage3(pageIndex) {
    print("loading page 3")
    
    // Use the default CLUT for all rows
    for (const i of this.rows) {
      i.metadata.x28Packet.setRemap(0)
    }
    
    this.drawHeader("X28 Language selection")
    this.drawPageIndex(4)

    this.drawBox(1,4,39,5,"Region")
    this.drawBox(1,8,39,11,"Language")
    
    this.regionsRadioGroup = new RadioGroup()
    this.languagesRadioGroup = new RadioGroup()
    
    // Editable fields
    this.editableFields = []
    
    //  ****** Regions ******
    let region = this.metadata.mapping.region

//      constructor(uiType, xLoc, yLoc, xWidth, yHeight, clutIndex, hint, enable = true) {
    let clutIndex = 0
    let h = 1
    let y = 6
    for (let rb = 0;  rb < this.regions.length; ++rb) {
      let x = 4 + 4 * rb
      let w = this.regions[rb] < 10 ? 4 : 5 // Last region is one character wider
      let field = new uiField(CONST.UI_FIELD.FIELD_RADIOBUTTON, x, y, w, h, clutIndex, `Press space to select region ${this.regions[rb]}`, true, this.regions[rb] )
      
      this.regionsRadioGroup.addRadioButton(field)
      
      // Initialise with the selected language region set
      if (region === this.regions[rb]) {
        this.regionsRadioGroup.selected = field
      }
      
      this.editableFields.push(field) 
    }
    
    this.setupLanguageRadioButtons(region)

/* TODO    // Initialise with the selected language region set
    if (region === this.regions[rb]) {
      this.regionsRadioGroup.selected = field
    }
    */
    this.pageHandler = this.hintHandler
    this.updateFieldsPage3()

  } // loadpage3
  
  /** Load the page data into the UI
  */
  updateFieldsPage3() {
    print("page 3 fields updater called ")
    
    // ***** REGION *****
    let y = 6
    for (let rb = 0;  rb < this.regions.length; ++rb) {
      let x = 4 + 4 * rb
      let w = this.regions[rb] < 10 ? 4 : 5 // Last region is one character wider
      this.drawRadioButton(1, x, y, w, this.regions[rb], this.regionsRadioGroup.selected === this.regionsRadioGroup.radioButtons[rb])
    }
    
    // ***** LANGUAGE *****
    const language = this.metadata.mapping.language
    let region = this.regionsRadioGroup.selected.value
    const languageStrings = MAPCHAR.getLanguageStrings(region)
    let i = 0
    let x = 4
    let w = 34
    y = 10
    for (const lang of languageStrings) {    
      if (typeof lang !== 'undefined') {
        let caption = (i + ' - ' + lang + ' '.repeat(w)).substring(0,w)
        let selected = this.languagesRadioGroup.selected.value === i
        this.drawRadioButton(1, x, y++, w, i + ' - ' + MAPCHAR.getLanguageStrings(region)[i], selected)
      }
      i++
    }
    // Blank out any unused lines
    for (;y<10+8;++y) {
      this.blankRadioButton(x, y, w)
    }

  }
  
  /** Setup Language Radio Buttons according to the region
   * @param region - Region for the language buttons
   */
  setupLanguageRadioButtons(region) {
    this.editableFields.length = 8
    //  ****** Languages ******
    // Vertical radio group
    const language = this.metadata.mapping.language
    const languageStrings = MAPCHAR.getLanguageStrings(region)
    let i = 0
    let x = 4
    let w = 34
    let y = 10
    let clutIndex = 0
    let h = 1
    for (const lang of languageStrings) {    
      if (typeof lang !== 'undefined') {
        let caption = i + ' - ' + lang
        let field = new uiField(CONST.UI_FIELD.FIELD_RADIOBUTTON, x, y++, w, h, clutIndex, `Press Space to select ${lang}`, true, i )
        this.languagesRadioGroup.addRadioButton(field)
        this.editableFields.push(field) 
      }
      i++
    }
     
   }

  
  /** Load the page data into the UI
   */
  updateFieldsPage1() {
    // Default screen colour    
    let txt = this.rows[6]
    
    // Values as text
    // Need to choose the text colour for contrast
    txt.setchar(this.metadata.x28Packet.getDefaultScreenClut(), 33)
    txt.setchar(this.metadata.x28Packet.getDefaultScreenColourIndex(), 35)

    /////////////////////////////////// Screen colour
//    txt.setchar(String.fromCharCode(this.metadata.x28Packet.getDefaultScreenColour()), 25) 
    // Fiddle this row's colour palette rather than mess with control codes.
    // We get the colour value and copy it from the page clut to CLUT 0:1
    let c = this.metadata.x28Packet.defaultScreenColour // 5 bit clut and colour
    let clut = (c >> 3) & 0x03
    let clr = c & 0x07
    let colour = this.metadata.x28Packet.getValue(clut, clr) // 12 bit colour
    txt.metadata.x28Packet.setValue(colour, 0,1) // CLUT 0:1 (red)
    
    txt.setchar(String.fromCharCode(1), 25) // colour index 1 (red)
    txt.setchar(String.fromCharCode(29), 26) // new background
    // txt.setchar(String.fromCharCode(7), 27) // foreground colour (text)
    let screenColour = this.metadata.x28Packet.getDefaultScreenRGB()
    let luma = (0.299 * screenColour.levels[0]) + (0.587 * screenColour.levels[1]) + (0.114 * screenColour.levels[2]);
    if (luma > 128) {
      // Set the text colour dark
      txt.setchar('\x00',27) // Black
    } else {
      // Set the text colour light
      txt.setchar('\x07',27) // White
    }
    
    
    /////////////////////////////////// Default row colour
    txt = this.rows[8]
    c = this.metadata.x28Packet.defaultRowColour // 5 bit clut and colour
    clut = (c >> 3) & 0x03
    clr = c & 0x07
    colour = this.metadata.x28Packet.getValue(clut, clr) // 12 bit colour
    txt.metadata.x28Packet.setValue(colour, 0,1) // CLUT 0:1 (Use the red slot for the colour)
    // @todo Choose the colour to contrast with the background
    txt.setchar(this.metadata.x28Packet.getDefaultRowClut().toString(), 33)
    txt.setchar(this.metadata.x28Packet.getDefaultRowColourIndex().toString(), 35)
    
    // Row colour
    // @todo Choose the colour to contrast with the background
//    txt.setchar(String.fromCharCode(this.metadata.x28Packet.getDefaultRowColour()), 25) 
    txt.setchar(String.fromCharCode(1), 25) // colour index 1 (red)
    txt.setchar(String.fromCharCode(29), 26) // new background
    let rowColour = this.metadata.x28Packet.getDefaultRowRGB()
    luma = (0.299 * rowColour.levels[0]) + (0.587 * rowColour.levels[1]) + (0.114 * rowColour.levels[2]);
    if (luma > 128) {
      // Set the text colour dark
      txt.setchar('\x00',27) // Black
    } else {
      // Set the text colour light
      txt.setchar('\x07',27) // White
    }
    
    // CLUT remap mode
    let row = 10 // field.yLoc
    let col = 23 // field.xLoc
    txt = this.rows[row]
    txt.setchar(this.metadata.x28Packet.remap.toString(), col)
    // Also want to update the remap description
    this.updateField(this.remapField)
    
    // Black background substitution
    row = 12
    col = 30
    txt = this.rows[row]
    txt.setrow(
      replace(txt.txt,
        this.metadata.x28Packet.blackBackgroundSub  ? 'Yes' : 'No ',
        col))

    // Left columns
    row = 16
    col = 30
    txt = this.rows[row]
    txt.setrow(
      replace(txt.txt,
        this.metadata.x28Packet.leftColumns.toString() + ' ',
        col))

    // Right columns (I think these are based on left and not explicitly set)
  }
  /** Draws a caption at xLoc+1, yPos
   *  xLoc contains a white alpha code
   */
  drawCaption(xLoc, yLoc, caption) {    
    this.rows[yLoc].setrow(
      replace(this.rows[yLoc].txt,
        String.fromCharCode(0x07) + caption,
        xLoc))
  }

  handleKeyPress(key) {
    print("[TTXPROPERTIES::handleKeyPress] Key pressed in Properties mode key = " + key) 
    // Go through the the editable fields and see if we hit one
    let xp = this.cursorCol
    let yp = this.cursorRow
    // Are we on the page? Tried to type a character off the page?
    // Allow TAB, Page Up, Page Down to get through though
    if ( ((xp < 0) || (xp > 39) || (yp < 0) || (yp > 25)) && (key < 0x80)) {
      return
    }
    // Page up and Page down cycle through the properties pages
    if (key === 0x21 + 0x80) { // Page up
      this.pageIndex = (this.pageIndex + 1) % this.totalPages
      this.updateIndex()
      return
    }
    if (key === 0x22 + 0x80) { // Page down
      this.pageIndex = (this.pageIndex - 1)
      if (this.pageIndex < 0) { // wrap around
        this.pageIndex = this.totalPages -1
      }
      this.updateIndex()
      return
    }
    // Do tab
    let doTab = false
    for (const field of this.editableFields) {
      if (doTab) { // forward tab
        this.cursor.moveTo(field.xLoc, field.yLoc)
        doTab = false
        break
      }
      // @todo Backward tab
      // @todo Wrap around forward or backward tab
      // Are we in the editable zone?
      let pos = field.inField(xp, yp) // Are we in a field, and what is our position in the field?

      if (pos >=0 ) {
        LOG.fn(
          ['ttxproperties', 'handleKeyPress'],
          `field position = ${pos}`,
          LOG.LOG_LEVEL_VERBOSE
        )  
        key = field.validateKey(key, pos)
        // [!] Test for special TAB code *before* testing for a character
        if (key !== 0xff) { // Key is valid for this field?
           // @todo I think we don't need to test for the page number here. We can use the same code
           // @todo Any specific coding can go in updateField
          if (this.pageIndex === 0 || true) { // [!] Same code for all pageIndex
            // page0 = A 12 bit RGB colour edit, page1 = X26 settings, page2 = timings and fastext
            if (field.uiType != CONST.UI_FIELD.FIELD_RADIOBUTTON) {
              this.rows[yp].setchar(key, xp)
            }
            // The field changed. What is the new value?
            field.key = key
            this.updateField(field)
          }
          
        }
        // Advance cursor for a valid key
        // @todo Backwards TAB
        // @todo This probably applies to PAGENUMBER also
        if  ((xp < field.xLoc + field.xWidth - 1) && (key < 0x80) || ((field.uiType===CONST.UI_FIELD.FIELD_HEXCOLOUR) && (key >= 'a') && (key<='f')) ) {
          this.cursor.right() // Advance right after a character
        }
        // We went off the end of the field or TAB, flip to the next one
        if ((xp === field.xLoc + field.xWidth - 1) || (key === (9 + 0x80))) {
          doTab = true
        }
        // @todo Return the modified data to the clut object
      }
    }
    // Forward TAB wrap back to the start
    if (doTab) {
      this.cursor.moveTo(this.editableFields[0].xLoc, this.editableFields[0].yLoc)
    }
    if (this.pageIndex === 1) {
      this.updateFieldsPage1()
    }
  }   

  // Unfortunately, this handler is used for all pages, so the logic may be
  // a little muddled.
  // When a field is changed, then this will update anything that the field needs to do
  updateField(field) {
    // Get the updated data
    let row = this.rows[field.yLoc]
    let rowString = row.txt
    let value = rowString.substring(field.xLoc, field.xLoc + field.xWidth)
    switch (field.uiType) {
    case CONST.UI_FIELD.FIELD_HEXCOLOUR: // This is only used on page 0
      print ("new hex value = " + value)
      // Now put this colour value into the CLUT of each row
      if (this.pageIndex === 0)
      {
        // The new colour
        let colour = X28Packet.colour12to24(value)
        // Which CLUT?
        let clutIndex = field.clutIndex
        // Which colour in the CLUT
        let colourIndex = -1
        switch (field.xLoc) {
        case 7 :
          colourIndex = 0
          break
        case 15 :
          colourIndex = 1
          break
        case 23 :
          colourIndex = 2
          break
        case 31 :
          colourIndex = 3
          break
        default:
          print("[TTXPROPERTIES::updateFields] BUG")
        }
        // lower row of colours?
        if ((field.yLoc % 2) === 0) {
          colourIndex+=4
        }
        // Update the current row so that we can see the change
        row.metadata.x28Packet.setValue(colour, clutIndex, colourIndex)
        
        // Update the master clut so that the change will be saved
        this.metadata.x28Packet.setValue(colour, clutIndex, colourIndex)

        this.drawPalettes() // Only really need to call this to set the font colour        
      }
      break;
    case CONST.UI_FIELD.FIELD_CHECKBOX: // This is only used on page 1
      // page 1?
      if (this.pageIndex === 1) {
        // blackBackgroundSub
        let x = field.xLoc
        let y = field.yLoc
        // blackbackgroundSub
        if (y===12) {
          if (key==='y') {
            this.metadata.x28Packet.setBlackBackgroundSub(true)
          }
          if (key==='n') {
            this.metadata.x28Packet.setBlackBackgroundSub(0)
          }
          if (key===' ') {
            this.metadata.x28Packet.setBlackBackgroundSub(this.metadata.x28Packet.blackBackgroundSub===0?1:0)
          }
        }
        
        print("PROPERTIES; x = " + x + " y = " + y + " key = " + field.key)
      }
      break
    case CONST.UI_FIELD.FIELD_NUMBER: // This is only used on page 1
      // page 1?
      if (this.pageIndex === 1) {
        value = Number(value)
        // there are several numeric fields on this page.
        let x = field.xLoc
        let y = field.yLoc
        
        // Default screen clut and colour
        if (y===6) {
          if (x===33) { // Screen Clut
            this.metadata.x28Packet.setDefaultScreenClut(value)
          }
          if (x===35) { // Screen Colour Index
            this.metadata.x28Packet.setDefaultScreenColourIndex(value)
          }
          // @todo At this point we want to find what the background colour is
          // and make the foreground text black or white to make it readable
          let screenColour = this.metadata.x28Packet.getDefaultScreenRGB()
          let luma = (0.299 * screenColour.levels[0]) + (0.587 * screenColour.levels[1]) + (0.114 * screenColour.levels[2]);
          print("default screen luma = " + luma)
          if (luma > 128) {
            // Set the text colour dark
            this.rows[y].setchar('\x00',27) // Black
          } else {
            // Set the text colour light
            this.rows[y].setchar('\x07',27) // White
          }
        }
        
        // Default row clut and colour
        if (y===8) {
          if (x===33) { // Row Clut
            this.metadata.x28Packet.setDefaultRowClut(value)
          }
          if (x===35) { // Row Colour Index
            this.metadata.x28Packet.setDefaultRowColourIndex(value)
          }
          // @todo At this point we want to find what the background colour is
          // and make the foreground text black or white to make it readable
          let rowColour = this.metadata.x28Packet.getDefaultRowRGB()
          let luma = (0.299 * rowColour.levels[0]) + (0.587 * rowColour.levels[1]) + (0.114 * rowColour.levels[2]);
          print("default row colour = " + rowColour + " luma = " + luma)
          if (luma > 128) {
            // Set the text colour dark
            this.rows[y].setchar('\x00',27) // Black
          } else {
            // Set the text colour light
            this.rows[y].setchar('\x07',27) // White
          }
        }
        
         // CLUT remapping 0..7
        if (y===10) {
          print ("CLUT remap new number = " + value) 
          // Update the data
          this.metadata.x28Packet.setRemap(value)
          // update the display
          switch (value) {
          case 0:row.setrow(replace(rowString,"Fg 0, Bg 0", 27));break;
          case 1:row.setrow(replace(rowString,"Fg 0, Bg 1", 27));break;
          case 2:row.setrow(replace(rowString,"Fg 0, Bg 2", 27));break;
          case 3:row.setrow(replace(rowString,"Fg 1, Bg 1", 27));break;
          case 4:row.setrow(replace(rowString,"Fg 1, Bg 2", 27));break;
          case 5:row.setrow(replace(rowString,"Fg 2, Bg 1", 27));break;
          case 6:row.setrow(replace(rowString,"Fg 2, Bg 2", 27));break;
          case 7:row.setrow(replace(rowString,"Fg 2, Bg 3", 27));break;
          }
        }
      }
      break;
    case CONST.UI_FIELD.FIELD_PAGENUMBER: 
      value = Number('0x' + value) // Convert the hex page number to a numeric value
      if (this.pageIndex === 2) { // Fastext are on page 2 
        // We only implement the first four fastext links
        // Which fastext button is it?        
        switch (field.xLoc) {
        case 6 : // red
          this.redLink = value
          break
        case 12 : // green
          this.greenLink = value
          break
        case 18 : // yellow
          this.yellowLink = value
          break
        case 24 : // cyan
          this.cyanLink = value
          break
        default:
          LOG.fn(
            ['ttxproperties', 'updateField'],
            `Unimplemented switch 1: fastext field not found at x = ${field.xLoc}`,
            LOG.LOG_LEVEL_ERROR
          )  
        }
      }
      // @todo Copy the value back to this.redLink etc.
      break
    case CONST.UI_FIELD.FIELD_RADIOBUTTON:
      print("[TTXPROPERTIES::updateField] radio button")
      if (this.pageIndex === 3) { // Language/Region
        print(field)
        // The button reference is field
        // What value is it?
        let value = field.value
        // Which radio group is it in?
        if (this.regionsRadioGroup.radioButtons.includes(field)) {
          print("[TTXPROPERTIES::updateField] This field is in the regions group")
          
          // Check that value is in regions[]
          if (this.regions.includes(value)) {
            // Update the underlying data 
            this.metadata.setRegion(value)
            this.regionsRadioGroup.selected = field
            // If the region changed, the language set also changes
            this.setupLanguageRadioButtons(value)
            
          } else {
            LOG.fn(
              ['ttxproperties', 'updateField'],
              `Invalid region = ${field.value}`,
              LOG.LOG_LEVEL_ERROR
            )  
          }
            
        }
        if (this.languagesRadioGroup.radioButtons.includes(field)) {
          print("[TTXPROPERTIES::updateField] language group handler")          
          print(`language selected = ${value}`)
          this.languagesRadioGroup.selected = field
          this.metadata.setLanguage(value)
        }
        // Make the widget redraw
        this.updateFieldsPage3()
      }
      break
    default:
      LOG.fn(
        ['ttxproperties', 'updateField'],
        `Unimplemented switch 2: field.uiType = ${field.uiType}`,
        LOG.LOG_LEVEL_ERROR
      )  
    }
    // update the display
  }
  
}


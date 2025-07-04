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
  // @todo Need to pass description, X28 clut and palette etc.
  constructor(/*pageNumber, description, clut, cursor*/) {
    print("[TTXPROPERTIES] Constructor")    
    this.totalPages = 2 // How many configuration pages
    this.pageIndex = 0 // Which configuration page we are on
    this.description = 'description not set'
    this.rows = []
    this.clut = undefined
    this.savedClut = new Clut  // Make a copy of the clut if we need to revert it
    this.cursor = cursor
    this.cursorCol = -1
    this.cursorRow = 0
    this.editableFields = [] // UI elements that we can interact with
    this.remapField = 0
    this.blackBackgroundSubField = 0 // Allow black background to be substituted
    
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
    this.page0Handler = function(xLoc, yLoc) {
      print("[TTXPROPERTIES::page0Handler] x,y = ("+xLoc+","+yLoc+")")
      // @todo look at the xLoc/yLoc and see if it affects any UI element
      
      // Check if a UI field hint can be added
      // Scan all the fields
      let foundField
      for (const field of this.editableFields) {
        if (field.inField(xLoc, yLoc)) {
          foundField = field
          break
        }
      }
      if (typeof foundField === 'undefined') {
        this.rows[23].setrow(String.fromCharCode(0x03) + " q" + String.fromCharCode(0x07) + "=quit," + String.fromCharCode(0x03) + "x" + String.fromCharCode(0x07) + "=save, PgUp/PgDn")    // Default hint.
      } else {
        this.rows[23].setrow(String.fromCharCode(0x03) + " Hint:" + String.fromCharCode(0x07) + foundField.getHint())    // Found UI field, add the hint on row 23
      }
    }

    this.pageHandler = 99 // The page handler that processes cursor changes
    // Row 0    
    let newClut = new Clut
    // clut.copyClut(clut, newClut)
    let pageNumber = 999
    this.rows.push(
      new Row(this, pageNumber, 0, "          Muttlee Properties Editor     ", newClut)
    )
    this.rows[0].setpagetext(pageNumber)
    for (let i = 1; i < 26; i++) { // @wsfn clrt2
      let newClut = new Clut
      // clut.copyClut(clut, newClut)
      this.rows.push(
        new Row(this, pageNumber, i, ''.padStart(CONFIG[CONST.CONFIG.NUM_COLUMNS]), newClut)
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
   *  @param clut - The clut of the subpage we are editing
   *  @param cursor - The cursor object so that we can move around the page
   */
  doInits(pageNumber, description, clut, cursor) {
    LOG.fn(
      ['ttxproperties', 'doInits'],
      `enters`,
      LOG.LOG_LEVEL_VERBOSE
    )  
    // page number is displayed in the header to show in which page we are editing the properties
    this.rows[0].pagetext = pageNumber.toString(16)
    this.rows[0].page = pageNumber
    this.description = description
    this.clut = clut // A reference to the page clut which is also the working clut
    Clut.copyClut(clut, this.savedClut) // Copy the working clut before we modify it
    this.cursor = cursor
    // @todo. Copy the clut to each of the rows.
    // Needs a lot of thought. A bad choice of colours can make the UI completely unusable.
    // Probably want to hack the CLUT to use CLUT 0 for UI and CLUT 2 and 3 to show the chosen colour
    // We should use the foreground for the UI and background for the CLUT colours
    for (let i = 1; i < 25; i++) { // @wsfn clrt4
      let row = this.rows[i]
      if (typeof row !== 'undefined') { // If the row exists
        row.clut.resetTable()
        Clut.copyClut(clut, row.clut) // Copy the CLUT to the row
        // Each row gets colours differently
        let remap = 2 // Default clut 0/2        
        row.clut.setBlackBackgroundSub(false); // Don't want to substitute black in the UI

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
        row.clut.setRemap(0) // fg0, bg0) // Text and UI colours default teletext
        row.clut.setDefaultScreenColour(0) // black
        row.clut.setDefaultRowColour(0) // black
      } else {
        console.log("Crash averted on row " + i + " You are welcome")
        // @todo Make sure that this message never happens and delete this branch
      }
    }
    // In case this is the first time, set up the palette text
    this.drawPalettes()
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
      case 0: this.loadPage0()
        break;
      case 1: this.loadPage1()
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
        clutA = r.clut.clut0
        clutB = r2.clut.clut0
        break
      case 1: 
        clutA = r.clut.clut1
        clutB = r2.clut.clut1
        break
      case 2: 
        clutA = r.clut.clut2
        clutB = r2.clut.clut2
        break
      case 3: 
        clutA = r.clut.clut3
        clutB = r2.clut.clut3
        // Also set fg colours in palette 2 for the black and white text
        // These colours are for UI rendering and do not affect the actual page
        r.clut.setValue(color(0,0,0), 2, 0) // 2:0 is black
        r2.clut.setValue(color(0,0,0), 2, 0) // 2:0 is black
        r.clut.setValue(color(255,255,255), 2, 7) // 2:7 is white
        r2.clut.setValue(color(255,255,255), 2, 7) // 2:7 is white
        break
      }
      if (palette===3) {
        palette = 7 // CLUT 3
      }
      this.rows[yLoc+0].clut.setRemap(palette)
      this.rows[yLoc+1].clut.setRemap(palette)
      // Draw a row of the palette
      let palstr1=''
      let palstr2=''
      for (let palcol=0; palcol<4; palcol++) {
        // What colour to make the text?        
        let c = clutA[palcol] // The colour
        let cHex = Clut.colourToHex(c)
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
        cHex = Clut.colourToHex(c)
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
  
  // Maybe do something a bit more automated and also records the required actions or targets
  drawFastext(txt) {
    this.rows[24].setrow(txt)    
  }

  // X/28 palette editor
  loadPage0(pageIndex) {
    print("loading page 0")
    
    this.drawHeader("PAGE ENHANCEMENTS-X/28/0 format 1")
    this.drawPageIndex(1)
    this.drawBox(1,4,39,19,"Palette")
    this.drawFastext(String.fromCharCode(1)+"Next  " + String.fromCharCode(2) + "Colour remap  "
    + String.fromCharCode(3) + "Metadata  "+String.fromCharCode(6)+"Exit")
    this.pageHandler = this.page0Handler
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
  loadPage1(pageIndex) {
    print("loading page 1")
    
    // Use the default CLUT for all rows
    for (const i of this.rows) {
      i.clut.setRemap(0)
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
    this.pageHandler = this.page0Handler

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
  
  /** Load the page data into the UI
   */
  updateFieldsPage1() {
    // Default screen colour    
    let txt = this.rows[6]
    
    // Values as text
    // Need to choose the text colour for contrast
    txt.setchar(this.clut.getDefaultScreenClut(), 33)
    txt.setchar(this.clut.getDefaultScreenColourIndex(), 35)

    /////////////////////////////////// Screen colour
//    txt.setchar(String.fromCharCode(this.clut.getDefaultScreenColour()), 25) 
    // Fiddle this row's colour palette rather than mess with control codes.
    // We get the colour value and copy it from the page clut to CLUT 0:1
    let c = this.clut.defaultScreenColour // 5 bit clut and colour
    let clut = (c >> 3) & 0x03
    let clr = c & 0x07
    let colour = this.clut.getValue(clut, clr) // 12 bit colour
    txt.clut.setValue(colour, 0,1) // CLUT 0:1 (red)
    
    txt.setchar(String.fromCharCode(1), 25) // colour index 1 (red)
    txt.setchar(String.fromCharCode(29), 26) // new background
    // txt.setchar(String.fromCharCode(7), 27) // foreground colour (text)
    let screenColour = this.clut.getDefaultScreenRGB()
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
    c = this.clut.defaultRowColour // 5 bit clut and colour
    clut = (c >> 3) & 0x03
    clr = c & 0x07
    colour = this.clut.getValue(clut, clr) // 12 bit colour
    txt.clut.setValue(colour, 0,1) // CLUT 0:1 (Use the red slot for the colour)
    // @todo Choose the colour to contrast with the background
    txt.setchar(this.clut.getDefaultRowClut().toString(), 33)
    txt.setchar(this.clut.getDefaultRowColourIndex().toString(), 35)
    
    // Row colour
    // @todo Choose the colour to contrast with the background
//    txt.setchar(String.fromCharCode(this.clut.getDefaultRowColour()), 25) 
    txt.setchar(String.fromCharCode(1), 25) // colour index 1 (red)
    txt.setchar(String.fromCharCode(29), 26) // new background
    let rowColour = this.clut.getDefaultRowRGB()
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
    txt.setchar(this.clut.remap.toString(), col)
    // Also want to update the remap description
    this.updateField(this.remapField)
    
    // Black background substitution
    row = 12
    col = 30
    txt = this.rows[row]
    txt.setrow(
      replace(txt.txt,
        this.clut.blackBackgroundSub  ? 'Yes' : 'No ',
        col))

    // Left columns
    row = 16
    col = 30
    txt = this.rows[row]
    txt.setrow(
      replace(txt.txt,
        this.clut.leftColumns.toString() + ' ',
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
      if (field.inField(xp, yp)) {
        key = field.validateKey(key)
        // [!] Test for special TAB code *before* testing for a character
        if (key !== 0xff) { // Key is valid for this field?
           // @todo I think we don't need to test for the page number here. We can use the same code
           // @todo Any specific coding can go in updateField
          if (this.pageIndex === 0) {
            // A 12 bit RGB colour edit
            this.rows[yp].setchar(key, xp)
            // The field changed. What is the new value?
            field.key = key
            this.updateField(field)
          }
          
          if (this.pageIndex === 1) {
            // Mainly look at blackBackgroundSub
            this.rows[yp].setchar(key, xp)
            print("Need to process key = " + key)
            field.key = key
            this.updateField(field)
          }
        }
        // Advance cursor for a valid key
        // @todo Backwards TAB
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
  // a little muddled
  updateField(field) {
    // Get the updated data
    let row = this.rows[field.yLoc]
    let rowString = row.txt
    let value = rowString.substring(field.xLoc, field.xLoc + field.xWidth)
    switch (field.uiType) {
    case CONST.UI_FIELD.FIELD_HEXCOLOUR: // This is only used on page 0
      print ("new hex value = " + value)
      // Now put this colour value into the CLUT of each row
      {
        // The new colour
        let colour = Clut.colour12to24(value)
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
        row.clut.setValue(colour, clutIndex, colourIndex)
        
        // Update the master clut so that the change will be saved
        this.clut.setValue(colour, clutIndex, colourIndex)

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
            this.clut.setBlackBackgroundSub(true)
          }
          if (key==='n') {
            this.clut.setBlackBackgroundSub(0)
          }
          if (key===' ') {
            this.clut.setBlackBackgroundSub(this.clut.blackBackgroundSub===0?1:0)
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
            this.clut.setDefaultScreenClut(value)
          }
          if (x===35) { // Screen Colour Index
            this.clut.setDefaultScreenColourIndex(value)
          }
          // @todo At this point we want to find what the background colour is
          // and make the foreground text black or white to make it readable
          let screenColour = this.clut.getDefaultScreenRGB()
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
            this.clut.setDefaultRowClut(value)
          }
          if (x===35) { // Row Colour Index
            this.clut.setDefaultRowColourIndex(value)
          }
          // @todo At this point we want to find what the background colour is
          // and make the foreground text black or white to make it readable
          let rowColour = this.clut.getDefaultRowRGB()
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
          this.clut.setRemap(value)
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
    default:
      print("[TTXPROPERTIES::updateField] switch todo")
    }
    // update the display
  }
  
}


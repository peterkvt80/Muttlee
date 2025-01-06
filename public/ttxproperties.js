// teletext properties page
// ttxproperties class defines pages for property editing including
// * description
// * x/26 and x/28 enhancements
// * fastext links
// * transmission flags
"use strict"

// What I think it should do is...

// 1) When the properties page is selected:
//      Create the object initialised with the
//      Description, CLUT, Palette, Fastext and everything else
// 2) Do a copy of the settings, so we can revert if needed
// 
class TTXPROPERTIES {
  // @todo Need to pass description, X28 clut and palette etc.
  constructor(pageNumber, description, clut) {
    print("[TTXPROPERTIES] Constructor")    
    this.totalPages = 5 // How many configuration pages
    this.pageIndex = 0 // Which configuration page we are on
    this.description = description
    this.rows = []
    this.clut = clut // Keep this so we can return changed values
    this.cursorCol = -1
    this.cursorRow = 0
    
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
      print("[TTXPROPERTIES::pageHandler] x,y = ("+xLoc+","+yLoc+")")
      // @todo look at the xLoc/yLoc and see if it affects any UI element
    }

    this.pageHandler = 99 // The page handler that processes cursor changes
    // Row 0    
    let newClut = new Clut
    this.copyClut(clut, newClut)
    this.rows.push(
      new Row(this, pageNumber, 0, "          Muttlee Properties Editor     ", newClut)
    )
    this.rows[0].setpagetext(pageNumber)
    for (let i = 1; i < 26; i++) {
      let newClut = new Clut
      this.copyClut(clut, newClut)
      this.rows.push(
        new Row(this, pageNumber, i, ''.padStart(CONFIG[CONST.CONFIG.NUM_COLUMNS]), newClut)
      )
      this.rows[i].setrow("                                        ")
    }
    this.updateIndex()    
  }
  
  /** 
   * Deep copy clut
   */
  copyClut(src, dest) {
    for (let i=0; i<8; i++) {
      dest.clut0[i]=src.clut0[i]
      dest.clut1[i]=src.clut1[i]
      dest.clut2[i]=src.clut2[i]
      dest.clut3[i]=src.clut3[i]
    }
    dest.remap = src.remap
    dest.blackBackground = src.blackBackground
  }
  
  /** When the user changes the configuration page with pg up/pg dn
   *  load in the new page
   */
  updateIndex() {
    switch (this.pageIndex)
    {
      case 0: this.loadPage0()
        break;
      default:
        print("[ttxproperties::updateIndex] Invalid index " + this.pageIndex)
    }
  }
  
  draw() {
    print("[TTXPROPERTIES::draw] called")
    for (let rw = 0; rw < this.rows.length; rw++) {
      let cpos = -1 // Disable the cursor
      // unless this is the correct row, then show it
      if (rw === this.cursorRow) {
        cpos = this.cursorCol
      }
      let revealMode = false // Don't need this
      let holdMode = false // Don't need this
      let subPage = 0
      let str = 'not sure what this is for'
      editMode = CONST.EDITMODE_PROPERTIES
      if (this.rows[rw].draw(cpos, revealMode, holdMode, editMode, subPage, str)) {
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
    this.rows[3].setchar('1',37)
    this.rows[3].setchar('/',38)
    this.rows[3].setchar(this.totalPages,39)
  }
  
  /** Draw the palettes
   */
  drawPalettes() {
    let xLeft = 4
    let yLoc = 4 + 2
    let yStep = 4
    for (let pal=0; pal<4; pal++) {
      // Draw the Clut caption
      let r = this.rows[yLoc++]
      r.setrow(replace(r.txt, String.fromCharCode(0x07) + "Clut " + pal + String.fromCharCode(0x13), xLeft))
      // Which clut to use?
      let clut
      let palette = pal
      switch (palette) {
      case 0: 
        clut = r.clut.clut0
        break
      case 1: 
        clut = r.clut.clut1
        break
      case 2: 
        clut = r.clut.clut2
        break
      case 3: 
        clut = r.clut.clut3
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
        let c = clut[palcol] // The colour
        let cs = (c.levels[0]>>4) << 8 | (c.levels[1]>>4) << 4 | (c.levels[2]>>4) // The 12 bit colour
        let csh = ('00' + cs.toString(16)).slice(-3)   // three digit hex colour
        let luma =  0.299 * c.levels[0] + 0.587 * c.levels[1] + 0.114 * c.levels[2]
        let textColour = 0x07 // white
        if (luma > 0x60) {
          textColour = 0x00 // black
        }
        palstr1 += String.fromCharCode(0x00+palcol) +
          String.fromCharCode(29) +
          String.fromCharCode(textColour) +
          csh + '  '
        c = clut[palcol+4]
        cs = (c.levels[0]>>4) << 8 | (c.levels[1]>>4) << 4 | (c.levels[2]>>4) // The 12 bit colour
        csh = ('00' + cs.toString(16)).slice(-3)   // three digit hex colour
        luma =  0.299 * c.levels[0] + 0.587 * c.levels[1] + 0.114 * c.levels[2]
        textColour = 0x07 // white
        if (luma > 0x60) {
          textColour = 0x00 // black
        }
        palstr2 += String.fromCharCode(0x04+palcol) +
          String.fromCharCode(29) + // new background
          String.fromCharCode(textColour) +
          csh + '  '
      }
      // first four colours
      palstr1+=String.fromCharCode(28) + String.fromCharCode(0x13) // new background, yellow mosaic
      r = this.rows[yLoc++]
      r.setrow(replace(r.txt, palstr1, 4))

      // last four colours
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
    this.drawHeader("PAGE ENHANCEMENTS-X/28/0 format 1")
    this.drawPageIndex(pageIndex)
    this.drawBox(1,4,39,19,"Palette")
    this.drawPalettes()
    this.drawFastext(String.fromCharCode(1)+"Next  " + String.fromCharCode(2) + "Colour remap  "
    + String.fromCharCode(3) + "Metadata  "+String.fromCharCode(6)+"Exit")
    this.pageHandler = this.page0Handler
    // Editable fields
  }
  
  
  
  

  
}


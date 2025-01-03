// teletext properties page
// ttxproperties class defines pages for property editing including
// * description
// * x/26 and x/28 enhancements
// * fastext links
// * transmission flags
'use strict'

// What I think it should do is...

// 1) When the properties page is selected:
//      Create the object initialised with the
//      Description, CLUT, Palette, Fastext and everything else
// 2) Do a copy of the settings, so we can revert if needed
// 
class TTXPROPERTIES {
  // @todo Need to pass description, X28 clut and palette etc.
  constructor(pageNumber, description, clut) {
    this.totalPages = 5 // How many configuration pages
    this.pageIndex = 0 // Which configuration page we are on
    this.description = description
    this.rows = []
    // Row 0
    this.rows.push(
      new Row(this, pageNumber, 0, "          Muttlee Properties Editor     ", clut)
    )
    this.rows[0].setpagetext(pageNumber)
    for (let i = 1; i < 26; i++) {
      this.rows.push(
        new Row(this, pageNumber, i, ''.padStart(CONFIG[CONST.CONFIG.NUM_COLUMNS]), clut)
      )
      this.rows[i].setrow("                                        ")
    }
    this.updateIndex()    
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
      let r = this.rows[yLoc]
      r.setrow(replace(r.txt, String.fromCharCode(0x07) + "Clut " + pal + String.fromCharCode(0x13), xLeft))
      yLoc += yStep
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
  }
  
  
  
}


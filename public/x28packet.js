/*
# clut.js.
#
# clut.js Teletext colour lookup table
# Maintains colour lookups and all data in X28/F1 packet
#
# Copyright (c) 2024 - 2035 Peter Kwan
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.
#

# This holds Packet 28 information, mainly the colour lookup tables and languages
# There are four CLUTs 0 to 3. Here is what the standard says:
## 8 background full intensity colours:
## Magenta, Cyan, White. Black, Red, Green, Yellow, Blue,
## 7 foreground full intensity colours:
## Cyan, White. Red, Green, Yellow, Blue, Magenta,
## Invoked as spacing attributes via codes in packets X/0 to X/25.
## Black foreground: Invoked as a spacing attribute via codes in packets X/0
## to X/25.
## 32 colours per page. The Colour Map contains four CLUTs
## (numbered 0 - 3), each of 8 entries. Each entry has a four bit resolution for
## the RGB components, subclause 12.4.
## Presentation
## Level
## 1 1.5 2.5 3.5
## { { ~ ~
## ~ ~ ~ ~
## { { ~ ~
## { { ~ ~
## Colour Definition
## CLUT 0 defaults to the full intensity colours used as spacing colour
## attributes at Levels 1 and 1.5.
## CLUT 1, entry 0 is defined to be transparent. CLUT 1, entries 1 to 7 default
## to half intensity versions of CLUT 0, entries 1 to 7.
## CLUTs 2 and 3 have the default values specified in subclause 12.4. CLUTs
## 2 and 3 can be defined for a particular page by packet X/28/0 Format 1, or
## for all pages in magazine M by packet M/29/0.
## Colour Selection
## CLUT 0, entries 1 to 7 are selectable directly by the Level 1 data as
## spacing attributes. CLUTs 0 to 3 are selectable via packets 26 or objects
## as non-spacing attributes.
## The foreground and background colour codes on the Level 1 page may be
## used to select colours from other parts of the Colour Map. Different CLUTs
## may be selected for both foreground and background colours.
## This mapping information is transmitted in packet X/28/0 Format 1 for the
## associated page and in packet M/29/0 for all pages in magazine M.
## With the exception of entry 0 in CLUT 1 (transparent), CLUTs 0 and 1 can
## be redefined for a particular page by packet X/28/4, or
##
*/
'use strict';
class X28Packet {
  constructor() {
    console.log ('Clut loaded')
    this.dc = 0 // Should always be 0 for this packet
    this.pageFunction = 0
    this.pageCoding = 0
    this.defaultG0G2CharacterSet
    this.secondG0G2CharacterSet
    this.clut0 = new Array(8) // default full intensity colours
    this.clut1 = new Array(8) // default half intensity colours
    this.clut2 = new Array(8)
    this.clut3 = new Array(8)
    this.defaultScreenColour = 0 // black. [!] Assume that bits 4,3 are CLUT, 2,1,0 are Colour
    this.defaultRowColour = 0 // black
    this.remap = 0 // 0..7 Colour Table remapping
    this.blackBackgroundSub = false // Allow CLUT to change the background colour
    this.enableLeftPanel = false
    this.enableRightPanel = false
    this.sidePanelStatusFlag = false
    this.leftColumns = -1 // 0..15
    this.rightColumns = 0 // implied
    // set defaults
    this.resetTable()

    // Setters and Getters
    let self = this // You'll thank me later
    this.getDefaultScreenClut = function() {
      return (self.defaultScreenColour >> 3) & 0x03
    }
    this.getDefaultScreenColourIndex = function() {
      return self.defaultScreenColour & 0x07
    }
    this.getDefaultRowClut = function() {
      return (self.defaultRowColour >> 3) & 0x03
    }
    this.getDefaultRowColourIndex = function() {
      return self.defaultRowColour & 0x07
    }

    /// Replace the screen clut value 
    this.setDefaultScreenClut = function(value) {
      self.defaultScreenColour &= 0x07
      self.defaultScreenColour |= value << 3
    }
    
    /// Replace the screen colour index value
    this.setDefaultScreenColourIndex = function(value) {
      self.defaultScreenColour &= 0x18
      self.defaultScreenColour |= (value & 0x07)
    }   
    
    /// Replace the row clut value 
    this.setDefaultRowClut = function(value) {
      self.defaultRowColour &= 0x07
      self.defaultRowColour |= value << 3
    }
    
    /// Replace the row colour index value
    this.setDefaultRowColourIndex = function(value) {
      self.defaultRowColour &= 0x18
      self.defaultRowColour |= (value & 0x07)
    }   
  } // constructor
  
  // Setters and getters
    
  setDC(value) {
    this.dc = value // Should always be 0
  }  

  setPageFunction(value) {
    this.pageFunction = value
  }  

  setPageCoding(value) {
    this.coding = value
  }  

  setDefaultG0G2CharacterSet(value) {
    this.defaultG0G2CharacterSet = value
  }
  
  // Replace the language part of the character specification
  setLanguage(lang) {
    // this.mapping.setLanguage(lang & 0x07) // TODO Mapping has to be set somewhere
    // [!] TODO Check that this region supports this language
    this.defaultG0G2CharacterSet = this.defaultG0G2CharacterSet & 0x38 + lang & 0x07
  }

  // Replace the region part of the character set specification
  setRegion(region) {
    //this.mapping.setRegion(region & 0x0f) // TODO Mapping has to be set somewhere
    // [!] TODO Check that this language exists in this region
    this.defaultG0G2CharacterSet = (this.defaultG0G2CharacterSet & 0x07) | (region & 0x0f << 3)
  }
  
  setSecondLanguage(lang) {
    this.mapping.setLanguage(lang & 0x07)
  }

  setSecondRegion(region) {
    this.mapping.setRegion(region & 0x0f)
  }

  setSecondG0G2CharacterSet(value) {
    this.secondG0G2CharacterSet = value
  }

  setDefaultScreenColour(value) {
    // @todo Check that it is a 5 bit value
    this.defaultScreenColour = value 
  }   
   
  setDefaultRowColour(value) {
    // @todo Check that it is a 5 bit value
    this.defaultRowColour = value 
  }
  
  setLeftColumns(value) {
    // @todo Check that it is 20 or less
    this.leftColumns = value 
  }
  
  setEnableLeftPanel(value) {
    this.enableLeftPanel = value 
  }
  
  setEnableRightPanel(value) {
    this.enableRightPanel = value 
  }
  
  setSidePanelStatusFlag(value) {
    this.sidePanelStatusFlag = value
  }
  setRemap(remap) {
    this.remap = remap & 0x7
  }

  setBlackBackgroundSub(bgFlag) {
    this.blackBackgroundSub = bgFlag!=0
  }
  
  region() {
    return (this.defaultG0G2CharacterSet >> 3) & 0x0f
  }

  language() {
  // TODO Do we need to reverse the bits?
  /*
        charSet &= 0x07 // language is reversed
      charSet =
        ((charSet & 0x01) << 2) |
        (charSet & 0x02) |
        (charSet >> 2);
   */
    return this.defaultG0G2CharacterSet & 0x07
  }

  /** Used by X28/0 to swap entire cluts
     * @param colour - Colour index 0..7
     * @param foreground - True for foreground colour, or False for background
     * @return - Colour string for tkinter. eg. 'black' or '#000'
     * Given a colour, it maps the colour according to the remapping Table 4
     * and whether it is a background or a foreground colour
     */
  remapColourTable(colourIndex, foreground) {
    let clutIndex = 0
    if (foreground) {
      if (this.remap > 4) {
        clutIndex = 2
      } else if (this.remap < 3) {
        clutIndex = 0
      } else {
        clutIndex = 1
      }
    } else {
      if (this.remap < 3) { // background
        clutIndex = this.remap
      } else if (this.remap === 3 || this.remap === 5) {
        clutIndex = 1
      } else if (this.remap === 4 || this.remap === 6) {
        clutIndex = 2
      } else {
        clutIndex = 3
      }
    }
    // Black Background Colour Substitution
    // If this is set, then colour 0 in a row is replaced by the default row colour
    if (this.blackBackgroundSub && !foreground && colourIndex===0) {
      let value = this.defaultRowColour
      let clut = (value >> 3) & 0x03
      let colour = value & 0x07
      switch (clut) {
      case 0: return this.clut0[colour]
      case 1: return this.clut1[colour]
      case 2: return this.clut2[colour]
      case 3: return this.clut3[colour]
      }
      return color(0, 0, 255)
    }
    if (colourIndex === 0) {
      // print("This is a test clutIndex = " + clutIndex)
      // @todo Implement black background colour substitution
    }
    return this.getValue(clutIndex, colourIndex)
  }

  resetTable() { // Default values from table 12.4
    // CLUT 0 full intensity
    this.clut0[0] = color(0) // black
    this.clut0[1] = color(255, 0, 0) // red
    this.clut0[2] = color(0, 255, 0) // green
    this.clut0[3] = color(255, 255, 0) // yellow
    this.clut0[4] = color(0, 0, 255) // blue
    this.clut0[5] = color(255, 0, 255) // magenta
    this.clut0[6] = color(0, 255, 255) // cyan
    this.clut0[7] = color(255, 255, 255) // white

    // CLUT 1 half intensity
    this.clut1[0] = color(0,0,0) // transparent @todo ?
    this.clut1[1] = color(127, 0, 0) // half red
    this.clut1[2] = color(0, 127, 0) // half green
    this.clut1[3] = color(127, 127, 0) // half yellow
    this.clut1[4] = color(0, 0, 127) // half blue
    this.clut1[5] = color(127, 0, 127) // half magenta
    this.clut1[6] = color(0, 127, 127) // half cyan
    this.clut1[7] = color(127, 127, 127) // half white

    // CLUT 2 lovely colours
    this.clut2[0] = color(0xff, 0x00, 0x55) // crimsonish
    this.clut2[1] = color(0xff, 0x77, 0x00) // orangish
    this.clut2[2] = color(0x00, 0xff, 0x77) // blueish green
    this.clut2[3] = color(0xff, 0xff, 0xbb) // pale yellow
    this.clut2[4] = color(0x00, 0xcc, 0xaa) // cyanish
    this.clut2[5] = color(0x55, 0x00, 0x00) // dark red
    this.clut2[6] = color(0x66, 0x55, 0x22) // hint of a tint of runny poo
    this.clut2[7] = color(0xcc, 0x77, 0x77) // gammon

    // CLUT 3 more lovely colours
    this.clut3[0] = color(48, 48, 48) // pastel black
    this.clut3[1] = color(255, 127, 127) // pastel red
    this.clut3[2] = color(127, 255,127) // pastel green
    this.clut3[3] = color(255, 255, 127) // pastel yellow
    this.clut3[4] = color(127, 127, 255) // pastel blue
    this.clut3[5] = color(255, 127, 255) // pastel magenta
    this.clut3[6] = color(127, 255, 255) // pastel cyan
    this.clut3[7] = color(0xdd, 0xdd, 0xdd) // pastel white
    
    this.blackBackgroundSub = false
    this.remap = 0 // Default to CLUT 0
  }

  /** set a value in a particular clut
   * Get the colour from a particular clut
   * Probably want to record which cluts are selected
   * Lots of stuff

   * @param colour - p5js color object
   * @param clutIndex CLUT index 0 to 3
   * @param clrIndex - 0..7 colour index
   */
  setValue(colour, clutIndex, clrIndex) {
    let colourI = clrIndex % 8 // need to trap this a bit better. This is masking a problem
    switch (clutIndex % 4) {
    case 0:
      this.clut0[colourI] = colour
      break
    case 1:
      this.clut1[colourI] = colour
      break
    case 2:
      this.clut2[colourI] = colour
      break
    case 3:
      this.clut3[colourI] = colour
      break
    }
    // console.log("clut value: clut" + clutIndex + " set[" + clrIndex + '] = ' + colour)
  }

  /**
   * @param clutIndex CLUT index 0 to 3
   * @param clrIndex - 0..7 colour index
   * @return colour - 12 bit web colour number eg. 0x1ab
   * // [!] Hmm seems to return p5js colour type?
   */
  getValue(clutIndex, clrIndex) {
    clutIndex = clutIndex % 4
    clrIndex = clrIndex % 8
    // console.log("[getValue] clutIndex = " + clutIndex + " clrIndex = " + clrIndex)
    switch (clutIndex) {
      case 0:
        return this.clut0[clrIndex]
      case 1:
        return this.clut1[clrIndex]
      case 2:
      //console.log("colour selected = " + this.clut2[clrIndex])
        return this.clut2[clrIndex]
      case 3:
        return this.clut3[clrIndex]
      default:
        return this.clut0[clrIndex] // just in case!
    }
  }
  
  /** colour12to24
   * @param colour12 -  a 12 bit colour
   * @return -  p5js colour
   */
  static colour12to24(colour12) {
    print(colour12)
    colour12 = parseInt(colour12, 16)
    let r = (colour12 >> 8) & 0x0f
    let g = (colour12 >> 4) & 0x0f
    let b = colour12 & 0x0f    
    return color(
      (r<<4 | r),
      (g<<4 | g),
      (b<<4 | b))
  }

  /** colour24to12
   * @param p5js colour
   * @return - colour12 -  a 12 bits of four bits per channel RGB colour
   */
  static colour24to12(colour24) {
    print(colour24)
    let c = colour24 // The p5js colour
    // let cs = (c.levels[0]>>4) << 8 | (c.levels[1]>>4) << 4 | (c.levels[2]>>4) // The 12 bit colour
    let cs = 0
    for (let i=0; i<3; ++i) {
      let cv = c.levels[i] // 0 = red, 1= green, 2 = blue
      // Truncate from 8 to 4 bits
      let cval = (cv >> 4)
      cs <<= 4 // Shift one nybble left
      cs += cval
    }
    return cs
  }
  
  /** p5js colour to 12 bit hex code
   *  @param clr - three character hex number
   *  @return Three digit hex colour
   */
  static colourToHex(clr) {
    let clr12 = X28Packet.colour24to12(clr)
    return ('00' + clr12.toString(16)).slice(-3)   // three digit hex colour
  }

  /** 
   * Deep copy clut.
   */
  static copyX28Packet(src, dest) {
    for (let i=0; i<8; i++) {
      if (typeof dest==='undefined') {
        console.log('PUT A BREAKPOINT HERE AND FIND OUT WHAT WENT WRONG - 1')
      }
      if (typeof dest.clut0==='undefined') {
        console.log('PUT A BREAKPOINT HERE AND FIND OUT WHAT WENT WRONG - 1a')
        return
      }
      if (typeof src==='undefined') {
        console.log('PUT A BREAKPOINT HERE AND FIND OUT WHAT WENT WRONG - 3')
      }
      if (typeof src.clut0[i]==='undefined') {
        console.log('PUT A BREAKPOINT HERE AND FIND OUT WHAT WENT WRONG - 4')
      }
      //print("clut dest = " + dest.clut0[i])
      //print("clut src = " + src.clut0[i])
      dest.clut0[i]=src.clut0[i] // Not sure CLUT 0 and 1 need to be done
      dest.clut1[i]=src.clut1[i]
      dest.clut2[i]=src.clut2[i]
      dest.clut3[i]=src.clut3[i]
    }
    dest.defaultScreenColour = src.defaultScreenColour
    dest.defaultRowColour = src.defaultRowColour
    dest.remap = src.remap
    dest.blackBackgroundSub = src.blackBackgroundSub
    dest.enableLeftPanel = src.enableLeftPanel
    dest.enableRightPanel = src.enableRightPanel
    dest.leftColumns = src.leftColumns
    
    // @TODO Add GoG2 character sets
  }
  
  /** debug dump the clut contents
   *  Don't need this right now
   */
   /*
  dump() {
    console.log("[Dump] CLUT values")
    for (let i=0; i<8; i++) {
        (this.clut0[i] + ', ', end='')
    print()
    for i in range(8):
        print(this.clut1[i] + ', ', end='')
    print()
    for i in range(8):
        print(this.clut2[i] + ', ', end='')
    print()
    for i in range(8):
        print(this.clut3[i] + ', ', end='')
    print()
  }
  */
  
  /** Return the 12 bit RGB value of the default screen colour
   */
  getDefaultScreenRGB() {
    let val = this.getValue(this.getDefaultScreenClut(), this.getDefaultScreenColourIndex())
    print("screen clut = " + this.getDefaultScreenClut() + " screen index = " + this.getDefaultScreenColourIndex() + " value = " + val)
    return val
  }

  /** Return the 12 bit RGB value of the default screen colour
   */
  getDefaultRowRGB() {
    return this.getValue(this.getDefaultRowClut(), this.getDefaultRowColourIndex())
  }

} // X28Packet
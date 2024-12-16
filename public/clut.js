/*
# clut.js.
#
# clut.js Teletext colour lookup table
# Maintains colour lookups
#
# Copyright (c) 2024 Peter Kwan
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

# This holds the colour lookup tables read in by packet 28 etc.
# I think we have four CLUTs 0 to 3. Here is what the standard says:
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
'use strict'
class Clut {
  constructor () {
    console.log('Clut loaded')
    this.clut0 = new Array(8) // default full intensity colours
    this.clut1 = new Array(8) // default half intensity colours
    this.clut2 = new Array(8)
    this.clut3 = new Array(8)
    // set defaults
    this.resetTable()
  }

  /** Used by X28/0 to swap entire cluts
     * @param colour - Colour index 0..7
     * @param remap - Remap 0..7
     * @param foreground - True for foreground colour, or False for background
     * @return - Colour string for tkinter. eg. 'black' or '#000'
     */
  remapColourTable (colourIndex, remap, foreground) {
    let clutIndex = 0
    if (foreground) {
      if (remap > 4) {
        clutIndex = 2
      } else if (remap < 3) {
        clutIndex = 0
      } else {
        clutIndex = 1
      }
    } else {
      if (remap < 3) { // background
        clutIndex = remap
      } else if (remap === 3 || remap === 5) {
        clutIndex = 1
      } else if (remap === 4 || remap === 6) {
        clutIndex = 2
      } else {
        clutIndex = 3
      }
    }
    return this.getValue(clutIndex, colourIndex)
  }

  resetTable () { // Default values from table 12.4
    // CLUT 0 full intensity
    this.clut0[0] = 0x000 // black
    this.clut0[1] = 0xf00 // red
    this.clut0[2] = 0x0f0 // green
    this.clut0[3] = 0xff0 // yellow
    this.clut0[4] = 0x00f // blue
    this.clut0[5] = 0xf0f // magenta
    this.clut0[6] = 0x0ff // cyan
    this.clut0[7] = 0xfff // white

    // CLUT 1 half intensity
    this.clut1[0] = 0x000 // transparent
    this.clut1[1] = 0x700 // half red
    this.clut1[2] = 0x070 // half green
    this.clut1[3] = 0x770 // half yellow
    this.clut1[4] = 0x007 // half blue
    this.clut1[5] = 0x707 // half magenta
    this.clut1[6] = 0x077 // half cyan
    this.clut1[7] = 0x777 // half white

    // CLUT 2 lovely colours
    this.clut2[0] = 0xf05 // crimsonish
    this.clut2[1] = 0xf70 // orangish
    this.clut2[2] = 0x0f7 // blueish green
    this.clut2[3] = 0xffb // pale yellow
    this.clut2[4] = 0x0ca // cyanish
    this.clut2[5] = 0x500 // dark red
    this.clut2[6] = 0x652 // hint of a tint of runny poo
    this.clut2[7] = 0xc77 // gammon

    // CLUT 3 more lovely colours
    this.clut3[0] = 0x333 // pastel black
    this.clut3[1] = 0xf77 // pastel red
    this.clut3[2] = 0x7f7 // pastel green
    this.clut3[3] = 0xff7 // pastel yellow
    this.clut3[4] = 0x77f // pastel blue
    this.clut3[5] = 0xf7f // pastel magenta
    this.clut3[6] = 0x7ff // pastel cyan
    this.clut3[7] = 0xddd // pastel white
  }

  /** set a value in a particular clut
   * Get the colour from a particular clut
   * Probably want to record which cluts are selected
   * Lots of stuff

   * @param colour - 12 bit web colour string eg. '#1ab'
   * @param clutIndex CLUT index 0 to 3
   * @param clrIndex - 0..7 colour index
   */
  setValue (colour, clutIndex, clrIndex) {
    clrIndex = clrIndex % 8 // need to trap this a bit better. This is masking a problem
    clutIndex = clutIndex % 4
    switch (clutIndex) {
      case 0:
        this.clut0[clrIndex] = colour
        break
      case 1:
        this.clut1[clrIndex] = colour
        break
      case 2:
        this.clut2[clrIndex] = colour
        break
      case 3:
        this.clut3[clrIndex] = colour
        break
    }
    console.log('clut value: clut' + clutIndex + ' set[' + clrIndex + '] = ' + colour)
  }

  /**
   * @param clutIndex CLUT index 0 to 3
   * @param clrIndex - 0..7 colour index
   * @return colour - 12 bit web colour number eg. 0x1ab
   */
  getValue (clutIndex, clrIndex) {
    clutIndex = clutIndex % 4
    clrIndex = clrIndex % 8
    switch (clutIndex) {
      case 0:
        return this.clut0[clrIndex]
      case 1:
        return this.clut1[clrIndex]
      case 2:
        return this.clut2[clrIndex]
      case 3:
        return this.clut3[clrIndex]
      default:
        return 0 // just in case!
    }
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
}

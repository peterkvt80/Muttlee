/*
# uifield.js.
#
# uifield.js Class for teletext based ui editing
# Manage UI fields for user input of data
#
# Copyright (c) 2025 Peter Kwan
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
#*/
"use strict"

// @TODO Add CONST.UI.FIELD.FIELD_FASTEXT_LINK
class uiField {

  /** 
   * @param uiType - CONST.UI_FIELD.FIELD_HEXCOLOUR | FIELD_CHECKBOX | FIELD_NUMBER | FIELD_COMBO
   * @param xLoc - X origin of the field
   * @param yLoc - Y origin of the field
   * @param xWidth - Width of the field
   * @param yHeight - Height of the field
   * @param clutIndex - index of the CLUT this colour comes from
   * @param hint - Hint text
   * @param enable - Field can be edited if true
   */
  constructor(uiType, xLoc, yLoc, xWidth, yHeight, clutIndex, hint, enable = true) {
    this.uiType = uiType
    this.xLoc = xLoc
    this.yLoc = yLoc
    this.xWidth = xWidth
    this.yHeight = yHeight
    this.clutIndex = clutIndex
    this.hint = hint
    this.enable = enable
  }
  
  /** validateKey
   *  Update this field according to the key press and its location
   *  This comes from a callback in TTXPROPERTIES
   * @param pos - Character position where we are in the field
   */  
  validateKey(key, pos)
  {
    if (!this.enable) {
      return 0xff // Field exists but can not be updated
    }
    // Is the cursor in our field
    // Is the key valid for this type of field?
    if (Number.isInteger(key)) { // TAB, Page Up, Page Down etc.
      return key
    }
    key = key.toLowerCase()
    switch (this.uiType) {
    case CONST.UI_FIELD.FIELD_HEXCOLOUR: // Three digit hex value.
      if  ( ((key >= '0') && (key <='9')) || 
        ((key >='a') && (key <='f'))) {
          return key
        }
      break
    case CONST.UI_FIELD.FIELD_CHECKBOX: // Yes/No but this should be made less language dependent
      // <Y|y> = YES, <N|n> = NO, <space> = toggle
      if ( key ==='y' || key ==='n' ||  key ===' ') {
        return key
      }
      break
    case CONST.UI_FIELD.FIELD_NUMBER: // Arbitrary decimal number. [@todo Could use limits]
      if  ( (key >= '0') && (key <='9')) {
          return key
        }
      break
    case CONST.UI_FIELD.FIELD_COMBO: // Yeah. Could be interesting! Don't know how to control this
      return key // @todo Replace this placeholder. 
      break
    case CONST.UI_FIELD.FIELD_PAGENUMBER: // Hex number PAGE_MIN to PAGE_MAX
      if  ( ((key >= '0') && (key <='9')) || 
        ((key >='a') && (key <='f'))) {
          // If the first digit is 0 or over 9 (or 8!) then it is not a valid page number
          if ((key ==='0' || (key >= 'a' && key <= 'f')) && pos === 0) {
            break
          }
          return key
        }
      break
    }
    // update the display
    // update the source data
    return 0xff // Valid field but invalid key
  }
  
  // Set a hint string for the user
  setHint(hint) {
    // Probably should limit size and contents. @Todo
    this.hint = hint
  }
  
  // Return - The hint string for this field
  getHint() {
    return this.hint
  }
  
  /** Test if the x,y coordinate is in this field.
   *  Return The index of the character in this field or -1 if not in this field 
   */
  inField(xp, yp) {
    if ((xp >= this.xLoc) && (xp < this.xLoc + this.xWidth) &&
        (yp >= this.yLoc) && (yp < this.yLoc + this.yHeight)) {
        return xp - this.xLoc
    }
    return -1
  }
  
  
} // uiField

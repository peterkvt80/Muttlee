'use strict'
/* global constrain */
/** Cursor class for teletext
 */
class TTXCURSOR {
  constructor () {
  print("[TTXCURSOR] Constructor")
    this.x = 0
    this.y = 0
    this.hide = true // Not used atm
    this.callback = null // Callback function for when the cursor is moved
  }

  right () {
    this.x++
    if (this.x > 39) {
      this.x = 39
    }
    this.doCallback('R')
    return this.x
  }

  left () {
    this.x--
    if (this.x < 0) {
      this.x = 0
    }
    this.doCallback('L')
    return this.x
  }

  up () {
    this.y--
    if (this.y < 0) {
      this.y = 0
    }
    this.doCallback('U')
    return this.y
  }

  down () {
    this.y++
    if (this.y > 24) {
      this.y = 24
    }
    this.doCallback('D')
    return this.y
  }

  newLine () {
    this.down()
    this.x = 0
    this.doCallback('N')
    return this.y
  }

  moveTo (x, y) {
    this.x = constrain(x, 0, 39)
    this.y = constrain(y, 0, 24)    
    this.doCallback('M')
  }
  
  /** Set a callback
   *  The callback should have the X and Y coordinates
   */
  setCallback(callback) {
    this.callback = callback
  }
  
  /** Execute a callback for when the cursor moves
   * @param ch - Can be used for debugging 
   */
  doCallback (ch) {
    if (this.callback !== null && this.callback !==undefined) {
      this.callback(this.x, this.y)
    }
    else
    {
      print("There is no callback")
    }
    // console.log("cursor="+ch+" ("+this.x+","+this.y+")")
  }
} // TTXCursor

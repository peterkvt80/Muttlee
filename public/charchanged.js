'use strict'
/** charchanged.js
 *  Class to indicate which keys have changed and have not been processed by the server.
 * This is an array 24 x 40 flags, one per character.
 * When a new character is set, the corresponding flag is set.
 * When the character is returned by the server, the flag is reset and the highlight removed.
 * @todo Range checking
 */

const CHARCHANGED = function () {
  // Create 24 rows of 40 characters
  this.rows = new Array(26)
  for (let row = 0; row < this.rows.length; row++) {
    this.rows[row] = new Array(40)
    for (let ch = 0; ch < 40; ch++) {
      this.rows[row][ch] = false
    }
  }

  this.get = function (x, y) {
    return (this.rows[y][x])
  }

  this.set = function (x, y) {
    this.rows[y][x] = true
  }

  this.clear = function (x, y) {
    this.rows[y][x] = false
  }
} // CHARCHANGED

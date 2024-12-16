/** < Miscellaneous utilities for teletext
 * \author Peter Kwan 2018.
 */
'use strict'
/** < De-escape Prestel style 7 bit encoding.
 * A Prestel encoded string is escaped so that
 * it only needs 7 bit characters.
 * It does this by taking control code characters
 * and writing them as <esc> followed by the code
 * plus 0x40.
 * \param str - Prestel encoded string
 */
 
require('./hamm.js') // Hamming decoding

global.DeEscapePrestel = function (str) {
  let result = ''

  for (let i = 0; i < str.length; i++) {
    let ch = str.charAt(i)

    // Prestel escape
    if (ch === '\u001b') {
      ch = str.charAt(++i).charCodeAt(0) - 0x40
      ch = String.fromCharCode(ch & 0x7f)
    }

    result += ch
  }

  return result
}

/** < Escape Prestel style 7 bit encoding.
 * A Prestel encoded string is escaped so that
 * Control code characters (<' ')
 * are written as <esc> followed by the code plus 0x40.
 * \param str - Raw teletext string
 */
global.EscapePrestel = function (str) {
  let result = ''

  for (let x = 0; x < str.length; x++) {
    const ch = str.charAt(x)

    if (ch.charCodeAt(0) < 32) {
      result = result + '\u001b' + String.fromCharCode((ch.charCodeAt(0) & 0x7f) | 0x40)
    } else {
      result += ch
    }
  }

  return result
}

/** < Extract triplets from X26, X27 or X28
 */ 
 /*
global.DecodeRowOfTriplets = function(X28) {
  let triplets = []
  for (let ix = 0; ix<13; ix++) {
    // Extract the triplet
    let i = ix * 3
    let ch1 = X28[i].charCodeAt()
    let ch2 = X28[i+1].charCodeAt()
    let ch3 = X28[i+2].charCodeAt()
    let triplet = ch1*0x10000 + ch2*0x100 + ch3 // NAH! This is backwards
    console.log("Triplet["+ix+"] = " + parseInt(triplet,16) + " " + parseInt(ch1,16) + " " + parseInt(ch2,16) +" " + parseInt(ch3,16))
    triplets.push(triplet)
  }  
  return triplets
}
*/

/** < Decode X28/0 format 1 packet
 * This packet controls appearance especially colours
 * Given the X28 payload of 39 characters arranged as 13 triplets,
 * it decodes the triplets then extracts the relevant data.
 * returns the data as individual parameters
 * or -1 if it fails
 */
global.DecodeOL28 = function(rowText) {
  // Thirteen triplets to deham 24/18
  let triples = []
  for (let i = 0; i < 13; i++) {
    let x = vbi_unham24p(rowText,i*3)
    console.log("Decoded [" + i + "] = " + x.toString(16))
    triples.push(x)
  }
  // Now pick the bones. See Page 32 Table 4 for X/28 values
  let result = {}
  // @TODO Lots more values
  result.defaultScreenColour = -1
  result.defaultRowColour = -1
  result.blackBackgroundSubRow = (triples[12] >> 13) & 0x01 // t13, 15
  result.colourTableRemapping = (triples[12] >> 14) & 0x07 // t13, 16..18
  console.log(result)
  return result
}


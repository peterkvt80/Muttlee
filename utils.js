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

/** < Decode X28/0 format 1 packet
 * This packet controls appearance especially colours
 * Given the X28 payload of 39 characters arranged as 13 triplets,
 * it decodes the triplets then extracts the relevant data.
 * returns the data as individual parameters
 * or -1 if it fails
 */
global.DecodeOL28 = function(rowText) {
  // Get an array of 13 triplets
  let result = DecodeRowOfTriplets(rowText)
  console.log(result)
  // Need to deham 24/16
  return result
}

/** < Extract triplets from X26, X27 or X28
 * 
global.DecodeRowOfTriplets = function(X28) {
  let triplets = []
  for (let ix = 0; ix<13; ix++) {
    // Extract the triplet
    let i = ix * 3
    let ch1 = X28[i].charCodeAt()
    let ch2 = X28[i+1].charCodeAt()
    let ch3 = X28[i+2].charCodeAt()
    let triplet = ch1*0x10000 + ch2*0x100 + ch3
    console.log("Triplet["+ix+"] = " + parseInt(triplet,16) + " " + parseInt(ch1,16) + " " + parseInt(ch2,16) +" " + parseInt(ch3,16))
    triplets.push(triplet)
  }  
  return triplets
}

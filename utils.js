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
  
  // Thirteen triplets with 18 bits each
  let triples = []
  for (let i = 0; i < 13; i++) {
    let a = rowText[i*3+1].charCodeAt() & 0x3f
    let b = rowText[i*3+2].charCodeAt() & 0x3f
    let c = rowText[i*3+3].charCodeAt() & 0x3f
    let x = (c << 12) | (b << 6) | a
    // console.log("rowText = " + rowText)
    // console.log("Decoded [" + i + "] = " + x.toString(16))
    triples.push(x)
  }
  // Now pick the bones. See Page 32 Table 4 for X/28 values
  let result = {}
  let dc = rowText[0] & 0x3f // designation code
  result.dc = dc
  
  // Colour mappings
  result.colourMap = [] // t2 11-18, t3-t12 1-18, t13 1-4
  let bitIndex = 10
  let tripletStart = 1
  let colour = 0
  for (let i = 0; i<16*3; i++) { // 16 x R, G, B
    // work out the indices
    let startBit = (i * 4) + bitIndex
    let tripletIndex = tripletStart + Math.trunc(startBit / 18)
    startBit = startBit % 18
    let colorIndex = Math.trunc(i / 3) // CLUT 0/1 for dc === 4
    let colourValue = i % 3 // RGB
    let clutIx = 1 // CLUT 0/1 where dc === 4
    if (i < (8*3)) {
      clutIx = 0
    }
    if (dc === 0) { // CLUT 2/3 for dc === 0
      clutIx = clutIx + 2
    }
    // extract the four bit colour value
    let t =  triples[tripletIndex] // Get the triplet
    t = (t >> startBit) & 0x0f // Shift and mask
    // does the data cross a triplet boundary? (ie. the bits go past 18)
    if (startBit > 14) {                
      let split = 18 - startBit // This is always 2! Could assert that
      let t2 = triples[tripletIndex + 1] & 0x03 // Triplets only ever break on two bits
      t2 = t2 << split
      console.log("test t = " + t.toString(16) + " t2 = " + t2)
      t = t | t2
    }    
    colour = colour | t <<  ((2-colourValue) * 4)
    if (colourValue === 2) { // Done an RGB value
      console.log("colour = " + colour.toString(16))
      result.colourMap.push(colour)
      colour = 0
    }    
  }
    
  // Screen colour remapping
  result.defaultScreenColour = (triples[12] >> 4) & 0x1f // t13, 5..9
  result.defaultRowColour = (triples[12] >> 9) & 0x1f // t13, 10..14
  result.blackBackgroundSubRow = (triples[12] >> 14) & 0x01 // t13, 15
  result.colourTableRemapping = (triples[12] >> 15) & 0x07 // t13, 16..18
  // left and right extension panels
  result.enableLeftPanel = (triples[1] & 0x08) > 0 // t2, 4
  result.enableRightPanel = (triples[1] & 0x10) > 0 // t2, 5
  result.leftColumns = (triples[1] >> 6) & 0x0f // t2, 7..10 
  // result.rightColumns = (triples[12]) Implied. Always 16-leftColumns
  
  console.log(result)
  for (let i=0; i<8; i++) {
    console.log(result.colourMap[i].toString(16))
  }
  return result
}


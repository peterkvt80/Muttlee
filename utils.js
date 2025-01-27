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
 * @return data as an object containing individual parameters
 * or -1 if it fails
 * @param rowText The text string from the OL,28 packet
 * eg. @@@|_yCu_@|wKpZA`UBsxLcz}ww]_}_wmg}
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
  
  if (false) {
    let result = "                                        "
    let s = ""
    for (let i=0; i<13; ++i) {
      s+=hex(triples[i],5)+" " // [!] hex is p5js function
    }
    // console.log ("triples dec = " + s)    
  }
  
  // Now pick the bones. See Page 32 Table 4 for X/28 values
  let result = {}
  let dc = rowText[0] & 0x3f // designation code
  result.dc = dc

  // Bits we are ignoring for now but we need to preserve them
  result.pageFunction = triples[0] & 0x0f // t1, 1..4
  result.pageCoding = (triples[0] >> 4) & 0x07 // t1, 5..7
  result.defaultG0G2CharacterSet = (triples[0] >> 7) & 0x7f // t1, 8..14
  result.secondG0G2CharacterSet = (  // t1, 15..18, t2, 1-3
    ((triples[0] >> 14) & 0x0f) | ((triples[1] & 0x07) << 4)
  )
  
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
      t = t | t2
    }    
    colour = colour | t <<  ((2-colourValue) * 4)
    if (colourValue === 2) { // Done an RGB value
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
  result.sidePanelStatusFlag = (triples[1] & 0x20) > 0 // t2, 6
  result.leftColumns = (triples[1] >> 6) & 0x0f // t2, 7..10 
  // result.rightColumns = (triples[12]) Implied. Always 16-leftColumns
  
  if (false) {
    console.log(result)
    for (let i=0; i<8; i++) {
      console.log(result.colourMap[i].toString(16))
    }
  }
  return result
} // DecodeOL28

/** < Encode X28/0 format 1 data into a tti OL,28 packet
 * Packs the colour palette and colour remappings into triplets
 * @return OL,28 line or -1 if it fails
 */
global.EncodeOL28 = function(data) {
  let triples = Array.apply(0, {length: 13})
  for (let i=0; i<13; i++) {
    triples[i]=0
  }

  /** AddX28
   *  Places bitCount bits of value into the triple[tripleIndex] and can
   *  overflow into the next triple if needed.
   *  @param value : Data to add to the packet
   *  @param tripleIndex : Number of triple that the value starts in 1..13
   *  @param bitIndex : The bit offset where the value starts in the triple
   *  @param bitCount : The number of bits to use from value
   */
  let AddX28 = function(value, tripleIndex, bitIndex, bitCount) {
    // Mask off bitCount bits
    let mask = (1 << bitCount) - 1
    let v2 = value & mask 
    if (value == undefined) {
      // console.log("Bad args " + tripleIndex + " " + bitIndex + " " + bitCount)
    }
    // console.log("AddX28 enters value = " + hex(v2,3)+ " masked = " + hex(v2,6))

    // Shift to the required bit index and trim any overflow
    v2 = (v2 << (bitIndex-1)) & 0x3ffff
    triples[tripleIndex-1] |= v2
    // console.log ("v2 = " + hex(v2, 6) + " triples[i] = " + hex(triples[tripleIndex-1], 5))
    
    // Overflow of high bits goes into the next triple
    if ((bitIndex + bitCount) > 18) {
      v2 = value >>= 18 - bitIndex + 1 // 
      // console.log("v2 overflow = " + hex(v2,3))
      triples[tripleIndex] |= v2
    }
  }

  // Work our way along the packet
  AddX28(data.pageFunction, 1, 1, 4) // 1: 1-4 Page function. 4 bits
  AddX28(data.pageCoding, 1, 5, 3)// 1: 5-7 Page coding. 3 bits
  // @todo Implement X28 character sets 
  AddX28(data.defaultG0G2CharacterSet, 1, 8, 7) // 1: 8-14 Default G0 and G2 character set designation. 7 bits
  AddX28(data.secondG0G2CharacterSet, 1, 15, 7) // 1: 15-18, 2: 1-3 Second G0 Set designation
  AddX28(data.enableLeftPanel, 2, 4, 1)
  AddX28(data.enableRightPanel, 2, 5, 1)
  AddX28(data.enableSidePanelStatus, 2, 6, 1)
  AddX28(data.leftColumns, 2, 7, 4)
  // 2: 11-18, 3:1-18, 13: 1-4
  // 16x12 bit values
  let tr=2 // triple
  let bi = 11 // bit offset
  for (let colourix=0; colourix<16; ++colourix) {
    let c = data.colourMap[colourix]
    // Need to swap red and blue because X28 does colours backwards
    let colour = ((c & 0x00f) << 8) | (c & 0x0f0) | (c & 0xf00) >> 8
    AddX28(colour, tr, bi, 12)
    // console.log ("triple: "+tr+" bit: "+(bi+1))
    bi += 12  
    if (bi >= 18) {
      bi = bi - 18
      tr++
    }
  }
  
  AddX28(data.defaultScreenColour, 13, 5, 5) // t13 5..9
  AddX28(data.defaultRowColour, 13, 10, 5) // t13 10..14
  AddX28(data.blackBackgroundSubRow, 13, 15, 1) // t13 15
  AddX28(data.colourTableRemapping, 13, 16, 3) // t13 16..18

  if (false) {
    let result = "                                        "
    let s = ""
    for (let i=0; i<13; ++i) {
      s+=hex(triples[i],5)+" "
    }
    console.log("triples enc = " + s)    
  }
  
  // Pack the triples into a tti OL,28
  let result = ""
  result += String.fromCharCode(0 | 0x40)
  for (let tr=0; tr<13; ++tr) {
    let t = triples[tr]
    result += String.fromCharCode( (t & 0x3f) | 0x40 )
    result += String.fromCharCode( ((t>>6) & 0x3f) | 0x40 )
    result += String.fromCharCode( ((t>>12) & 0x3f) | 0x40 )
  }
  // console.log ("result = " + result)
  return result
} // EncodeOL28

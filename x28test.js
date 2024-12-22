/** < Temporary test for X28 decoding
 * \author Peter Kwan 2018.
 */
'use strict'
require('./utils.js')
let X280="OL,28,@@@|g@@@cB|ps@@OgObOwLs_w}ww]_}_wM@p" // Correct colour Fore 2 Back 2
let X281="OL,28,@@@|g@@@cB|ps@@OgObOwLs_w}ww]_}_wM@@" // Level 1 colours Fore 0 Back 0
let X282="OL,28,@@@|g@@@cB|ps@@OgObOwLs_w}ww]_}_wM@t" // Black background flag
let X283="OL,28,@@@|g@@@cB|ps@@OgObOwLs_w}ww]_}_wM@x" // Fore 2, Back 3

let X284="OL,28,@@@|gpC@@@@@@@@@@@@@@pLs_w}ww]_}_wM@@" // red clut2/0
let X285="OL,28,@@@|g@@@@@@@@@@@@@@@@pLs_w}ww]_}_wM@p" // black clut2/0

// Why 7? The line command is 6 characters. The first byte is the designation code 
let r
r=DecodeOL28(X284.substring(7),0) // Correct colour Fore 2 Back 2
console.log(r.colourMap[0].toString(16))
r=DecodeOL28(X285.substring(7),0) // Correct colour Fore 2 Back 2
console.log(r.colourMap[0].toString(16))
//DecodeOL28(X281.substring(7),0) // Level 1 colours Fore 0 Back 0
//DecodeOL28(X282.substring(7),0) // Black background flag
//DecodeOL28(X283.substring(7),0) // Fore 2, Back 3

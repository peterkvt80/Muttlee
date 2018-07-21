// Run this unit test under node

const EDITMODE_NORMAL=0 // normal viewing
const EDITMODE_EDIT=1   // edit mode
const EDITMODE_ESCAPE=2 // expect next character to be either an edit.tf function or Escape again to exit.
const EDITMODE_INSERT=3 // The next character is ready to insert

require('./edittf.js')
require('./cursor.js')
require('./ttxpage.js')

console.log("Test configuring")

var page=new TTXPAGE()
  page.init(0x100)

var website="http://edit.tf" // could be zxnet. Up to you
var cset=0 // WST EN

var encoding

console.log("Test started")
encoding=save_to_hash(cset, website, page)
console.log("Result=")
console.log(encoding)
console.log("Test finished")


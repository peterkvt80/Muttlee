// Run this unit test under node
'use strict'
/* global TTXPAGE, saveToHash */
const EDITMODE_NORMAL = 0 // normal viewing
const EDITMODE_EDIT = 1 // edit mode
const EDITMODE_ESCAPE = 2 // expect next character to be either an edit.tf function or Escape again to exit.
const EDITMODE_INSERT = 3 // The next character is ready to insert

require('./edittf.js')
require('./cursor.js')
require('./ttxpage.js')

console.log('Test configuring')

const page = new TTXPAGE()
page.init(0x190)
page.setSubPage(1)

// var website="http://edit.tf" // could be zxnet. Up to you
const website = 'https://zxnet.co.uk/teletext/editor/' // could be zxnet. Up to you
const cset = 0 // WST EN

let encoding

console.log('Test started')
encoding = saveToHash(cset, website, page)
console.log('Result=')
console.log(encoding)
console.log('Test finished')

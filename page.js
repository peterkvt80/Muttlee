/** page.js
* Encapsulate a teletext page object.
* Used to load, edit and save a tti file (MRG format teletext file)
*/
/* global DeEscapePrestel, EscapePrestel */
'use strict'
// io stream stuff
const fs = require('fs')
const readline = require('readline')

// import constants for use server-side
const CONST = require('./constants.js')

require('./utils.js') // Prestel and other string handling

// import logger
const LOG = require('./log.js')

global.Page = function () {
  // basic properties
  this.pageNumber = 0x100
  this.subpageNumber = 0
  this.ttiLines = [] // Each line in a tti file
  this.ttiLines.push('DE,random comment 1')
  this.changed = false /// true if the page has been edited
  this.filename = ''

  const that = this // should use bind(this) instead!

  this.loadPage = function (filename, callback, error) {
    that.filename = filename
    this.filename = filename
    this.cb = callback
    this.err = error

    const that2 = this

    LOG.fn(
      ['page', 'loadPage'],
      `Loading filename=${filename}`,
      LOG.LOG_LEVEL_INFO
    )

    that.ttiLines = [] // Clear the tti array

    const instream = fs.createReadStream(
      filename,
      {
        // ascii strips bit 7 without messing up the rest of the text. latin1 does not work :-(
        encoding: CONST.ENCODING_ASCII
      }
    )

    instream.on('error', function (err) {
      LOG.fn(
        ['page', 'loadPage'],
        `Error: ${err}`,
        LOG.LOG_LEVEL_ERROR
      )

      that2.err(err)
    })

    const rl = readline.createInterface({
      input: instream,
      terminal: false
    })

    rl.on('line', function (line) {
      that.ttiLines.push(DeEscapePrestel(line))
    })

    rl.on('close', function (line) {
      that2.cb(that.ttiLines) // probably don't want to return this except for testing
    })
  }

  // Editing
  // Handle keyMessage
  this.keyMessage = function (key) {
    let subcode = -1 // Signal an invalid code until we get a real one
    let insert = true
    let pageNumber = 0x100
    let rowIndex = 0 // The index of the line OR where we want to splice
    let fastext = '8ff,8ff,8ff,8ff,8ff,8ff'

    LOG.fn(
      ['page', 'keyMessage'],
      `Entered, row=${key.y}`,
      LOG.LOG_LEVEL_VERBOSE
    )

    // Validator does a tti format grammar check and splices out bad sections
    validatePage(this.ttiLines)

    // Scan for the subpage of the key
    for (let i = 0; i < this.ttiLines.length; i++) {
      let line = this.ttiLines[i] // get the next line
      const code = line.substring(0, 2) // get the two character command
      line = line.substring(3) // get the tail from the line

      if (code === 'FL') { // Fastext Link: Save the fastext link
        fastext = line
        if ((rowIndex === 0) && (key.subcode === subcode)) { // did we get to the end of the page without finding any rows?
          rowIndex = i - 1 // Splice before the FL // [!] todo Not sure that i is correct.
        }
      }

      if (code === 'PN') { // Page Number: Get the MPP
        pageNumber = parseInt(line, 16) >> 8
        // [!] @TODO Check the SS. Don't rely on the SC.
      }

      if (code === 'SC') {
        subcode++ // Don't use the file numbering, just increment

        LOG.fn(
          ['page', 'keyMessage'],
          `Parser in subcode=${subcode}`,
          LOG.LOG_LEVEL_VERBOSE
        )
      }

      if (code === 'DE') { // Description
        LOG.fn(
          ['page', 'keyMessage'],
          `Parser in description=${line}`,
          LOG.LOG_LEVEL_VERBOSE
        )
        // If new description comes in, it replaces this
        if (key.x === CONST.SIGNAL_DESCRIPTION_CHANGE) {
          this.ttiLines[i] = 'DE,' + key.k
        }
      }

      if (code === 'OL') { // Output Line
        let ix = 0
        let row = 0
        let ch = line.charAt(ix++)
        row = ch
        ch = line.charAt(ix)
        if (ch !== ',') {
          row = row + ch // haha. Strange maths
          ix++
        }

        row = parseInt(row)
        line = line.substring(++ix)

        if (key.s === subcode) { // if we are on the right page
          LOG.fn(
            ['page', 'keyMessage'],
            `Subcode matches, decoded row=${row}, line=${line}`,
            LOG.LOG_LEVEL_VERBOSE
          )

          if (key.y >= row) { // Save the new index if it is ahead of here
            rowIndex = i
            if (key.y === row) { // If we have found the line that we want
              insert = false
              break
            }
          }
        }
        // How do we choose the insert point?
        // 1) If there is a matching row we edit that
        // 2) If there are other rows we add the new row in the correct order
        // 3) If there is NO row, then add it before the FL
        // 4) If there is no FL then add it before the next SC
        // 5) If we reach the end then put it at the end
      } // OL
    } // Find the splice point

    if ((key.s === subcode) && (rowIndex === 0)) { // If no splice point was found then add to the end of the file
      rowIndex = this.ttiLines.length - 1
    }

    LOG.fn(
      ['page', 'keyMessage'],
      `Insert point=${rowIndex}`,
      LOG.LOG_LEVEL_VERBOSE
    )

    if (key.s > subcode) { // We didn't find the subcode? Lets add it
      this.ttiLines.push('CT,8,T')

      let str = 'PN,' + pageNumber.toString(16)
      str += ('0' + key.s).slice(-2)

      this.ttiLines.push(str) // add the subcode
      this.ttiLines.push('SC,' + ('000' + key.s).slice(-4)) // add the four digit subcode
      this.ttiLines.push('PS,8000')
      this.ttiLines.push('RE,0')

      rowIndex = this.ttiLines.length - 1

      this.ttiLines.push('FL,' + fastext)
    }

    // we should now have the line in which we are going to do the insert
    if (insert) {
      this.ttiLines.splice(++rowIndex, 0, 'OL,' + key.y + ',                                        ')
    }

    let offset = 5 // OL,n,
    if (key.y > 9) {
      offset = 6 // OL,nn,
    }

    this.ttiLines[rowIndex] = setCharAt(this.ttiLines[rowIndex], key.x + offset, key.k)
  }

  this.savePage = function (filename, cb, error) {
    // WARNING. We are saving to the stored filename!

    LOG.fn(
      ['page', 'savePage'],
      `Saving, filename=${this.filename}`,
      LOG.LOG_LEVEL_INFO
    )

    this.callback = cb
    // this.filename='/dev/shm/test.tti' // @todo Check the integrity

    let txt = ''

    // Copy and escape the resulting lines, being careful not to escape the terminator
    for (let i = 0; i < this.ttiLines.length; i++) {
      txt += (EscapePrestel(this.ttiLines[i]) + '\n')
    }

    fs.writeFile(
      this.filename,
      txt,
      function (err) {
        if (err) {
          LOG.fn(
            ['page', 'savePage'],
            `Error: ${err}`,
            LOG.LOG_LEVEL_ERROR
          )

          error(err)
        } else {
          // this.callback() // Can't get this callback to work. Says NOT a function
        }
      }
    )
  }.bind(this)

  this.print = function () {
    for (let i = 0; i < this.ttiLines.length; i++) {
      console.log('[' + i + '] ' + this.ttiLines[i])
    }
  }
}

/** Utility */
function setCharAt (str, index, chr) {
  if (index > str.length - 1) return str
  return str.substr(0, index) + chr + str.substr(index + 1)
}

/**
 * @brief Validate a teletext page, and remove bits that are invalid
 * Rules:
 * 1) A header starts with the first line of the page
 * 2) A header can contain any of these line types in any order DE, DS, SP, CT, PN, SC, PS, RE
 * 3) Each header can have zero or one occurence of these line types, except PN which must exist.
 * 4) A header must have a valid PN. Any OL that arrives with a valid PN is discarded.
 * 5) When OL is received, it becomes the page body.
 * 6) When FL is received, expect the next header.
 * 7) If a header arrives while in body mode, go to header mode
 * 8) The next header must have a page number mppss, where mpp is the same and ss is a higher number than the previous header.
 * The general idea is that if we don't like a line, make it null in the first pass, then splice out the nulls in the second pass
 * @param page : A page is a ttifile that has been loaded into an array of strings
 */
function validatePage (ttiLines) {
  // State machine constants
  const EXPECT_HEADER = 0 // Initial condition. (rule 1)
  const IN_HEADER = 1 // While parsing header (rule 2)
  const IN_VALID_PN = 2 // Found a valid PN in the header (rule 4)
  const IN_BODY = 3 // While parsing OL rows (rule 5)

  // Parse values
  let parseState = EXPECT_HEADER // state machine (rule 1)
  let mpp = -1 // PN: Magazine and page number 100 .. 8ff
  let ss = -1 // PN: Subpage 00..79
  console.log('[validatPage] ' + ttiLines)

  LOG.fn(
    ['page', 'validatePage'],
    `Line count = ${ttiLines.length}`,
    LOG.LOG_LEVEL_VERBOSE
  )
  for (const li in ttiLines) {
    const line = ttiLines[li]
    console.log('The next line is ' + line)
    const tokens = line.split(',')
    // Handle the header rows (rule 2)
    const isHeader = ['DE', 'DS', 'SP', 'CT', 'PN', 'SC', 'PS', 'RE'].includes(tokens[0])
    console.log('isHeader  = ' + isHeader)
    if (isHeader) {
      if (parseState === EXPECT_HEADER) {
        console.log('[PARSER] IN_HEADER')
        parseState = IN_HEADER
      }
      // [!] @TODO Check the occurences of each type. Allow no more than one (rule 3)
      // [!] @TODO Null out duplicates
      if (tokens[0] === 'PN') { // Does this header have a valid PN? (Rule 4)
        const mag = parseInt(tokens[1], 16) >> 8
        const subpage = parseInt(tokens[1].substring(3))
        mpp = mag
        // If the PN valid? (rule 8)
        if ((mpp > 0 && mpp !== mag) || (ss > -1 && ss >= subpage)) {
          // Subsequent subpage is invalid.
          // Either the mpp doesn't match or subpage is not increasing
          ttiLines[li] = '' // Blank this line
        } else {
          mpp = mag
          ss = subpage
          console.log('[PARSER] IN_VALID_PN')
          parseState = IN_VALID_PN // We can now accept an OL (rule 4)
        }
        console.log('PN mag = ', mag.toString(16))
        console.log('PN sub = ', subpage)
        console.log('PN = ', tokens[1])
      }
    }
    // Is it a valid row?
    const isBody = tokens[0] === 'OL'
    if (isBody && parseState === IN_VALID_PN) {
      parseState = IN_BODY // (rule 5)
      console.log('[PARSER] IN_BODY')
    }

    //
    if (parseState === IN_BODY) {
      if (tokens[0] === 'OL') {
        // [!] @todo Check that there are no more than one rows in the range 0..24
        // [!] @TODO Null out duplicates 0..24
        // [!] @TODO Limit duplicates for special packets
        // Is it a fastext link? (rule 6)
      } else if (tokens[0] === 'FL') {
        parseState = EXPECT_HEADER // Next subpage
      } else {
        console.log('[PARSER] EXPECT_HEADER')
        parseState = EXPECT_HEADER // (rule 7)
      }
    }
  } // For all lines

  // [!] @TODO Parse again and splice out null lines
}

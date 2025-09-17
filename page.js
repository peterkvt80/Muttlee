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
  this.pageTime = 8 /// seconds per carousel page

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
  // Given an edit event parameter called key, it scans the page to find where the event should go.
  this.keyMessage = function (key) {
    let subcode = -1 // Signal an invalid code until we get a real one
    let insert = true
    let pageNumber = 0x100 // the mpp of mppss
    let pageSubCode = 0 // The ss of mppss
    let rowIndex = -1 // The index of the line OR where we want to splice. -1 = not found
    let fastext = '8ff,8ff,8ff,8ff,8ff,100'
    let noDescription = true // If we don't have a description, we need to add one

    LOG.fn(
      ['page', 'keyMessage'],
      `Entered, x=${key.x}, row=${key.y}`,
      LOG.LOG_LEVEL_VERBOSE
    )
    
    
    if (key.x === CONST.SIGNAL_DELETE_SUBPAGE) {
      this.deleteSubpage(key)
      return
    }

    // Scan for the subpage of the key
    for (let i = 0; i < this.ttiLines.length; i++) {
      let line = this.ttiLines[i] // get the next line
      const code = line.substring(0, 2) // get the two character command
      line = line.substring(3) // get the tail from the line

      if (code === 'FL') { // Fastext Link: Save the fastext link
        fastext = line
        // Replace the fastext
        if (key.x === CONST.SIGNAL_FASTEXT_CHANGE) {
          // Don't actually need to do this slice thing. It should never have leading zeros
          this.ttiLines[i] = 'FL,'
            + ('000'+key.fastext[0].toString(16)).slice(-3) + ','
            + ('000'+key.fastext[1].toString(16)).slice(-3) + ','
            + ('000'+key.fastext[2].toString(16)).slice(-3) + ','
            + ('000'+key.fastext[3].toString(16)).slice(-3) + ','
            + ('000'+key.fastext[4].toString(16)).slice(-3) + ','
            + ('000'+key.fastext[5].toString(16)).slice(-3)
            console.log('Setting FL to ' + this.ttiLines[i])
        } else
        if (key.s === pageSubCode) { // did we get to the end of the page without finding any rows?
          rowIndex = i - 1 // Splice before the FL // [!] todo Not sure that i is correct.
          LOG.fn(
            ['page', 'keyMessage'],
            `FL found instead of target row rowIndex = ${rowIndex}`,
            LOG.LOG_LEVEL_ERROR
          )
          break
        }
     }

      if (code === 'PN') { // Page Number: Get the MPP
        pageNumber = parseInt(line.substring(0, 3), 16)
        // Check the SS. Don't rely on the SC.
        pageSubCode = parseInt(line.substring(3, 5)) // Get SS
        LOG.fn(
          ['page', 'keyMessage'],
          `Parser in pageSubCode=${pageSubCode}`,
          LOG.LOG_LEVEL_VERBOSE
        )
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
        noDescription = false
        // If new description comes in, it replaces this
        if (key.x === CONST.SIGNAL_DESCRIPTION_CHANGE) {
          this.ttiLines[i] = 'DE,' + key.k
        }
      }
      
      if (code === 'CT') { // Counter/timer
        // Ignore C/T, just assume the number is the seconds for all the subpages
        const tokens = line.split(',')
        this.pageTime = parseInt(tokens[0]) // Not actually used. 
      }

      if (key.x === CONST.SIGNAL_DESCRIPTION_CHANGE) {
        console.log('[Page::Validate] Encountered a description: ' + key.k)
      }

      if (code === 'OL') { // Output Line
        // TODO: X28 row inserts need to be first, before row 1.
        let ix = 0
        let row = 0
        let ch = line.charAt(ix++)
        row = ch
        ch = line.charAt(ix)
        if (ch !== ',') {
          row = row + ch // haha. Javascript maths
          ix++
        }

        row = parseInt(row)
        line = line.substring(++ix)

//        if (key.y === 28) {
  //        console.log("[Page::keyMessage] X28 insert TODO")
    //    }
        if (key.s === pageSubCode) { // if we are on the right page
          // 1) Find the matching row and return that rowIndex
          // 2) If not, find the first row with a bigger row number and insert before that
          // 3) If not insert before whichever comes first: FL, PN, end of file. (FL is handled above)
          // @TODO Check that insert fallback happens on PN and end of file
          LOG.fn(
            ['page', 'keyMessage'],
            `Subcode matches, decoded row=${row}, line=${line}`,
            LOG.LOG_LEVEL_VERBOSE
          )
          
          if (row < 25) { // Only consider normal rows
          
            // Row seek 1 - We have found the row that we want
            if (key.y === row) { // If we have found the line that we want
              rowIndex = i    // The line that we are editing
              insert = false  // Don't insert a new line, edit the existing line
              break           // Don't seek any further
            }
            
            // Row seek 2 - Find the first row with a bigger row number and insert before that
            if (key.y < row) { // We didn't find the row (assuming that the rows are sequential)
              rowIndex = i - 1 // Insert before this row
              LOG.fn(
                ['page', 'keyMessage'],
                `Row seek 2 didn't find key.y=${key.y} in row=${row}`,
                LOG.LOG_LEVEL_VERBOSE
              )
              break // Don't seek any further
            }
            
          }
          
        } // We are in the correct subpage
        // How do we choose the insert point?
        // 1) If there is a matching row we edit that
        // 2) If there are other rows we add the new row in the correct order
        // 3) If there is NO row, then add it before the FL
        // 4) If there is no FL then add it before the next SC
        // 5) If we reach the end then put it at the end
      } // OL
    } // Find the splice point

    if ((key.s === pageSubCode) && (rowIndex === -1)) { // If no splice point was found then add to the end of the file
      // If this message pops up, then we probably have the wrong insert point
      LOG.fn(
        ['page', 'keyMessage'],
        `No insert point was found. Sticking this at the end of the file`,
        LOG.LOG_LEVEL_ERROR
      )

      rowIndex = this.ttiLines.length - 1
    }

    LOG.fn(
      ['page', 'keyMessage'],
      `Insert point=${rowIndex} Insert mode = ${insert}`,
      LOG.LOG_LEVEL_VERBOSE
    )

    if (key.s > pageSubCode) { // We didn't find the subcode? Lets add it
      LOG.fn(
        ['page', 'keyMessage'],
        `Adding subpage: key.s > subcode ${key.s}>=${pageSubCode}`,
        LOG.LOG_LEVEL_VERBOSE
      )
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
    if (key.row < 25) { // Edits only apply to displayable rows
      if (insert) {
        if (rowIndex === -1) { // We don't have a valid rowIndex
          LOG.fn(
            ['page', 'keyMessage'],
            `Failed to insert row. Invalid rowIndex -1`,
            LOG.LOG_LEVEL_ERROR
          )
          this.ttiLines.splice(++rowIndex, 0, 'OL,' + key.y + ',This line is in the wrong place ERROR   ')
        } else {
          LOG.fn(
            ['page', 'keyMessage'],
            `Inserting row number = ${key.y} `,
            LOG.LOG_LEVEL_ERROR
          )
          this.ttiLines.splice(++rowIndex, 0, 'OL,' + key.y + ',                                        ')
        }
      }
    }

    let offset = 5 // OL,n,
    if (key.y > 9) {
      offset = 6 // OL,nn,
    }

    if (key.y === 28) {
      this.ttiLines[rowIndex] = "OL,28,1000000000000000000000000000000000000000" // Placeholder
      // TODO: At this point convert the message to x28f1 TTI
      this.ttiLines[rowIndex] = 'OL,28,' + this.EncodeOL28(key.x28f1)
      console.log(this.ttiLines[rowIndex])    }     
    else
    {
      if (this.ttiLines[rowIndex].length < 45) {
        this.ttiLines[rowIndex] = this.ttiLines[rowIndex] + '                                        '
      }

      this.ttiLines[rowIndex] = setCharAt(this.ttiLines[rowIndex], key.x + offset, key.k)
      LOG.fn(
        ['page', 'keyMessage'],
        `Setting a character at row = ${rowIndex}:<${this.ttiLines[rowIndex]}>`,
        LOG.LOG_LEVEL_VERBOSE
      )
    }
    if (noDescription) {
      if (key.x === CONST.SIGNAL_DESCRIPTION_CHANGE) {
        this.ttiLines.unshift('DE,' + key.k)
      } else {
        this.ttiLines.unshift('DE,No description')
      }
    }
  }
  
  /** deleteSubpage deletes subpage
   * Updates this.ttiLines - Array of tti lines from the page file
   * @param key - The muttlee key event object
   *  Delete the subpage where
   *  Service - key.S
   *  page - key.p
   *  subpage - key.s
   */  
  this.deleteSubpage = function(key) {
    console.log(key)
    LOG.fn(
      ['page', 'deleteSubpage'],
      `Removing subpage=${key.s}`,
      LOG.LOG_LEVEL_VERBOSE
    )
    // Decode each line looking for PN and match our subpage
    // If the subpage matches then splice out lines until the next subpage arrives
    // Scan for the subpage of the key
    let pageSubCode = 0
    for (let i = 0; i < this.ttiLines.length; i++) {
      let line = this.ttiLines[i] // get the next line
      const code = line.substring(0, 2) // get the two character command
      line = line.substring(3) // get the tail from the line
      
      if (code === 'PN') { // Page Number: Don't need the mpp
        // Check the SS. Don't rely on the SC.
        pageSubCode = parseInt(line.substring(3, 5)) // Get SS
        LOG.fn(
          ['page', 'keyMessage'],
          `Parser in pageSubCode=${pageSubCode}`,
          LOG.LOG_LEVEL_VERBOSE
        )
      }
      
      if (code === 'FL') { // Treat FL as the last command in the current subpage
        // @TODO Remember this point in csse we have moved into the page that is being deleted
        // @TODO If this is the end of the subpage being deleted, what do we do?
      }
      
      if (pageSubCode === key.s) {
        // @TODO If there is an FL remembered then delete all the lines from there first
        console.log('[page::deleteSubpage] we are going to delete ' + this.ttiLines[i])
        // Probably have to mark the lines up with RM, and delete them in a second pass
      }
      
    } // For each line in file 
  } // deleteSubpage

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

  /**
   * @brief Validate a teletext page, and remove bits that are invalid
   * Rules:
   * 1) A header starts with the first line of the page
   * 2) A header can contain any of these line types in any order DE, DS, SP, CT, PN, SC, PS, RE
   * 3) Each header can have zero or one occurence of these line types, except PN which must occur once.
   * 4) A header must have a valid PN. Any OL that arrives without a valid PN is discarded.
   * 5) When OL is received, it becomes the page body.
   * 6) When FL is received, expect the next header.
   * 7) If a header arrives while in body mode, go to header mode
   * 8) The next header must have a page number mppss, where mpp is the same and ss is a higher number than the previous header.
   * The general idea is that if we don't like a line, make it null in the first pass, then splice out the nulls in the second pass
   * @param page : A page is a ttifile that has been loaded into an array of strings
   */
  this.validatePage = function () {
    // State machine constants
    const EXPECT_HEADER = 0 // Initial condition. (rule 1)
    const IN_HEADER = 1 // While parsing header (rule 2)
    const IN_VALID_PN = 2 // Found a valid PN in the header (rule 4)
    const IN_BODY = 3 // While parsing OL rows (rule 5)

    // Parse values
    let parseState = EXPECT_HEADER // state machine (rule 1)
    let mpp = -1 // PN: Magazine and page number 100 .. 8ff
    let ss = -1 // PN: Subpage 00..79
    console.log('[validatePage] ' + this.ttiLines)

    LOG.fn(
      ['page', 'validatePage'],
      `Line count = ${this.ttiLines.length}`,
      LOG.LOG_LEVEL_VERBOSE
    )
    for (const li in this.ttiLines) {
      const line = this.ttiLines[li]
      console.log('The next line is ' + line)
      const tokens = line.split(',')
      // Handle the header rows (rule 2)
      const isHeader = ['DE', 'DS', 'SP', 'CT', 'PN', 'SC', 'PS', 'RE'].includes(tokens[0])
      // console.log('isHeader  = ' + isHeader)
      if (isHeader) {
        if (parseState === EXPECT_HEADER) {
          console.log('[PARSER] IN_HEADER')
          parseState = IN_HEADER
        }
        // [!] @TODO Check the occurrences of each type. Allow no more than one (rule 3)
        // [!] @TODO Null out duplicates
        if (tokens[0] === 'PN') { // Does this header have a valid PN? (Rule 4)
          const mag = parseInt(tokens[1], 16) >> 8
          const subpage = parseInt(tokens[1].substring(3))
          mpp = mag
          // If the PN valid? (rule 8)
          if ((mpp > 0 && mpp !== mag) || (ss > -1 && ss >= subpage)) {
            // Subsequent subpage is invalid.
            // Either the mpp doesn't match or subpage is not increasing
            this.ttiLines[li] = 'RM,1,INVALID PN. MARKED FOR DELETION' + this.ttiLines[li]
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
      } // isHeader
      // Is it a valid row?
      const isBody = tokens[0] === 'OL'
      if (isBody) {
        switch (parseState) {
          case IN_VALID_PN: // OL follows a valid header
            parseState = IN_BODY // (rule 5)
            console.log('[PARSER] IN_BODY')
            break
          case EXPECT_HEADER: // OL not yet expected
            console.log('[PARSER] Unexpected OL before header')
            this.ttiLines[li] = 'RM,2,UNEXPECTED OL BEFORE HEADER. MARKED FOR DELETION' + this.ttiLines[li]
            break
          case IN_HEADER: // OL not yet expected
            console.log('[PARSER] Unexpected OL in header')
            this.ttiLines[li] = 'RM,3,UNEXPECTED OL IN HEADER. MARKED FOR DELETION' + this.ttiLines[li]
            break
          case IN_BODY: // Another OL. Carry on
            break
        }
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
    this.removeMarkedLines()
  } // Validatepage

  /** Remove lines starting "RM," from
   *  ttiLines[]
   */
  this.removeMarkedLines = function () {
    // [!] @TODO
  }

  /** < Encode X28/0 format 1 data into a tti OL,28 packet
   * Packs the colour palette and colour remappings into triplets
   * @return OL,28 line or -1 if it fails
   */
  this.EncodeOL28 = function(data) {
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
  }  
  
}

/** Utility */
function setCharAt (str, index, chr) {
  if (index > str.length - 1) return str
  return str.substr(0, index) + chr + str.substr(index + 1)
}

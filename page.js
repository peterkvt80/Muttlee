/** page.js
* Encapsulate a teletext page object.
* Used to load, edit and save a tti file (MRG format teletext file)
*/

// io stream stuff
const fs = require('fs');
const readline = require('readline');

require('./utils.js'); // Prestel and other string handling

// import logger
const LOG = require('./log.js');


Page = function () {
  // basic properties
  this.pageNumber = 0x100;
  this.subpageNumber = 0;
  this.ttiLines = [];  // Each line in a tti file
  this.ttiLines.push('DE,random comment 1');
  this.changed = false;  /// true if the page has been edited
  this.filename = '';

  var that = this;  // should use bind(this) instead!

  this.loadPage = function (filename, callback, error) {
    that.filename = filename;
    this.filename = filename;
    this.cb = callback;
    this.err = error;

    var that2 = this;

    LOG.fn(
      ['page', 'loadPage'],
      `Loading filename=${filename}`,
      LOG.LOG_LEVEL_INFO,
    );

    that.ttiLines = [];  // Clear the tti array

    var instream = fs.createReadStream(filename, {encoding: 'ascii'}); // Ascii strips bit 7 without messing up the rest of the text. latin1 does not work :-(
    instream.on('error', function (err) {
      LOG.fn(
        ['page', 'loadPage'],
        `Error: ${err}`,
        LOG.LOG_LEVEL_ERROR,
      );

      that2.err(err);
    });

    var rl = readline.createInterface({
      input: instream,
      terminal: false
    });

    rl.on('line', function (line) {
      that.ttiLines.push(DeEscapePrestel(line));
    });

    rl.on('close', function (line) {
      that2.cb(that.ttiLines); // probably don't want to return this except for testing
    });
  };

  // Editing
  // Handle keyMessage
  this.keyMessage = function (key) {
    var subcode = -1; // Signal an invalid code until we get a real one
    var insert = true;
    var pageNumber = 0x100;
    var rowIndex = 0;  // The index of the line OR where we want to splice
    var fastext = '8ff,8ff,8ff,8ff,8ff,8ff';

    LOG.fn(
      ['page', 'keyMessage'],
      `Entered, row=${key.y}`,
      LOG.LOG_LEVEL_VERBOSE,
    );

    // Scan for the subpage of the key
    for (let i = 0; i < this.ttiLines.length; i++) {
      let line = this.ttiLines[i]; // get the next line
      let code = line.substring(0, 2); // get the two character command
      line = line.substring(3);       // get the tail from the line

      if (code === 'FL') // Fastext Link: Save the fastext link
      {
        fastext = line;
        if ((rowIndex === 0) && (key.subcode === subcode))  // did we get to the end of the page without finding any rows?
        {
          rowIndex = ix - 1; // Splice before the FL
        }
      }

      if (code === 'PN') // Page Number: Get the MPP
      {
        pageNumber = parseInt(line, 16) >> 8;
      }

      if (code === 'SC') {
        subcode++;  // Don't use the file numbering, just increment

        LOG.fn(
          ['page', 'keyMessage'],
          `Parser in subcode=${subcode}`,
          LOG.LOG_LEVEL_VERBOSE,
        );
      }

      if (code === 'OL') // Output Line
      {
        let ix = 0;
        let row = 0;
        let ch = line.charAt(ix++);
        row = ch;
        ch = line.charAt(ix);
        if (ch !== ',') {
          row = row + ch; // haha. Strange maths
          ix++;
        }

        row = parseInt(row);
        line = line.substring(++ix);

        if (key.s === subcode) // if we are on the right page
        {
          LOG.fn(
            ['page', 'keyMessage'],
            `Subcode matches, decoded row=${row}, line=${line}`,
            LOG.LOG_LEVEL_VERBOSE,
          );

          if (key.y >= row)  // Save the new index if it is ahead of here
          {
            rowIndex = i;
            if (key.y === row)  // If we have found the line that we want
            {
              insert = false;
              break;
            }
          }
        }
        // How do we choose the insert point?
        // 1) If there is a matching row we edit that
        // 2) If there are other rows we add the new row in the correct order
        // 3) If there is NO row, then add it before the FL
        // 4) If there is no FL then add it before the next SC
        // 5) If we reach the end then put it at the end
      }  // OL
    }  // Find the splice point

    if ((key.s == subcode) && (rowIndex == 0))  // If no splice point was found then add to the end of the file
    {
      rowIndex = this.ttiLines.length - 1;
    }

    LOG.fn(
      ['page', 'keyMessage'],
      `Insert point=${rowIndex}`,
      LOG.LOG_LEVEL_VERBOSE,
    );

    if (key.s > subcode)  // We didn't find the subcode? Lets add it
    {
      this.ttiLines.push('CT,8,T');

      var str = 'PN,' + pageNumber.toString(16);
      str += ('0' + key.s).slice(-2);

      this.ttiLines.push(str); // add the subcode
      this.ttiLines.push('SC,' + ('000' + key.s).slice(-4));  // add the four digit subcode
      this.ttiLines.push('PS,8000');
      this.ttiLines.push('RE,0');

      rowIndex = this.ttiLines.length - 1;

      this.ttiLines.push('FL,' + fastext);
    }

    // we should now have the line in which we are going to do the insert
    if (insert) {
      this.ttiLines.splice(++rowIndex, 0, 'OL,' + key.y + ',                                        ');
    }

    var offset = 5;  // OL,n,
    if (key.y > 9) {
      offset = 6;   // OL,nn,
    }

    this.ttiLines[rowIndex] = setCharAt(this.ttiLines[rowIndex], key.x + offset, key.k);
  };

  this.savePage = function (filename, cb, error) {
    // WARNING. We are saving to the stored filename!

    LOG.fn(
      ['page', 'savePage'],
      `Saving, filename=${this.filename}`,
      LOG.LOG_LEVEL_INFO,
    );

    this.callback = cb;
    // this.filename='/dev/shm/test.tti' // @todo Check the integrity

    var txt = '';

    // Copy and escape the resulting lines, being careful not to escape the terminator
    for (let i = 0; i < this.ttiLines.length; i++) {
      txt += (EscapePrestel(this.ttiLines[i]) + '\n');
    }

    fs.writeFile(
      this.filename,
      txt,
      function (err) {
        if (err) {
          LOG.fn(
            ['page', 'savePage'],
            `Error: ${err}`,
            LOG.LOG_LEVEL_ERROR,
          );

          error(err);

        } else {
          // this.callback() // Can't get this callback to work. Says NOT a function
        }

      }.bind(this)
    )
  }.bind(this);

  this.print = function () {
    for (let i = 0; i < this.ttiLines.length; i++) {
      console.log('[' + i + '] ' + this.ttiLines[i]);
    }
  }
};


/** Utility */
function setCharAt(str, index, chr) {
  if (index > str.length - 1) return str;
  return str.substr(0, index) + chr + str.substr(index + 1);
}
/** servicelist.js
 *  Object that handles teletext services.
 *  This maintains a list of services.
 *
 *  The methods that it should handle are:
 *  Add service
 *  Delete service
 *  Find service
 *  doLoad should find the relevant service, then let service find the page, then the page will load the
 */

var fs = require('fs');
var readline = require('readline');

require('./service.js'); // teletext service
require('./public/page.js'); // Page to put in a service


ServiceList = function (callback) {     // This callback is used to send a page
  var data = {
    S: 'BBCNEWS/BBC',
    page: 100, // Page mpp
    s: 0, // subpage 0
    x: 0, // This signals that we should load the initial page (usually 100)
    y: 0,
    rowText: '',
  };

  var targetPage = new TextPage(data);

  this.initialPage = 100;
  this.services = [];
  //this.callback=callback;

  /** Finds the service with the required name.
   * @return Index of service, or false;
   */
  const findService = function (services, name) {
    console.log('[ServiceList::findService] seeking ' + name);

    if (services.length === 0) {
      // No services
      return false;
    }

    for (var i = 0; i < services.length; i++) {
      if (services[i].matchName(name))
        return i;
    }

    return false; // Not found
  };

  /**
   * doLoad loads a page.
   * It loads the page into a service cache and then emits it to the client.
   * On subsequent loads, the cache is sent.
   * The cache also accepts updates from the client.
   * When updated, the updates are emitted to all the clients that are looking at this page.
   * The cache is written back to the disk periodically.
   * A long interval is used to expire a cache entry. If it is not being used then remove it.
   * A short interval is used to save the cache back to disk. This keeps the disk version up to date without saving after every single keystroke.
   */
  this.doLoad = function (pageData) {
    targetPage.blank();

    var data = pageData; // copy needed here???

    // For some reason, services does not get initialised in the contructor.
    if (typeof this.services === 'undefined') {
      this.services = [];
    }

    console.log('[ServiceList::doLoad]doing a load, pageData=' + pageData + ' data=' + data);

    // Find the filename that we want to load
    if (data.x === 2000) {
      data.p = 100;//initialPage;
      data.x = 0;
    }

    var filename = data.S + data.p + '.ttix';  // This is the actual filename that we want to load

    console.log('[ServiceList::doLoad] filename=' + filename + ' Services.length=' + this.services.length);

    // Which service object do we want to send it to?

    // Check if the page is already in cache
    var found = findService(this.services, data.S);
    if (found === false) {
      console.log('[ServiceList::doLoad] Adding service called ' + data.S);

      this.services.push(new Service(data.S));  // create the service
      found = this.services.length - 1; // The index of the service we just created
    }

    // Now we have a service name. Does it contain our page?
    var svc = this.services[found];
    var page = svc.findPage(data.p);

    console.log('[doload]setting page to ' + data.p);
    targetPage.pageNumber = data.p;

    if (page === false) {
      console.log('[servicelist::doLoad]Page not found ' + data.p);

      // What happens here? The page is loaded from disk into cache and added to the page list
      var fail = false;

      var instream;
      instream = fs.createReadStream(filename);
      instream.on('error', function () {
        var data2 = {
          x: -1 // Signal a 404 error
        };

        this.doLoad(data2);
      });

      // Make a new page object
      targetPage = new TextPage(data);

      console.log('[servicelist::doLoad] made a new page');

      rl = readline.createInterface({
        input: instream,
        terminal: false,
      });

      /** This procedure is called for each line itself until the whole page is read
       *  We take this opportunity to populate a page object.
       */
      rl.on('line', function (line) {
        if (line.indexOf('DE,') == 0) {   // Detect a description row
          var desc = line.substring(3);
          //this.io.sockets.emit('description',desc); // Probably a huge mistake having this here !!!!!!! Move io back to top level/
          console.log('[Read]Description' + desc);
          targetPage.setDescription(desc);

        } else if (line.indexOf('FL,') === 0) { // Detect a Fastext link
          var ch;
          var ix = 3;

          data.fastext = [];

          for (var link = 0; link < 4; link++) {
            var flink = '';
            for (ch = line.charAt(ix++); ch != ',';) {
              flink = flink + ch;
              ch = line.charAt(ix++);
            }

            data.fastext[link] = flink;

            console.log('Link ' + link + ' = ' + flink);
          }

          //this.io.sockets.emit('fastext',data);
          console.log('[Read]fastext' + data);

          return;

        } else if (line.indexOf('OL,') === 0) {  // Detect a teletext row
          var p = 0;
          var ix = 3;
          var row = 0;
          var ch;
          ch = line.charAt(ix);
          if (ch != ',') {
            row = ch;
          }
          ix++;
          ch = line.charAt(ix);
          if (ch != ',') {
            row = row + ch; // haha. Strange maths
            ix++;
          }
          row = parseInt(row);

          ix++; // Should be pointing to the first character now

        } else {
          // Not a row. Not interested
          return;
        }

        data.y = row;
        // @todo - Handle strings shorter than 40 characters

        // Here is a line at a time
        var result = '';
        for (var i = 0; i < 40; i++) {
          var ch = line.charAt(ix++);
          if (ch === '\u001b') { // Prestel escape
            ch = line.charAt(ix++).charCodeAt() - 0x40;// - 0x40;
            ch = String.fromCharCode(ch);
          }

          data.k = ch;
          data.x = i;
          // io.sockets.emit('keystroke', data);
          result += ch;
        }

        data.y = row;
        data.rowText = result;

        // this.io.sockets.emit('row',data);
        targetPage.setRow(data.p, data.y, data.rowText);
        targetPage.pageNumber = data.p; // having trouble setting this and making it stick

      }.bind(this));

      // Handler for the close event when this file is finished.
      rl.on('close', () => {
        //console.log('[readline::close]Javascript is weird');
        //console.log('[readline::close]data= ');
        //console.log(data);
        //console.log('[readLine] about to send targetPage >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>');
        //targetPage.dump();
        callback(data, targetPage);
        // console.log('[readLine] targetPage sent <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<');
      }.bind(this).bind(targetPage);

    } else {
      console.log('[doload]setting page to ' + data.p);
      targetPage.pageNumber = data.p;
    }
  };
};
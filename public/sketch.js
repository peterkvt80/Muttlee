// teletext
let myPage, ttxFont;
let serviceSelector;

// metrics
let gTtxW, gTtxH;
const gTtxFontSize = 20;

// page selection
let digit1 = '1';
let digit2 = '0';
let digit3 = '0';

let hdr;

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 550;

// comms
let socket;
let gClientID = null; // Our unique connection id

// x signals
const SIGNAL_PAGE_NOT_FOUND = -1;
const SIGNAL_INITIAL_LOAD = 2000;

// state
//const EDITMODE_NORMAL=0 // normal viewing
//const EDITMODE_EDIT=1   // edit mode
//const EDITMODE_ESCAPE=2 // expect next character to be either an edit.tf function or Escape again to exit.
//const EDITMODE_INSERT=3 // The next character is ready to insert
let editMode=EDITMODE_NORMAL

// dom
let redButton, greenButton, yellowButton, cyanButton
let inputPage
let indexButton

// timer
// Timer for expiring incomplete keypad entries
let expiredState=true // True for four seconds after the last keypad number was typed OR until a valid page number is typed
let forceUpdate=false // Set true if the screen needs to be updated
let timeoutVar

// canvas
let cnv;

// indicate changes that have not been processed by the server yet
let changed;

// block
let blockStart; // block select


/** mapKey
 *  \brief Maps a keyboard key to a teletext code
 * Currently only maps English but should be extended to at least WST
 * \return The mapped key
 */
function mapKey(key)
{
  // These are english mappings
  // Don't need to do $, @, ^, | because they are the same
  // Don't need to do  [, ], \, ¬  because they can't be mapped
  switch (key)
  {
   // '@' // 0x40 ampersand
   // '[' // 0x5b left arrow
   // '\' // 0x5c half
   // ']' // 0x5d right arrow
   // '^' // 0x5e up arrow
   // Only these need mapping where the ASCII code does not match the teletext
   case '£' : return '#' // 0x23 -> 0x24
   case '#' : return '_' // 0x24 -> 0x5f
   case '_' : return '`' // 0x5f -> 0x60
   // '{' quarter 0x7b
   // '|' pipe 0x7c
   // '}' three quarters 0x7d
   // '~' divide 0x7e
  }
  return key
}


function startTimer()
{
	expiredState=false
	// If there is a timeout active then clear it
	if (timeoutVar==null) // A new keypad entry starts
	{
		digit1='0'
		digit2='0'
		digit3='0'
	}
	else
	{
		clearTimeout(timeoutVar) // Continue an existing keypad entry
	}
	timeoutVar=setTimeout(function() {
		expiredState=true
		// console.log("Expire actions get done here")
		// todo: Restore the page number. Enable the refresh loop
		let p=myPage.pageNumber
		digit1=(String)((p >> 8) & 0xf)
		digit2=(String)((p >> 4) & 0xf)
		digit3=(String)(p & 0xf)
		myPage.pageNumberEntry=digit1+digit2+digit3
		// todo Put this into row 0
		myPage.rows[0].setpagetext(digit1+digit2+digit3)
		timeoutVar=null
	} , 4000)
}




function preload() {
  // load font files
  ttxFont = loadFont("assets/teletext2.ttf"); // Normal
  ttxFontDH = loadFont("assets/teletext4.ttf"); // Double height
}


function setup() {
  // Try to make a debug and on-air version
  // socket=io.connect('http://192.168.1.11:3010');
  socket=io.connect('http://www.xenoxxx.com:80');
  // socket=io.connect('http://23.251.131.26:8080');
  // socket=io.connect('http://localhost:80');

  // create the p5 canvas, and move it into the #canvas DOM element
  cnv = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  cnv.parent('canvas');

  // observe mouse press events on p5 canvas
  cnv.mousePressed(
    function () {
      if (editMode !== EDITMODE_NORMAL) {   // Only need to do this in edit mode
        const xLoc = int(mouseX / gTtxW);
        const yLoc = int(mouseY / gTtxH);

        if (xLoc >= 0 && xLoc < 40 && yLoc >= 0 && yLoc < 25) {
          myPage.cursor.moveTo(xLoc, yLoc);

          console.log('The mouse was clicked at ' + xLoc + ' ' + yLoc);
        }
      }

      return false; // Prevent default behaviour
    }
  );

  // font metrics
  textFont(ttxFont);
  textSize(gTtxFontSize);

  gTtxW = textWidth('M');
  gTtxH = gTtxFontSize;

  myPage = new TTXPAGE();
  myPage.init(0x100);

  // message events
  socket.on('keystroke', newCharFromServer);
  socket.on('row', setRow); // A teletext row
  socket.on('blank', setBlank); // Clear the page
  socket.on('fastext', setFastext);
  socket.on('setpage', setPageNumber); // Allow the server to change the page number (Page 404 etc)
  socket.on('description', setDescription);
  socket.on('subpage', setSubPage); // Subpage number for carousels (Expect two digits 00..99) [99 is higher than actual spec]
  socket.on('timer', setTimer); // Subpage timing. Currently this is just an overall value. Need to implement for animations
  socket.on('id', setID); // id is a socket id that identifies this client. Use this when requesting a page load
  //hdr=new header(0,1,0,0)

  //indexButton=select('#index')
	//indexButton.mousePressed(fastextIndex)
		
	
  btnkx=select('#khold')
	btnkx.mousePressed(khold)
  btnky=select('#krvl')
	btnky.mousePressed(krvl)
  btnkback=select('#kback')
	btnkback.mousePressed(kback)
  btnkfwd=select('#kfwd')
	btnkfwd.mousePressed(kfwd)

  inputPage = select('#pageNumber');
  frameRate(10);
  
  let offset=CANVAS_WIDTH+(displayWidth-CANVAS_WIDTH)/2


  // create page number input field
  inputPage = select('#pageNumber');

  // set frame rate
  frameRate(10);

  // indicate changes that have not been processed by the server yet
  changed = new CHARCHANGED();
}


openTeefax = function () {
  window.open('?service=');
};

openD2K = function () {
  window.open('?service=d2k');
};

openReadback = function () {
  window.open('?service=readback');
};

openWTF = function () {
  window.open('?service=wtf');
};

cheatSheet = function () {
  window.open('/assets/WikiTelFax.pdf');
};


function serviceChange()
{
  let item=serviceSelector.value()
  console.log("Selected option= "+item)
}

function setTimer(data)
{
  myPage.setTimer(data.fastext[0])  
}

function setSubPage(data)
{
	if (data.id!=gClientID && gClientID!=null) return;	// Not for us?

	myPage.setSubPage(parseInt(data.line))
}

/** We MUST be sent the connection ID or we won't be able to display anything
 */
function setID(id)
{
	console.log("Our connection ID is "+id)
	gClientID=id
	
  // Now we can load the initial page 100
  let data=
  {
	S: myPage.service, // The codename of the service. eg. d2k or undefined
	p: 0x100, // Page mpp
	s:0,	// subpage 0
	x:SIGNAL_INITIAL_LOAD, // A secret flag to do an initial load
	y: 0,
	rowText: '',
	id: gClientID
  }
  socket.emit('load',data)
}

function setDescription(data) {
  if (data.id !== gClientID && gClientID !== null) {
    return;  // Not for us?
  }

  // console.log('[setDescription]setting page description to '+desc)
  myPage.description=data.desc;
  document.getElementById('description').innerHTML = '<strong>Page info</strong>: ' + data.desc;
}

function setPageNumber(data)
{
	if (data.id!=gClientID && gClientID!=null) return;	// Not for us?
    console.log('[setPageNumber]setting page to '+data.p.toString(16)+"Service="+data.S)
	myPage.setPage(data.p)
	myPage.setService(data.S)    
}

// Handle the button UI
function fastextR()
{
	fastext(1)
}
function fastextG()
{
	fastext(2)
}
function fastextY()
{
	fastext(3)
}
function fastextC()
{
	fastext(4)
}

function fastextIndex()
{
	fastext(6)
}
 
/**
 * Load the fastext link
 * @param index 0..3
 */
function fastext(index)
{
	console.log('Fastext pressed: '+index)
  let createPage=false // Special case. If yellow link is >0x0fff then create a page
	switch (index)
	{
	case 1:page=myPage.redLink;break
	case 2:page=myPage.greenLink;break
	case 3:
    // Special hack for yellow:
    // If page is greater than 0x0fff then it is a request to create the page
    page=myPage.yellowLink
    if (page>0x0fff)
    {
      page &=0x0fff
      createPage=true
    }
    break
	case 4:page=myPage.cyanLink;break
	case 6:page=myPage.indexLink;break
	default:
		page=myPage.redLink
	}
	console.log('Fastext pressed: '+index+" link to 0x"+page.toString(16)+" ("+page+")")
	if (page>=0x100 && page<=0x8ff) // Page in range
	{
		myPage.setPage(page) // We now have a different page number
    let data=
    {
      S: myPage.service,
      p: page, // Page mpp
      s: 0,	// @ todo subpage	
      x: 0,
      y: 0,
      rowText: '',
      id: gClientID
    }	
    if (createPage) // Special case
    {
      
      socket.emit('create',data)	
    }
    else
    {
      socket.emit('load',data)	
    }
	}
}

function setFastext(data)
{
  if (!matchpage(data)) return; // Data is not for our page?
	if (data.id!=gClientID && gClientID!=null) return;	// Not for us?
	
	myPage.redLink=parseInt   ("0x"+data.fastext[0])
	myPage.greenLink=parseInt ("0x"+data.fastext[1])
	myPage.yellowLink=parseInt("0x"+data.fastext[2])
	myPage.cyanLink=parseInt  ("0x"+data.fastext[3])
	myPage.indexLink=parseInt ("0x"+data.fastext[5])
}

function draw()
{
	// No updating while we are pressing the mouse OR while typing in a page number
	if (!forceUpdate)
	{
		if (blockStart!=null || !expiredState )
			return
	}
	else
		forceUpdate=false
  // @todo We only need to update this during updates. No more than twice a second. Could save a lot of CPU
  background(0)
  noStroke()
  fill(255,255,255)
  // ellipse(mouseX,mouseY,10,10)
  myPage.draw(changed)
}

// Does our page match the incoming message?
function matchpage(data)
{
	//console.log ("Matching myPage.service, data.S "+myPage.service+' '+data.S)
	if (myPage.service!=data.S) return false
	//console.log ("Matching data.p, myPage.pageNumber"+data.p.toString(16)+' '+myPage.pageNumber.toString(16))
	if (myPage.pageNumber!=data.p) return false
	// if (myPage.subPage!=data.s) return false // This needs more thought now that we are implementing carousels
	return true
}

/** newCharFromServer only differs from newChar in that it does not move the cursor
 */
function newCharFromServer(data)
{
  newChar(data,false)
}

/** AlphaInGraphics
 *  \param key - Key to test 
 * \return - true if it is a prinatable character when in graphics mode
 * Note that this is only valid for the England character set
 * When processKey translates keys, we probably don't need to alter this?
 */
function AlphaInGraphics(key)
{
  return (key.charCodeAt()>=0x40 && key.charCodeAt()<0x60)
// This code not needed now that we pre-map characters into teletext space  
/*
  if (key>='A' && key<='Z')    
  {
    return true
  }    
  if (key=='[') return true // left arrow
  if (key==']') return true // right arrow
  if (key=='@') return true
  if (key=='\\') return true // half
  if (key=='^') return true // up arrow
  if (key=='_') return true // hash  
  return false
  */
}

// Message handlers....
/** newChar
 * \param data - keyStroke
 * \param local - default true. Set local to false if the keystroke came from the server
 This is because 1) we don't want the remote user to move our cursor. 2) We don't want to interpret qwaszx from a remote user
 * \return The data key is returned and if graphics then the mosaic
 *
 */
function newChar(data, local=true) // 'keystroke'
{
  // If nothing else, we note that our character returned and can be marked as "processed"
  if (local)
  {
    changed.set(data.x,data.y) // local change
    console.log("Set x="+data.x);
  }
  else
  {
    changed.clear(data.x,data.y) // remote change
    console.log("Cleared x="+data.x);
  }
  //if (data.k<' ')
  // console.log("returned keycode="+(data.k))
  // @todo page number test
  if (!matchpage(data)) return; // Char is not for our page?
  let key=data.k
  // We should now look if graphic mode is set at this char.
  // If graphics mode is set, only allow qwaszx and map the bits of the current character
  // At (x,y) on subpage s, place the character k
  let graphicsMode=myPage.IsGraphics(data) // what about the subpage???
  let advanceCursor=local // Cursor advances, unless it is a remote user or a graphics twiddle
  let alphaInGraphics=AlphaInGraphics(key) // Graphics but not a twiddle key?
  if (local)
  {
    // Do the graphics, unless this an edit tf escape. Or an upper case letter.
    if (graphicsMode && editMode!=EDITMODE_INSERT && !alphaInGraphics) // Take the original pixel and xor our selected bit
    {
      
      key=data.k.toUpperCase() // @todo. Do we need to consider subpages and services? Maybe just subpages.
      let bit=0
      advanceCursor=false
      switch (key)
      {
        // sixel modifying
        case 'Q' : bit=0x01;break        
        case 'W' : bit=0x02;break
        case 'A' : bit=0x04;break
        case 'S' : bit=0x08;break
        case 'Z' : bit=0x10;break
        case 'X' : bit=0x40;break // Note the discontinuity due to the gap.
        // R=Reverse, F=fill
        case 'R' : bit=0x5f;break // reverse all bits
        case 'F' : bit=0xff;break // set all bits
        case 'C' : bit=0x00;break // clear all bits
        
        default: return key       
      }
      if (bit==0)
      {
        key=0x20 // All pixels off
      }
      else if (bit==0xff)
      {
        key=0x7f // All pixels on
      }
      else
      {
        key=myPage.getChar(data) // Get the original character
        key=key^bit | 0x20 // And set bit 5 so we only make mosaics
      }
      key=String.fromCharCode(key) // Convert to ascii
      console.log ("[newChar] Graphics key="+key+" bit="+bit)
      // What is the problem? The data is being inserted as an ascii number rather than the code
    }
  }
  else
  {
    advanceCursor=false
  }
  if (advanceCursor)
  { 
    myPage.cursor.right()  // advance the cursor if it is the local user
  }
  
  myPage.drawchar(key,data.x,data.y,data.s) // write the character
  //console.log(data)
  if (editMode==EDITMODE_INSERT)
  {
    editMode=EDITMODE_EDIT
  }
  return key
} // newChar

// A whole line is updated at a time
function setRow(r) // 'row'
{
  // console.log("Going to set row="+(r.rowNumber))
  if (!matchpage(r)) return;
	if (r.id!=gClientID && gClientID!=null) return;	// Not for us?
  myPage.setRow(r.y,r.rowText)
}

// Clear the page to blank (all black)
function setBlank(data) // 'blank'
{
  if (!matchpage(data)) return;
	if (data.id!=gClientID && gClientID!=null) return;	// Not for us?
  myPage.setBlank()
}

function inputNumber()
{
  console.log("inputNumber changed");

  if (inputPage && inputPage.elt) {
    const pageValue = inputPage.elt.value;

    console.log("Opening page=" + pageValue);

    // Now load the page
    if (pageValue.length === 3) {
      processKey(pageValue.charAt(0));
      processKey(pageValue.charAt(1));
      processKey(pageValue.charAt(2));

      inputPage.elt.blur();
    }
  }
}

function keyRelease()
{
  console.log (" release")
}

/** built in function.
 *  Fires on all key presses
 */
function keyPressed() // This is called before keyTyped
{
  console.log("k=" + keyCode);

  let handled = true;

  if (document.activeElement.id) {
    console.log("Active element=" + document.activeElement.id);
  }

  if ((inputPage && inputPage.elt) && (document.activeElement === inputPage.elt)) {
    // Don't prevent native event propagation on input element
    handled = false;

  } else {
    // todo: Kill refresh cycles while the input is active.
    switch (keyCode) {
      case LEFT_ARROW:
        if (editMode === EDITMODE_EDIT) myPage.cursor.left();
        break;

      case RIGHT_ARROW:
        if (editMode === EDITMODE_EDIT) myPage.cursor.right();
        break;

      case UP_ARROW:
        if (editMode === EDITMODE_EDIT) myPage.cursor.up();
        break;

      case DOWN_ARROW:
        if (editMode === EDITMODE_EDIT) myPage.cursor.down();
        break;

      case ESCAPE:
        // @todo A more sophisticated access scheme
        if (
          [
            'wtf',
            'amigarob',
            'artfax',
            'channel19'
          ].includes(myPage.service)
        ) {
          break;
        }

        switch (editMode) {
          case EDITMODE_NORMAL:
            editMode = EDITMODE_EDIT;
            break;

          case EDITMODE_EDIT:
            editMode = EDITMODE_ESCAPE;
            break;

          case EDITMODE_ESCAPE:
            editMode = EDITMODE_NORMAL;
            break;
        }

        myPage.editSwitch(editMode);
        break;

      case TAB: // Insert a space
        myPage.insertSpace(); // Do our page
        insertSpace();       // Any other clients
        editMode = EDITMODE_EDIT;
        break;

      case BACKSPACE: // Remove current character, move the remainder one char left.
        myPage.backSpace();
        backSpace();
        editMode = EDITMODE_EDIT;
        break;

      case 33: // PAGE_UP (next subpage when in edit mode)
        if (editMode === EDITMODE_EDIT) {
          myPage.nextSubpage();
        }
        break;

      case 34: // PAGE_DOWN (prev subpage when in edit mode)
        if (editMode === EDITMODE_EDIT) {
          myPage.prevSubpage();
        }
        break;

      case 35: // END - move to the last character on this line (ideally the first blank character after the last non-blank)
        myPage.end();
        break;

      case 36: // HOME - move to the first character on this line
        myPage.home();
        break;

      case 45: // INSERT - Add a subpage
        myPage.addSubPage();
        break;

      case 46: // DELETE - Delete a subpage
        myPage.removeSubPage();
        break;

      default:
        handled = false;
    }
  }

  // Signal whether the key should be processed any further
  return !handled;
}

/** This inserts a space on the server and any listening client,
 *  Not our own page.
 */
function insertSpace()
{
  let xp=39
  let txt=
  {
    S: myPage.service, // service number
    p: myPage.pageNumber,
    s: myPage.subPage,
    k: 'q',
    x: myPage.cursor.x,
    y: myPage.cursor.y,
    id: gClientID
  }
  for (let xp=39;xp>myPage.cursor.x;xp--)
  {
    // This looks a bit weird, but keystroke automatically advances the insert position
    txt.x=xp
    let ch=myPage.getChar(txt)
    // txt.x=xp
    txt.k=String.fromCharCode(ch)
    socket.emit('keystroke', txt)
  }
  // Finally insert a space
  txt.k=' '
  txt.x=myPage.cursor.x,
  socket.emit('keystroke', txt)  
}

/** Delete the current character by shifting all characters to the right by 1
 * This deletes on the server and any listening client,
 *  Not on our own page.
 */
function backSpace()
{
  let txt=
  {
    S: myPage.service, // service number
    p: myPage.pageNumber,
    s: myPage.subPage,
    k: 'q',
    x: myPage.cursor.x,
    y: myPage.cursor.y,
    id: gClientID
  }
  for (let xp=myPage.cursor.x;xp<40;xp++)
  {
    txt.x=xp
    let ch=myPage.getChar(txt)
    txt.k=String.fromCharCode(ch)
    socket.emit('keystroke', txt)
  }
  // Finally insert a space
  txt.k=' '
  txt.x=39,
  socket.emit('keystroke', txt)  
}

/** edit mode is entered if any non numeric code is typed
 *  edit mode exits if <esc> is pressed
 *  This p5js function doesn't fire on Ctrl, Alt, Shift etc.
 */
function keyTyped()
{
  console.log('keyTyped keycode=' + keyCode);

  if ((inputPage && inputPage.elt) && (document.activeElement === inputPage.elt)) {
    // keypress in the page number input field...
    setTimeout(
      function () {
        if (inputPage.elt.value.length === 3) {
          // trigger blur event, in order to trigger input element onchange function
          inputPage.elt.blur();
        }
      },
      0,
    );

    return true;    // Don't prevent native event propagation on input element

  } else {
    // keypress anywhere else...
    key = mapKey(key);
    processKey(key);

    return false;   // Prevent triggering any other behaviour
  }
}

/**
 * 
*/
function processKey(keyPressed)
{
  // console.log('processKey='+keyPressed)
  // @todo need to map codes to national options at this point.
  // @todo Also need to fix AlphaInGraphics when I do this
  if (editMode==EDITMODE_ESCAPE)
  {
      // console.log("[keyPressed] Reminder that this is where edit.tf commands are processed")
      editMode=EDITMODE_INSERT
      myPage.editSwitch(editMode)
      // console.log("[keyPressed] keyCode="+keyCode+" key="+key)
      editTF(key)
      return
  }
	if (editMode!=EDITMODE_NORMAL) // Numbers are typed into the page
	{
		let data=
		{
			S: myPage.service, // service number
			p: myPage.pageNumber,
			s: myPage.subPage,
			k: keyPressed,
			x: myPage.cursor.x,
			y: myPage.cursor.y,
			id: gClientID
		}
		data.k=newChar(data)  // Return the key in case we are in mosaic twiddle mode. ie. don't return qwaszx.
		socket.emit('keystroke', data)
	}
	else // Numbers are used for the page selection
	{
		if (keyPressed>='0' && keyPressed <='9')
		{
			if (inputPage && inputPage.elt) {
				// Don't want the number input to steal keystrokes
				inputPage.elt.blur();
			}

			startTimer() // This also clears out the other digits (first time only)
			forceUpdate=true
			digit1=digit2
			digit2=digit3
			digit3=keyPressed
			if (digit1!=' ')
			{
				//let page=Number(digit1+digit2+digit3)
				let page=parseInt("0x"+digit1+digit2+digit3)
				myPage.pageNumberEntry=digit1+digit2+digit3
				if (page>=0x100)
				{
					// hdr.setPage(page)
					// console.log('@todo: pass the page '+page)
					console.log("Page number is 0x"+page.toString(16))
					myPage.setPage(page) // We now have a different page number
					let data=
					{
					S: myPage.service, // service
					p: page, // Page mpp
					s: myPage.subPage,	// @ todo check that subpage is correct
					x: 0,
					y: 0,
					rowText: '',
					id: gClientID
					}
					socket.emit('load',data)
				}
			}
		}
	}
    // socket.emit('load')

    //console.log('keycode='+keyPressed)
}

function k0() {	processKey('0') }
function k1() {	processKey('1') }
function k2() {	processKey('2') }
function k3() {	processKey('3') }
function k4() {	processKey('4') }
function k5() {	processKey('5') }
function k6() {	processKey('6') }
function k7() {	processKey('7') }
function k8() {	processKey('8') }
function k9() {	processKey('9') }
// function kinfo() {	processKey('x') } // @todo
function krvl() {	myPage.toggleReveal() }
function kback() {prevPage() }
function kfwd()  {nextPage() }
function khold()  {myPage.toggleHold() }

/* Block editing. Touch marks the first corner of an area
*/
function touchStarted()
{
	if (touchY>CANVAS_HEIGHT)  // Only start block on a page
  {
		return
  }
  // console.log('Touch started at '+touchX+' '+touchY)
	blockStart=createVector(touchX,touchY)
	return false
}

function touchEnded()
{
  // console.log('Touch ended at '+touchX+' '+touchY);
	let blockEnd=createVector(touchX,touchY)
	blockEnd.sub(blockStart)
	blockStart=null // Need this to be null in case we return!

	if (touchY>CANVAS_HEIGHT) // Restrict to the actual page (need to check width too)
  {
		return
  }
	// Block needs to be a minimum distance (& possibly velocity?
	let mag=blockEnd.mag()
	if (mag<40)
		return;
	let heading=blockEnd.heading()
	// left
	//console.log("block select ! Heading="+degrees(heading))
		
	let dir=4*heading/PI
	// console.log("Block! dir="+dir)
	return false	
}

function nextPage()
{
	let p=myPage.pageNumber
	p++
	if ((p & 0xf)==0xa) // Hex numbers should be skipped. Users should not select them.
    {
		p+=6
    }
    if (p>0x8fe)
    {
        p=0x8fe
    }
	myPage.setPage(p) // We now have a different page number
	let data=
	{
	S: myPage.service,
	p: p, // Page mpp
	s: 0,
	y: 0,
	rowText: '',
	id: gClientID	
	}				
	socket.emit('load',data)
	console.log("page="+hex(data.p))
}

function prevPage()
{
	let p=myPage.pageNumber
	p--
	if ((p & 0xf)==0xf) // Hex numbers should be skipped. Users should not select them.
    {
		p-=6
    }
	if (p<0x100)
    {
        p=0x100
    }
	myPage.setPage(p) // We now have a different page number
	let data=
	{
	S: myPage.service,
	p: p, // Page mpp
	s: 0,
	y: 0,
	rowText: '',
	id: gClientID	
	}				
	socket.emit('load',data)
	console.log("page="+hex(data.p))
}

/** Execute an editTF escape command
 *  This is the key that follows the escape key
 *  As zxnet keys are handled the same way, we add aliases for those too
 */
function editTF(key)
{
    let chr    // The character that the editTF escape creates
    switch (key)
    {
    case '8' :; // zxnet
    case 'k' : chr='\x00';break // alpha black
    case '1' :; // zxnet
    case 'r' : chr='\x01';break // alpha 5c
    case '2' :; // zxnet
    case 'g' : chr='\x02';break // alpha green
    case '3' :; // zxnet
    case 'y' : chr='\x03';break // alpha yellow
    case '4' :; // zxnet
    case 'b' : chr='\x04';break // alpha blue
    case '5' :; // zxnet
    case 'm' : chr='\x05';break // alpha magenta
    case '6' :; // zxnet
    case 'c' : chr='\x06';break // alpha cyan
    case '7' :; // zxnet
    case 'w' : chr='\x07';break // alpha white

    case 'F' : chr='\x08';break // flash on (same as zxnet)
    case 'f' : chr='\x09';break // steady )same as zxnet)
    
    // chr='\x0a';break // endbox
    // chr='\x0b';break // startbox
    
    case 'd' : chr='\x0c';break // normal height (same as zxnet)
    case 'D' : chr='\x0d';break // double height (same as zxnet)
    
    // 0x0e SO - SHIFT OUT
    // 0x0f SI - SHIFT IN
    
    case '*' :; // zxnet    
    case 'K' : chr='\x10';break // graphics black
    case '!' :; // zxnet    
    case 'R' : chr='\x11';break // graphics red
    case '"' :; // zxnet    
    case 'G' : chr='\x12';break // graphics green
    case '£' :; // zxnet
    case '#' :; // alternate character
    case 'Y' : chr='\x13';break // graphics yellow
    case '$' :; // zxnet    
    case 'B' : chr='\x14';break // graphics blue
    case '%' :; // zxnet    
    case 'M' : chr='\x15';break // graphics magenta
    case '^' :; // zxnet    
    case 'C' : chr='\x16';break // graphics cyan
    case '&' :; // zxnet    
    case 'W' : chr='\x17';break // graphics white

    case 'O' : chr='\x18';break // conceal

    case 's' : chr='\x19';break // Contiguous graphics
    case 'S' : chr='\x1a';break // Separated graphics

    case 'n' : chr='\x1c';break // 28 black background (same as zxnet)
    case 'N' : chr='\x1d';break // 29: new background (same as zxnet)
    case 'H' : chr='\x1e';break // 30: Hold graphics mode (same as zxnet)
    case 'h' : chr='\x1f';break // 31 Release hold mode (same as zxnet)
    
    case 'x' : myPage.showGrid=!myPage.showGrid;return // toggle grid display
    case 'i' : // Insert row      
      editMode=EDITMODE_EDIT
      {
        let y=myPage.cursor.y
        if (y<=0 || y>=24) // Can't insert row on the header or fastext row
        {
          return
        }
        // @TODO All this must be duplicated in keyevents
        for (let r=(23-1);r>=y;r--)
        {
          let row=myPage.getRow(r)
          // console.log("Row "+r+" = "+row)
          myPage.setRow(r+1,row)
          sendRow(r+1,row)
        }
        // Clear the current row
        myPage.setRow(y,"                                        ")
        sendRow(y,"                                        ")
      }
      return
    case 'I' : // Delete row    
      editMode=EDITMODE_EDIT
      let y=myPage.cursor.y
      if (y<=0 || y>=24) // Can't delete header or fastext
      {
        return
      }
      for (let r=y;r<23;r++)
      {
        let row=myPage.getRow(r+1)
        // console.log("Row "+r+" = "+row)
        myPage.setRow(r,row)
        sendRow(r,row)
      }
      // Clear the current row
      myPage.setRow(23,"                                        ")
      sendRow(23,"                                        ")
      
      return
    case 'J' : // block
        chr = '\x7f'
        break;
    case 'Z' : // clear screen
      // @todo At this point, send a signal to the server
      // Send the page details so we know which page to clear!
      let data=
      {
        S: myPage.service, // service number
        p: myPage.pageNumber,
        s: myPage.subPage,
        k: ' ',
        x: myPage.cursor.x,
        y: myPage.cursor.y,
        id: gClientID
      }      
      socket.emit('clearPage',data)
      editMode=EDITMODE_EDIT    
      return
      

    /*
    edit.tf functions not implemented
    Number pad: need to find out what the keys do
    'i' : // insert row
    'I' : // delete row
    'z' : // redraw screen
    '&' : // cycle character set
    '<' : // narrow screen
    '<' : // widen screen
    '=' : // trace image
    'U' : // Duplicate row
    'Q' : // toggle control codes
    '-' : // Toggle conceal/reveal
    
    editing with blocks
    Select blocks with <esc> arrow keys
    X: cut, C: paste, <shift< arrows: move sixels
    */
    default: // nothing matched?
      editMode=EDITMODE_EDIT    
        return
    }
    // Construct object to define exactly where this key code will go
    let data=
    {
        S: myPage.service,
        p: myPage.pageNumber, // Page mpp
        s: myPage.subPage,
        x: myPage.cursor.x,
        y: myPage.cursor.y,
        k: chr
    }
    socket.emit('keystroke', data)    
    newChar(data)
}

/** Transmit a row of text
 *  Woefully inefficient. Really need to implement whole row transmission
 * \param r : row number
 * \param txt : Row of teletext
 */
function sendRow(r,txt)
{
  for (let c=0;c<txt.length;c++)
  {
    let data=
    {
        S: myPage.service,
        p: myPage.pageNumber, // Page mpp
        s: myPage.subPage,
        x: c,
        y: r,
        k: txt[c]
    }
    socket.emit('keystroke', data)
  }
}


function windowResized() {

}


function exportPage() {
  const grabSelectLinks = document.querySelector('#grabSelectLinks');

  // determine if hiding or showing grab links...
  const isShow = grabSelectLinks.getAttribute('data-visible') === 'false';

  if (isShow) {
    // @todo language
    let cset = 0;

    // get page number
    let pg = hex(myPage.pageNumber, 3);

    // edit.tf
    let website = 'http://edit.tf';
    let url = save_to_hash(cset, website, myPage);

    // zxnet
    website = 'https://zxnet.co.uk/teletext/editor';
    let url2 = save_to_hash(cset, website, myPage);

    // Download the tti page
    let svc = myPage.getService();
    let url3 = 'www/' + svc + '/p' + pg + '.tti';


    // update grab link items text and URL...
    const dynamicLink = document.querySelector('#dynamicLink');

    if (dynamicLink) {
      dynamicLink.href = url;
      dynamicLink.innerHTML = 'open P' + pg + '<br/>in edit.tf';
    }

    const dynamicLink2 = document.querySelector('#dynamicLink2');

    if (dynamicLink2) {
      dynamicLink2.href = url2;
      dynamicLink2.innerHTML = 'open P' + pg + '<br/>in zxnet';
    }

    const dynamicLink3 = document.querySelector('#dynamicLink3');

    if (dynamicLink3) {
      dynamicLink3.href = url3;
      dynamicLink3.innerHTML = 'download <br/>P' + pg + '.tti';
    }


    // show links
    grabSelectLinks.setAttribute('data-visible', 'true');

  } else {
    // hide links
    grabSelectLinks.setAttribute('data-visible', 'false');
  }
}

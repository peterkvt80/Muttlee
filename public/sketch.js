// teletext
var mypage;
var ttxFont;

//metrics
var gTtxW;
var gTtxH;
var gTtxFontSize=20;

// page selection
var digit1='1';
var digit2='0';
var digit3='0';

var hdr;

// comms
var socket;
var gClientID=null;

// state
var editMode=false;

// dom
var redButton;
var indexButton;

// timer
// Timer for expiring incomplete keypad entries
var expiredState=true; // True for four seconds after the last keypad number was typed OR until a valid page number is typed
var forceUpdate=false; // Set true if the screen needs to be updated
var timeoutVar;

function startTimer()
{
	expiredState=false;
	// If there is a timeout active then clear it
	if (timeoutVar==null) // A new keypad entry starts
	{
		digit1='0';
		digit2='0';
		digit3='0';
	}
	else
	{
		clearTimeout(timeoutVar); // Continue an existing keypad entry
	}
	timeoutVar=setTimeout(function() {
		expiredState=true;
		// console.log("Expire actions get done here");
		// todo: Restore the page number. Enable the refresh loop
		var p=mypage.pageNumber;
		digit1=(String)((p >> 8) & 0xf);
		digit2=(String)((p >> 4) & 0xf);
		digit3=(String)(p & 0xf);
		mypage.pageNumberEntry=digit1+digit2+digit3;
		// todo Put this into row 0
		mypage.rows[0].setpagetext(digit1+digit2+digit3);
		timeoutVar=null;
	} , 4000);
}

var btnk0;
var btnk1;
var btnk2;
var btnk3;
var btnk4;
var btnk5;
var btnk6;
var btnk7;
var btnk8;
var btnk9;
var btnkx;
var btnky;
var btnkback;
var btnkfwd;

// swipe
var swipeStart;

function preload()
{
  ttxFont=loadFont("assets/teletext2.ttf"); // Normal  
  ttxFontDH=loadFont("assets/teletext4.ttf"); // Double height 
}

function setup()
{
  // Try to make a debug and on-air version
//  socket=io.connect('http://192.168.1.11:3010');
  socket=io.connect(':8080');
//  socket=io.connect('http://23.251.131.26:8080');
  // socket=io.connect('http://localhost:80');
  var cnv=createCanvas(600,550);
	cnv.position(0,0);
	//createCanvas(displayWidth, displayHeight);	
  // font metrics
  textFont(ttxFont);
  textSize(gTtxFontSize);
  gTtxW=textWidth('M');
  gTtxH=gTtxFontSize;
  mypage=new TTXPAGE();
  mypage.init(0x100);
  // message events
  socket.on('keystroke',newChar);
  socket.on('row',setRow); // A teletext row
  socket.on('blank',setBlank); // Clear the page
  socket.on('fastext',setFastext);
  socket.on('setpage',setPageNumber); // Allow the server to change the page number (Page 404 etc)
  socket.on('description',setDescription);
  socket.on('subpage',setSubPage); // Subpage number for carousels (Expect two digits 00..99) [99 is higher than actual spec]
  socket.on("id",setID); // id is a socket id that identifies this client. Use this when requesting a page load
  //hdr=new header(0,1,0,0);

  // dom
  redButton=select('#red');
  redButton.mousePressed(fastextR);
  greenButton=select('#green');
  greenButton.mousePressed(fastextG);
  yellowButton=select('#yellow');
  yellowButton.mousePressed(fastextY);
  cyanButton=select('#cyan');
  cyanButton.mousePressed(fastextC);
  //indexButton=select('#index');
	//indexButton.mousePressed(fastextIndex);
	
	// keypad - Doesn't work well. In fact, it is really bad
	/*
  btnk0=select('#k0');
	btnk0.mousePressed(k0);
  btnk1=select('#k1');
	btnk1.mousePressed(k1);
  btnk2=select('#k2');
	btnk2.mousePressed(k2);
  btnk3=select('#k3');
	btnk3.mousePressed(k3);
  btnk4=select('#k4');
	btnk4.mousePressed(k4);
  btnk5=select('#k5');
	btnk5.mousePressed(k5);
  btnk6=select('#k6');
	btnk6.mousePressed(k6);
  btnk7=select('#k7');
	btnk7.mousePressed(k7);
  btnk8=select('#k8');
	btnk8.mousePressed(k8);
  btnk9=select('#k9');
	btnk9.mousePressed(k9);
	*/
	
	
	
  btnkx=select('#khold');
	btnkx.mousePressed(khold);
  btnky=select('#krvl');
	btnky.mousePressed(krvl);
  btnkback=select('#kback');
	btnkback.mousePressed(kback);
  btnkfwd=select('#kfwd');
	btnkfwd.mousePressed(kfwd);
	
	inputPage=select('#pageNumber');
}

function setSubPage(data)
{
	if (data.id!=gClientID && gClientID!=null) return;	// Not for us?

	mypage.setSubPage(parseInt(data.line));
}

/** We MUST be sent the connection ID or we won't be able to display anything
 */
function setID(id)
{
	console.log("Our connection ID is "+id);
	gClientID=id;
	
  // Now we can load the initial page 100
  var data=
  {
	S: mypage.service, // The codename of the service. eg. d2k or undefined
	p: 0x100, // Page mpp
	s:0,	// subpage 0
	x:2000,
	y: 0,
	rowText: '',
	id: gClientID
  }
  socket.emit('load',data);
}

function setDescription(data)
{
	if (data.id!=gClientID && gClientID!=null) return;	// Not for us?

	// console.log('[setDescription]setting page description to '+desc);
	mypage.description=data.desc;
	document.getElementById('description').innerHTML = 'Page info: '+data.desc;
}

function setPageNumber(data)
{
	if (data.id!=gClientID && gClientID!=null) return;	// Not for us?
    console.log('[setPageNumber]setting page to '+data.p.toString(16)+"Service="+data.S);
	mypage.setPage(data.p);
	mypage.setService(data.S);    
}

// Handle the button UI
function fastextR()
{
	fastext(1);
}
function fastextG()
{
	fastext(2);
}
function fastextY()
{
	fastext(3);
}
function fastextC()
{
	fastext(4);
}

function fastextIndex()
{
	fastext(6);
}
 
/**
 * Load the fastext link
 * @param index 0..3
 */
function fastext(index)
{
	console.log('Fastext pressed: '+index);
	switch (index)
	{
	case 1:page=mypage.redLink;break;
	case 2:page=mypage.greenLink;break;
	case 3:page=mypage.yellowLink;break;
	case 4:page=mypage.cyanLink;break;
	case 6:page=mypage.indexLink;break;
	default:
		page=mypage.redLink;
	}
	console.log('Fastext pressed: '+index+" link to 0x"+page.toString(16)+" ("+page+")");
	if (page>=0x100 && page<=0x8ff) // Page in range
	{
		mypage.setPage(page); // We now have a different page number
			var data=
			{
			S: mypage.service,
			p: page, // Page mpp
			s: 0,	// @ todo subpage	
			x: 0,
			y: 0,
			rowText: '',
			id: gClientID
			}	
		socket.emit('load',data);	
	}
}

function setFastext(data)
{
  if (!matchpage(data)) return; // Data is not for our page?
	if (data.id!=gClientID && gClientID!=null) return;	// Not for us?
	
	mypage.redLink=parseInt   ("0x"+data.fastext[0]);
	mypage.greenLink=parseInt ("0x"+data.fastext[1]);
	mypage.yellowLink=parseInt("0x"+data.fastext[2]);
	mypage.cyanLink=parseInt  ("0x"+data.fastext[3]);
	mypage.indexLink=parseInt ("0x"+data.fastext[5]);
}

function draw()
{
	// No updating while we are pressing the mouse OR while typing in a page number
	if (!forceUpdate)
	{
		if (swipeStart!=null || !expiredState )
			return;
	}
	else
		forceUpdate=false;
  // @todo We only need to update this during updates. No more than twice a second. Could save a lot of CPU
  background(0);
  noStroke();
  fill(255,255,255);
  // ellipse(mouseX,mouseY,10,10);
  mypage.draw();
	
}

// Does our page match the incoming message?
function matchpage(data)
{
	console.log ("Matching mypage.service, data.S "+mypage.service+' '+data.S);
	if (mypage.service!=data.S) return false;
	//console.log ("Matching data.p, mypage.pageNumber"+data.p.toString(16)+' '+mypage.pageNumber.toString(16));
	if (mypage.pageNumber!=data.p) return false;
	// if (mypage.subPage!=data.s) return false; // This needs more thought now that we are implementing carousels
	return true;
}

// Message handlers....
function newChar(data) // 'keystroke'
{
  //if (data.k<' ')
  // console.log("returned keycode="+(data.k));
  // @todo page number test
  if (!matchpage(data)) return; // Char is not for our page?
  // At (x,y) on subpage s, place the character k
  mypage.drawchar(data.k,data.x,data.y,data.s);
  mypage.cursor.right();  
  console.log(data);
}

// A whole line is updated at a time
function setRow(r) // 'row'
{
  // console.log("Going to set row="+(r.rowNumber));
  if (!matchpage(r)) return;
	if (r.id!=gClientID && gClientID!=null) return;	// Not for us?
  mypage.setRow(r.y,r.rowText);
}

// Clear the page to blank (all black)
function setBlank(data) // 'blank'
{
  if (!matchpage(data)) return;
	if (data.id!=gClientID && gClientID!=null) return;	// Not for us?
  mypage.setBlank();
}

function inputNumber()
{
	console.log("inputNumber changed");
	var page=document.getElementById('pageNumber');
		console.log("Opening page="+page.value);
	// Now load the page
	if (page.value.length==3)
	{
		processKey(page.value.charAt(0));
		processKey(page.value.charAt(1));
		processKey(page.value.charAt(2));
		page.blur();
	}
}

function keyPressed() // This is called before keyTyped
{
	var active=document.activeElement;
	console.log("Active element="+active.id);
	if (document.activeElement.id!='pageNumber') // todo: Kill refresh cycles while the input is active.
	{
		switch (keyCode)
		{
        //case PAGE_UP:;
		case LEFT_ARROW:
            if (editMode) mypage.cursor.left();
            break;
        //case PAGE_DOWN:;
		case RIGHT_ARROW: 
            if (editMode) mypage.cursor.right();
            break;
		case UP_ARROW:
            if (editMode) mypage.cursor.up();
            break;
		case DOWN_ARROW:
            if (editMode) mypage.cursor.down();
            break;
		case ESCAPE:
            editMode=!editMode;
            mypage.editSwitch(editMode);
            break;
        case 33: // PAGE_UP (next subpage when in edit mode)
            if (editMode)
            {
                mypage.nextSubpage();
            }
            break;
        case 34: // PAGE_DOWN (prev subpage when in edit mode)
            if (editMode)
            {
                mypage.prevSubpage();
            }
            break;
		default:
			console.log('unhandled keycode='+keyCode)
		;
		}
	}
	// return false; // Do not do this! This stops keyTyped 
}

/** edit mode is entered if any non numeric code is typed
 *  edit mode exits if <esc> is pressed
 */
function keyTyped()
{	
	if (document.activeElement.id=='pageNumber') // Input a page number
	{
    console.log('keyTyped keycode='+keyCode);
	}
	else // Anywhere else
	{	
		processKey(key);
		return false;
	}
}

function processKey(keyPressed)
{
	console.log('processKey='+keyPressed);
	if (editMode==true) // Numbers are typed into the page
	{
		var data=
		{
			S: mypage.service, // service number
			p: mypage.pageNumber,
			s: mypage.subPage,
			k: keyPressed,
			x: mypage.cursor.x,
			y: mypage.cursor.y,
			id: gClientID
		}
		socket.emit('keystroke', data);
		newChar(data);
	}
	else // Numbers are used for the page selection
	{
		if (keyPressed>='0' && keyPressed <='9')
		{
			document.getElementById('pageNumber').blur(); // Don't want the number input to steal keystrokes
			startTimer(); // This also clears out the other digits (first time only)
			forceUpdate=true;
			digit1=digit2;
			digit2=digit3;
			digit3=keyPressed;
			if (digit1!=' ')
			{
				//var page=Number(digit1+digit2+digit3);
				var page=parseInt("0x"+digit1+digit2+digit3);
				mypage.pageNumberEntry=digit1+digit2+digit3;
				if (page>=0x100)
				{
					// hdr.setPage(page);
					// console.log('@todo: pass the page '+page);
					console.log("Page number is 0x"+page.toString(16));
					mypage.setPage(page); // We now have a different page number
					var data=
					{
					S: mypage.service, // service
					p: page, // Page mpp
					s: mypage.subPage,	// @ todo check that subpage is correct
					x: 0,
					y: 0,
					rowText: '',
					id: gClientID					
					}				
					socket.emit('load',data);
				}
			}
			timimg=500;		
		}
	}    
    // socket.emit('load');
    
    //console.log('keycode='+keyPressed);
}

function k0() {	processKey('0'); }
function k1() {	processKey('1'); }
function k2() {	processKey('2'); }
function k3() {	processKey('3'); }
function k4() {	processKey('4'); }
function k5() {	processKey('5'); }
function k6() {	processKey('6'); }
function k7() {	processKey('7'); }
function k8() {	processKey('8'); }
function k9() {	processKey('9'); }
// function kinfo() {	processKey('x'); } // @todo
function krvl() {	mypage.toggleReveal() }
function kback() {prevPage(); }
function kfwd()  {nextPage(); }
function khold()  {mypage.toggleHold(); }

function mouseClicked()
{
	// Only need to do this in edit mode
	if (!editMode)
		return;
  var xLoc=int(mouseX/gTtxW);
  var yLoc=int(1+mouseY/gTtxH); // @todo Will need to fix this once we add a header
  mypage.cursor.moveTo(xLoc,yLoc);
  // console.log('The mouse was clicked at '+xLoc+' '+yLoc);
	return false;
}

/* Swipes */
function touchStarted()
{
	if (touchY>550) // Only swipe on page
		return;
  console.log('Touch started at '+touchX+' '+touchY);
	swipeStart=createVector(touchX,touchY);
	return false;
}

function touchEnded()
{
  // console.log('Touch ended at '+touchX+' '+touchY);
	var swipeEnd=createVector(touchX,touchY);
	swipeEnd.sub(swipeStart);
	swipeStart=null; // Need this to be null in case we return!

	if (touchY>550) // Only swipe on page
		return;
	// Swipe needs to be a minimum distance (& possibly velocity?
	var mag=swipeEnd.mag();
	if (mag<40)
		return;
	var heading=swipeEnd.heading();
	// left
	//console.log("swiped! Heading="+degrees(heading));
		
	var dir=4*heading/PI;
	console.log("Swiped! dir="+dir);
	if (dir>=-1 && dir<=1)
	{
		console.log("swiped right (back)");
		prevPage();
	}
	if (dir>3 || dir<-3)
	{
		// console.log("swiped left");
		nextPage();
	}
	return false;	
}

function nextPage()
{
	var p=mypage.pageNumber;
	p++;
	if ((p & 0xf)==0xa) // Hex numbers should be skipped. Users should not select them.
		p+=6;
	if (p>0x8fe) p=0x8fe;
	mypage.setPage(p); // We now have a different page number
	var data=
	{
	S: mypage.service,
	p: p, // Page mpp
	s: 0,
	y: 0,
	rowText: '',
	id: gClientID	
	}				
	socket.emit('load',data);		
	console.log("page="+hex(data.p));
}

function prevPage()
{
	var p=mypage.pageNumber;
	p--;
	if ((p & 0xf)==0xf) // Hex numbers should be skipped. Users should not select them.
		p-=6;

	if (p<0x100) p=0x100;		
	mypage.setPage(p); // We now have a different page number
	var data=
	{
	S: mypage.service,
	p: p, // Page mpp
	s: 0,
	y: 0,
	rowText: '',
	id: gClientID	
	}				
	socket.emit('load',data);		
	console.log("page="+hex(data.p));
}

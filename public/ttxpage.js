// Timer for flashing cursor and text
var flashState=false;
setInterval(toggle, 500);
function toggle()
{
  flashState=!flashState;
}

function page()
{
  this.cursor=new myCursor();
  
  this.redLink=100;
  this.greenLink=100;
  this.yellowLink=100;
  this.cyanLink=100;
  
  this.description='none';

  // @todo check range
  this.init=function(number)
  {
    this.pageNumber=number;
	this.subpage=0; // @todo Carousels
	this.service=0; // @todo Services
    this.rows = new Array();
	// As rows go from 0 to 31 and pages start at 100, we can use the same parameter for both
    this.rows.push(new row(number,0,"Pnn     CEEFAX 1 100 Sun 08 Jan 12:58/57"));
    for (var i=1;i<26;i++)
    {
      this.rows.push(new row(number,i,"~„~„~„~„~„~„~„~„~„~„~„~„~„~„~„~„~„~„~„~„"));
    }
    
  }
  
  /** @brief Change the page number for this page and all child rows
   */
  this.setPage=function(p)
  {
	this.pageNumber=p;
	for (var r=0;r<this.rows.length;r++)
	{
		this.rows[r].page=p;
	}
  }

  /** @brief Set row r to txt
   */
   
  this.setRow=function(r,txt)
  {
	if (r>=0 && r<=24)
	{
		this.rows[r].setrow(txt);
	}
	else
		console.log('not setting row '+r+' to '+txt);
  }
  
  
  this.draw=function()
  {
    for (var row=0;row<this.rows.length;row++)
    {
	// console.log("drawing row "+row+" of "+this.rows.length);
      var cpos=-1;
	  if (!this.cursor.hide && row==this.cursor.y) // If in edit mode and it is the correct row...
		cpos=this.cursor.x;
      this.rows[row].draw(cpos);
    }    
  }
  
  this.drawchar=function(ch,x,y)
  {
    //console.log('Attempting to draw row '+y);
    this.rows[y].setchar(ch,x);
  }
  
  /**
   * @brief Clear all rows to blank spaces
   */
  this.setBlank=function()
  {
    for (var y=1;y<this.rows.length;y++)
		this.rows[y].setrow('                                        ');
	this.rows[0].setrow('Pnn     CEEFAX 1 100 Sun 08 Jan 12:58/57'); // @todo Add proper header control		
  }
  
  
} // page

function row(page,y,str)
{
  this.page=page;
  this.row=y;
  this.txt=str;
  console.log('Setting row to '+this.page+' '+this.row+' '+this.txt);
  this.setchar=function(ch,n)
  {
    this.txt=setCharAt(this.txt,n,ch);
  }

  this.setrow=function(txt)
  {
    this.txt=txt;
  }

  /// @param cpos is the cursor column position to highlight
  this.draw=function(cpos)
  {
	var txt=this.txt; // Copy the row text because a header row will modify it
	if (this.row==0 && cpos<0) // This is the header row
	{
		// Replace the first eight characters with the page number
		txt=replace(txt,'P'+nf(this.page,3)+'    ',0);
		
		// Substitute mpp for the page number
		var ix;
		if ((ix=txt.indexOf('mpp'))>0)
			txt=replace(txt,nf(this .page,3),ix)
		// Substitute dd for the day 1..31
		if (ix=txt.indexOf('dd'))
			txt=replace(txt,nf(day(),2),ix)
		// Substitute DAY for the three letter abbreviated day 
		ix=txt.indexOf('DAY');
		if (ix>0)
		{
			var week = new Date().getDay(); 
			var str="MonTueWedThuFriSatSun".substr((week-1)*3,3);
			txt=replace(txt,str,ix);
		}
		// Substitute MTH for the three letter abbreviated month 
		ix=txt.indexOf('MTH');
		if (ix>0)
		{
			var str="JanFebMarAprMayJunJulAugSepOctNovDec".substr((month()-1)*3,3);
			txt=replace(txt,str,ix)
		}
		// Substitute hh for the two digit hour 
		if ((ix=txt.indexOf('hh'))>0)
			txt=replace(txt,nf(hour(),2),ix)
		// Substitute nn for the two digit minutes
		if ((ix=txt.indexOf('nn'))>0)
			txt=replace(txt,nf(minute(),2),ix)
		// Substitute ss for the two digit seconds
		if ((ix=txt.indexOf('ss'))>0)
			txt=replace(txt,nf(second(),2),ix)
	}
    // Set up all the display mode initial defaults
    var fgColor=color(255,255,255); // Foreground defaults to white
    var bgColor=color(0); // Background starts black
    var textmode=true; // If false it is graphics mode
    var contiguous=true; // if false it is separated graphics
    var holdGfx=false;
    var flashMode=false;
    var dblHeight=false;
    textFont(ttxFont);
    textSize(gTtxFontSize);
    for (var i=0;i<40;i++)
    {
      var ch=txt.charAt(i);
      var ic=txt.charCodeAt(i);
      var printable=false;
      switch (ic)
      {
      case  0 : fgColor=color(0);textmode=true;break; // 0: black. Only for level 1 rebels.
      case  1 : fgColor=color(255,0,0);textmode=true;break; // 1:red 
      case  2 : fgColor=color(0,255,0);textmode=true;break; // 2:green
      case  3 : fgColor=color(255,255,0);textmode=true;break; // 3:yellow
      case  4 : fgColor=color(0,0,255);textmode=true;break; // 4:blue
      case  5 : fgColor=color(255,0,255);textmode=true;break; // 5:magenta
      case  6 : fgColor=color(0,255,255);textmode=true;break; // 6:cyan
      case  7 : fgColor=color(255,255,255);textmode=true;break; // 7:white
      case  8 : flashMode=true;break; // 8:flash
      case  9 : flashMode=false;break; // 9:steady
      case 10 : break; // 10:endbox
      case 11 : break; // 11:startbox
      case 12 :
        dblHeight=false;
        textFont(ttxFont);
        textSize(gTtxFontSize);
        break; // 12:normalheight
      case 13 :
        dblHeight=true;
        textFont(ttxFontDH);
        textSize(gTtxFontSize*2);
        break; // 13:doubleheight
      case 16 : fgColor=color(0);textmode=false;break;// 16: Farrimond gfxblack
      case 17 : fgColor=color(255,0,0);textmode=false;break; // 16:gfxred 
      case 18 : fgColor=color(0,255,0);textmode=false;break; // 17:gfxgreen
      case 19 : fgColor=color(255,255,0);textmode=false;break; // 18:gfxyellow
      case 20 : fgColor=color(0,0,255);textmode=false;break; // 19:gfxblue
      case 21 : fgColor=color(255,0,255);textmode=false;break; // 20:gfxmagenta
      case 22 : fgColor=color(0,255,255);textmode=false;break; // 21:gfxcyan
      case 23 : fgColor=color(255,255,255);textmode=false;break; // 22:gfxwhite

      case 25 : contiguous=true;break; // 25: Contiguous graphics
      case 26 : contiguous=false;break; // 26: Separated graphics

      case 28 : bgColor=color(0);break; // 28 black background
      case 29 : bgColor=fgColor;break; // 29: new background
      case 30 : holdGfx=true;break; // 30: Hold graphics mode
      case 31 : holdGfx=false;break; // 31 Release hold mode
	  case 32 : break; // Space is not printable
      default:
        printable=true;
      } // case
      // Paint the background colour always
      noStroke();
      fill(bgColor);
      // except if this is the cursor position
      if (cpos==i && flashState) fill(255);
      this.drawchar(String.fromCharCode(0xe6df),i,this.row);
      if (printable && (flashState || !flashMode)) 
      {
        fill(fgColor);
        if (textmode || ch>='A' && ch<='Z')
        {
          ch=this.mapchar(ch);
          this.drawchar(ch,i,this.row);
        }
        else
        {
		  
          fill(fgColor);
          if (contiguous)
          {
            stroke(fgColor);
            this.drawchar(String.fromCharCode(ic+0x0e680-0x20),i,this.row);
          }
          else
          {
            this.drawchar(String.fromCharCode(ic+0x0e680),i,this.row);
          }
        }        
      }
    }
  }
  this.drawchar=function(ch,x,y)
  {
    text(ch,x*gTtxW,(y+1)*gTtxH);
  }
  this.mapchar=function(ch)
  {
// Temporary mappings for Germany
switch(ch)
{
	case '|':  return char(0x00f6); // 7/C o umlaut
    case '}':  return char(0x00fc); // 7/D u umlaut	
	}
    switch (ch)
    {
    case '#': return 'Â£';
    case '[': return char(0x2190); // 5/B Left arrow.
    case '\\': return char(0xbd);   // 5/C Half
    case ']':   return char(0x2192); // 5/D Right arrow.
    case '^':  return char(0x2191); // 5/E Up arrow.
    case '_':  return char(0x0023); // 5/F Underscore is hash sign
    case '`' : return String.fromCharCode(0x2014); // 6/0 Centre dash. The full width dash e731
    case '{':  return char(0xbc);   // 7/B Quarter
    case '|':  return char(0x2016); // 7/C Double pipe
    case '}':  return char(0xbe);   // 7/D Three quarters
    case '~':  return char(0x00f7); // 7/E Divide 
    }
	
    return ch;
  }
}

function setCharAt(str,index,chr) {
    if(index > str.length-1) return str;
    return str.substr(0,index) + chr + str.substr(index+1);
}

/// @brief replace the characters in str at index with those in str2
function replace(str,str2,index) {
	var len=str2.length;
    if (index+len > str.length) return str;
    return str.substr(0,index) + str2 + str.substr(index+len);
}


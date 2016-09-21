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
  this.indexLink=100;
  
  this.description='none';
	
	this.subPage=0; // This is used to address the sub page as we 
	this.subPageList=new Array();
	
	this.pageNumberEntry='100'; // Page number as entered (used to allow partial page numbers) 
	
	this.iteration=0;
	
	this.revealMode=false;


  // @todo check range
  this.init=function(number)
  {
    this.pageNumber=number;
		this.service=0; // @todo Services

		this.addPage(number);
  }
	
	this.toggleReveal=function ()
	{
		this.revealMode=!this.revealMode;
	}
  
  /** @brief Change the page number for this page and all child rows
	 *  Clear the page. We should get a number of rows soon
   */
  this.setPage=function(p)
  {
		this.subPage=0;
		this.iteration=0;
		this.pageNumber=p; /// @todo Convert this to do all sub pages
		
		this.pageNumberEntry=p.toString(16);
		
		this.subPageList=new Array();
		this.addPage(this.pageNumber);		

  }
	
	/** @brief Add a page to the sub page list
	 */
	this.addPage=function(number)
	{
    this.rows = new Array();
	// As rows go from 0 to 31 and pages start at 100, we can use the same parameter for both
    this.rows.push(new row(number,0,"Pnn     CEEFAX 1 100 Sun 08 Jan 12:58/57"));
    for (var i=1;i<26;i++)
    {
      //this.rows.push(new row(number,i,"~„~„~„~„~„~„~„~„~„~„~„~„~„~„~„~„~„~„~„~„"));
      this.rows.push(new row(number,i,"                                        "));
    }  
		this.subPageList.push(this.rows);
	}
	
	/**
   * @param s Subpage number. All subsequent row/char updates go to this subpage.	
	 */
	this.setSubPage=function(s)
	{
		s=parseInt(s);
		// console.log("[setSubPage] enters "+s);
		if (s<0 || s>99)
			s=0;
		///@todo Check that s is in a subpage that exists and add it if needed.
		if (this.subPageList.length<s)
		{
			this.addPage(this.pageNumber);
			// console.log("[setSubPage] Need to add a new subpage: "+s);
		}
		this.subPage=s;
	}

  /** @brief Set row r to txt
   */   
  this.setRow=function(r,txt)
  {
		if (r>=0 && r<=24)
		{
			//this.rows[r].setrow(txt); // Old working code
			// console.log ("Adding row "+r+" to sub page "+this.subPage);
			var sp=this.subPage;
			if (sp>0) sp=sp-1;
			var v=this.subPageList[sp];
			//console.log("v="+v);
			v[r].setrow(txt); // New not tested code
		}
		else
			return;
		/*
			// Might want to find out why this happens. Doesn't seem to matter
			console.log('not setting row '+r+' to '+txt);
			*/
  }
  
  
  this.draw=function()
  {
		this.iteration++;
		var dblHeight;
		if (this.iteration % 30==0) // Approx 7 seconds
		{
			this.subPage=(this.subPage+1) % this.subPageList.length;			
			// console.log("iteration="+this.iteration/30+" Subpage="+this.subPage);
		}
    for (var row=0;row<this.rows.length;row++)
    {
	// console.log("drawing row "+row+" of "+this.rows.length);
      var cpos=-1;
			if (!this.cursor.hide && row==this.cursor.y) // If in edit mode and it is the correct row...
			cpos=this.cursor.x;
			//this.rows[row].draw(cpos); // Original version
			// Single pages tend to have subpage 0000. carousels start from 0001. So subtract 1 unless it is already 0.
			var v=this.subPageList[this.subPage>0?this.subPage-1:0];
			if (v.length>0)
			{			
				if (row==0 && v.length>0) // Set the page number for the header only
				{
					v[0].setpagetext(this.pageNumberEntry);
				}

				if (v[row].draw(cpos, this.revealMode))
					row++; // If double height, skip the next row 
			}    
		}
  }
  
  this.drawchar=function(ch,x,y)
  {
    //console.log('Attempting to draw row '+y);
    this.rows[y].setchar(ch,x); /// @todo Convert this to update subPage
  }
  
  /**
   * @brief Clear all rows to blank spaces
   */
  this.setBlank=function()
  {
		console.log(" Clear all rows to blank");
		this.subPageList=new Array();
		this.addPage(this.pageNumber);
		
//    for (var y=1;y<this.rows.length;y++)
			//this.rows[y].setrow('                                        ');
		//this.rows[0].setrow('Pnn     CEEFAX 1 100 Sun 08 Jan 12:58/57'); // @todo Add proper header control		
  }
  
  
} // page

function isMosaic(ch)
{
    ch=ch.charCodeAt() & 0x7f;
    return (ch>=0x20 && ch<0x40) || ch>=0x60;
}

function row(page,y,str)
{
  this.page=page;
  this.row=y;
  this.txt=str;
	this.pagetext='xxx';
  // console.log('Setting row to '+this.page+' '+this.row+' '+this.txt);
  this.setchar=function(ch,n)
  {
    this.txt=setCharAt(this.txt,n,ch);
  }

  this.setrow=function(txt)
  {
    this.txt=txt;
  }
	
	/** Expect a three digit page number, or partial page number */
	this.setpagetext=function(txt)
	{
		this.pagetext=txt;
	}

  /** @param cpos is the cursor column position to highlight
	 *  @param if revealMode is true overrides conceal 
	 * @return True if there was a double height code in this row
	 */
  this.draw=function(cpos, revealMode)
  {
	var txt=this.txt; // Copy the row text because a header row will modify it
	if (this.row==0 && cpos<0) // This is the header row
	{
		// Replace the first eight characters with the page number
//		txt=replace(txt,'P'+this.page.toString(16)+'    ',0);
		txt=replace(txt,'P'+this.pagetext+'    ',0);
		
		// Substitute mpp for the page number
		var ix;
		if ((ix=txt.indexOf('mpp'))>0)
			txt=replace(txt,this.page.toString(16),ix)
		// Substitute dd for the day 1..31
		if ((ix=txt.indexOf('dd'))>0)
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
	// Non header substitutions
	if (this.row>0 && this.row<25 && cpos<0) // This is the header row
	{
		// World time. (two values allowed per line
  	for (var i=0;i<2;i++)
			if ((ix=txt.indexOf('%t'))>0)
			{
				// Read the half hour offsets
				var offset=txt.substring(ix+2,ix+5);
				// console.log(offset);
				// add the offset to the time
				// show the HH:MM
				var h=(hour()+int(parseInt(offset)/2)) % 24;
				var m=minute();
				if ( (parseInt(offset) % 2)==1)
					m=(m+offset*30 ) % 60;
				txt=replace(txt,nf(h,2)+':'+nf(m,2),ix);
			}
	}
    // Set up all the display mode initial defaults
    var fgColor=color(255,255,255); // Foreground defaults to white
    var bgColor=color(0); // Background starts black
    var textmode=true; // If false it is graphics mode
    var contiguous=true; // if false it is separated graphics
		var concealed=false;
    var holdGfx=false;
		var holdChar=' ';
    var flashMode=false;
    var dblHeight=false;
		var hasDblHeight=false; // If there is a double height anywhere on this row, the next row must be skipped.
    textFont(ttxFont);
    textSize(gTtxFontSize);
    for (var i=0;i<40;i++)
    {
      var ch=txt.charAt(i);
      var ic=txt.charCodeAt(i) & 0x7f;
      var printable=false;
			// Do the set-before codes
      switch (ic)
      {
      case  0 : ; // 0: black. Only for level 1 rebels.
      case  1 : ; // 1:red 
      case  2 : ; // 2:green
      case  3 : ; // 3:yellow
      case  4 : ; // 4:blue
      case  5 : ; // 5:magenta
      case  6 : ; // 6:cyan
      case  7 : ; // 7:white
				holdGfx=false;
				concealed=false;
				break;
      case  8 : flashMode=true; // 8:flash
				break;
      case  9 : flashMode=false;break; // 9:steady
      case 10 : break; // 10:endbox
      case 11 : break; // 11:startbox
      case 12 : // 12:normalheight SetAt
        dblHeight=false;
        textFont(ttxFont);
        textSize(gTtxFontSize);
        break; 
      case 13 : // 13:doubleheight SetAfter
				break;
      case 16 : ;// 16: Farrimond gfxblack
      case 17 : ; // 16:gfxred 
      case 18 : ; // 17:gfxgreen
      case 19 : ; // 18:gfxyellow
      case 20 : ; // 19:gfxblue
      case 21 : ; // 20:gfxmagenta
      case 22 : ; // 21:gfxcyan
      case 23 : ; // 22:gfxwhite
				concealed=false;
				break;
			case 24 :  // 24: conceal. (SetAt)
				if (!revealMode) concealed=true;
				break;
      case 25 : contiguous=true;break; // 25: Contiguous graphics
      case 26 : contiguous=false;break; // 26: Separated graphics

      case 28 : bgColor=color(0);break; // 28 black background
      case 29 : bgColor=fgColor;break; // 29: new background
      case 30 : holdGfx=true; // 30: Hold graphics mode (set at)
      	printable=true; // Because this will be replaced
      	break;
      case 31 : break; // 31 Release hold mode (set after)
	  case 32 : ; // Space is not printable but it is still a mosaic. Intentional fall through
      default:
			  if (isMosaic(ch))
				{
					holdChar=ic;
				}
			
        printable=true;
      } // case
			
			// Mosaic hold is always printable
			if (!textmode && holdGfx)
        printable=true;

				// Paint the background colour always
      noStroke();
      fill(bgColor);
      // except if this is the cursor position
      if (cpos==i && flashState) fill(255);
      this.drawchar(String.fromCharCode(0xe6df),i,this.row,dblHeight);
      if (printable && (flashState || !flashMode) && !concealed) 
      {
        fill(fgColor);
        if (textmode || (ch>='A' && ch<='Z'))
        {
          ch=this.mapchar(ch);
          this.drawchar(ch,i,this.row,dblHeight);
        }
        else // mosaics
        {
		  
          fill(fgColor);
					var ic2=ic;
					if (holdGfx)
						ic2=holdChar; // hold char replaces
          if (contiguous)
          {
            stroke(fgColor);
            this.drawchar(String.fromCharCode(ic2+0x0e680-0x20),i,this.row,dblHeight);
          }
          else
          {
            this.drawchar(String.fromCharCode(ic2+0x0e680),i,this.row,dblHeight);
          }
        }        
      }
			// Set-After codes go here
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
			case 13 : // 13: double height
  			dblHeight=true;
				hasDblHeight=true;
        textFont(ttxFontDH);
        textSize(gTtxFontSize*2); 
        break; 
      case 16 : fgColor=color(0);textmode=false;break;// 16: Farrimond gfxblack
      case 17 : fgColor=color(255,0,0);textmode=false;break; // 16:gfxred 
      case 18 : fgColor=color(0,255,0);textmode=false;break; // 17:gfxgreen
      case 19 : fgColor=color(255,255,0);textmode=false;break; // 18:gfxyellow
      case 20 : fgColor=color(0,0,255);textmode=false;break; // 19:gfxblue
      case 21 : fgColor=color(255,0,255);textmode=false;break; // 20:gfxmagenta
      case 22 : fgColor=color(0,255,255);textmode=false;break; // 21:gfxcyan
      case 23 : fgColor=color(255,255,255);textmode=false;break; // 22:gfxwhite			
			case 24 : break;// 24:conceal
      case 31 : holdGfx=false;break; // 31 Release hold mode (set after)
			
			}
    }
		if (this.row<1 || this.row>22) // Can't double height header or last row.
			return;
		else
			return hasDblHeight;
  } // draw
	
  this.drawchar=function(ch,x,y,dblH)
  {
    text(ch,x*gTtxW,(y+1+(dblH?1:0))*gTtxH);
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
		case String.fromCharCode(0x7f):  return char(0xe65f); // 7/F Bullet (rectangle block)
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


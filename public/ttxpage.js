// Defines a teletext page
// page class defines a page and subpages.
// row class defines a teletext row.

const EDITMODE_NORMAL=0 // normal viewing
const EDITMODE_EDIT=1   // edit mode
const EDITMODE_ESCAPE=2 // expect next character to be either an edit.tf function or Escape again to exit.
const EDITMODE_INSERT=3 // The next character is ready to insert

// Timer for flashing cursor and text
let flashState=false
let tickCounter=0 // For timing carousels (in steps of half a second)
setInterval(toggle, 500)
function toggle()
{
  tickCounter++
  flashState=!flashState
}
////////////////////////////////////////////////////////////////////////////////////////////////////////
// Not much of a class
function MetaData(displayTiming)
{
  this.timer=displayTiming
}

////////////////////////////////////////////////////////////////////////////////////////////////////////

TTXPAGE=function()
{
  // Basic page properties
  this.pageNumber=0x100
  this.subPage=0 // This is the integer to index the current sub page
  this.cursor=new TTXCURSOR()
  this.service=undefined

  // Misc page properties
  this.redLink=0x900
  this.greenLink=0x100
  this.yellowLink=0x100
  this.cyanLink=0x100
  this.indexLink=0x100
  this.editMode=EDITMODE_NORMAL
  this.description='none'
  this.showGrid=false

  // this.timer=7 // This is global. Replaced by a per page timer
  
  // subPageList contains the rows. metadata contains other data like timing.
  // if subPageList is modified, then metadata must be done at the same time
  this.subPageList=[] // Subpage just contains rows.
  this.metadata=[]   // Metadata contains other things that a subpage needs, just the timer at the moment
  
  this.pageNumberEntry='100' // Page number as entered (used to allow partial page numbers) 
    
  this.revealMode=false
  this.holdMode=false
  
  // timer
  this.setTimer=function(t)
  {
    // this.timer=t
    if (this.metadata[this.subPage] != undefined)
      this.metadata[this.subPage].timer=t
  }
    
  // edit mode 
  this.editSwitch=function(mode)
  {
    this.editMode=mode
    this.cursor.hide=(mode==EDITMODE_NORMAL)
  }

  // @todo check range
  this.init=function(number)
  {
    this.pageNumber=number
    //this.service=undefined // @todo Services
    this.addPage(number)
  }
  
  this.toggleReveal=function ()
  {
    this.revealMode=!this.revealMode
  }
  
  this.toggleHold=function ()
  {
    this.holdMode=!this.holdMode
  }
  
  /** @brief Change the page number for this page and all child rows
   *  Clear the page. We should get a number of rows soon
   */
  this.setPage=function(p)
  {
    this.subPage=0
    tickCounter=1
    this.pageNumber=p /// @todo Convert this to do all sub pages

    this.pageNumberEntry=p.toString(16)

    this.subPageList=[]
    this.metaData=[]

    this.addPage(this.pageNumber)

    // keep page number input field synced with the current page number
    if (inputPage && inputPage.elt) {
      inputPage.elt.value = this.pageNumberEntry;
    }
  }
  
  this.setService=function(S)
  {
    this.service=S
  }
  
  this.getService=function()
  {
    let svc=String(this.service)
    if (svc=='undefined')
    {
      svc='onair'
    }
    return svc
  }
  
  /** @brief Add a page to the sub page list
   */
  this.addPage=function(number)
  {
    this.rows = []
  // As rows go from 0 to 31 and pages start at 100, we can use the same parameter for both
    this.rows.push(new row(number,0,"Pnn     CEEFAX 1 100 Sun 08 Jan 12:58/57"))
    for (let i=1;i<26;i++)
    {
      //this.rows.push(new row(number,i,"~„~„~„~„~„~„~„~„~„~„~„~„~„~„~„~„~„~„~„~„"))
      this.rows.push(new row(number,i,"                                        "))
    }  
    this.subPageList.push(this.rows)
    this.metadata.push(new MetaData(7))
  }
  
  /**
   * @param s Subpage number. All subsequent row/char updates go to this subpage.  
   */
  this.setSubPage=function(s)
  {
    s=parseInt(s)
    // console.log("[setSubPage] enters "+s)
    if (s<0 || s>79) // 
      s=0 // Single page
    else
      s=s-1 // Carousel (because carousels start at 1, but our array always starts at 0
    
    ///@todo Check that s is in a subpage that exists and add it if needed.
    if (this.subPageList.length<=s)
    {
      this.addPage(this.pageNumber)
      // console.log("[setSubPage] Need to add a new subpage: "+s)
    }
    this.subPage=s
  }

  /** @brief Set row r to txt
   * Note that this is the page level setrow.
   */   
  this.setRow=function(r,txt)
  {
    if (r>=0 && r<=24)
    {
      if (this.subPage<0)
      {
        this.subPage=0
      }
      let v=this.subPageList[this.subPage]
      if (v==undefined)
      {
        console.log('oh noes. v is undefined')
      }
      v[r].setrow(txt)
    }
    else
      return
    /*
      // Might want to find out why this happens. Doesn't seem to matter
      console.log('not setting row '+r+' to '+txt)
      */
  }
   
  // Return the text of row r on the current subpage
  this.getRow=function(r)
  {
    if (r>=0 && r<=24)
    {
      if (this.subPage<0)
      {
        this.subPage=0
      }
      let v=this.subPageList[this.subPage]
      if (v==undefined)
      {
        console.log('where is our subpage, dammit?')
        return "                                       "
      }
      return v[r].txt
    }
    else
    {
      return "                                        "    
    }
  }
  
  // Helpers for navigating subpages
  this.nextSubpage=function()
  {
    this.subPage=(this.subPage+1) % this.subPageList.length      
  }
  this.prevSubpage=function()
  {
    if (this.subPage>0)
    {
      this.subPage--
    }
    else
    {
      this.subPage=this.subPageList.length-1
    }
  }
  
  this.addSubPage=function()
  {
    this.addPage(this.pageNumber)
    this.setSubPage(this.subPageList.length-1)
  }
  
  this.removeSubPage=function()
  {
    console.log("Remove subpage not implemented. @todo")
  }
  
  this.draw=function(changed)
  {
    let dblHeight
    // Sometimes the carousel isn't ready
    if (typeof this.subPage==='undefined')
    {
      return;
    }
    let carouselReady=typeof this.subPage!='undefined'
    if (carouselReady)
    {
      carouselReady=typeof this.metadata[this.subPage]!='undefined'
    }
    if (!(this.holdMode || this.editMode!=EDITMODE_NORMAL) && carouselReady) // Only cycle if we are not in hold mode or edit
    {
      // carousel timing
      if (tickCounter % ((1+round(this.metadata[this.subPage].timer))*2)==0) // Times 2 because the tick is 2Hz.
      {
        this.nextSubpage()
        console.log("drawing subpage "+this.subPage)
        tickCounter=1 // Prevent a cascade of page changes!
      }
    }
    for (let rw=0;rw<this.rows.length;rw++)
    {
  // console.log("drawing row "+rw+" of "+this.rows.length)
      let cpos=-1
      if (this.editMode!=EDITMODE_NORMAL && rw==this.cursor.y) // If in edit mode and it is the correct row...
      {
        cpos=this.cursor.x
      }
      //this.rows[row].draw(cpos) // Original version
      // Single pages tend to have subpage 0000. carousels start from 0001. So subtract 1 unless it is already 0.
//      let v=this.subPageList[this.subPage>0?this.subPage-1:0] 
      if (this.subPage>=this.subPageList.length) // This shouldn't happen much but it does during start up
        this.subPage=this.subPageList.length-1
        
      let v=this.subPageList[this.subPage]
      if (v==undefined)
      {      
        console.log("Undefined :-(")
        // can we fix it?
        v=this.subPageList[0]
        if (v!=undefined) // Move to a subpage that exists
        {
          this.subPage=0
        }
      }
      if (v!=undefined && v.length>0)
      {      
        if (rw==0 && v.length>0) // Set the page number for the header only
        {
          v[0].setpagetext(this.pageNumberEntry)
        }
        let str=changed.rows[rw]
        if (v[rw].draw(cpos, this.revealMode, this.holdMode, this.editMode, this.subPage, str))
        {
          rw++ // If double height, skip the next row 
        }
      }    
    }
    if (this.showGrid) this.grid()
  }
  
  /** Draw a character grid overlay for edit quidance
   */
  this.grid=function()
  {
    stroke(128)
    for (let x=0;x<=40;x++)
    {
      line(gTtxW*x,0,gTtxW*x,gTtxH*25)
    }
    for (let y=0;y<=25;y++)
    {
      line(0,gTtxH*y,gTtxW*40,gTtxH*y)
    }
  }
  
  //  Draw ch at (x,y) on subpage s
  this.drawchar=function(ch,x,y,s)
  {
    //console.log('Attempting to draw row '+y)
    // Select the subpage to update
    let v=this.subPageList[s]
    if (v==undefined)
    {
      console.log("Can not draw on a subpage that doesn't exist :-(")
    }
    else
    {
      v[y].setchar(ch,x)
    }
  }
  
  /** home
   * Move to the start of the line or the start of text
   */
  this.home=function()
  {
    let col;
    let page=this.subPageList[this.subPage]
    let row=page[this.cursor.y].txt 
    // Find the first printable character
    for (col=0;col<39;col++)
    {
      if (row.charAt(col)>' ')
      {
        break;
      }
    }    
    // Did we find a non blank?
    if (col<39) // Yes. We found the new position
    {
      if (this.cursor.x!=col)
      {        
        this.cursor.x=col    // If we aren't there already, then go there   
      }
      else
      {
        this.cursor.x=0    // otherwise go back to the start of the row
      }
    }
    else // No. Skip to the start of the line
    {
      this.cursor.x=0      
    }  
  }  // home
  
  this.end=function()
  {
    let page=this.subPageList[this.subPage]
    let row=page[this.cursor.y].txt
    let x
    // Find the last non blank character    
    for (x=39;x>0;x--)
    {
      if (row.charAt(x) != ' ')
      {
        break;
      }
    }
    // Did we find a non blank character?
    if (x>0)
    {
      // Is it before the right hand side?
      if (x<38)
      {
        if (this.cursor.x==x+1) // Already there?
        {
          this.cursor.x=39
        }
        else
        {
          this.cursor.x=x+1 // Advance to the blank space
        }
      }
      else
      {
        this.cursor.x=39 // Clip, because we can't advance
      }
    }
    else // Another edge case, If the line is entirely blank, move to the right edge
    {
      this.cursor.x=39
    }
  }
  
  // Insert a space at the current cursor location (TAB command)
  // WARNING: This is not handled by other clients. Will need some thinking how to do it properly
  // Maybe broadcast the entire row when we are done?
  this.insertSpace=function()
  {
    let pg=this.subPageList[this.subPage]
    if (pg!=undefined)
    {
      let x=this.cursor.x
      let y=this.cursor.y
      str=pg[y].txt
      str=str.substr(0,x) + ' ' + str.substr(x)
      // might want to trim back to 40 chars?   
      pg[y].setrow(str)
    }    
  }
  
  // Backspace. Delete current character, move remainder of line one character left
  // Pad with a space at the end. Also update the cursor position.
  // @todo Work out how this edit will get back to the server
  this.backSpace=function()
  {
    let pg=this.subPageList[this.subPage]
    if (pg!=undefined)
    {
      let x=this.cursor.x
      let y=this.cursor.y
      this.cursor.left()
      str=pg[y].txt
      str=str.substr(0,x-1) + str.substr(x,40-x) + ' ' 
      pg[y].setrow(str)
    }    
  }
  
  /**
   * @brief Clear all rows to blank spaces
   */
  this.setBlank=function()
  {
    // console.log(" Clear all rows to blank")
    this.subPageList=[]
    this.metadata=[]
    
    this.addPage(this.pageNumber)
    
//    for (let y=1;y<this.rows.length;y++)
      //this.rows[y].setrow('                                        ')
    //this.rows[0].setrow('Pnn     CEEFAX 1 100 Sun 08 Jan 12:58/57') // @todo Add proper header control    
  }
  
  /**
   * \return true if the character at the location (data.x, data.y) is a graphics character
   * \param data : {p: page x: column y: row s: subpage S: service
   */
  this.IsGraphics=function(data)  
  {
    if (data==undefined)
    {
      return false
    }

    let subpage=data.s
    if (subpage!=this.subPage)
    {
      // Need to access the subpage data.s rather than the local
      // However things will get complicated.
      // Consider another client sending a keystroke.
      console.log("[TTXPAGE::IsGraphics] subPage does not match. Need think about what to do")
      return false
    }
    
    let myPage=this.subPageList[data.s]
    let row=myPage[data.y].txt
    // console.log("[TTXPAGE::IsGraphics]"+row)
    
    let len=data.x
    if (len>40)
    {
      len=40
    }
    let gfxMode=false
    for (let i=0;i<len;i++)
    {
      let ch=row.charCodeAt(i) & 0x7f
      if (ch<0x08)
      {
        gfxMode=false
      }
      if (ch>=0x10 && ch<0x18)
      {
        gfxMode=true
      }
    }
    // console.log("[TTXPAGE::IsGraphics] gfxMode="+gfxMode)

    return gfxMode
  }
    
  /** \return the character at location given in data.x amd data.y */
  this.getChar=function(data)
  {
    if (data==undefined)
    {
      return 0
    } 
    let subpage=data.s
    if (subpage!=this.subPage)
    {
      return false // @todo
    }
    let myPage=this.subPageList[data.s]
    let row=myPage[data.y].txt
    
    let ch=row.charCodeAt(data.x) & 0x7f    
    console.log("[getChar] row="+row+" ch="+ch)        
    return ch        
  }  
  
} // page


/** \return true if while in graphics mode it is a graphics character */
function isMosaic(ch)
{
  ch=ch.charCodeAt() & 0x7f
  return (ch>=0x20 && ch<0x40) || ch>=0x60
}

///////////////////////////////////////////////////////////////////////////////////////////////

function row(page,y,str)
{
  this.page=page
  this.row=y
  this.txt=str
  this.pagetext='xxx'
  // console.log('Setting row to '+this.page+' '+this.row+' '+this.txt)
  this.setchar=function(ch,n)
  {
    this.txt=setCharAt(this.txt,n,ch)
  }

  this.setrow=function(txt)
  {
    this.txt=txt
  }
  
  /** Expect a three digit page number, or partial page number */
  this.setpagetext=function(txt)
  {
    this.pagetext=txt
  }

  /** @param cpos is the cursor column position to highlight
   *  @param if revealMode is true overrides conceal 
   * @return True if there was a double height code in this row
   */
  this.draw=function(cpos, revealMode, holdMode, editMode, subPage, changed)
  {
    let txt=this.txt // Copy the row text because a header row will modify it
    // Special treatment for row 0
    if (this.row==0)
    {
      if (cpos<0 && editMode==EDITMODE_NORMAL) // This is the header row and we are NOT editing
      {
          // Replace the first eight characters with the page number
  //    txt=replace(txt,'P'+this.page.toString(16)+'    ',0)

          if (holdMode)
              txt=replace(txt,'HOLD    ',0)
          else
              txt=replace(txt,'P'+this.pagetext+'    ',0)
          
          // Substitute mpp for the page number
          let ix=txt.indexOf('%%#')
          if (ix<0)
          {
            ix=txt.indexOf('mpp')
          }
          if (ix>0)
          {
            txt=replace(txt,this.page.toString(16),ix)
          }
              
          // Substitute dd for the day 1..31 (or %d)
          ix=txt.indexOf('%d')
          if (ix<0)
          {
              ix=txt.indexOf('dd')
          }
          if (ix>0)
          {
            txt=replace(txt,nf(day(),2),ix)
          }

              // Substitute DAY for the three letter abbreviated day 
          ix=txt.indexOf('%%a')
          if (ix<0)
          {
            ix=txt.indexOf('DAY')
          }
          if (ix>0)
          {
            let week = new Date().getDay() 
            let str="MonTueWedThuFriSatSun".substr((week-1)*3,3)
            txt=replace(txt,str,ix)
          }
          // Substitute MTH for the three letter abbreviated month 
          ix=txt.indexOf('%%b')
          if (ix<0)
          {
            ix=txt.indexOf('MTH')
          }
          if (ix>0)
          {
            let str="JanFebMarAprMayJunJulAugSepOctNovDec".substr((month()-1)*3,3)
            txt=replace(txt,str,ix)
          }
          // Substitute %m for two digit month
          ix=txt.indexOf('%m')
	  if (ix>0)
	  {
	  	txt=replace(txt,nf(month(),2),ix)
	  }
	  // Substitute %y for two digit year
	  ix=txt.indexOf('%y')
          if (ix>0)
          {
		let y=nf(year()%100,2)
		txt=replace(txt,y,ix)
          }
          // Substitute hh for the two digit hour 
          ix=txt.indexOf('%H')
          if (ix<0)
              ix=txt.indexOf('hh')
          if (ix>0)		
              txt=replace(txt,nf(hour(),2),ix)
              
          // Substitute nn for the two digit minutes
          ix=txt.indexOf('%M')
          if (ix<0)
              ix=txt.indexOf('nn')
          if (ix>0)
              txt=replace(txt,nf(minute(),2),ix)
              
          // Substitute ss for the two digit seconds
          ix=txt.indexOf('%S')
          if (ix<0)
              ix=txt.indexOf('ss')
          if (ix>0)
              txt=replace(txt,nf(second(),2),ix)
      }
    else // If editing, then show the page/row number
    {
  // txt=replace(txt,'E'+this.pagetext+'    ',0)            // Show the page/subpage being edited
      let highlight='\003' // Edit mode is yellow
      if (editMode==EDITMODE_ESCAPE)
      {
        highlight='\002' // Escape mode is green
      }
      txt=replace(txt,highlight+this.pagetext+'.'+nf(subPage,2)+'\007',0)            // Show the page/subpage being edited
    }
  }
  // Non header substitutions
  if (this.row>0 && this.row<25 && cpos<0) // This is NOT the header row NOR in edit mode.
  {
    // World time. (two values allowed per line)
    for (let i=0;i<2;i++)
    if ((ix=txt.indexOf('%t'))>0)
    {
      // Read the half hour offsets
      let offset=txt.substring(ix+2,ix+5)
      // console.log(offset)
      // add the offset to the time
      // show the HH:MM
      let h=(hour()+int(parseInt(offset)/2)) % 24
      let m=minute()
      if ( (parseInt(offset) % 2)==1)
        m=(m+offset*30 ) % 60
      txt=replace(txt,nf(h,2)+':'+nf(m,2),ix)
    }
  }
  // Set up all the display mode initial defaults
  let fgColor=color(255,255,255) // Foreground defaults to white
  let bgColor=color(0) // Background starts black
  let textmode=true // If false it is graphics mode
  let contiguous=true // if false it is separated graphics
  let concealed=false
  let holdGfx=false
  let holdChar=' '
  let flashMode=false
  let dblHeight=false
  textFont(ttxFont)
  textSize(gTtxFontSize)
  
  
  // If there is a double height anywhere on this row, the next row must be skipped.
  // Edge case: Any single height character in this row will copy the background (and only the background) to the row below.
  let hasDblHeight=false 
    
  if (txt!="")
  for (let i=0;i<40;i++)
  {
    let ic=txt.charCodeAt(i) & 0x7f
  // if (i==0) console.log (ic+" ")
    if (ic==0x0d)
    {
      hasDblHeight=true    
      break
    }
  }
    
    for (let i=0;i<40;i++)
    {
      let ch=txt.charAt(i)
      let ic=txt.charCodeAt(i) & 0x7f
      let printable=false
      // Do the set-before codes
      switch (ic)
      {
      case  0 : ; // 0: black. Level 1 purists need not apply
      case  1 : ; // 1:red 
      case  2 : ; // 2:green
      case  3 : ; // 3:yellow
      case  4 : ; // 4:blue
      case  5 : ; // 5:magenta
      case  6 : ; // 6:cyan
      case  7 : ; // 7:white
        holdGfx=false
        concealed=false
        break
      case  8 : flashMode=true // 8:flash
        break
      case  9 : flashMode=false;break // 9:steady
      case 10 : break // 10:endbox
      case 11 : break // 11:startbox
      case 12 : // 12:normalheight SetAt
        dblHeight=false
        textFont(ttxFont)
        textSize(gTtxFontSize)
        break 
      case 13 : // 13:doubleheight SetAfter
        break
      case 16 : ;// 16: Farrimond gfxblack
      case 17 : ; // 16:gfxred 
      case 18 : ; // 17:gfxgreen
      case 19 : ; // 18:gfxyellow
      case 20 : ; // 19:gfxblue
      case 21 : ; // 20:gfxmagenta
      case 22 : ; // 21:gfxcyan
      case 23 : ; // 22:gfxwhite
        concealed=false
        break
        case 24 :  // 24: conceal. (SetAt)
            if (!revealMode) concealed=true
            break
      case 25 : contiguous=true;break // 25: Contiguous graphics
      case 26 : contiguous=false;break // 26: Separated graphics

      case 28 : bgColor=color(0);break // 28 black background
      case 29 : bgColor=fgColor;break // 29: new background
      case 30 : holdGfx=true // 30: Hold graphics mode (set at)
        printable=true // Because this will be replaced
        break
      case 31 : break // 31 Release hold mode (set after)
    case 32 : ; // Space is not printable but it is still a mosaic. Intentional fall through
      default:
        if (isMosaic(ch))
        {
          holdChar=ic
        }
      
        printable=true
      } // case
      
      // Mosaic hold is always printable
      if (!textmode && holdGfx)
        printable=true

        // Paint the background colour always
      noStroke()
      fill(bgColor)
      // except if this is the cursor position
      if (cpos==i && flashState) // Flash the orange cursor
      {
        fill(255,100,0) // However, this is hidden when all sixels are set. @todo
      }
      if (this.row<23)
      {
        this.drawchar(String.fromCharCode(0xe6df),i,this.row+1,false) //edge case: a single height character on a double height row has double height background
      }
      this.drawchar(String.fromCharCode(0xe6df),i,this.row,dblHeight)
      if (printable && (flashState || !flashMode) && !concealed) 
      {
          fill(fgColor)          // Normal
        if (textmode || (ch.charCodeAt()>=0x40 && ch.charCodeAt()<0x60))          
        {
          ch=this.mapchar(ch)
          if (changed[i]) {fill(200,100,0)} // Indicate unsaved change
          this.drawchar(ch,i,this.row,dblHeight)
        }
        else // mosaics
        {
      
          //fill(fgColor)
          let ic2=ic
          if (holdGfx)
          {
            ic2=holdChar // hold char replaces
          }
          if (cpos==i && flashState)
          {
            let r=red(fgColor)
            let g=green(fgColor)
            let b=blue(fgColor)
            fill(color(255-r,255-g,255-b))   
            //fill ('magenta')            
          }
          if (contiguous)
          {
            stroke(fgColor)
            this.drawchar(String.fromCharCode(ic2+0x0e680-0x20),i,this.row,dblHeight)
          }
          else
          {
            this.drawchar(String.fromCharCode(ic2+0x0e680),i,this.row,dblHeight)
          }
        }        
      }
      // Set-After codes go here
      switch (ic)
      {
      case  0 : fgColor=color(0);textmode=true;break // 0: black. Only for level 1 rebels.
      case  1 : fgColor=color(255,0,0);textmode=true;break // 1:red 
      case  2 : fgColor=color(0,255,0);textmode=true;break // 2:green
      case  3 : fgColor=color(255,255,0);textmode=true;break // 3:yellow
      case  4 : fgColor=color(0,0,255);textmode=true;break // 4:blue
      case  5 : fgColor=color(255,0,255);textmode=true;break // 5:magenta
      case  6 : fgColor=color(0,255,255);textmode=true;break // 6:cyan
      case  7 : fgColor=color(255,255,255);textmode=true;break // 7:white  
      case 13 : // 13: double height
        dblHeight=true
        hasDblHeight=true
        textFont(ttxFontDH)
        textSize(gTtxFontSize*2) 
        break 
      case 16 : fgColor=color(0);textmode=false;break// 16: Farrimond gfxblack
      case 17 : fgColor=color(255,0,0);textmode=false;break // 16:gfxred 
      case 18 : fgColor=color(0,255,0);textmode=false;break // 17:gfxgreen
      case 19 : fgColor=color(255,255,0);textmode=false;break // 18:gfxyellow
      case 20 : fgColor=color(0,0,255);textmode=false;break // 19:gfxblue
      case 21 : fgColor=color(255,0,255);textmode=false;break // 20:gfxmagenta
      case 22 : fgColor=color(0,255,255);textmode=false;break // 21:gfxcyan
      case 23 : fgColor=color(255,255,255);textmode=false;break // 22:gfxwhite      
      case 24 : break// 24:conceal
      case 31 : holdGfx=false;break // 31 Release hold mode (set after)
      
      }
    }
    if (this.row<1 || this.row>22) // Can't double height header or last row.
      return
    else
      return hasDblHeight
  } // draw
  
  this.drawchar=function(ch,x,y,dblH)
  {
    text(ch,x*gTtxW,(y+1+(dblH?1:0))*gTtxH)
  }
  
  this.mapchar=function(ch)
  {
// Temporary mappings for Germany
/*
switch(ch)
{
  case '|':  return char(0x00f6) // 7/C o umlaut
    case '}':  return char(0x00fc) // 7/D u umlaut  
  }*/
    switch (ch)
    {
    case '#': return '£'
    case '[': return char(0x2190) // 5/B Left arrow.
    case '\\': return char(0xbd)   // 5/C Half
    case ']':   return char(0x2192) // 5/D Right arrow.
    case '^':  return char(0x2191) // 5/E Up arrow.
    case '_':  return char(0x0023) // 5/F Underscore is hash sign
    case '`' : return String.fromCharCode(0x2014) // 6/0 Centre dash. The full width dash e731
    case '{':  return char(0xbc)   // 7/B Quarter
    case '|':  return char(0x2016) // 7/C Double pipe
    case '}':  return char(0xbe)   // 7/D Three quarters
    case '~':  return char(0x00f7) // 7/E Divide 
    case String.fromCharCode(0x7f):  return char(0xe65f) // 7/F Bullet (rectangle block)
    }
  
    return ch
  }
} // row

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function setCharAt(str,index,chr)
{
  if(index > str.length-1) return str
  return str.substr(0,index) + chr + str.substr(index+1)
}

/// @brief replace the characters in str at index with those in str2
function replace(str,str2,index)
{
  let len=str2.length
    if (index+len > str.length) return str
    return str.substr(0,index) + str2 + str.substr(index+len)
}


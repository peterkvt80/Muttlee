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
  // @todo check range
  this.init=function(number)
  {
    this.pageNumber=number;
    this.rows = new Array();
    for (var i=0;i<25;i++)
    {
      this.rows.push(new row(i,"1234567890123456789012345678901234567890"));
    }
    
  }
  
  
  this.draw=function()
  {
    for (var row=0;row<25;row++)
    {
      var cpos=-1;
      if (row==this.cursor.y) cpos=this.cursor.x;
      this.rows[row].draw(cpos);
    }
    
  }
  this.drawchar=function(ch,x,y)
  {
    //console.log('Attempting to draw row '+y);
    this.rows[y].setchar(ch,x);
  }
  
} // page

function row(row,str)
{
  this.row=row;
  this.txt=str;
  this.setchar=function(ch,n)
  {
    this.txt=setCharAt(this.txt,n,ch);
  }
  /// \param cpos is the cursor column position to highlight
  this.draw=function(cpos)
  {
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
      var ch=this.txt.charAt(i);
      var ic=this.txt.charCodeAt(i);
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
    text(ch,x*gTtxW,y*gTtxH);
  }
  this.mapchar=function(ch)
  {
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


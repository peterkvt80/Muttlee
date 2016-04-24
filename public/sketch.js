// teletext
var mypage;
var ttxFont;

//metrics
var gTtxW;
var gTtxH;
var gTtxFontSize=20;

// comms
var socket;

function preload()
{
  ttxFont=loadFont("assets/teletext2.ttf"); // Normal  
  ttxFontDH=loadFont("assets/teletext4.ttf"); // Double height 
}

function setup()
{
  socket=io.connect('http://192.168.1.11:3010');
  createCanvas(600,500);
  background(0);
  // font metrics
  textFont(ttxFont);
  textSize(gTtxFontSize);
  gTtxW=textWidth('M');
  gTtxH=gTtxFontSize;
  mypage=new page();
  mypage.init(100);
  socket.on('keystroke',newChar);
}

// Do not handle ttix escapes. Leave it to the server.
function newChar(data)
{
  //if (data.k<' ')
  // console.log("returned keycode="+(data.k));
  // @todo page number test
  mypage.drawchar(data.k,data.x,data.y);
  mypage.cursor.right();
  
}

// cursor (might be a good idea to put this in a class)
function myCursor(number)
{
  this.x=0;
  this.y=0;
  this.right = function(t)
  {
    this.x++;
    if (this.x>39) this.x=39;
    return this.x;
  };
  
  this.left=function()
  {
    this.x--;
    if (this.x<0) this.x=0;
    return this.x;
  };
  this.up=function()
  {
    this.y--;
    if (this.y<0) this.y=0;
    return this.y;
  };
  this.down=function()
  {
    this.y++;
    if (this.y>24) this.y=24;
    return this.y;
  };
  this.moveTo=function(x,y)
  {
    this.x=constrain(x,0,39);
    this.y=constrain(y,0,24);
  }
}


function draw()
{
  background(0);
  noStroke();
  fill(255,255,255);
  ellipse(mouseX,mouseY,10,10);
  mypage.draw();
}

function keyPressed()
{
  switch (keyCode)
  {
  case LEFT_ARROW: mypage.cursor.left();break;
  case RIGHT_ARROW: mypage.cursor.right();break;
  case UP_ARROW: mypage.cursor.up();break;
  case DOWN_ARROW: mypage.cursor.down();break;
  default:
    console.log('unhandled keycode='+keyCode);
  }
}

function keyTyped()
{
    if (key!='§')
    {
      var data=
      {
        p: mypage.pagenumber,
        k: key,
        x: mypage.cursor.x,
        y: mypage.cursor.y
      }
      socket.emit('keystroke', data);
      newChar(data);
    }
    else
    {
      socket.emit('load');
    }
    console.log('keycode='+key);
}

function mouseClicked()
{
  var xLoc=int(mouseX/gTtxW);
  var yLoc=int(1+mouseY/gTtxH); // @todo Will need to fix this once we add a header
  mypage.cursor.moveTo(xLoc,yLoc);
  console.log('The mouse was clicked at '+xLoc+' '+yLoc);
}

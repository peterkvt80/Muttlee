// cursor class 
TTXCURSOR=function()
{
  this.x=0;
  this.y=0;
  this.hide=true;
  
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



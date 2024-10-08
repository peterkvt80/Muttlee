"use strict";
/** Cursor class for teletext
 */
class TTXCURSOR
{
  constructor()
  {
    this.x=0
    this.y=0
    this.hide=true
  }
  
  right()
  {
    this.x++
    if (this.x>39)
    {
        this.x=39
    }
    this.dump("R")
    return this.x
  }
  
  left()
  {
    this.x--
    if (this.x<0)
    {
        this.x=0
    }
    this.dump("L")
    return this.x
  }
  
  up()
  {
    this.y--
    if (this.y<0)
    {
        this.y=0
    }
    this.dump("U")    
    return this.y
  }
  
  down()
  {
    this.y++
    if (this.y>24)
    {
        this.y=24
    }
    this.dump("D")    
    return this.y
  }
  
  moveTo(x,y)
  {    
    this.x=constrain(x,0,39)
    this.y=constrain(y,0,24)
    this.dump("M")    
  }
  
  dump(ch)
  {
    // console.log("cursor="+ch+" ("+this.x+","+this.y+")")    
  }
} // TTXCursor



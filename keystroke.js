/** keystroke.js
 *  Part of the Muttlee system
 *  Copyright Peter Kwan (c) 2018
 *  MIT license blah blah.
 *  Records keystrokes received from connected clients 
 *  Used to keep a record of edits to pages
 * 
 *  addEvent(data) - Adds a key event to the list
 *  replayEvents() - Replays the events to newly connected clients
 *  saveEvents()
 *  matchPage(event) - Returns a matching event if there is one in the list. (page, subpage, service)
 */

KeyStroke=function()
{
  this.eventList=[];
  this.debug=true;
  if (this.debug) console.log("[keystroke::constructor]");
  
  /** Add a keystroke event to the list */
  this.addEvent=function(data)
  {
    this.eventList.push(data);
    if (this.debug) console.log("[keystroke::addEvent] queue length="+this.eventList.length);
  }

  /** replayEvents to the specified client*/
  this.replayEvents=function(client)
  {
    if (this.debug) console.log("[keystroke::replay]");
    for (var i=0;i<this.eventList.length;i++)
    {
        client.emit('keystroke',this.eventList[i]);
    }
  }

  this.matchPage=function(event)
  {
    if (this.debug) console.log("[keystroke::matchPage]");  
    return event; // @todo
  }

}; // keystroke class 

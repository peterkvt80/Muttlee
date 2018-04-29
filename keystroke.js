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
 
var readline = require('readline');
//var stream = require('stream');
var fs = require('fs');


KeyStroke=function()
{
  this.eventList=[]
  this.debug=true
  if (this.debug) console.log("[keystroke::constructor]")
  
  /** Add a keystroke event to the list */
  this.addEvent=function(data)
  {
    this.eventList.push(data)
    if (this.debug) console.log("[keystroke::addEvent] queue length="+this.eventList.length)
  }

  /** replayEvents to the specified client*/
  this.replayEvents=function(client)
  {
    if (this.debug) console.log("[keystroke::replay]")
    for (var i=0;i<this.eventList.length;i++)
    {
        client.emit('keystroke',this.eventList[i])
    }
  }

  this.matchPage=function(event)
  {
    if (this.debug) console.log("[keystroke::matchPage]")
    return event // @todo
  }
  
  /* Write the edits back to file */
  this.saveEdits=function()
  {
    if (this.debug) console.log("[keystroke::saveEdit]")
    // Are there any edits to save?
    if (this.eventList.length>0)
    {
        // Sort the event list by S(service name) p(page 100..8ff) s(subpage 0..99) y(row 0..24)
        this.eventList.sort(
            function(a,b)
            {
                // the main service is never defined, so set it to the proper "onair"
                if (a.S==undefined) a.S='onair'
                if (b.S==undefined) a.S='onair'
                // Service sort
                if (a.S<b.S) return -1
                if (a.S>b.S) return 1
                // page sort
                if (a.p<b.p) return -1
                if (a.p>b.p) return 1
                // subpage sort
                if (a.s<b.s) return -1
                if (a.s>b.s) return 1
                // row sort
                if (a.y<b.y) return -1
                if (a.y>b.y) return 1
                return 0 // same
            }
        )
        if (this.debug) this.dump()
        // Now that we are sorted we can apply the edits
        if (this.eventList.length>0)
        {
            for (event=this.eventList.pop();this.eventList.length>0;event=this.eventList.pop())
            {
                // Find the file ( /var/www/d2k/p404.tti)
                service=event.S
                var filename='/var/www/'+service+'/p'+event.p.toString(16)+'.tti'
                if (this.debug) console.log('filename='+filename)
                var instream
                instream = fs.createReadStream(filename,{encoding: "ascii"}) // Ascii strips bit 7 without messing up the rest of the text. latin1 does not work :-(
                instream.on('error',function()
                {
                    console.log("error routine not written")                
                })
                var reader = readline.createInterface(
                {
                    input: instream,
                    terminal: false
                })
                reader.on('line', function(line)
                { 
                    console.log("[saveEdits] line="+line)
                    // processing needed here
                })
            }
        }
        
        // file by file
        // page by page
        // subpage by subpage
        // row by row
        
    }
  }
   
/** Dump the summary of the contents of the key events list   */
    this.dump=function()
    {
        var p2,y2,s2,S2,r2
        var count=0
        for (var i=0;i<this.eventList.length;i++)
        {
            var event=this.eventList[i]
            //console.log(event)
            var p=event.p
            var y=event.y
            var s=event.s
            var S=event.S
            if (S==undefined) S="AAAA"
            // Count the number of edits to a particular row (y)
            if ((p2==p) && (y2==y) && (s2==s) && (S2==S) // same row
                && (i!=0))
            {
                count++  
            }
            else // Not same row
            {
                // Not the first item?
                if (i>0)
                {
                    console.log("Count="+(count+1))
                }
                // Not the end of the list?
                if ((i+1)!=this.eventList.length)
                {
                    console.log("[dump] p:"+p.toString(16)+" s:"+s+" y:"+y+" S:"+S)
                }
                count=0
            }
            // Last item in list? Final count
            if ((i+1)==this.eventList.length)
            {
                console.log("Count="+(count))
            }
            
            p2=p;y2=y;s2=s;S2=S
        }        
    }

} // keystroke class 

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
    this.event;
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
        ) // sort
        if (this.debug) this.dump()
        // Now that we are sorted we can apply the edits
        // However, due to the async nature, we only do one file at a time
        if (this.eventList.length>0)
        {
            console.log(this.event)
            this.event=this.eventList[0]
            this.eventList.shift()
            // Get the filename
            service=this.event.S
            if (service==undefined) service='onair'
            var filename='/var/www/'+service+'/p'+this.event.p.toString(16)+'.tti'
            // Open a stream and get ready to read the file
            var instream
            instream = fs.createReadStream(filename,{encoding: "ascii"}) // Ascii strips bit 7 without messing up the rest of the text. latin1 does not work :-(
            instream.on('error',function()
            {
                console.log("error routine not written")   
                throw new Error("Something went badly wrong!")
            })
            var reader = readline.createInterface(
            {
                input: instream,
                terminal: false
            })
            var pageNumber
            var subCode
            var that=this
            reader.on('line', function(line)
            { 
                if (line.indexOf('SC')==0)
                {
                    subCode=line.substring(3)
                    if (subCode>0) subCode--
                    console.log("Found subcode:"+subCode)  
                } 
                if (that.event.s==subCode) // If the subcode matches, look for our line
                {
                    if (line.indexOf('OL,')==0) // teletext row?
                    {
                      var ix=3
                      var row=0
                      var ch
                      ch=line.charAt(ix)
                      if (ch!=',')
                      {
                        row=ch
                      }
                      ix++
                      ch=line.charAt(ix)
                      if (ch!=',')
                      {
                        row=row+ch // haha. Strange maths
                        ix++
                      }
                      row=parseInt(row)
                      ix++ // Should be pointing to the first character now
                      // console.log('row='+row);
                      // console.log("ix="+ix)
                      var str=line
                      while (that.event.y==row && that.event.s==subCode) // Any more characters on this line?
                      {
                        console.log("[saveEdits] Matched row "+row+", line="+line)
                        str=setCharAt(str,that.event.x+ix+1, that.event.k)
                        console.log("[edited]"+str)
                        if (that.eventList.length>0)
                        {
                            that.event=that.eventList[0]
                            that.eventList.shift();
                            console.log(that.event)
                        }
                        else
                            break
                      }
                    } // OL                    
                } // If subcode matches
            }) // reader
            
        }  // If eventlist>0
    } // saveEdits
} // saveEdits

   
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

/** Utility */
function setCharAt(str,index,chr) {
    if(index > str.length-1) return str;
    return str.substr(0,index) + chr + str.substr(index+1);
}
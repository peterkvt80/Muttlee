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
 *
 & @todo Move all the file stuff out of here!
 */
 
require('./page.js')
const page=new Page()
 
KeyStroke=function()
{
  var that=this  // Make the parent available in the nested functions. Probably 100 reasons why you shouldn't do this.
  this.sourceFile=""
  this.destFile=""
  
  this.event=undefined // Used to talk to inner function
  this.outfile=undefined
  
  this.eventList=[]
  this.debug=true
  
  this.writebBackList
  
  /** Add a keystroke event to the list */
  this.addEvent=function(data)
  {
    // Unfortunately, we need to check that we don't already have a character at that location
    // @todo Search through the list and if the character location matches
    // then replace the key entry for that location
    // otherwise push the event
    var overwrite=false
    for (var i=0;i<this.eventList.length;i++)
    {
      if (this.sameChar(data,this.eventList[i]))
      {
        this.eventList[i].k=data.k  // replace the key as this overwrites the original character
        overwrite=true
        console.log("Overwriting character")
        break
      }
    }
    if (!overwrite)
    {
        this.eventList.push(data)
    }
    if (this.debug) console.log("[keystroke::addEvent] queue length="+this.eventList.length)
  } // addEvent
  
  /**<return true if the character location is the same in both key events
   */
  this.sameChar=function(a,b)
  {
    if (a==undefined) return false
    if (b==undefined) return false
    if (a.x!=b.x) return false // Column
    // Check each value for not matching
    if (a.p!=b.p) return false // Page
    if (a.s!=b.s) return false // Subpage
    if (a.y!=b.y) return false // Row
    if (a.S!=b.S) return false // Service
    return true
  } // sameChar

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
  
  /*( Helper for saveEdits() */
  this.savePage=function()
  {
    console.log("[keystroke::savePage] enters")
    //page.filename="/dev/shm/mypage.tti"
    page.savePage("dummy",
      function()
      {
        console.log("Write completed")
      },
      function(err)
      {
        console.log("Write failed"+err)
      }
    )
  }  
  
  /* Write the edits back to file */
  this.saveEdits=function()
  {
    
    var tempFile='/run/shm/work.tti' // where the edited file gets written first
    
    if (this.debug) console.log("[keystroke::saveEdit]")
    // Are there any edits to save?
    if (this.eventList.length==0)
    { 
      return
    }
    
    err=function(error)
    {
      console.log("Something went wrong: "+error)
    }
    
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
    // if (this.debug) this.dump()
    // Now that we are sorted we can apply the edits
    // However, due to the async nature, we only do one file at a time
    if (this.eventList.length>0)
    {
      //console.log(this.event)
      var event=this.eventList[0]
      // Get the filename
      service=event.S
      if (service==undefined)
      {
        service='onair'
      }
      var pageNumber=event.p
      var subPage=event.s
      var filename='/var/www/'+service+'/p'+pageNumber.toString(16)+'.tti' // The filename of the original page
      
      console.log("Filename="+filename)
      const that=this
      page.loadPage(filename, function()
        {
          console.log("Loaded. Now edit...")
          // apply all the edits that refer to this page
          for ( ; (that.eventList.length>0) && (pageNumber==event.p) && (service==event.S) ;
                  event=that.eventList[0] )
          {
            page.keyMessage(event)
            that.eventList.shift()            
          }
          page.print()
          // At this point we trigger off a timer
          setTimeout(this.savePage(), 500);
        }
        ,function(err)
        {
          console.log(err)
        }
      )
      return
      

    } // if any events
  } // saveEdits 
  

  
  this.copyback=function()
  {
    copyFile(that.sourceFile,that.destFile,function(err)
        {
          if (err!=undefined)
          {
            console.log("[copyback] Something meaningful here about a file copy error="+err)
          }
        } //lambda
      ) // copyfile
  } // copyback
  
  /** Dump the summary of the contents of the key events list   */
  this.dump=function()
  {
    console.log("Dump "+this.eventList.length+" items")
    for (var i=0;i<this.eventList.length;i++)
    {
      console.log(
          "p:"+this.eventList[i].p.toString(16)+
          " s:"+this.eventList[i].s+
          " k:"+this.eventList[i].k+
          " x:"+this.eventList[i].x+
          " y:"+this.eventList[i].y
      )
      //console.log(this.eventList[i])
    }        
  } // dump
} // keystroke class 

/** Utility */
function setCharAt(str,index,chr)
{
  if(index > str.length-1) return str
  return str.substr(0,index) + chr + str.substr(index+1)
}

/** copyFile - Make a copy of a file
 * @param source - Source file 
 * @param target - Destination file
 * @param cb - Callback when completed, with an error message
 */
function copyFile(source, target, cb)
{
  console.log ("[copyFile] Copying "+source+" to "+target)
  var cbCalled = false

  var rd = fs.createReadStream(source)
  rd.on("error", function(err)
  {
    done(err)
  })
  var wr = fs.createWriteStream(target)
  wr.on("error", function(err)
  {
    done(err)
  })
  wr.on("end", function(ex)
  {
    console.log("[copyfile] closing files...(end)")
    done()
  })
  wr.on("close", function(ex)
  {
    console.log("[copyfile] closing files...(close)")
    done()
  })
  rd.pipe(wr)

  function done(err)
  {
    if (!cbCalled)
    {
      cb(err)
      cbCalled = true
    }
    rd.close()
    rd=null
  }
} // copyFile
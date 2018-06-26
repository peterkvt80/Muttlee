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
 
var readline = require('readline')
var fs = require('fs')

KeyStroke=function()
{
  var that=this
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
      this.event=this.eventList[0]
      this.eventList.shift()
      // Get the filename
      service=this.event.S
      if (service==undefined) service='onair'
      var filename='/var/www/'+service+'/p'+this.event.p.toString(16)+'.tti' // The filename of the original page
      var copyFilename=service+'.p'+this.event.p.toString(16)+'.tti' // The filename of the copied page
      var copyPath='/run/shm/'
        
      copyFile(filename, copyPath+copyFilename, function(err)
        {
        console.log("File copied, now trying to parse "+copyFilename)
        const currentPath= filename
        const newPath= filename+".backup"


        // @todo Look at err and abandon if needed
        // Open a stream and get ready to read the file
        var instream
        instream = fs.createReadStream(copyPath+copyFilename,{encoding: "ascii"}) // Ascii strips bit 7 without messing up the rest of the text. latin1 does not work :-(
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
          
        that.outfile=fs.createWriteStream(tempFile) // Stick the edited file here until we prove that it is working
        
        // If not set, then set the service to default
        if (that.event.S==undefined)
        {
          that.event.S='onair'
        }
          
        reader.on('line', function(line)
          { 
                  
            var SaveEvent=that.event    // Save so we can check if we stay on the same row
            var subCode=0
            if (line.indexOf('SC')==0)
            {
              subCode=line.substring(3)
              if (subCode>0) subCode--
              console.log("Found subcode:"+subCode)  
              //that.dump()
            } 
            if (that.event.s==subCode) // If the subcode matches, look for our line
            {
                // @todo: BUG. If the line doesn't exist, we can't add or edit it.
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
                  // console.log('row='+row)
                  
                  // Pad strings shorter than 40 characters
                  if (line.length<40)
                  {
                    line+="                                        " 
                    line=line.substring(0,40)
                  }                  

                  var str=DeEscapePrestel(line)

                  var changed=false
                  
                  // This is if we have changes to apply to a line that doesn't exist
                  // We have to create the missing lines
                  // This is annoyingly almost the same code repeated in the next block, We can factorise
                  if (that.eventList.length>0 && that.event.y<row)
                  {
                    console.log("TODO: We are at row "+row+" but event.y="+that.event.y)
                    var moreLines=true
                    var moreEvents=true
                    // We don't actually have a line from the file. We need to add one.
                    
                    while (moreLines)
                    {
                      var currentRow=that.event.y
                      var strPrefix="OL,"+that.event.y+","
                      str="                                      "
                      while (moreEvents)
                      {
                        str=setCharAt(str,that.event.x, that.event.k) // Set the key of the event
                        if (that.eventList.length>0) // Any more events?
                        {
                          that.event=that.eventList[0]
                          if (that.event.S==undefined) // default service is onair
                          {
                            that.event.S='onair'
                          }
                          if (that.event.y!=currentRow ||
                              that.event.s!=SaveEvent.s ||
                              that.event.S!=SaveEvent.S ||
                              that.event.p!=SaveEvent.p) // If the next event is not on the same row
                          {
                            moreEvents=false // Done with this line
                            // Don't eat the event, it belongs to the next line
                          }
                          else
                          {
                            that.eventList.shift()  // Eat the event. It is on the same row                            
                          }                                
                        }
                        else
                        {  
                          moreLines=false
                          that.event.y=0 // Signal that we ar
                          break; // Done! There are no more events to process
                        }
                      } // moreEvents
                      if (that.eventList.length>0 || that.event.y>=row) // Are we caught up with the actual rows yet?
                      {
                        moreLines=false;
                      }
                      line=strPrefix+EscapePrestel(str); // Escape and write the line
                      console.log("Writing out "+line)
                      that.outfile.write(line+'\n')
                    }
                  } // Create missing line(s)
                  
                  var more=that.event.y==row // If the row matches, we have an entry to process
                  while (more) // Any more changes on this line?
                  {
                    changed=true
                    str=setCharAt(str,that.event.x+ix, that.event.k)
                    console.log("Setting key="+that.event.k)
                    if (that.eventList.length>0)
                    {
                        that.event=that.eventList[0]
                        if (that.event.S==undefined)
                        {
                          that.event.S='onair'
                        }
                        if (that.event.y!=row ||
                            that.event.s!=SaveEvent.s ||
                            that.event.S!=SaveEvent.S ||
                            that.event.p!=SaveEvent.p) // If the next event is not on the same row
                        {
                          more=false // Done with this line
                          console.log("S="+that.event.S)
                          console.log(that.event)
                          console.log(SaveEvent)                            
                        }
                        else
                        {
                          that.eventList.shift()  // Eat the event. It is on the same row                            
                        }
                        // console.log(that.event)
                    }
                    else
                    {
                      console.log("Nothing left to process")
                      break // Nothing left to process
                    }
                  }
                  // The result of editing this row
                  if (changed)
                  {
                    console.log("ix="+ix)
                    console.log("[1. before]"+line+">")
                    console.log("[2. edited]"+str+">")
                    
                    line=EscapePrestel(str); // Escape and write the line
                    console.log("[3. escaped]"+line+">")
                  }
                  
                } // OL                    
            } // If subcode matches
           // Write the line out to the file
            that.outfile.write(line+'\n')

        }) // reader.on
            /*
            reader.on('end', function()
            {
              reader.close()
              that.sourceFile=tempFile
              that.destFile=filename
              setTimeout(that.copyback,5000)
            })
            */
            /* When the input stream ends */
            reader.on('close', function(line)
              {
                // console.log("Copy "+tempFile+" to "+filename)
                reader.close()
                // Oh. This fails because we are already nested inside copyfile
                // Instead we schedule the file write so that it doesn't interfere with the current thread.
                that.sourceFile=tempFile
                that.destFile=filename
                setTimeout(that.copyback,500)
                //This is when we will also close the output file and probably rename them.
                // that.outfile.end()
                console.log("[reader.on] closed file. byebye.")
              }) // lambda/reader.close
          } // lambda
        )     
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
// io stream stuff
const fs = require('fs')
const readline = require('readline')
const stream = require('stream')

require('./weather.js') // Should check if this is obsolete
require('./service.js')
require('./utils.js') // Prestal and other string handling
require('./keystroke.js') // Editing data from clients

var services=[] // List of services

//var outstream = new stream
//outstream.readable = true
//outstream.writable = true

// The x value is used to signal various states using magic numbers
const SIGNAL_PAGE_NOT_FOUND = -1
const SIGNAL_INITIAL_LOAD = 2000

const express=require('express')
var app = express()
app.use(express.static('public'))
var server= app.listen(8080)

var weather=new Weather(doLoad)
var keystroke=new KeyStroke()

app.get('/weather.tti',weather.doLoadWeather)

var socket=require('socket.io')
var io=socket(server)
var initialPage=0x100
var connectionList=new Object() // Associative array links user id to service: connectionList['/#NODc31jxxFTSm_SaAAAC']='d2k'
var missingPage=0

console.log("Server is running on "+process.platform)
io.sockets.on('connection',newConnection)

function save()
{
  console.log("Autosave")
  keystroke.saveEdits()
}

setInterval(save, 60000)  // every minute we save away the edits

function newConnection(socket)
{
  // Try to split the parameters from ?service=BBCNEWS&page=120    
      
  var queryString = {}
  var uri=decodeURI(socket.handshake.headers.referer)
  uri.replace(
    new RegExp("([^?=&]+)(=([^&]*))?", "g"),
    function($0, $1, $2, $3) { queryString[$1] = $3 }
  )
  // console.log('[newConnection] Service: ' + queryString['service'])     // ID: 2140
  // console.log('[newConnection] Page: ' + queryString['page']) // Name: undefined
  
  var p=parseInt("0x"+queryString['page'],16)
  
  // If there was no page supplied we default to 100.
  if (queryString['page']===undefined)
  {
    p=0x100
  }
  var serviceString=queryString['service']
    
  connectionList[socket.id]=serviceString // Register that this user is linked to this service.

  // var p=socket.handshake.headers.referer.slice(-3)
  // If there is no page=nnn in the URL then default to 0x100
  //console.log('[newConnection] typeof(p) '+typeof(p))
  if (p>=0x100 && p<=0x8ff)
  {
		initialPage=p
		// console.log('[newConnection] setpage '+initialPage.toString(16))
		var data=
		{
			p: initialPage,
      S: serviceString
		}
		io.sockets.emit('setpage',data)
  }
  else
  {
		initialPage=0x100
  }
  console.log(p)
  console.log('[NewConnection] '+socket.id)
  
  var str=socket.id.toString()
  
  //console.log('['+str+']')
  
  var clientIp = socket.request.connection.remoteAddress
  console.log(clientIp)
  // Banned IP addresses. All of them Amazon AWS bots making annoying connections during debugging
  if ((clientIp=="54.159.215.81") ||
    (clientIp==='54.161.11.39') ||
    (clientIp==='54.235.50.87')||
    (clientIp==='54.162.45.98')||
    (clientIp==='54.162.186.216')  
    )  
  {
  // console.log("*["+clientIp+"]********************************************* blocked ip")
    return
  }
  
  // 107.20.85.165 AmazonAWS bad bot
	
	// Send the socket id back. If a message comes in with this socket we know where to send the setpage to.
	socket.emit("id",socket.id)
	
  // Set up handlers for this socket
  socket.on('keystroke', keyMessage)
  function keyMessage(data)
  {
    socket.broadcast.emit('keystroke', data)
    console.log("Main::keyMessage"+data)  // @todo Comment this line out
    // Also send this keymessage to our pages
    // Or maybe to our services who can then switch the message as needed?
    for (var i=0;i<services.length;i++)
    {
      services[i].keyMessage(data)
    }
    // Temporary hack. Use ] to trigger the writeback mechanism.
    if (data.k==']')
    {
      keystroke.saveEdits()
    }
    else
    {
      keystroke.addEvent(data)
    }
  }
  
  socket.on('load', doLoad)
  socket.on('initialLoad',doInitialLoad)
  socket.on('create',doCreate)
  
  // When this connection closes we remove the connection id
  socket.on('disconnect', function () {
        delete connectionList[socket.id]
  })
  
} // NewConnection

/** Create the page and load it
 */
function doCreate(data)
{
  console.log('[doCreate] Creating page '+data.p.toString(16))
  // Create a page from template
  createPage(data, function()
  {
    doLoad(data)
  })
}

function doInitialLoad(data)
{
  console.log('[doInitialLoad]')
	data.p=parseInt(initialPage)
	doLoad(data)
}

function doLoad(data)
{
  var filename
  // if client request has data.x==SIGNAL_INITIAL_LOAD, we load the initial page. 
  if (data.x==SIGNAL_INITIAL_LOAD)
  {
    data.p=initialPage
    data.x=0
  }
    
  var serviceString=connectionList[data.id] 
  
  if (typeof(serviceString)==='undefined')
  {
    serviceString='onair'
  }
  filename='/var/www/'+serviceString+'/p'+data.p.toString(16)+'.tti'
  // !!! Here we want to check if the page is already in cache
  var found=findService(serviceString)
  if (found===false)
  {
    console.log("[doLoad] Adding service called "+serviceString+" buffered key count ="+keystroke.length)
    services.push(new Service(serviceString))	// create the service
    found=services.length-1 // The index of the service we just created
  }

  // Now we have a service number. Does it contain our page?
  var svc=services[found]
  var page=svc.findPage(data.p)
  console.log("[doLoad] Found Service:"+serviceString+" Page:"+page)

  console.log('[doLoad] called '+filename+' data.x='+data.x+' id='+data.id)
  //	console.log(data)
  if (data.y==0 && data.p==0x410) // Special hack. Intercept P410. First time we will load weather
  {
    data.x=SIGNAL_PAGE_NOT_FOUND
  }
  // The next time x=1 so we will load the page we just created.
  if (data.x<0)
  {
    filename='/var/www/'+serviceString+'/p404.tti' // this must exist or we get into a deadly loop
    data.S=serviceString
    // filename='http://localhost:8080/weather.tti'
    if (data.p==0x410)
    {
      weather.doLoadWeather(0,0)
      return
    }
  }
  //console.log("blank")
  io.sockets.emit('blank',data) // Clear down the old data. // TODO This should emit only to socket.emit, not all units
  var fail=false
  var instream
  instream = fs.createReadStream(filename,{encoding: "ascii"}) // Ascii strips bit 7 without messing up the rest of the text. latin1 does not work :-(
  instream.on('error',function()
    {       
      var data2
      console.log("[doLoad] ERROR! data.p="+data.p.toString(16))
      // If this comes in as 404 it means that the 404 doesn't exist either. Set back to the default initial page
      if (data.p==0x404)
      {
          console.log('[doLoad] 404 double error')
          data.p=initialPage
          data.S=undefined
          data2=data // Hmm, do we need to do a deep copy here?
          data2.x=0
          connectionList[data.id]=undefined // Force this user back to the default service
      }
      else
      {
        data2=data // Could this do better with a deep copy?
//            console.log('page that we failed to load='+data2.p)
        data2.y=data2.p // Save the page number, we will ask the user if they want to create the page
        data2.p=0x404 // This page must exist or we get into a deadly loop
        data2.x=SIGNAL_PAGE_NOT_FOUND // Signal a 404 error
        data2.S=connectionList[data.id] // How do we lose the service type? This hack shouldn't be needed
        console.log('[doLoad] 404 single error. Service='+data2.S)
      }
      io.sockets.emit("setpage",data2)
      doLoad(data2)       
    }) // page load error

    var rl = readline.createInterface({
    input: instream,
    //    output: outstream,
    terminal: false
    })

    rl.on('line', function(line)
    { 
      if (line.indexOf('PN')==0)
      {
        // console.log('Need to implement carousels'+line)	
        data.line=line.substring(6)
        io.sockets.emit('subpage',data)
      }
      else
      if (line.indexOf('DE,')==0) // Detect a description row
      {
        var desc=line.substring(3)
        data.desc=desc
        // Hacky hack. Page 404 gets the failed page number in data.y
        if (data.p==0x404)
        {
          data.desc+=" Failed to load "+data.y.toString(16)
          missingPage=data.y.toString(16)
        }
        io.sockets.emit('description',data)
        console.log('Sending desc='+data.desc)		  
      }
      else		
      if (line.indexOf('FL,')==0) // Detect a Fastext link
      {
        var ch
        var ix=3
        data.fastext=[]
        for (var link=0;link<4;link++)
        {
          var flink=''
          for (ch=line.charAt(ix++);ch!=',';)
          {
              flink=flink+ch
              ch=line.charAt(ix++)				
          }
          // console.log('Link '+link+' = ' + flink)
          data.fastext[link]=flink
        }
        // Hacky hack: 404 page signals the missing page in data.y
        // We will offer to make the page from template eventually
        if (data.p==0x404)
        {
          data.fastext[2]='1'+ missingPage.toString(16) // Flag that this page doesn't exist
          console.log(data.fastext);            
        }          
        io.sockets.emit('fastext',data)	
        return
      }
      else
      if (line.indexOf('OL,')==0) // Detect a teletext row
      {
        var p=0
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
      }
      else
      {
        return // Not a row. Not interested
      }
      data.y=row
      
      // Here is a line at a time
      var result=line.substring(ix) // snip out the row data
      // Pad strings shorter than 40 characters
      if (result.length<40)
      {
        result+="                                        " 
        result=result.substring(0,40)
      }
      // @todo Different services need different permissions
      if (data.S=='wtf' && row==22 && data.p==0x404) // Special hack for 404 page. Replace this field with the missing page number
      {
        var first=result.substring(0,32)
        var second=result.substr(35)
        result=first+missingPage.toString(16)+second
      } // end of 404 hack
      
      //console.log ('Row(a)='+result)
      result=DeEscapePrestel(result) // remove Prestel escapes
      //console.log ('Row(b)='+result)
      
      data.k='?' // @todo Not sure what these values should be, if anything
      data.x=-1 
      // console.log ('Row='+result)
      data.y= row // The row that we are sending out
      data.rowText=result
      //console.log(data.p.toString(16)+' '+data.y+' '+data.rowText)
      io.sockets.emit('row',data)
  }) // rl.on
  
  rl.on('close',
    function()
    {
      console.log('[doLoad] end of file')
      // When the file has been read, we want to send any keystrokes that might have been added to this page
      keystroke.replayEvents(io.sockets)
      // How are we going to send this?
    }
  )
} // doLoad
  
/** Finds the service with the required name.
* @return Index of service, or false
*/
function findService(name)
{
  if (services.length===0)
  {
    return false // No services
  }
  for (var i=0;i<services.length;i++)
  {
    if (services[i].matchName(name))
    return i
  }
  return false // Not found
}


/** Create a page from template number data.p
 */
function createPage(data, callback)
{
  console.log('[createPage] Starts')
  // what is my page name? /var/www/<service>/p<page number>.tti
  // @todo Check for service being undefined
  var filename='/var/www/'+data.S+'/p'+data.p.toString(16)+'.tti'
  console.log('[createPage] filename='+filename)
  var template=""
  // open write file stream
  var wstream = fs.createWriteStream(filename)
  // write the template
  wstream.write('DE,Topic: Created by user\n')
  wstream.write('DS,muttlee\n')
  wstream.write('SP,'+filename+'\n')
  wstream.write('CT,8,T\n')
  wstream.write('PN,'+data.p.toString(16)+'00\n') // @todo How can we add subpages?
  wstream.write('SC,0000\n')
  wstream.write('PS,8000\n') // To do languages
  wstream.write('RE,0\n')
  wstream.write('OL,0,XXXXXXXXWT-FAX mpp DAY dd MTH C hh:nn.ss\n')
  wstream.write('OL,1,Q73#35R7ss35S7sskT]C| Wiki |FFacts at  |\n')
  wstream.write('OL,2,Q55555R5 5 5S5=$jT]C| Tel  |Fyour      |\n')
  wstream.write('OL,3,Qussq5Rupqp5SuqpzT]C| Fax  |Ffingertips|\n')
  wstream.write('OL,4,MTemplate                               \n')
  wstream.write('OL,5,Q                                       \n')
  wstream.write('OL,6, ```````````````````````````````````````\n')
  wstream.write('OL,7,CTemplateGhighlights other entries in   \n')
  wstream.write('OL,8,CyellowGwith the first paragraph white. \n')
  wstream.write('OL,9,F                                       \n')
  wstream.write('OL,10,FSubsequent paragraphs should be cyan.  \n')
  wstream.write('OL,11,FThe last line is reserved for Fastext  \n')
  wstream.write('OL,12, To find out more about editing, press  \n')
  wstream.write('OL,13, theFcyanGbutton.                       \n')  
  wstream.write('OL,14,F                                       \n')
  wstream.write('OL,15,F                                       \n')
  wstream.write('OL,16,M    NOW PRESSHESCAPEIAND EDIT THIS  \n')
  wstream.write('OL,17,F                                       \n')
  wstream.write('OL,18,F                                       \n')
  wstream.write('OL,19,F                                       \n')
  wstream.write('OL,20,F                                       \n')
  wstream.write('OL,21,F                                       \n')
  wstream.write('OL,22,F                                       \n')
  wstream.write('OL,23,F                                       \n')
  wstream.write('OL,24,A Next   B....       C....      FHelp   \n')
  // @todo ONLY ALLOW NEXT LINK TO BE DECIMALS
  wstream.write('FL,'+(data.p+1).toString(16)+',8ff,8ff,700,8ff,8ff  \n')
  wstream.end()
  // signal completion
  wstream.on('finish',callback)
}
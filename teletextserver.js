// io stream stuff
var fs = require('fs');
var readline = require('readline');
var stream = require('stream');

require('./weather.js');
require('./page.js');
require('./service.js');

var services=[]; // List of services

//var outstream = new stream;
//outstream.readable = true;
//outstream.writable = true;



var express=require('express');
var app = express();
app.use(express.static('public'));
var server= app.listen(8080);

var weather=new Weather(doLoad);

app.get('/weather.tti',weather.doLoadWeather);
console.log("Server is running");

var socket=require('socket.io');

var io=socket(server);

var initialPage=0x100;
// var service="BBCNEWS/BBC";

var service="/var/www/onair/p";

io.sockets.on('connection',newConnection);

function newConnection(socket)
{
// Try to split the parameters from ?service=BBCNEWS&page=120
	
var queryString = {};
var uri=decodeURI(socket.handshake.headers.referer);
uri.replace(
    new RegExp("([^?=&]+)(=([^&]*))?", "g"),
    function($0, $1, $2, $3) { queryString[$1] = $3; }
);
console.log('Service: ' + queryString['service']);     // ID: 2140
console.log('Page: ' + queryString['page']); // Name: undefined
var p=parseInt("0x"+queryString['page'],16);
service=queryString['service'];

  // var p=socket.handshake.headers.referer.slice(-3);
  // If there is no page=nnn in the URL then default to 0x100
  if (typeof(p)=="undefined")
		p=0x100;
  if (typeof(service)=="undefined")
    service="/var/www/onair/p";
  else
		service="ITV/R"; // @todo Temporary measure 
  if (p>=0x100 && p<=0x8ff)
  {
		initialPage=p;
		console.log('Setting page '+initialPage.toString(16));
		var data=
		{
			p: initialPage
		}
		io.sockets.emit('setpage',data);
  }
  else
  {
		initialPage=0x100;
  }
	console.log(p);
  console.log('New connection'+socket.id);
	
	// Send the socket id back. If a message comes in with this socket we know where to send the setpage to.
	socket.emit("id",socket.id);
	
  // Set up handlers for this socket
  socket.on('keystroke', keyMessage);
  function keyMessage(data)
  {
    socket.broadcast.emit('keystroke', data);
    // console.log(data);
  }
  socket.on('load', doLoad);
  socket.on('initialLoad',doInitialLoad);
}

function doInitialLoad(data)
{
	data.p=parseInt(initialPage);
	doLoad(data);
}

  function doLoad(data)
  {
	var filename
	if (data.x==2000)
	{
		data.p=initialPage;
		data.x=0;
	}
	filename=service+data.p.toString(16)+'.tti';
	// !!! Here we want to check if the page is already in cache
	var found=findService(service);
	if (found===false)
	{
		console.log("Adding service called "+service);
		services.push(new Service(service));	// create the service
		found=services.length-1; // The index of the service we just created
	}

	// Now we have a service number. Does it contain our page?
	var s=services[found];
	var page=s.findPage(data.p);
	console.log("Found Service:"+service+" Page:"+page);
	
    console.log('doLoad called '+filename+' data.x='+data.x+' id='+data.id);
	//	console.log(data);
	if (data.y==0 && data.p==0x410) // Special hack. Intercept P410. First time we will load weather
		data.x=-1;
	// The next time x=1 so we will load the page we just created.
    if (data.x<0)
	{
		filename=service+'404.tti'; // this must exist or we get into a deadly loop
		// filename='http://localhost:8080/weather.tti';
		if (data.p==0x410)
		{
			weather.doLoadWeather(0,0);
			return;
		}
	}
		//console.log("blank");
	io.sockets.emit('blank',data); // Clear down the old data. // TODO This should emit only to socket.emit, not all units
	var fail=false;
	var instream;
	instream = fs.createReadStream(filename,{encoding: "ascii"}); // Ascii strips bit 7 without messing up the rest of the text. latin1 does not work :-(
	instream.on('error',function()
	{
	  var data2=data;
	  data2.p=0x404; // This page must exist or we get into a deadly loop
	  data2.x=-1; // Signal a 404 error
		io.sockets.emit("setpage",data2);
	  doLoad(data2);	  
	});

    var rl = readline.createInterface({
    input: instream,
//    output: outstream,
    terminal: false
	});

	rl.on('line', function(line)
	{ 
		if (line.indexOf('PN')==0)
		{
			// console.log('Need to implement carousels'+line);	
			data.line=line.substring(6);
			io.sockets.emit('subpage',data);
		}
		else
		if (line.indexOf('DE,')==0) // Detect a description row
		{
		  var desc=line.substring(3);
			data.desc=desc;
		  io.sockets.emit('description',data);
		console.log('Sending desc='+data.desc);		  
		}
		else		
		if (line.indexOf('FL,')==0) // Detect a Fastext link
		{
		  var ch;
		  var ix=3;
		  data.fastext=[];
		  for (var link=0;link<4;link++)
		  {
			var flink='';
			for (ch=line.charAt(ix++);ch!=',';)
			{
				flink=flink+ch;
				ch=line.charAt(ix++);				
			}
			// console.log('Link '+link+' = ' + flink);
			data.fastext[link]=flink;
		  }
		  io.sockets.emit('fastext',data);	
			return;
		}
		else
		if (line.indexOf('OL,')==0) // Detect a teletext row
		{
		  var p=0;
		  var ix=3;
		  var row=0;
		  var ch;
		  ch=line.charAt(ix);
		  if (ch!=',')
		  {
			row=ch;
		  }
		  ix++;
		  ch=line.charAt(ix);
		  if (ch!=',')
		  {
			row=row+ch; // haha. Strange maths
			ix++;
		  }
		  row=parseInt(row);
		  ix++; // Should be pointing to the first character now
		  // console.log('row='+row);
		}
		else
		return; // Not a row. Not interested
		data.y=row;
		// @todo - Handle strings shorter than 40 characters
		
		// Here is a line at a time
		var result='';
		for (var i=0;i<40;i++)
		{
		  var ch=line.charAt(ix++);
		  if (ch=='\u001b') // Prestel escape
		  {
			ch=line.charAt(ix++).charCodeAt()-0x40;// - 0x40;
			// console.log ('Escaped char='+ch);
			ch=String.fromCharCode(ch);
		  }
		  data.k=ch;
		  data.x=i;
		  // io.sockets.emit('keystroke', data);
		  result+=ch;
		}
		// console.log ('Row='+result);
		data.y= row;
		data.rowText=result;
		//console.log(data);
		io.sockets.emit('row',data);
	});

  }
  /** Finds the service with the required name.
   * @return Index of service, or false;
   */
  function findService(name)
  {
	if (services.length===0) return false; // No services
    for (var i=0;i<services.length;i++)
	{
		if (services[i].matchName(name))
		return i;
	}
	return false; // Not found
  }



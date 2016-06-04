// io stream stuff
var fs = require('fs');
var readline = require('readline');
var stream = require('stream');

//var outstream = new stream;
//outstream.readable = true;
//outstream.writable = true;

var express=require('express');
var app = express();
app.use(express.static('public'));
var server= app.listen(8080);
console.log("Server is running");

var socket=require('socket.io');

var io=socket(server);

var initialPage=100;
var service="BBCNEWS/BBC";

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
var p=queryString['page'];
service=queryString['service'];

  // var p=socket.handshake.headers.referer.slice(-3);
  // If there is no page=nnn in the URL then default to 100
  if (typeof(p)=="undefined")
	p=100;
  if (typeof(service)=="undefined")
    service="BBCNEWS/BBC";
  else
	service="ITV/R"; // @todo Temporary measure 
  if (p>=100 && p<=999) // Only allow decimals (no Bamboozle cheating)
  {
	initialPage=p;
	console.log('Setting page '+initialPage);
	var data=
	{
		p: initialPage
	}
	  var data=

	io.sockets.emit('setpage',data);
  }
  else
  {
	initialPage=100;
  }
	console.log(p);
  console.log('New connection'+socket.id);
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
	filename=service+data.p+'.ttix';
    //console.log('doLoad called '+filename+' data.x='+data.x);
	//	console.log(data);
	if (data.y==0 && data.p==400) // Special hack. Intercept P400. First time we will load weather
		data.x=-1;
	// The next time x=1 so we will load the page we just created.
    if (data.x<0)
	{
		filename=service+'404.ttix';
		// filename='http://localhost:8080/weather.tti';
		if (data.p==400)
		{
			doloadweather(0,0);
			return;
		}
	}
		//console.log("blank");
	io.sockets.emit('blank',data); // Clear down the old data.
	var fail=false;
	var instream;
	instream = fs.createReadStream(filename);
	instream.on('error',function()
	{
	  var data2=data;
	  //data2.p=404;
	  data2.x=-1; // Signal a 404 error
	  doLoad(data2);	  
	});

    var rl = readline.createInterface({
    input: instream,
//    output: outstream,
    terminal: false
	});

	rl.on('line', function(line)
	{
		if (line.indexOf('DE,')==0) // Detect a description row
		{
		  var desc=line.substring(3);
		  io.sockets.emit('description',desc);
		console.log('Sending desc='+desc);		  
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
			console.log('Link '+link+' = ' + flink);
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

/**--/Weather Stuff is below/--**/
// io stream
//var fs=require('fs');
//var readline=require('readline');
//var stream=require('stream');
var request=require('request');

var gResponse;

// express
//var express=require('express');
//var app=express();

// server
// var server=app.listen(3020);
//console.log('Server is running');

// app.get('/',mypage);
app.get('/weather.tti',doloadweather);

// Request weather from Darren Storer's server
function doloadweather(req,res)
{
	gResponse=res;
	var weatherdata="http://g7lwt.com/realtime.txt";
	request.get(weatherdata, gotWeather);
}

// Got the weather, tokenise it and generate teletext
function gotWeather(error, res, body)
{
	if (!error && res.statusCode==200)
	{
		var weather=body.split(' ');
		console.log("weather="+weather);
	}
	mypage(weather);
}

function mypage(w)
{
	var page="DE,Weather data courtesy of Darren Storer\r\n\
DS,inserter\r\n\
SP,E:\dev\muttlee\weather.tti\r\n\
CT,8,T\r\n\
PS,8000\r\n\
RE,0\r\n\
PN,40000\r\n\
SC,0000\r\n\
OL,0,XXXXXXXXTEDFAX mpp DAY dd MTH C hh:nn.ss\r\n\
OL,1,SxCWEATHERC"+w[1]+"S$\r\n\
OL,2,Q|||C   C      in    out  feels like    \r\n\
OL,3,Q|||GTempBG"+w[22]+"BG"+w[2]+"RBG"+w[54]+"BG   \r\n\
OL,4,Qj|||||||||||||||||||||||||||\r\n\
OL,5,Q|||C mph     now    ave.    gust    dir\r\n\
OL,6,Q|||GWindFG"+w[6]+"FG"+w[5]+"FG"+w[32]+"FG"+w[11]+"\r\n\
OL,7,Qj|||||||||||||||||||||||||||\r\n\
OL,8,Q|||C   %      in    out      dew       \r\n\
OL,9,Q|||GHum EG"+w[23]+"%EG"+w[3]+"%EG"+w[4]+"EG   \r\n\
OL,10,Qj|||||||||||||||||||||||||||\r\n\
OL,11,Q|||C  mm   today    hour               \r\n\
OL,12,Q|||GRainDG"+w[9]+"DG "+w[8]+"DG    DG   \r\n\
OL,13,Qj|||||||||||||||||||||||||||\r\n\
OL,14,Q|||C hPa      now   trend              \r\n\
OL,15,Q|||GPresAG"+w[10]+"AG"+w[18]+"AG   AG   \r\n\
OL,16,Qj|||||||||||||||||||||||||||\r\n\
OL,17,Q|||G                                   \r\n\
OL,18,QGWind chill: "+w[24]+"C                   \r\n\
OL,19,QGHeat index: "+w[41]+"                   \r\n\
OL,20,QGUV Index  :   "+w[43]+"                   \r\n\
OL,21,QF]DWeather station: Location?       \r\n\
OL,22,QF]Dhttp://g7lwt.com/realtime.txt    \r\n\
OL,23,Q+]                                   \r\n\
OL,24,ARefreshBFirst storyCHeadlinesFMain Menu\r\n\
FL,400,104,102,120,100,100";
		
	console.log("got here");
	if (gResponse!=0)	
	{
		gResponse.writeHead(200, {'Content-Type': 'application/octet-stream'});
		//Content-Disposition: attachment;filename=\"weather.tti\"
		gResponse.write(page);
		gResponse.end();
	}
	else
	{
		var outstream;
		var filename="BBCNEWS/BBC400.ttix";
		outstream = fs.createWriteStream(filename);
		fs.writeFile(filename,page,function (err){
		if (!err)
		{
			console.log("Page written OK");
			var data={
				S:0,
				p:400,
				s:0,
				y:1,
				x:1 // Signal that we can now render the page
			};
			doLoad(data);			
		}
		else	
			console.log('error='+err);
		});

	}
}

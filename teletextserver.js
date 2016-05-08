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

io.sockets.on('connection',newConnection);

function newConnection(socket)
{
  console.log('New connection'+socket.id);
  // Set up handlers for this socket
  socket.on('keystroke', keyMessage);
  function keyMessage(data)
  {
    socket.broadcast.emit('keystroke', data);
    // console.log(data);
  }
  socket.on('load', doLoad);

  function doLoad(data)
  {
	var filename='BBCNEWS/BBC'+data.p+'.ttix';
    console.log('doLoad called '+filename+' data.x='+data.x);
    if (data.x<0)
	{
		filename='BBCNEWS/BBC404.ttix';
	}
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
		//console.log ('Row='+result);
		data.y= row;
		data.rowText=result;
		//console.log(data);
		io.sockets.emit('row',data);
	});

  }
}



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
var server= app.listen(3010);
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
    console.log(data);
  }
  socket.on('load', doLoad);
  function doLoad()
  {
    var instream = fs.createReadStream('private/R10000.TTIx');
    console.log('doLoad called');
    var s="1234567890abcdefghij1234567890abcdefghij";
    var data=
    {
      p: 100,
      k: '?',
      x: 0,
      y: 2
    }
    var rl = readline.createInterface({
    input: instream,
//    output: outstream,
    terminal: false
});
rl.on('line', function(line)
{
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
      console.log('row='+row);
    }
    else
    return; // Not a row. Not interested
    data.y=row;
    // @todo - Handle strings shorter than 40 characters
    for (var i=0;i<40;i++)
    {
      var ch=line.charAt(ix++);
      if (ch=='\u001b') // Prestel escape
      {
        ch=line.charAt(ix++).charCodeAt()-0x40;// - 0x40;
        console.log ('Escaped char='+ch);
        ch=String.fromCharCode(ch);
      }
      data.k=ch;
      data.x=i;
      io.sockets.emit('keystroke', data);
    }
    //Do your stuff ...
    //Then write to outstream
//    rl.write(cubestuff);
  // console.log (line.indexOf('OL,'));
});

/*
    for (var i=0;i<40;i++)
    {
      data.k=s.charAt(i);
      data.x=i;
      io.sockets.emit('keystroke', data);
      console.log(data);
    }
    */
  }
}



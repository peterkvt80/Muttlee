/**--/Weather Stuff from Darren Storer /--**/

var request=require('request');


Weather = function(callBack) {

var fs = require('fs');

var _callback=callBack;

// io stream
//var fs=require('fs');
//var readline=require('readline');
//var stream=require('stream');

var gResponse;


// Request weather from Darren Storer's server
this.doLoadWeather = function (req,res) {
	gResponse=res;
	var weatherdata="http://g7lwt.com/realtime.txt";
	request.get(weatherdata, this.gotWeather);
}

function myPage(w) {
	var page="DE,Weather data courtesy of Darren Storer\r\n\
DS,inserter\r\n\
SP,E:\dev\muttlee\weather.tti\r\n\
CT,8,T\r\n\
PS,8000\r\n\
RE,0\r\n\
PN,41000\r\n\
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
OL,14,Q|||C hPa     now    trend              \r\n\
OL,15,Q|||GPresAG"+w[10]+"AG"+w[18]+"AG   AG   \r\n\
OL,16,Qj|||||||||||||||||||||||||||\r\n\
OL,17,Q|||G                                   \r\n\
OL,18,QGWind chill: "+w[24]+"C                   \r\n\
OL,19,QGHeat index: "+w[41]+"                   \r\n\
OL,20,QGUV Index  :   "+w[43]+"                   \r\n\
OL,21,QF]DWeather station: Loc: Herts      \r\n\
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
//		var filename="BBCNEWS/BBC400.ttix";
		var filename="/var/www/onair/p410.tti";
		
		outstream = fs.createWriteStream(filename);
		fs.writeFile(filename,page,function (err){
		if (!err)
		{
			console.log("Page written OK");
			var data={
				S:0,
				p:0x410,
				s:0,
				y:1,
				x:1 // Signal that we can now render the page
			};
			_callback(data);	
			return;			
		}
		else	
			console.log('error='+err);
		});

	}
}
// Got the weather, tokenise it and generate teletext
this.gotWeather=function(error, res, body) {
	if (!error && res.statusCode==200)
	{
		var weather=body.split(' ');
		console.log("weather="+weather);
	}
	myPage(weather);
}

};


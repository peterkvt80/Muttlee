// Unit test for Page.js
require('./page.js')

var pageName

var page=new Page()

var eventList=[]

var cb=function(rc)
{
	console.log('[callback]'+rc.length)
  //for (var i=0;i<rc.length;i++)
  //{
//    console.log('['+i+'] '+rc[i])
//  }
  page.print()
  // If we read 11 lines, then all is well
  var status;
  if (rc.length==11)
  {
    status='pass'
  }
  else
  {
    status='fail'
  }
  console.log('test 1: '+status)
}

var err=function(err)
{
	console.log(err)
  if (err.path=='doesntexist.tti')
  {
    console.log('test 2: pass')
  }
  else
  {
    console.log('test 2: fail')
  }
}

// a keystroke object has this data
// data : {S: "wtf", p: 281, s: 0, x: 8, y: 19, …}
// where
// S: "wtf" - Service name
// k: "" - Keystroke character
// p: 281 - Page number (hex 100..8ff)
// s: 0 - Subpage number (decimal 00..99)
// x: 8 - Column address (0..39)
// y: 19 - row address (0..24)
addEvent=function(service, pagenum, subpage, row, column, key)
{
  if ( (pagenum<0x100) || (pagenum>0x8ff) )  {    return 0  }
  if ( (subpage<0) || (subpage>99) )  {    return 0  }
  if ( (column<0) || (column>39) )  {    return 0  }
  if ( (row<0) || (row>39) )  {    return 0  }
  var event=
  {
    S: service,
    k: key,
    p: pagenum,
    s: subpage,
    x: column,
    y: row
  }
  eventList.push(event)
}

eventSet1=function() // writing to an existing line
{
  eventList=[]
  // Row 6 already exists. Add "insert"
  addEvent('wtf', 0x100, 0, 6, 12, 'i')
  addEvent('wtf', 0x100, 0, 6, 13, 'n')
  addEvent('wtf', 0x100, 0, 6, 14, 's')
  addEvent('wtf', 0x100, 0, 6, 15, 'e')
  addEvent('wtf', 0x100, 0, 6, 16, 'r')
  addEvent('wtf', 0x100, 0, 6, 17, 't')

  // Row 10 does not exist. Add "row 10"
  addEvent('wtf', 0x100, 0, 10, 20, 'r')
  addEvent('wtf', 0x100, 0, 10, 21, 'o')
  addEvent('wtf', 0x100, 0, 10, 22, 'w')
  addEvent('wtf', 0x100, 0, 10, 24, '1')
  addEvent('wtf', 0x100, 0, 10, 25, '0')
  
  // Subpage 1, row 4 does not exist. Add subpage 1 "New line 4"
  addEvent('wtf', 0x100, 1, 4, 5, 'N')
  addEvent('wtf', 0x100, 1, 4, 6, 'e')
  addEvent('wtf', 0x100, 1, 4, 7, 'w')
  addEvent('wtf', 0x100, 1, 4, 9, 'l')
  addEvent('wtf', 0x100, 1, 4, 10, 'i')
  addEvent('wtf', 0x100, 1, 4, 11, 'n')
  addEvent('wtf', 0x100, 1, 4, 12, 'e')
  addEvent('wtf', 0x100, 1, 4, 13, '4')   
}

test4=function(rc)
{
  cb(rc)
  console.log("[TEST 3] Result")
  eventSet1()
  for (var i=0;i<eventList.length;i++)
  {
    page.keyMessage(eventList[i])
  }
  page.print()    
  console.log("/[TEST 3] Result")
}

test3=function(rc)
{
  console.log("[TEST3] Started")
  cb(rc)
  pageName='test.tti'
  page.loadPage(pageName,test4,err)
  console.log("[TEST3] Ended")
}

test2=function(rc)
{
  cb(rc)
  // test 2: fail to load the page: show an error
  console.log("[TEST2] Started")
  pageName='doesntexist.tti'
  page.loadPage(pageName,cb,test3)
  console.log("[TEST2] Ended")
}

// Code executes from here

// test 1: load the page and display it
console.log("[TEST 1] Started")
pageName='test.tti'
page.loadPage(pageName,test2,err)
console.log("[ALL TESTS] Ended")







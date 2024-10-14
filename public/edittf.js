'use strict'
/** This code adapted from Simon Rawles
 *  by Peter Kwan
 *  with contributions from Alistair Cree.
 *
// Copyright (C) 2015  Simon Rawles
// Reference: https://github.com/rawles/edit-tf/wiki/Teletext-page-hashstring-format
//
// The JavaScript code in this page is free software: you can
// redistribute it and/or modify it under the terms of the GNU
// General Public License (GNU GPL) as published by the Free Software
// Foundation, either version 3 of the License, or (at your option)
// any later version.  The code is distributed WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY or FITNESS
// FOR A PARTICULAR PURPOSE.  See the GNU GPL for more details.
//
// As additional permission under GNU GPL version 3 section 7, you
// may distribute non-source (e.g., minimized or compacted) forms of
// that code without the copy of the GNU GPL normally required by
// section 4, provided you include this license notice and a URL
// through which recipients can access the Corresponding Source.
 */

/* @todo load from edit.tf
function load_from_hash(TTXPage* page, char* str)
{
   const char base64[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
   char* hashstring=strchr(str,'#'); // Find the start of hash string
   // @todo Get the metadata

   if (hashstring){
       hashstring=strchr(hashstring,':');// move past metadata
       if (hashstring){
           // Is it valid length?
           hashstring++;
           uint16_t len=strlen(hashstring);
           if (len<1120) return;

           // Initialise before the loop
           uint8_t currentCode=0;
           uint8_t outBit=0x40;
           uint8_t outCol=0;
           uint8_t outRow=0; // Teletext40 uses the header row
           char line[40];
           char* pos;
          // for (int i=0;i<40;i++)line[i]=0;
           for (uint16_t i=0; i<1167; i++)
           {
              char ch=*hashstring ;
              hashstring++;
              pos=strchr(base64,ch);
              if (pos==NULL)
              {
                  std::cout << "can not find character " << ch << std::endl;
              }
              uint32_t code=(pos-base64) &0xff;

              for (uint8_t b=0x20;b>0;b>>=1) // Source bit mask
              {
                  if ((b&code)>0)
                  {
                      currentCode|=outBit;
                  }
                  outBit>>=1; // next output bit
                  if (outBit==0) // Character done?
                  {
                      assert(currentCode<0x80);
                      if (currentCode<' ') // Control codes. Only null and CR cause problems.
                      {
                        currentCode|=0x80;
                      }
                      line[outCol]=currentCode; // Save the character
                      currentCode=0;
                      outBit=0x40;
                      assert(outCol<40);
                      outCol++;   // next column
                      if (outCol>=40)
                      {
                          page->SetRow(outRow,std::string(line));
                          outCol=0;
                          outRow++;
                      }
                  }
              } // bit mask
           } // For each encoded source char
           // @todo At this point, if the first row contains a page number in the right place, use it as an initial value
           // parse the rest of the string which is a set of :key=value pairs eg.
           // :PN=550:PS=400c:SC=2
           printf("hashstring=%s\n",hashstring);
           char * pair = strtok(hashstring,":");
           while (pair) {
              char * eq=strchr(pair,'=');
              if (!eq) return; // oops!
              char * key=pair;
              *eq=0;
              char * value=eq;
              value++;
              if (!strcmp("PN",key)) { // Page Number - 3 hex digits
                int page_num=std::strtol(value,NULL,16);
                page->SetPageNumber(page_num*0x100);
              }
              if (!strcmp("SC",key)) { // Subcode - 4 hex digits
                int subcode_num=std::strtol(value,NULL,16);
                page->SetSubCode(subcode_num);
              }
              if (!strcmp("PS",key)) { // Page Status - 4 hex digits
                int status_num=std::strtol(value,NULL,16);
                page->SetPageStatus(status_num);
              }
              if (!strcmp("X270",key)) { // X/27/0 fastext. 6 x MPPSSSSS
                  for (int i=0;i<6;i++) {
                    int link;
                    sscanf(&value[i*7],"%3x",&link);
                    page->SetFastextLink(i,link);
                  }
              }
              if (!strcmp("X280",key)) { // X/28/0 format 1 enhancement data
              }
              *eq=' '; // Hack it so tokens still work
              pair=strtok(NULL,":");
           }
       } // if hashstring metadata
   } // if hashstring
}
*/

// Similarly, we want to save the page to the hash. This simply
// converts the character set and page data into a hex string and
// puts it there.

/**
 * \param cset A character set 0-Eng 1-Ger 2-Swe 3-Ita 4-Bel 5-ASCII 6=Heb 7=Cyr
 * \param website The website prefix eg. "http://edit.tf"
 * \param encoding
 */
// function saveToHash(int cset, char* encoding, uint8_t cc[25][40], const char* website, TTXPage* page)
const saveToHash = function (cset, website, page) {
  // Construct the metadata as described above.
  const metadata = '/#' + cset + ':'

  let encoding = website + metadata

  // Construct a base-64 array by iterating over each character
  // in the frame.
  const b64 = [] // was 1300 long
  for (let i = 0; i < 1300; i++) {
    b64[i] = 0
  }
  let framebit = 0
  console.log(page)
  const p = page.subPageList[page.subPage] // This is the page that we are sending
  for (let r = 0; r < 25; r++) { // Now include fastext
    const txt = p[r].txt // This is the text of the row that we are sending
    console.log('row=' + txt)
    for (let c = 0; c < 40; c++) {
      const ch = txt.charCodeAt(c)
      for (let b = 0; b < 7; b++) { // 7 bits per teletext character
        // Read a bit and write a bit.
        const bitval = ch & (1 << (6 - b))
        if (bitval) {
          // Work out the position of the character in the
          // base-64 encoding and the bit in that position.
          const b64bitoffset = framebit % 6
          const b64charoffset = (framebit - b64bitoffset) / 6
          b64[b64charoffset] |= 1 << (5 - b64bitoffset)
        }
        framebit++
      }
    }
  }

  // Encode bit-for-bit.
  // const sz = encoding.length
  const base64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  for (let i = 0; i < 1167; i++) {
    encoding += base64[b64[i]]
  }
  // metadata (@todo for zxnet )
  const pageNumber = page.pageNumber
  const subcode = page.subPage
  // var status="0x8000" // page.GetPageStatus()
  encoding += ':PN=' + (pageNumber.toString(16)) // 3
  encoding += ':SC=' + subcode // 4
  encoding += ':X270=' + page.redLink.toString(16) + '0000' + // The six Fastext links
    page.greenLink.toString(16) + '0000' +
    page.yellowLink.toString(16) + '0000' +
    page.cyanLink.toString(16) + '0000' +
    '8ff0000' +
    page.indexLink + '0000'
  if (page.redLink !== 0x900) {
    encoding += 'F' // If we got a Fastext FL line, display it.
  }
  //   encoding+=":X270=12300008FF00008FF000070000008FF00008FF0000" // @todo
  // encoding[1167+sz]=0;
  return encoding
}

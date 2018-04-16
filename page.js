/** page.js
 * Encapsulate a teletext page object
 */
 
 Page=function(mpp)
 {
    console.log("Page::Page Created "+mpp);
	// basic properties
	this.pageNumber=mpp;
	this.rows=[];
    
  
  
  // metadata
  // Cycle timing, start and end datetimes, routing etc.
  // To do. At least cycle timing.
  this.changed=false; // true if the page has been edited

  // Editing
  // Handle keyMessage
  this.keyMessage = function(key)
  {
    console.log("Page::keyMessage: Entered");
    this.validate(key);
  }
  // Something to write back changed lines into the file copies. 
  // Something to poll when changed and write back
 
    /** validate - Checks that this page matches that of the key message
     * @param A key message object
     */
   this.validate=function(key)
   {
    console.log("Page::validate: Entered");
   }
 }
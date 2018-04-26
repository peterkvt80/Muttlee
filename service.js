/** service.js
 *  Encapsulates a teletext service object
 *  Environment: node.js server side script
 *  @brief A service is a service name and a set of pages. 
 */
 
 require('./public/ttxpage.js');
 
 /** Constructor
  * @param serviceName - a Service name such as BBCONE_2007_06_19
  */
 Service=function(serviceName)
 {
	// member variables
	this.name=serviceName;
	this.pages=[];
	
	// What do we want to do with a service?
	// 1) Keep pages in numerical order
	// 2) Load pages and save pages
	// 3) Expire pages and remove them 
    /** Give a teletext page, inserts it into the local page list 
	 * @todo What do we do about a duplicate page?
	 * We don't intend to cache pages forever so there won't ever be many pages to search through
	 */
	this.addPage=function(page)
	{
		if (this.findPage(page.pageNumber)==false)
		{
			this.pages.push(page);
			return;
		}
	}
	
	/** Seek the three digit page number that we are looking for
	 * This is a part of a cacheing scheme so a missing page is not an errot
	 *  @return false if the page does not exist
	*/
	this.findPage=function(mpp)
	{
		//console.log("[Service::findPage] looking for page "+mpp);
		// Page out of range?
		if (mpp<0x100 || mpp>0x7ff)
		{
			return false;
		}
		// For each page in the service...
		for (var p=0;p<this.pages.length;p++)
		{
			if (this.pages[p].pageNumber==mpp)
			{
				//console.log("[Service::findPage]Found page "+mpp);
				return this.pages[p];
			}
		}
		//console.log("[Service::findPage]Failed to find page "+mpp);
		return false;
		
	}
    
    /** Switcher.
     *  If the message is for this service, send it to the pages 
     */
    this.keyMessage=function(key)
    {
        console.log("service::keyMessage: Got a keymessage. This="+this.name+" data="+key.s );
        console.log("asasasasas "+JSON.stringify(key, null, 4));
    }
	
	/** Match the given name with the service name
	 * @return true if the service name matches
     */	
	this.matchName=function(name)
	{
		return this.name===name;
	}
 }
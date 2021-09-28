# Muttlee
Multi User TeleText Live Edit Environment

The advantage of Teletext is that it is easy to view. 
Most people already know how to do that.
What is difficult is creating and publishing your own pages. 

Editors like wxTED give full access to all of teletext's features. 
edit.tf lets you create pages without even needing an installation.

The difficulty is running your own service. 

It is hard to believe but there are people who couldn't open an SSH session to save their life. 
People who think that VIM is for cleaning the bathroom.

Just imagine if your teletext viewer could turn into an editor. 
An editor with no complicated menus or options.

A complete teletext service in your browser. 
It will allow you to view or edit a teletext service on a single browser page, not even a save button.

The code here is used in the online Teefax browser based viewer. 
The editing features are included but these are NOT promoted as they are only experimental so far.

The rest is a statement of intent. Not much of this is implemented yet...


## What it does 
You can navigate pages on a service using the usual number keys or Fastext links.

You can edit any page that you view (In future it will be subject to permissions).

You enter and exit editing by pressing escape. Edit mode is signalled by the page number
turning yellow. Normally it will just say a page number.

`P123`

In edit mode it becomes

`123.00`

Where the text is yellow and the subpage number is added.

The subpage that you are editing can be selected by using the PAGE_UP and PAGE_DOWN keys.

Anything that you type will instantly appear on your viewer as you'd expect.

Any change you make will instantly appear on all other viewers that happen to be on the same page.

Raspberry Pi client viewers will [in the future] also update VBIT-Pi instantly.


## How it works

The client viewer is javascript. It uses the p5.js library to simplify the rendering code enormously.

It makes a connection to the server.

The basic data message consists of a keystroke, a row and column position, and a page number.

Any keystroke that you make gets turned into a message packet and is sent to the server.

The server records this keystroke and updates its copy of the page.

The server forwards the same message packet to all clients.

The clients pick up the packet, and if it is for their current page then the keystroke is applied to the page.

The server is also javascript.

It runs on the node.js environment with Express for web services and socket.io for message passing.

Express is used to serve static http from the `public` folder.


## Installation
Install the project depedencies via the Node package manager:

`npm install`


### Running the server
The system stays alive by using PM2. The environment is Debian so this is what worked for me.

`sudo npm install pm2@latest -g`

`pm2 start teletextserver.js`

`pm2 startup ubuntu`

`pm2 save`


## Development

There are a lot of print messages that are useful in debugging the system.

Stop the system and run it in a shell:

`pm2 stop teletextserver.js`

`node teletextserver.js`

Don't forget to restart the automatic service afterwards.

`pm2 start teletextserver.js`

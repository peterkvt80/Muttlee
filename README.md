<<<<<<< Updated upstream
# Muttlee
Multi User Teletext Live Edit Environment
The advantage of Teletext is that it is easy to view. Most people already know how to do that.
What is difficult is creating and publishing your own pages. Editors like wxTED give full access to all of 
teletext's features. edit.tf lets you create pages without even needing an installation.
The difficulty is running your own service. It is hard to believe but there are people who couldn't 
open an SSH session to save their life. People who think that VIM is for cleaning the bathroom.

Imagine if your teletext viewer could turn into an editor. An editor with no complicated menus or options.
Just 

A complete teletext service in your browser. It will allow you to view or edit a teletext service on a single browser page,
not even a save button.

The rest is a statement of intent. Not much of this is implemented yet...

This is what it does 
You can navigate pages on a service using the usual number keys or Fastext links.
You can edit any page that you view (subject to permissions).
You begin editing by pressing any key other than a number.
You exit editing by pressing escape.
Anything that you type will instantly appear on your viewer as you'd expect.
Any change you make will instantly appear on all other viewers that happen to be on the same page.
Raspberry Pi client viewers will also update VBIT-Pi instantly.

This is how it works
The client is javascript. It uses the p5.js library to simplify the code enormously.
It makes a connection to the server.
The basic data message consists of a keystroke, a row and column position, and a page number.
Any keystroke that you make gets turned into a message packet and is sent to the server.
The server records this keystroke and updates its copy of the page.
The server forwards the same message packet to all clients.
The clients pick up the packet, and if it is for their current page then the keystroke is applied to the page.
The server is also javascript.
It runs on the node.js environment with Express for web services and socket.io for message passing.
As it happens to be running on Google's Compute Engine it is also using the cloud for data storage,
In this case it is datastore and it is based on NoSQL.
Express is used to serve static http from the Public folder.
=======
# 1 - Muttlee

This folder contains my efforts to install [Muttlee][step-1]
tutorial. Please refer to the tutorial for instructions on configuring, running,
and deploying this sample.

[step-1]: https://cloud.google.com/nodejs/getting-started/hello-world
>>>>>>> Stashed changes

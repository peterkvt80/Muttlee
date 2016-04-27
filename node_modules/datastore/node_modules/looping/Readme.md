# Looping

  Iteration utility made for **[datastore](http://github.com/bredele/datastore)**

## Installation

with component:

    $ component install bredele/looping

with nodejs:

    $ npm install looping

## API

Looping expose a consisten API between objects and arrays (the first argument is the object's key - or index for an array -).


### each(array, fn, [scope])

  Iterate an array:

```js
var each = require('looping');
each(['olivier', 'bredele'], function(key, val){
  //key is the array's index
})
```

### each(object, fn, [scope])

  Iterate an object;

```js
var each = require('looping');
each(conf, function(key, val){
  //key is the object's key
})
```


## License

The MIT License (MIT)

Copyright (c) 2014 Olivier Wietrich <olivier.wietrich@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


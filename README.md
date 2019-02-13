# mongomap
Extends javascript maps for persistance to a MongoDB collection and updating the map from a MongoDB changefeed.

This module came about after wanting the same functionality as enmap with my enmap-mongo fork (https://github.com/fatchan/enmap-mongo), while also removing the need for the provider model and using MongoDB instead.

### examples
Single MongoMap
```
const MongoMap = require('mongomap');
const test = new MongoMap({
	dbName: 'mongomap',
	collectionName: 'test',
	fetchAll: true,
	monitorChanges: true,
	documentTTL: false,
	url: 'mongodb://user:pass@host:port/db',
	client: null //optionally pass a connected mongoClient instance to share the client between multiple instances to reduce number of connections. Recommended especially if using multi()
});
await test.ready;
//ready to use
```

Multiple MongoMaps
```
const MongoMap = require('mongomap');
const { testing, example, mongomap } = MongoMap.multi(['testing', 'example', 'mongomap'],{
        dbName: 'mongomap',
	//collectionName will be the name given in the array
        fetchAll: true,
        monitorChanges: true,
        documentTTL: false,
        url: 'mongodb://user:pass@host:port/db',
        client: null //optionally pass a connected mongoClient instance to share the client between multiple instances to reduce number of connections. Recommended especially if using multi()
});
await testing.ready;
//await each MongoMap being ready
```

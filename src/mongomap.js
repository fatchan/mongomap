'use strict';

const { MongoClient } = require('mongodb');

class MongoMap extends Map {

	constructor(options) {
		super();
		this.ready = new Promise((resolve) => {
			this.initDone = resolve;
		});
		this.client = options.client || null;
		this.dbName = options.dbName || 'mongomap';
		this.collectionName = options.collectionName;
		this.documentTTL = options.documentTTL || false;
		this.fetchAll = options.fetchAll || false;
		this.monitorChanges = options.monitorChanges || false;
		this.url = options.url; //"mongodb://user:pass@host:port/authdb"
		this.init();
	}

	async init() {
		if (!this.client) {
			this.client = await MongoClient.connect(this.url, { useNewUrlParser: true });
		}
		this.db = this.client.db(this.dbName).collection(this.collectionName);
		if (this.documentTTL) {
			this.db.createIndex({ "expireAt": 1 }, { expireAfterSeconds: 0 });
		}
		if (this.fetchAll) {
			await this.fetchEverything();
		}
		if (this.monitorChanges) {
			const changeStream = this.db.watch();
			changeStream.on("change", (change) => {
				if (change.operationType === 'insert' || change.operationType === 'replace') {
					super.set(change.fullDocument._id, change.fullDocument.value);
				} else if (change.operationType === 'update' && change.updateDescription.updatedFields) {
					const current = super.get(change.documentKey._id);
					for (let key in change.updateDescription.updatedFields) {
						 //not yet supporting nested changes
						const splitKey = key.split('.');
						current[splitKey[1]] = change.updateDescription.updatedFields[key];
					}
					super.set(change.documentKey._id, current);
				} else if (change.operationType === 'delete') {
					super.delete(change.documentKey._id);
				}
			});
		}
		this.initDone();
	}
	
	static multi(names, options) {
		const mongomaps = {};
		for (const name of names) {
			options.collectionName = name;
			const mongomap = new MongoMap(options);
			mongomaps[name] = mongomap;
		}
		return mongomaps;
	}

	set(key, val, expiry) {
		if (expiry) {
			this.db.replaceOne({ _id: key }, { _id: key, value: val, expireAt: expiry }, { upsert: true });
		} else {
			this.db.replaceOne({ _id: key }, { _id: key, value: val }, { upsert: true });
		}
		super.set(key, val);
	}

	delete(key) {
		this.db.deleteOne({ _id: key });
		super.delete(key);
	}

	async fetch(keyOrKeys) {
		if (!Array.isArray(keyOrKeys)) {
			const value = await this.db.findOne({ _id: keyOrKeys });
			if(value != null && value.value != null) {
				super.set(keyOrKeys, value.value);
				return value.value;
			}
			return null;
		}
		await Promise.all(keyOrKeys.map(async key => {
			const value = await findOne({ _id: key });
			if(value != null && value.value != null) {
				super.set(key, value.value);
			}
		}));
	}

	async fetchEverything() {
		const rows = await this.db.find({}).toArray();
		for (const row of rows) {
			super.set(row._id, row.value);
		}
	}

}

module.exports = MongoMap;

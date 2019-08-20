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
			this.client = await MongoClient.connect(this.url, {
				useNewUrlParser: true,
				useUnifiedTopology: true
			});
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

	set(key, value, expireAt) {
		const query = { _id: key, value };
		if (expireAt != null) {
			query.expireAt = expireAt;
		}
		this.db.replaceOne({ _id: key }, query, { upsert: true });
		return super.set(key, value);
	}

	delete(key) {
		this.db.deleteOne({ _id: key });
		return super.delete(key);
	}

	async fetch(keyOrKeys) {
		const filter = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
		const rows = await this.db.find({
			_id: {
				$in: filter
			}
		}).toArray();
		if (rows != null && Array.isArray(rows) && rows.length > 0) {
			if (rows.length === 1) {
				super.set(keyOrKeys, rows[0].value);
				return;
			} else {
				rows.forEach(row => {
					super.set(row._id, row.value);
				});
			}
		}
	}

	async fetchEverything() {
		const rows = await this.db.find({}).toArray();
		for (const row of rows) {
			super.set(row._id, row.value);
		}
	}

}

module.exports = MongoMap;

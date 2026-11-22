"use strict";
// Data Deva Functions
// Copyright ©2000-2026 Quinn Michaels; All rights reserved. 
// Owner Signature Required For Lawful Use.
// Distributed under VLA:25377341401711892723 LICENSE.md
// Saturday, November 21, 2026 - 7:42:26 PM PST

export const func = {
			/**************
	func: insert
	params: opts
	describe: the insert function that inserts into the specified collection.
	***************/
	async insert(opts) {
		this.belief('data', `uid:${opts.data.id.uid}`);
		this.action('func', `insert:${opts.collection}:${opts.data.id.uid}`);
		let result = false;
		try {
			this.state('insert', `${opts.collection}:${opts.data.id.uid}`);
			this.state('connect', `${opts.collection}:${opts.data.id.uid}`);
			await this.modules.client.connect(); // connect to the database client.
			const db = this.modules.client.db(opts.database);  // set the database to use
			
			result = await db.collection(opts.collection).insertOne(opts.data); // insert the data
			this.action('return', `insert:${opts.collection}:${opts.data.id.uid}`);
			this.state('valid', `insert:${opts.collection}:${opts.data.id.uid}`);
			this.intent('good', `insert:${opts.collection}:${opts.data.id.uid}`);
			this.belief('vedic', `uid:${opts.data.id.uid}`);
			return result; // return the result to the requestor.
		} finally {
			if (this.modules.client) await this.modules.client.close(); // close the connection when done
		}
	},
	
	/**************
	func: update
	params: opts
	describe: the update function that update into the specified collection.
	***************/
	async update(opts) {
		this.action('func', 'update');
		let result = false;
		try {
			this.state('update', opts.collection);
			await this.modules.client.connect(); // connect to the database client.
			const db = this.modules.client.db(this.vars.database);  // set the database to use
			result = await db.collection(opts.collection).updateOne(
				{ _id: new ObjectId(`${opts.id}`) },
				{ $set: opts.data }
			); // insert the data
			this.state('return', 'update');
			return result; // return the result to the requestor.
		} finally {
			if (this.modules.client) await this.modules.client.close(); // close the connection when done
		}
	},
	
	/**************
	func: list
	params: obj - the find object
	describe: return a find from the database collection.
	***************/
	async list(opts={}) {
		this.action('func', 'list');
		let result = false;
		const {collection,data} = opts;
		try {
			await this.modules.client.connect();
			const db = this.modules.client.db(this.vars.database);
			result = await db.collection(collection).find(data).sort({created:1}).toArray();
			return result;
		} finally {
			if (this.modules.client) await this.modules.client.close(); // close the connection when done
		}
	},
	
	/**************
	func: search
	params: obj - the search object
	describe: return a search from the database collection.
	***************/
	async search(opts) {
		this.action('func', 'search');
		let result = false;
		try {
			this.state('search', opts.text);
			const {collection,limit} = this.vars.search;
			await this.modules.client.connect();
			const db = this.modules.client.db(this.vars.database);
			const table = db.collection(collection);
	
			// await table.dropIndex('a.text_1');
			// const newIndex = await table.createIndex({"a.text": "text"});
			const idx = await table.listIndexes().toArray();
			// Print the list of indexes
	
			const query  = {$text:{$search:opts.text}};
			const projection  = {
				_id: 0,
				a: {
					id: 1,
					text: 1
				},
				score: { $meta: "textScore" }
			};
			result = await table.find(query).project(projection).limit(limit).toArray();
			this.state('return', 'search');
			return result;
		} finally {
			if (this.modules.client) await this.modules.client.close(); // close the connection when done
		}
	},
	
	/**************
	func: memory
	params: obj - the memory object
	describe: return a search from the memory collection.
	***************/
	async memory(opts) {
		this.action('func', 'memory');
		let result = false;
		const {collection,limit} = this.vars.memory;
		try {
			this.state('get', `memory`);
			const {database} = this.data().personal.mongo;
			await this.modules.client.connect();
			const db = this.modules.client.db(database);
			const table = db.collection(collection);
			// await table.dropIndex('a_text_q_text');
			const idx = await table.listIndexes().toArray();
			const hasIdx = idx.find(i => i.name === 'a_q_text');
			if (!hasIdx) {
				const newIdx = await table.createIndex({"a": "text", "q": "text"}, {name: 'a_q_text'});
			}
			const query = {$text:{$search:opts.text}};
			const options = {
					projection: {
					id: 1,
					a: 1,
					q: 1,
					score: { $meta: "textScore" },
					created: 1
				}
			};
			result = await table.find(query, options).limit(parseInt(limit)).toArray();
			this.state('return', `memory`);
			return result;
		} finally {
			if (this.modules.client) await this.modules.client.close(); // close the connection when done        
		}
	},
	
	/**************
	func: knowledge
	params: obj - the knowledge object
	describe: return a search from the knowledge collection.
	***************/
	async knowledge(opts) {
		this.action('func', 'knowledge');
		let result = false;
		const {collection,limit,index} = this.vars.knowledge;
	
		try {
			this.state('get', 'knowledge');
			const database = this.vars.database;
			await this.modules.client.connect();
			const db = this.modules.client.db(database);
			const table = db.collection(collection);
	
			// await table.dropIndex('a_text_q_text');
			const idx = await table.listIndexes().toArray();
			const hasIdx = idx.find(i => i.name === index)
			if (!hasIdx) {
				const newIdx = await table.createIndex({"content": "text"}, {name: index});
			}
	
			const query  = {$text:{$search:opts.text}};
			const options  = {
				projection: {
					_id: 1,
					content: 1,
					score: { $meta: "textScore" }
				}
			};
			result = await table.find(query,options).limit(parseInt(limit)).toArray();
			this.state('return', `knowledge`);
			return result;
		} finally {
			if (this.modules.client) await this.modules.client.close(); // close the connection when done
		}
	},
	
	/**************
	func: indexes
	params: opts
	describe: Creates an index on a collection in the database.
	***************/
	async indexes(opts) {
		this.action('func', 'indexes');
		let result = false;
		// get indexes
		try {
			this.state('get', `indexes`);
			const {database} = this.data().personal.mongo;
			await this.modules.client.connect();
			const db = this.modules.client.db(database);
			result = await db.collection(opts.collection).listIndexes().toArray();
			this.state('return', 'indexes');
			return result;
		} finally {
			if (this.modules.client) await this.modules.client.close(); // close the connection when done
		}
	},
	
	/**************
	func: history
	params: opts
	describe: return history
	***************/
	async history() {
		this.action('func', 'history');
		let result = false;
		const {collection,limit} = this.vars.history;
		try {
			this.state('get', `history`);
			const {database} = this.data().personal.mongo;
			await this.modules.client.connect();
			const db = this.modules.client.db(database);
			result = await db.collection(collection).find({}).sort({created:-1}).limit(limit).toArray();
			this.state('return', `history`);
			return result;
		} finally {
			if (this.modules.client) await this.modules.client.close(); // close the connection when done
		}
	},

}
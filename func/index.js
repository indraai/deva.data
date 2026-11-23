"use strict";
// Data Deva Functions
// Copyright ©2000-2026 Quinn Michaels; All rights reserved. 
// Owner Signature Required For Lawful Use.
// Distributed under VLA:25377341401711892723 LICENSE.md
// Saturday, November 21, 2026 - 7:42:26 PM PST

import { ObjectId } from 'mongodb';

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
	},
	
	/**************
	func: update
	params: opts
	describe: the update function that update into the specified collection.
	***************/
	async update(opts) {
		this.action('func', 'update');
		let result = false;
		this.state('update', opts.collection);
		await this.modules.client.connect(); // connect to the database client.
		const db = this.modules.client.db(this.vars.database);  // set the database to use
		result = await db.collection(opts.collection).updateOne(
			{ _id: new ObjectId(`${opts.id}`) },
			{ $set: opts.data }
		); // insert the data
		this.state('return', 'update');
		return result; // return the result to the requestor.
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
		await this.modules.client.connect();
		const db = this.modules.client.db(this.vars.database);
		result = await db.collection(collection).find(data).sort({created:1}).toArray();
		return result;
	},
	
	/**************
	func: search
	params: obj - the search object
	describe: return a search from the database collection.
	***************/
	async search(opts) {
		this.action('func', 'search');
		let result = false;
		
		this.state('get', 'search');
		const {collection,limit} = this.vars.search;

		const parsed = parseInt(limit, 10);
		if (parsed !== Number(limit) || parsed < 1) {
			this.action('incorrect', `search:limit:${limit}`);
			this.state('invalid', `search:limit:${limit}`);
			this.intent('bad', `search:limit:${limit}`);
			return [];
		}

		await this.modules.client.connect();
		const db = this.modules.client.db(this.vars.database);
		const table = db.collection(collection);

		const query  = {$text:{$search:opts.text}};
		const projection  = {
			_id: 0,
			a: {
				id: 1,
				text: 1
			},
			score: { $meta: "textScore" }
		};
		
		result = await table.find(query).project(projection).limit(parsed).toArray();
		this.action('return', `search`);
		this.state('valid', `search`);
		this.intent('good', `search`)
		return result;
	},
	
	/**************
	func: memory
	params: obj - the memory object
	describe: return a search from the memory collection.
	***************/
	async memory(opts) {
		this.action('func', 'memory');
		let result = false;

		this.state('get', `memory`);
		const {collection,limit} = this.vars.memory;

		const parsed = parseInt(limit, 10);
		if (parsed !== Number(limit) || parsed < 1) {
			this.action('incorrect', `memory:limit:${limit}`);
			this.state('invalid', `memory:limit:${limit}`);
			this.intent('bad', `memory:limit:${limit}`);
			return [];
		}
		
		const {database} = this.data().personal.mongo;
		await this.modules.client.connect();
		const db = this.modules.client.db(database);
		const table = db.collection(collection);

		await table.createIndex({"a": "text", "q": "text"}, {name: 'a_q_text'});
		
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
		
		result = await table.find(query, options).limit(parsed).toArray();
		this.action('return', `memory`);
		this.state('valid', `memory`);
		this.intent('good', `memory`)
		return result;
	},
	
	/**************
	func: knowledge
	params: obj - the knowledge object
	describe: return a search from the knowledge collection.
	***************/
	async knowledge(opts) {
		this.action('func', 'knowledge');
		let result = false;

		this.state('get', 'knowledge');
		const {collection,limit,index} = this.vars.knowledge;
		
		const parsed = parseInt(limit, 10);
		if (parsed !== Number(limit) || parsed < 1) {
			this.action('incorrect', `knowledge:limit:${limit}`);
			this.state('invalid', `knowledge:limit:${limit}`);
			this.intent('bad', `knowledge:limit:${limit}`);
			return [];
		}
		
		const database = this.vars.database;
		await this.modules.client.connect();
		const db = this.modules.client.db(database);
		const table = db.collection(collection);

		await table.createIndex({"content": "text"}, {name: index});
		
		const query  = {$text:{$search:opts.text}};
		const options  = {
			projection: {
				_id: 1,
				content: 1,
				score: { $meta: "textScore" }
			}
		};
		
		result = await table.find(query,options).limit(parsed).toArray();
		this.action('return', `knowledge`);
		this.state('valid', `knowledge`);
		this.intent('good', `knowledge`)
		return result;
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
		this.state('get', `indexes`);
		const {database} = this.data().personal.mongo;
		await this.modules.client.connect();
		const db = this.modules.client.db(database);
		result = await db.collection(opts.collection).listIndexes().toArray();
		
		this.action('return', `indexes`);
		this.state('valid', `indexes`);
		this.intent('good', `indexes`)
		return result;
	},
	
	/**************
	func: history
	params: opts
	describe: return history
	***************/
	async history() {
		this.action('func', 'history');
		let result = false;

		this.state('get', `history`);
		const {collection,limit} = this.vars.history;

		const parsed = parseInt(limit, 10);
		if (parsed !== Number(limit) || parsed < 1) {
			this.action('incorrect', `history:limit:${limit}`);
			this.state('invalid', `history:limit:${limit}`);
			this.intent('bad', `history:limit:${limit}`);
			return [];
		}

		const {database} = this.data().personal.mongo;
		await this.modules.client.connect();
		const db = this.modules.client.db(database);

		result = await db.collection(collection).find({}).sort({created:-1}).limit(parsed).toArray();
		this.action('return', `history`);
		this.state('valid', `history`);
		this.intent('good', `history`)
		return result;
	},
}

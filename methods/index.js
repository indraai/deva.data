"use strict";
// Data Deva Methods
// Copyright ©2000-2026 Quinn Michaels; All rights reserved. 
// Owner Signature Required For Lawful Use.
// Distributed under VLA:25377341401711892723 LICENSE.md
// Saturday, November 21, 2026 - 7:42:26 PM PST

export const methods = {
	/**************
	method: insert
	params: packet
	describe: insert data into the data vault.
	***************/
	insert(packet) {
		this.context('insert', `${packet.q.meta.params[1]}:${packet.id.uid}`);
		this.action('method', `insert:${packet.q.meta.params[1]}:${packet.id.uid}`);
		return new Promise((resolve, reject) => {
			const {data, meta} = packet.q;
			const collection = meta.params[1];
			const database = meta.params[2] || this.vars.database;
			this.func.insert({database, collection,data}).then(ins => {
				this.action('resolve', `insert:${collection}:${ins.insertedId}`)
				return resolve({
					text: `id:${ins.insertedId}`,
					html: `id:${ins.insertedId}`,
					data: ins,
				});
			}).catch(err => {
				this.action('reject', 'insert');
				return this.err(err, packet, reject);
			});
		});
	},
	
	
	/**************
	method: history
	params: packet
	describe: get history
	***************/
	history(packet) {
		this.context('history', packet.id.uid);
		return new Promise((resolve, reject) => {
			this.func.history().then(history => {
				return resolve({
					text: 'see data',
					html: 'see data',
					data: history,
				})
			}).catch(err => {
				return this.err(err, packet, reject);
			});
		});
	},
	
	/**************
	method: search
	params: packet
	describe: search data
	***************/
	search(packet) {
		this.context('search', packet.q.text);
		this.action('method', `search:${packet.q.text}`);
		return new Promise((resolve, reject) => {
			if (!packet.q.text) return resolve(this._messages.notext);
			const {params} = packet.q.meta;
			if (params[1]) this.vars.search.collection = packet.q.meta.params[1];
			if (params[2]) this.vars.search.limit = packet.q.meta.params[2];
	
			this.func.search(packet.q).then(search => {
				this.state('resolve', `search:${packet.q.text}`);
				return resolve({
					text: 'see data',
					html: 'see data',
					data: search,
				})
			}).catch(err => {
				return this.err(err, packet, reject);
			});
		});
	},
	
	/**************
	method: memory
	params: packet
	describe: search memory
	***************/
	memory(packet) {
		this.context('memory', packet.q.text);
		this.action('method', `memory`);
		return new Promise((resolve, reject) => {
			if (!packet.q.text) return resolve(this._messages.notext);
			const {params} = packet.q.meta;
			const data = {};
	
			if (params[1]) this.vars.memory.collection = `memory_${params[1]}`;
			if (params[2]) this.vars.memory.limit = packet.q.meta.params[2];
	
			this.func.memory(packet.q).then(memory => {
				data.memory = memory;
				const text = memory.length ? memory.map(mem => {
					return [
						`::begin:memory:${mem.id.uid}`,
						`question: ${mem.q}`,
						`answer: ${mem.a}`,
						`date: ${this.lib.formatDate(mem.created, 'long', true)}`,
						`score: ${mem.score.toFixed(3)}`,
						`::end:memory:${mem.id.uid}`,
					].join('\n');
				}).join('\n') : 'no memory';
				
				this.action('parse', `memory:${packet.id.uid}`);
				return this.question(`${this.askChr}feecting parse ${text}`);
			}).then(feecting => {
				data.feecting = feecting.a.data;
				this.state('resolve', `memory`);
				return resolve({
					text: feecting.a.text,
					html: feecting.a.html,
					data,
				})
			}).catch(err => {
				this.state('reject', `memory`)
				return this.err(err, packet, reject);
			});
		});
	},
	
	/**************
	method: knowledge
	params: packet
	describe: Knowledge base wisdom
	***************/
	knowledge(packet) {
		this.context('knowledge', packet.q.text);
		this.action('method', `knowledge`);
		return new Promise((resolve, reject) => {
			if (!packet.q.text) return resolve(this._messages.notext);
			const {params} = packet.q.meta;
			const data = {};
	
			if (params[1]) this.vars.knowledge.limit = params[1];
	
			this.func.knowledge(packet.q).then(wisdom => {
				data.wisdom = wisdom;
				const text = wisdom.length ? wisdom.map(item => {
					return [
						`::begin:knowledge:${item._id}`,
						`p: ${item.content}`,
						`created: ${this.lib.formatDate(item.created, 'long', true)}`,
						`score: ${item.score.toFixed(3)}`,
						`::end:knowledge:${item._id}`,
					].join('\n');
				}).join('\n') : this.vars.messages.no_knowledge;
				this.action('parse', `knowledge:${packet.id.uid}`);
				return this.question(`${this.askChr}feecting parse ${text}`);
			}).then(feecting => {
				data.feecting = feecting.a.data;
				this.state('resolve', `knowledge`);
				return resolve({
					text: feecting.a.text,
					html: feecting.a.html,
					data,
				})
			}).catch(err => {
				this.state('reject', `knowledge`);
				return this.err(err, packet, reject);
			});
		});
	},
	
	/**************
	method: know
	params: packet
	describe: add data to the knowledge base
	example: #data mem:[id] [content to store in memory]
	***************/
	know(packet) {
		this.context('know', packet.id.uid);
	
		return new Promise((resolve, reject) => {
			if (!packet.q.text) return resolve(this._messages.notext);
	
			const {meta, text} = packet.q;
			const {collection} = this.vars.knowledge;
			const data = {
				id: packet.id,
				content: packet.q.text,
			};
			let id = false,
					func = 'insert';
	
			// if param[1] id is found then update record
			if (meta.params[1]) {
				id = meta.params[1];
				func = 'update';
				data.modified = Date.now();
			}
			else {
				data.modified = null;
				data.created = Date.now();
			}
	
			this.func[func]({id,collection,data, database: this.vars.database}).then(ins => {
				this.state('resolve', 'add');
				return resolve({
					text: `id: ${ins.insertedId || id}`,
					html: `id: ${ins.insertedId || id}`,
					data: ins.insertedId,
				});
			}).catch(err => {
				this.state('reject', 'add');
				return this.err(err, packet, reject);
			});
		});
	},
	
	
	/**************
	method: listidx
	params: packet
	describe: List Indexes
	***************/
	listidx(packet) {
		this.context('index', packet.q.text);
		this.action('method', 'index');
		return new Promise((resolve, reject) => {
			const collection = packet.q.meta.params[1] || packet.q.text;
			this.func.indexes({collection}).then(idx => {
				this.state('resolve', 'indexes');
				return resolve({
					text: 'indexes',
					html: 'indexes',
					data: idx
				})
			}).catch(err => {
				return this.err(err, packet, reject);
			});
		});
	},

}
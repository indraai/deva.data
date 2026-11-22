"use strict";
// Data Deva
// Copyright ©2000-2026 Quinn Michaels; All rights reserved. 
// Owner Signature Required For Lawful Use.
// Distributed under VLA:25377341401711892723 LICENSE.md
// Saturday, November 21, 2026 - 7:42:26 PM PST

import Deva from '@indra.ai/deva';
import { MongoClient, ObjectId } from 'mongodb';

import pkg from './package.json' with {type:'json'};
const {agent, vars} = pkg.data;

import {methods} from './methods/index.js';
import {func} from './func/index.js';

// set the __dirname
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';    
const __dirname = dirname(fileURLToPath(import.meta.url));

const info = {
	id: pkg.id,
	name: pkg.name,
	version: pkg.version,
	author: pkg.author,
	describe: pkg.description,
	dir: __dirname,
	url: pkg.homepage,
	git: pkg.repository.url,
	bugs: pkg.bugs.url,
	license: pkg.license,
	VLA: pkg.VLA,
	copyright: pkg.copyright
};

const DataDeva = new Deva({
	info,
	agent,
	vars,
	utils: {
		translate(input) {return input.trim();},
		parse(input) {return input.trim();},
		process(input) {return input.trim();},
		memory(input) {
			input = input.replace(/\n/g, ' ')
								.replace(/(\b)or have specific questions about it(\b)/g, '$2')
								.replace(/(\b), feel free to ask(\b)/g, '$2')
								.replace(/\sIf you have .+ free share!/g, '')
								.replace(/\sIf there are .+ free share!/g, '')
								.replace(/\s{2,}/g, ' ');
			return input;
		}
	},
	listeners: {
		async 'data:history'(packet) {
			this.context('history', `${packet.a.agent.key}:${packet.id.uid}`);
			try {
				await this.func.insert({
					database: this.data().personal.mongo.database,
					collection: 'history',
					data: this.lib.copy(packet),
				});
			} catch (err) {
				return this.err(err, packet, false).catch(() => {});
			}
		},
		async 'data:memory'(packet) {
			try {
				const data = {
					id: packet.id,
					client: packet.client.id,
					agent: packet.agent.id,
					q: this.utils.memory(packet.q),
					a: this.utils.memory(packet.a),
					created: Date.now(),
				}
				const data_stamped = this._stamp(data, 'data:memory', data.id.uid)
				
				await this.func.insert({
					database: this.data().personal.mongo.database,
					collection: this.vars.memory.collection,
					data: data_stamped,
				});				
			} 
			catch (err) {
				return this.err(err, packet, false).catch(() => {});        
			}
		}
	},
	modules: {
		client: false,
	},
	devas: {},
	func,
	methods,
	onReady(data, resolve) {
		const {VLA} = this.info();
		const {uri,database} = this.data().global?.mongo || {};
		if (uri) this.modules.client = new MongoClient(uri); // build the client if uri is set
		this.vars.database = database;
		this.prompt(`${this.vars.messages.ready} > VLA:${VLA.uid}`);
		return resolve(data);
	},
	onStop(data, resolve) {
		const {client} = this.modules;
		if (!client) return this.close(data, resolve);
		return client.close().then(() => this.close(data, resolve)); // close the database before shutdown
	},
	onError(err, data, reject) {
		this.prompt(this.vars.messages.error);
		console.log(err);
		return reject ? reject(err) : Promise.reject(err);
	}
});
export default DataDeva

"use strict";
// Data Deva Test File
// Copyright ©2000-2026 Quinn Michaels; All rights reserved. 
// Owner Signature Required For Lawful Use.
// Distributed under VLA:25377341401711892723 LICENSE.md
// Saturday, November 21, 2026 - 7:42:26 PM PST

// run with: npm test
// MongoDB tests use a local server at mongodb://127.0.0.1:27017 by default. Set MONGO_URI to use another one.
// They skip with a message when MongoDB can't be reached.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MongoClient, ObjectId} from 'mongodb';
import Deva from '@indra.ai/deva';
import core from '@indra.ai/deva/package.json' with {type:'json'};
import pkg from './package.json' with {type:'json'};
import {func} from './func/index.js';
import {methods} from './methods/index.js';
import DATA from './index.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const STAGES = ['start', 'enter', 'done', 'ready'];
const TIERS = ['md5', 'sha256', 'sha512'];
const PLACEHOLDER = /::[a-z-]+::|\{\{profile\.[a-z]+\}\}/;
const FUNC_KEYS = ['insert', 'update', 'list', 'search', 'memory', 'knowledge', 'indexes', 'history'];
const METHOD_KEYS = ['insert', 'history', 'search', 'memory', 'knowledge', 'know', 'listidx'];

// test databases: the uri can change, the database names are fixed so the after hook only ever drops the test databases.
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const GLOBAL_DB = 'deva_data_test_global';
const PERSONAL_DB = 'deva_data_test_personal';

// check the server once before the tests are defined so the MongoDB tests can skip cleanly.
const mongo = new MongoClient(MONGO_URI, {serverSelectionTimeoutMS: 2000});
const MONGO_SKIP = await mongo.db('admin').command({ping: 1}).then(
	() => false,
	err => `MongoDB is not reachable at ${MONGO_URI} (${err.message}). Start a local mongod or set MONGO_URI.`
);
if (MONGO_SKIP) console.log(`⏭️ ${MONGO_SKIP}`);

// stub client built in code: the core VLA for the core check, the agent VLA for Data Deva
// and the mongo settings for the data feature. useMongo false leaves the data feature without a database.
const client = (agentVLA = pkg.VLA, useMongo = true) => ({
	id: '00000000000000000000',
	key: 'client',
	VLA: structuredClone(core.VLA),
	prompt: {
		emoji: '🧪',
		text: 'client',
		colors: {
			label: {R: 2, G: 229, B: 77},
			text: {R: 2, G: 229, B: 77},
		},
	},
	profile: {
		id: '00000000000000000000',
		name: 'Test Client',
		describe: 'Test client for Data Deva',
		lang: 'en',
		locale: 'en-US',
		currency: 'USD',
	},
	features: {
		license: {
			concerns: [],
			global: [],
			devas: {
				data: structuredClone(agentVLA),
			},
		},
		data: {
			concerns: [],
			global: useMongo ? {mongo: {uri: MONGO_URI, database: GLOBAL_DB}} : {},
			devas: useMongo ? {data: {mongo: {uri: MONGO_URI, database: PERSONAL_DB}}} : {},
		},
	},
});

// wait for a listener to write a document.
async function findDoc(database, collection, query, tries = 30) {
	for (let i = 0; i < tries; i++) {
		const doc = await mongo.db(database).collection(collection).findOne(query);
		if (doc) return doc;
		await new Promise(r => setTimeout(r, 100));
	}
	return null;
}

async function count(database, collection) {
	return mongo.db(database).collection(collection).countDocuments();
}

async function question(deva, q, data = false, ms = 8000) {
	return Promise.race([
		deva.question(q, data),
		new Promise((_, reject) => setTimeout(() => reject(new Error(`TIMEOUT after ${ms}ms`)), ms)),
	]);
}

let dataClient = false; // Data Deva's own MongoClient, kept so the after hook can close it.

after(async () => {
	if (!MONGO_SKIP) {
		await mongo.db(GLOBAL_DB).dropDatabase();
		await mongo.db(PERSONAL_DB).dropDatabase();
	}
	await mongo.close();
	if (dataClient) await dataClient.close();
});

test('data builds as a Deva and waits offline before init', async () => {
	assert.ok(DATA instanceof Deva, 'the export is a Deva');
	assert.equal(await DATA.stop(), DATA._messages.offline, 'stop before init answers offline');
});

test('data data has no placeholders left', () => {
	assert.doesNotMatch(JSON.stringify(pkg.data), PLACEHOLDER, 'package.json data');
	assert.doesNotMatch(JSON.stringify(pkg.VLA), PLACEHOLDER, 'package.json VLA');
	assert.doesNotMatch(pkg.copyright, PLACEHOLDER, 'package.json copyright');
});

test('func and methods load from func/index.js and methods/index.js', () => {
	assert.deepEqual(Object.keys(func), FUNC_KEYS, 'func export names');
	assert.deepEqual(Object.keys(methods), METHOD_KEYS, 'methods export names');
	assert.equal(DATA.func, func, 'index.js wires the imported func object');
	assert.equal(DATA.methods, methods, 'index.js wires the imported methods object');
	for (const name of FUNC_KEYS) assert.equal(typeof DATA.func[name], 'function', `func.${name}`);
	for (const name of METHOD_KEYS) assert.equal(typeof DATA.methods[name], 'function', `methods.${name}`);
});

test('data comes online and walks to ready', async () => {
	const prompts = [];
	DATA.listen('devacore:prompt', packet => prompts.push(packet.text));
	const data = await DATA.init(client());
	for (const k of STAGES) assert.equal(typeof data[k], 'number', `${k} timestamp`);
	assert.ok(data.start <= data.enter && data.enter <= data.done && data.done <= data.ready, 'stages in order');
	assert.equal(typeof data.id.uid, 'string', 'uid');
	for (const t of TIERS) assert.equal(typeof data[t], 'string', `${t} hash`);
	assert.ok(prompts.includes(`${DATA.vars.messages.ready} > VLA:${pkg.VLA.uid}`), 'onReady prompts the ready message');
	assert.ok(DATA.modules.client instanceof MongoClient, 'onReady builds the MongoClient');
	assert.equal(DATA.vars.database, GLOBAL_DB, 'onReady sets the global database');
	assert.equal(DATA.data().personal.mongo.database, PERSONAL_DB, 'personal.mongo.database is the personal name');
	dataClient = DATA.modules.client;
});

test('data agent matches the package', () => {
	const agent = DATA.agent();
	assert.equal(agent.key, 'data');
	assert.equal(agent.profile.name, 'Data Deva');
	assert.equal(agent.profile.owner, 'Quinn Michaels');
});

test('data utils answer with trimmed text', () => {
	const {translate, parse, process} = DATA.utils;
	for (const util of [translate, parse, process]) assert.equal(util('  hello  '), 'hello');
});

test('data help pages name the Deva and carry the package license', async () => {
	const main = await DATA.help('main', DIR);
	assert.match(main, /^# \{\{profile\.name\}\}$/m, 'main help heading');
	const license = await DATA.help('main:license', DIR);
	assert.match(license, new RegExp(`^uid: ${pkg.VLA.uid}$`, 'm'), 'license uid');
	for (const t of TIERS) assert.ok(license.includes(`${t}: ${pkg.VLA[t]}`), `${t} hash in the license help`);
});

test('a memory listener write is stamped and stored in the personal database, then /memory reads it back', {skip: MONGO_SKIP}, async () => {
	const hashEvents = [];
	const onHash = packet => {
		if (packet?.value === 'hash' && /data:memory:/.test(packet.text || '')) hashEvents.push(packet.text);
	};
	DATA.listen('devacore:action', onHash);
	const uid = 'mem-test-1';
	DATA.talk('data:memory', {
		id: {uid},
		client: {id: '00000000000000000000'},
		agent: {id: pkg.id, key: 'data'},
		q: 'memory question about the personal vault',
		a: 'memory answer lives in personal',
	});
	const doc = await findDoc(PERSONAL_DB, 'memory', {'id.uid': uid});
	assert.ok(doc, 'the memory document was written to the personal database');
	assert.equal(await count(GLOBAL_DB, 'memory'), 0, 'memory is not in the global database');
	for (const t of TIERS) assert.equal(typeof doc[t], 'string', `${t} on the stored document`);
	assert.ok(Object.keys(doc).indexOf('md5') < Object.keys(doc).indexOf('sha256'));
	assert.ok(Object.keys(doc).indexOf('sha256') < Object.keys(doc).indexOf('sha512'));
	const body = {};
	for (const k of Object.keys(doc)) {
		if (k === '_id' || TIERS.includes(k)) continue;
		body[k] = doc[k];
	}
	const t1 = Object.assign({}, body);
	t1.md5 = DATA.hash(t1, 'md5');
	const t2 = Object.assign({}, t1);
	t2.sha256 = DATA.hash(t2, 'sha256');
	const t3 = Object.assign({}, t2);
	t3.sha512 = DATA.hash(t3, 'sha512');
	assert.equal(doc.md5, t1.md5, 'md5 is the hash of the unstamped body');
	assert.equal(doc.sha256, t2.sha256, 'sha256 is the hash of the body plus md5');
	assert.equal(doc.sha512, t3.sha512, 'sha512 is the hash of the body plus md5 and sha256');
	for (const t of TIERS) {
		assert.ok(hashEvents.some(text => text.includes(`data:memory:${t}:${uid}`)), `${t} hash action`);
	}
	const hits = await DATA.func.memory({text: 'personal vault'});
	assert.ok(Array.isArray(hits) && hits.length >= 1, 'func.memory finds the personal write');
	assert.equal(hits[0].q, 'memory question about the personal vault');
	assert.equal(hits[0].a, 'memory answer lives in personal');
	await assert.rejects(
		question(DATA, '/memory personal vault'),
		err => !/TIMEOUT/.test(err.message),
		'/memory rejects after the read when Feecting Deva is not loaded'
	);
});

test('/know inserts and /know:id updates a knowledge document in the global database, then /knowledge reads it back', {skip: MONGO_SKIP}, async () => {
	const inserted = await question(DATA, '/know a fact about the global knowledge base');
	assert.match(inserted.a.text, /^id: [0-9a-f]{24}$/i, '/know insert returns an id');
	const id = inserted.a.text.replace(/^id: /, '');
	const first = await mongo.db(GLOBAL_DB).collection('knowledge').findOne({_id: new ObjectId(id)});
	assert.equal(first.content, 'a fact about the global knowledge base');
	assert.equal(await count(PERSONAL_DB, 'knowledge'), 0, 'knowledge is not in the personal database');
	const updated = await question(DATA, `/know:${id} the updated global knowledge fact`);
	assert.match(updated.a.text, new RegExp(`^id: ${id}$`), '/know:id returns the same id');
	const docs = await mongo.db(GLOBAL_DB).collection('knowledge').find({}).toArray();
	assert.equal(docs.length, 1, 'the update changed the existing document');
	assert.equal(docs[0].content, 'the updated global knowledge fact');
	assert.equal(typeof docs[0].modified, 'number', 'modified is set');
	assert.equal(await count(PERSONAL_DB, 'knowledge'), 0);
	const hits = await DATA.func.knowledge({text: 'updated global knowledge'});
	assert.ok(Array.isArray(hits) && hits.length >= 1, 'func.knowledge finds the updated global write');
	assert.equal(hits[0].content, 'the updated global knowledge fact');
	await assert.rejects(
		question(DATA, '/knowledge updated global knowledge'),
		err => !/TIMEOUT/.test(err.message),
		'/knowledge rejects after the read when Feecting Deva is not loaded'
	);
});

test('func.search finds a document in the global search collection and returns the stored created time', {skip: MONGO_SKIP}, async () => {
  const collection = DATA.vars.search.collection;
  const created = Date.now();
  const text = 'zephyrquartz searchprobe';
  const {insertedId} = await mongo.db(GLOBAL_DB).collection(collection).insertOne({
    id: {uid: 'search-test-1'},
    q: {id: 'sq', text},
    a: {id: 'sa', text},
    created,
  });
  try {
    const hits = await DATA.func.search({text});
    assert.ok(Array.isArray(hits) && hits.length >= 1, 'func.search finds the global search write');
    assert.equal(hits[0].a.text, text, 'the hit has the inserted a.text');
    assert.equal(hits[0].created, created, 'created is the stored time');
  } finally {
    await mongo.db(GLOBAL_DB).collection(collection).deleteOne({_id: insertedId});
  }
});

test('/insert with a data payload writes to the global database, and /insert without a payload rejects', {skip: MONGO_SKIP}, async () => {
	const payload = {id: {uid: 'insert-test-1'}, content: 'hello insert payload', created: Date.now()};
	const ans = await question(DATA, '/insert:review_docs hello', payload);
	assert.match(ans.a.text, /^id:/, '/insert returns an id');
	const doc = await mongo.db(GLOBAL_DB).collection('review_docs').findOne({'id.uid': 'insert-test-1'});
	assert.equal(doc?.content, 'hello insert payload');
	assert.equal(await mongo.db(PERSONAL_DB).collection('review_docs').countDocuments({'id.uid': 'insert-test-1'}), 0);
	const log = console.log;
	console.log = () => {};
	try {
		await assert.rejects(
			question(DATA, '/insert:review_docs nope'),
			err => !/TIMEOUT/.test(err.message) && /uid/.test(err.message),
			'/insert without a data payload rejects'
		);
	} finally {
		console.log = log;
	}
});

test('/listidx:collection and /listidx collection both list indexes in the personal database', {skip: MONGO_SKIP}, async () => {
	await mongo.db(PERSONAL_DB).collection('idxprobe').insertOne({marker: 'personal'});
	await mongo.db(GLOBAL_DB).collection('idxprobe').insertOne({marker: 'global'});
	await mongo.db(PERSONAL_DB).collection('idxprobe').createIndex({marker: 1}, {name: 'personal_marker_1'});
	await mongo.db(GLOBAL_DB).collection('idxprobe').createIndex({marker: 1}, {name: 'global_marker_1'});
	const colon = await question(DATA, '/listidx:idxprobe');
	const text = await question(DATA, '/listidx idxprobe');
	const colonNames = (colon.a.data || []).map(i => i.name);
	const textNames = (text.a.data || []).map(i => i.name);
	assert.ok(colonNames.includes('personal_marker_1'), 'param form sees the personal index');
	assert.ok(!colonNames.includes('global_marker_1'), 'param form does not see the global index');
	assert.ok(textNames.includes('personal_marker_1'), 'text form sees the personal index');
	assert.ok(!textNames.includes('global_marker_1'), 'text form does not see the global index');
});

test('a history listener write is stored in the personal database, then /history reads it back', {skip: MONGO_SKIP}, async () => {
	const uid = 'hist-test-1';
	DATA.talk('data:history', {
		id: {uid},
		client: {id: '00000000000000000000'},
		agent: {id: pkg.id, key: 'data'},
		q: {id: 'hq', text: 'history packet question'},
		a: {id: 'ha', text: 'history packet answer', agent: {key: 'data'}},
		created: Date.now(),
	});
	const doc = await findDoc(PERSONAL_DB, 'history', {'id.uid': uid});
	assert.ok(doc, 'the history document was written to the personal database');
	assert.equal(await count(GLOBAL_DB, 'history'), 0, 'history is not in the global database');
	const ans = await question(DATA, '/history');
	assert.equal(ans.a.text, 'see data');
	const hits = ans.a.data || [];
	assert.ok(hits.some(item => item?.id?.uid === uid), '/history returns the personal write');
});

// runs in a child process with a fresh Data Deva and no database, so it does not
// share the bound func object or MongoClient with the tests that use DATA.
test('commands reject and do not hang when no MongoDB client is built', async () => {
	const code = [
		`const {default: DATA} = await import(${JSON.stringify(new URL('./index.js', import.meta.url).href)});`,
		'await DATA.init(JSON.parse(process.env.DATA_TEST_CLIENT));',
		"const commands = ['/search hello', '/listidx', '/insert testdoc', '/history', '/memory hello', '/knowledge hello', '/know a fact'];",
		'for (const q of commands) {',
		'	try {',
		'		await Promise.race([',
		'			DATA.question(q),',
		'			new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 8000)),',
		'		]);',
		'		console.log(`RESOLVED:${q}`);',
		'		process.exit(2);',
		'	} catch (err) {',
		'		if (/TIMEOUT|close is not a function/.test(err.message)) {',
		'			console.log(`BAD:${q}:${err.message}`);',
		'			process.exit(3);',
		'		}',
		'		console.log(`REJECTED:${q}`);',
		'	}',
		'}',
		'await DATA.stop();',
		'console.log("RESULT:ok");',
	].join('\n');
	const env = {PATH: process.env.PATH, DATA_TEST_CLIENT: JSON.stringify(client(pkg.VLA, false))};
	const run = promisify(execFile)(process.execPath, ['--input-type=module', '-e', code], {cwd: DIR, env, timeout: 20000, killSignal: 'SIGKILL'});
	const {stdout} = await run.catch(err => {
		const why = err.killed ? 'did not return within 20 seconds' : `failed: ${err.message}`;
		assert.fail(`commands without a MongoDB client ${why}`);
	});
	assert.match(stdout, /^RESULT:ok$/m, 'every command rejected without hanging');
});

test('a stop and init restart builds a new MongoClient and can insert again', {skip: MONGO_SKIP}, async () => {
	const before = DATA.modules.client;
	await DATA.stop();
	const data = await DATA.init(client());
	assert.equal(typeof data.ready, 'number', 'restart reaches ready');
	assert.ok(DATA.modules.client instanceof MongoClient, 'restart builds a MongoClient');
	assert.notEqual(DATA.modules.client, before, 'the MongoClient is new');
	dataClient = DATA.modules.client;
	const payload = {id: {uid: 'insert-restart-1'}, content: 'after restart', created: Date.now()};
	await question(DATA, '/insert:review_docs hello-again', payload);
	const doc = await mongo.db(GLOBAL_DB).collection('review_docs').findOne({'id.uid': 'insert-restart-1'});
	assert.equal(doc?.content, 'after restart');
});

test('data stops through the full chain', async () => {
	const data = await DATA.stop();
	assert.equal(data.key, 'shutdown', 'the chain ends on shutdown');
	assert.equal(data.value, 'data');
	dataClient = false;
});

// the refusal check loads a fresh Data Deva instance from the same file, so it starts from a clean state.
test('data refuses to start with a bad agent VLA', async () => {
	const {default: REFUSE} = await import('./index.js?refuse');
	const prompts = [];
	REFUSE.listen('devacore:prompt', packet => prompts.push(packet.text));
	const result = await REFUSE.init(client({uid: 'bad'}));
	assert.equal(result, REFUSE._messages.checkVLA, 'init answers with the invalid VLA message');
	assert.ok(prompts.includes(REFUSE._messages.checkVLA), 'core prompts the invalid VLA message');
	assert.equal(REFUSE._active, false, 'the Deva stays offline');
	if (REFUSE.modules?.client) await REFUSE.modules.client.close();
});


# Data Deva

Data Deva is the MongoDB front end for Deva.world. It stores and retrieves shared data, such as the knowledge base, and entity-specific data, such as memory and history. Commands talk to it directly with `/insert` or, from another Deva, with `#data insert`.

## Requirements

- Node.js with npm. Data Deva's `package.json` sets no `engines`. Deva Core 1.67.26 declares `"node": ">=22"` and `"npm": ">=9.5.1"` in its own `package.json`.
- A project with `"type": "module"` in its `package.json`. Data Deva is an ES module.
- `@indra.ai/deva` `^1.67.26` (Deva Core) and `mongodb` `^6.13.0`. Both install with Data Deva.
- A MongoDB server if you want data saved. A local `mongod` at `mongodb://127.0.0.1:27017` is enough.
- Feecting Deva, if you want `/memory` and `/knowledge` to finish formatting their results. Those two commands read the database first, then ask `#feecting parse`. Without Feecting Deva they reject after the read. The other commands do not use Feecting.

## Install

```bash
npm install @indra.ai/deva.data --save
```

```js
import DataDeva from '@indra.ai/deva.data';
```

## Two licenses

A running Deva carries two separate licenses, and each is checked on its own.

- **The core license** comes through the client data as `client.VLA`. Deva Core checks it against the core package's VLA at the start of `init`.
- **The agent license** comes through the license feature data as `features.license.devas.data`. Deva Core 1.67.26 checks it against the VLA in Data Deva's own `package.json` right after the features load and before `onInit`. Data Deva has no `onInit` of its own, so it has no license check of its own to change or remove.

The agent check compares the sha256 of the whole VLA object, so every field has to match exactly.

## Configuration

Data Deva reads two features from the client you pass to `init()`. The feature data loader puts them in the client, and Deva Core loads them into the Deva at startup, so both must be there before `init()` runs.

```json
"features": {
	"license": {
		"concerns": [],
		"global": [],
		"devas": {
			"data": {"uid": "25377341401711892723"}
		}
	},
	"data": {
		"concerns": [],
		"global": {
			"mongo": {
				"uri": "mongodb://127.0.0.1:27017",
				"database": "DataDeva"
			}
		},
		"devas": {
			"data": {
				"mongo": {
					"uri": "mongodb://127.0.0.1:27017",
					"database": "DataDevaPersonal"
				}
			}
		}
	}
}
```

- `license.devas.data` is the agent VLA. The short form above only shows where it goes. It must be the full `VLA` object from this package's `package.json`, for example:

```js
import pkg from '@indra.ai/deva.data/package.json' with {type:'json'};

const devas = {data: pkg.VLA}; // goes in features.license.devas
```

- `data.global.mongo.uri` is the MongoDB connection string. If it is not set, Data Deva still comes online but builds no MongoDB client, and commands that talk to the database reject.
- `data.global.mongo.database` is the global database name. `onReady` stores it in `this.vars.database`.
- `data.devas.data` is the personal record for this agent (`agent.key` is `data`). Deva Core exposes it as `this.data().personal`. `personal.mongo` has the same `{uri, database}` shape as `global.mongo`.
- There is one `MongoClient`, built in `onReady` from `global.mongo.uri` and kept in `this.modules.client`. `personal.mongo.uri` is not used to open a second client. `personal.mongo.database` is a database name on that same client, selected with `this.modules.client.db(name)`.

## Routing

| Store | Where the name comes from | What it is for |
| --- | --- | --- |
| Global | `this.vars.database`, from `global.mongo.database` | Common data, such as the knowledge base. Also the default for `/insert`, and the database `/search`, `func.update` and `func.list` use. |
| Personal | `this.data().personal.mongo.database` | Entity-specific data: memory, history, and the collections `/listidx` lists. |

## Load it

```js
import DataDeva from '@indra.ai/deva.data';

const data = await DataDeva.init(client); // client data provided by your loader
console.log(data.id.uid);
```

When the license checks pass, Data Deva walks start, enter, done and ready. In `onReady` it reads `this.data().global?.mongo`, builds a `MongoClient` in `this.modules.client` when `uri` is set, keeps `database` in `this.vars.database`, and prompts `💾 Data Deva Ready > VLA:25377341401711892723`.

To shut it down:

```js
await DataDeva.stop();
```

`onStop` closes the MongoDB client, if there is one, then calls `this.close(data, resolve)`. A stopped Deva can start again. Call `init()` again with a client that passes the license check. Data Deva builds a new MongoDB client in `onReady`.

## When Data Deva refuses to start

If the agent license check fails, Deva Core prompts the message, stops the Deva, and `init()` resolves with that message.

| You see | Why |
| --- | --- |
| `❌ Bad Personal VLA` | `features.license.devas` is there but has no `data` entry. |
| `❌ Invalid VLA Check` | The `data` entry doesn't match this package's VLA, or the license feature has no `devas`. |

## Commands

Talk to Data Deva with `/command` when it is the current agent, or with `#data command` from another Deva.

| Command | Database | What it does |
| --- | --- | --- |
| `/insert:collection` or `/insert:collection:database` | `params[2]`, or `this.vars.database` (global) if you omit it | Inserts `packet.q.data` into that collection. The document must include `data.id.uid`. A call with no data payload rejects. |
| `/know` | Global | Inserts the question text into the `knowledge` collection. |
| `/know:id` | Global | Updates that knowledge document. `id` is the MongoDB `_id`. |
| `/knowledge` and `/knowledge:limit` | Global | Text-searches `knowledge`, then asks `#feecting parse` to format the hits. |
| `/memory` | Personal | Text-searches the `memory` collection, then asks `#feecting parse`. |
| `/memory:limit` | Personal | Same search on the `memory` collection, using that limit. A good limit is stored in `this.vars.memory.limit` and used for later calls. There is one `memory` collection for everything, because memory lives in each entity's personal database. |
| `/history` | Personal | Returns the latest documents from the `history` collection, newest first, up to `vars.history.limit` (25). It does not use Feecting. |
`/search` creates the `a_q_text` text index on `a.text` and `q.text` before it searches. A collection can have only one text index, so searching a collection that already has a different one, such as `knowledge`, fails with Mongo error 85.
| `/listidx:collection` or `/listidx collection` | Personal | Lists indexes on that collection. Both the param form and the text form work. |

`/memory` and `/knowledge` need Feecting Deva after a successful database read. Without it they reject; they do not hang. `/know`, `/insert`, `/listidx`, `/search` and `/history` do not use Feecting.

Each search command checks its limit before it reads the database. A limit must be a whole number of 1 or more. A good limit is stored in `this.vars` as a number and used for later calls. A bad limit, such as `abc`, `0`, `-5` or `1.5`, fires action `incorrect`, state `invalid` and intent `bad`, returns an empty array, and resets the limit to that command's `default` in `package.json`. The defaults are 5 for `/search`, `/memory` and `/knowledge`, and 25 for `/history`.

There are no public `/update`, `/list` or `/archive` commands. `func.update` and `func.list` exist and use the global database. They are not exposed as methods yet.

`/search` uses the global database, and its default collection is `search`. The history listener and `/history` use the personal `history` collection, so `/search` does not read history.

## Listeners

| Event | Database | What it does |
| --- | --- | --- |
| `data:memory` | Personal | Builds a document from `packet.id`, `packet.client.id`, `packet.agent.id`, and `q` and `a` after `this.utils.memory` (it expects those as strings). It stamps the document with `this._stamp(data, 'data:memory', data.id.uid)`, which writes `md5`, then `sha256`, then `sha512` (each tier hashes the document plus the tiers before it) and fires hash action events with that label, then inserts into `this.vars.memory.collection` (default `memory`). |
| `data:history` | Personal | Inserts a copy of the packet into the `history` collection. The packet must include `id.uid` (for the insert) and `a.agent.key` (for the context line). |

## Functions

All of these use the one `MongoClient` from `global.mongo.uri`. Each function calls `connect()` at the start. The client stays open for later calls, and `onStop` closes it.

| Func | Database | What it does |
| --- | --- | --- |
| `insert` | `opts.database` | Inserts `opts.data` into `opts.collection`. If `opts.database` is omitted, the MongoDB driver uses the default database `test`. `opts.data.id.uid` is required. |
| `update` | `this.vars.database` (global) | Updates one document by `ObjectId(opts.id)` with `$set: opts.data`. |
| `list` | `this.vars.database` (global) | Finds documents in `opts.collection` matching `opts.data`, sorted by `created` ascending. There is no public method for this yet. |
| `search` | `this.vars.database` (global) | `$text` search of `this.vars.search.collection` (default `history`). |
| `memory` | Personal | `$text` search of the memory collection. Creates the `a_q_text` text index on `a` and `q` if it is missing. |
| `knowledge` | Global | `$text` search of the knowledge collection. Creates the `knowledge_text` index on `content` if it is missing. |
| `indexes` | Personal | `listIndexes()` on `opts.collection`. |
| `history` | Personal | Finds all documents in the history collection, sorted by `created` descending, limited to `vars.history.limit`. |

## The wall feature

`feature/methods.js` exports a `data(packet)` method that installs with other agents. It asks Data Deva with `#data ${method}:${collection}:${database}` and a data payload. The defaults are method `insert`, collection `PersonalVault`, and database `${agent.id}-${agent.profile.name}` with spaces removed. That database name is passed through as `/insert`'s explicit database parameter. It is not `this.vars.database` and it is not `personal.mongo.database`.

## Inside Data Deva

| Name | Kind | What it does |
| --- | --- | --- |
| `data:memory`, `data:history` | listeners | Write memory and history as described above. |
| `insert`, `update`, `list`, `search`, `memory`, `knowledge`, `indexes`, `history` | funcs | The database calls, loaded from `func/index.js`. |
| `insert`, `history`, `search`, `memory`, `knowledge`, `know`, `listidx` | methods | The commands, loaded from `methods/index.js`. |
| `translate`, `parse`, `process` | utils | Each returns its input trimmed. |
| `memory` | util | Flattens a memory string before it is stored. The `data:memory` listener uses this on `packet.q` and `packet.a`. |
| `onReady` | lifecycle | Builds the MongoDB client from the data feature's `global.mongo` and prompts the ready message. |
| `onStop` | lifecycle | Closes the MongoDB client, then calls `this.close(data, resolve)`. |
| `onError` | lifecycle | Prompts `💣 ERROR!`, logs the error, and returns `reject(err)` or `Promise.reject(err)`. |
| `modules.client` | module | The `MongoClient`, set in `onReady` when a `uri` is given. |

The `func` and `methods` objects live in their own directories so `index.js` stays the Deva wiring: listeners, utils, lifecycle, and the imports from `./func/index.js` and `./methods/index.js`. Deva Core binds those functions to the Deva `this`.

The `vars` in `package.json` hold the prompt `messages`, the default `search`, `memory`, `knowledge` and `history` `collection names`, `limits`, and the `default limit` each one resets to, and the command `context` labels. `this.vars.database` is set in `onReady` from `global.mongo.database`.

## Testing

Start a local MongoDB, then run:

```bash
node --test
```

The package.json `test` script is `node --test`, so `npm test` runs the same file. The tests use `mongodb://127.0.0.1:27017` by default. To use another server, set `MONGO_URI`:

```bash
MONGO_URI="mongodb://127.0.0.1:27018" node --test
```

The tests always write to their own databases, `deva_data_test_global` and `deva_data_test_personal`, and drop those two when they finish. Only the server can change, so the cleanup never touches another database. If MongoDB can't be reached, the MongoDB tests are skipped with a message and the rest still run, including the checks that commands reject when no MongoDB client is built.

The tests build a stub client in code from the core VLA in `@indra.ai/deva/package.json` and the VLA in this package's `package.json`, so no client file is needed. They cover:

- data builds as a Deva and waits offline before init
- data data has no placeholders left
- func and methods load from `func/index.js` and `methods/index.js` with the 0.22.10 names
- data comes online and walks to ready
- data agent matches the package
- data utils answer with trimmed text
- data help pages name the Deva and carry the package license
- a memory listener write is stamped and stored in the personal database, then `/memory` reads it back (MongoDB)
- `/know` inserts and `/know:id` updates a knowledge document in the global database, then `/knowledge` reads the updated document (MongoDB)
- `/insert` with a data payload writes to the global database, and `/insert` without a payload rejects (MongoDB)
- `/listidx:collection` and `/listidx collection` both list indexes in the personal database (MongoDB)
- a history listener write is stored in the personal database, then `/history` reads it back (MongoDB)
- `/memory` and `/knowledge` reject after the database read when Feecting Deva is not loaded (MongoDB)
- commands reject and do not hang when no MongoDB client is built
- a stop and `init` restart builds a new MongoClient and can insert again (MongoDB)
- data stops through the full chain
- data refuses to start with a bad agent VLA

## Files

| File | What it holds |
| --- | --- |
| `index.js` | The Data Deva: listeners, utils, lifecycle, and the imports of `func` and `methods`. |
| `func/index.js` | The database functions, including the `ObjectId` import `func.update` uses. |
| `methods/index.js` | The command methods. |
| `package.json` | Package info, the package VLA, and the agent and vars data under `data`. |
| `feature/methods.js` | The `data(packet)` wall feature that installs with other agents. |
| `help/main.feecting` | The main help page and the license block. |
| `help/corpus.feecting` | The help corpus. |
| `index.test.js` | The tests. |
| `assets/` | The emoji, avatar, background and main images. |
| `LICENSE.md` | The license. |

Copyright ©2000-2026 Quinn Michaels; All rights reserved.  
Owner Signature Required For Lawful Use.  
Distributed under VLA:25377341401711892723 LICENSE.md  
Saturday, November 21, 2026 - 7:42:26 PM PST

// Copyright (c)2023 Quinn Michaels
// Data Deva
import Deva from '@indra.ai/deva';
import { MongoClient, ObjectId } from 'mongodb';

import pkg from './package.json' with {type:'json'};
const {agent, vars} = pkg.data;

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
  copyright: pkg.copyright
};

const DATA = new Deva({
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
    'data:history'(packet) {
      this.context('history');
      // here we insert a history object into the database.
      this.func.insert({
        collection: 'history',
        data: packet,
      });
    },
    async 'data:memory'(packet) {
      const data = {
        id: packet.id,
        client: packet.client.id,
        agent: packet.agent.id,
        q: this.utils.memory(packet.q),
        a: this.utils.memory(packet.a),
        created: Date.now(),
      }
      data.hash = this.lib.hash(data);
      await this.func.insert({
        collection: `memory_${packet.agent.key}`,
        data,
      });
    }
  },
  modules: {
    client: false,
  },
  devas: {},
  func: {
    /**************
    func: insert
    params: opts
    describe: the insert function that inserts into the specified collection.
    ***************/
    async insert(opts) {
      this.action('func', `insert:${opts.collection}:${opts.id}`);
      let result = false;
      try {
        this.state('insert', opts.collection);
        const {database} = this.services().personal.mongo;
        await this.modules.client.connect(); // connect to the database client.
        const db = this.modules.client.db(database);  // set the database to use
        result = await db.collection(opts.collection).insertOne(opts.data); // insert the data
      } finally {
        await this.modules.client.close(); // close the connection when done
        this.action('return', `insert:${opts.collection}:${opts.id}`);
        return result; // return the result to the requestor.
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
        const {database} = this.services().personal.mongo;
        await this.modules.client.connect(); // connect to the database client.
        const db = this.modules.client.db(database);  // set the database to use
        result = await db.collection(opts.collection).updateOne(
          { _id: new ObjectId(`${opts.id}`) },
          { $set: opts.data }
        ); // insert the data
      } finally {
        await this.modules.client.close(); // close the connection when done
        this.state('return', 'update');
        return result; // return the result to the requestor.
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
        const {database} = this.services().personal.mongo;
        await this.modules.client.connect();
        const db = this.modules.client.db(database);
        result = await db.collection(collection).find(data).sort({created:1}).toArray();
      } finally {
        await this.modules.client.close();
        return result;
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
        const {database} = this.services().personal.mongo;
        await this.modules.client.connect();
        const db = this.modules.client.db(database);
        const table = db.collection(collection);

        // await table.dropIndex('a.text_1');
        // const newIndex = await table.createIndex({"a.text": "text"});
        const idx = await table.listIndexes().toArray();
        // Print the list of indexes
        // console.log("Existing indexes:\n", idx);

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
      } finally {
        await this.modules.client.close();
        this.state('return', 'search');
        return result;
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
        const {database} = this.services().personal.mongo;
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
      } finally {
        await this.modules.client.close();
        this.state('return', `memory`);
        return result;
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
        const {database} = this.services().personal.mongo;
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
      } finally {
        await this.modules.client.close();
        this.state('return', `knowledge`);
        return result;
      }
    },

    /**************
    func: index
    params: opts
    describe: Creates an index on a collection in the database.
    ***************/
    async indexes(opts) {
      this.action('func', 'indexes');
      let result = false;
      // get indexes
      try {
        this.state('get', `indexes`);
        const {database} = this.services().personal.mongo;
        await this.modules.client.connect();
        const db = this.modules.client.db(database);
        result = await db.collection(opts.collection).listIndexes().toArray();
      } finally {
        await this.modules.client.close();
        this.state('return', 'indexes');
        return result;
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
        const {database} = this.services().personal.mongo;
        await this.modules.client.connect();
        const db = this.modules.client.db(database);
        result = await db.collection(collection).find({}).sort({created:-1}).limit(limit).toArray();
      } finally {
        await this.modules.client.close();
        this.state('return', `history`);
        return result;
      }
    },

  },
  methods: {
    /**************
    method: insert
    params: packet
    describe: insert data into the data vault.
    ***************/
    insert(packet) {
      this.context('insert', `collection:${packet.q.meta.params[1]}`);
      this.action('method', `insert:${packet.q.meta.params[1]}`);
      return new Promise((resolve, reject) => {
        const {data, meta} = packet.q;
        const collection = meta.params[1];
        this.func.insert({collection,data}).then(ins => {
          this.state('resolve', `insert:${collection}:${insinsertedId}`)
          return resolve({
            text: `id:${insinsertedId}`,
            html: `id:${insinsertedId}`,
            data: ins,
          });
        }).catch(err => {
          this.state('reject', 'insert');
          return this.error(packet, err, reject);
        });
      });
    },


    /**************
    method: history
    params: packet
    describe: get history
    ***************/
    history(packet) {
      this.context('history');
      return new Promise((resolve, reject) => {
        this.func.history().then(history => {
          return resolve({
            text: 'see data',
            html: 'see data',
            data: history,
          })
        }).catch(err => {
          return this.error(packet, err, reject);
        });
      });
    },

    /**************
    method: history
    params: packet
    describe: get history
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
          return this.error(packet, err, reject);
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
          const text = memory ? memory.map(mem => {
            return [
              `::begin:memory:${mem.id}`,
              `question: ${mem.q}`,
              `answer: ${mem.a}`,
              `date: ${this.formatDate(mem.created, 'long', true)}`,
              `score: ${mem.score.toFixed(3)}`,
              `::end:memory:${this.hash(mem)}`,
            ].join('\n');
          }).join('\n') : 'no memory';
          this.state('parse', `memory`);
          console.log('packet memory feecting resolve', memory);

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
          return this.error(packet, err, reject);
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
              `::end:knowledge:${this.lib.hash(item)}`,
            ].join('\n');
          }).join('\n') : this.vars.messages.no_knowledge;
          this.state('parse', `knowledge`);
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
          return this.error(err, packet, reject);
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
      this.context('know', packet.id);

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

        this.func[func]({id,collection,data}).then(ins => {
          this.state('resolve', 'add');
          return resolve({
            text: `id: ${ins.insertedId || id}`,
            html: `id: ${ins.insertedId || id}`,
            data: ins.insertedId,
          });
        }).catch(err => {
          this.state('reject', 'add');
          return this.error(err, packet, reject);
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
        this.func.indexes(packet.q).then(idx => {
          this.state('resolve', 'indexes');
          return resolve({
            text: 'indexes',
            html: 'indexes',
            data: idx
          })
        }).reject(err => {
          return this.error(err, packet, reject);
        })
      });
    },
  },
  onReady(data, resolve) {
    const {uri} = this.services().personal.mongo;
    this.modules.client = new MongoClient(uri);
    this.prompt(this.vars.messages.ready);
    return resolve(data);
  },
  onError(err, data, reject) {
    this.prompt(this.vars.messages.error);
    console.log(err);
    return reject ? reject(err) : false;
  },
});
export default DATA

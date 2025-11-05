"use strict";
// Copyright ©2025 Quinn A Michaels; All rights reserved. 
// Legal Signature Required For Lawful Use.
// Distributed under VLA:65859204002504361305 LICENSE.md

export default {
  /**************
  method: data
  params: packet
  describe: The global wall feature that installs with every agent
  ***************/
  async data(packet) {
      const info = this.info();
      const agent = this.agent();
      const client = this.client();
      const {id, q} = packet;
      const {meta, text, data} = q;
      const {params} = meta;
      const method = params[1] ? params[1] : 'insert';
      const collection = params[2] ? params[2] : 'PersonalVault';
      const database = params[3] ? params[3] : `${agent.id}-${agent.profile.name.replace(/\s/g, '')}`;
      
      this.state('data', `data_packet:${id.uid}`); // set state data
      const data_packet = {
        id,
        content: q.text,
        client: client.id,
        agent: agent.id,
        method,
        collection,
        database,
        created: Date.now(),
      };
      
      this.action('hash', `data:${method}:md5:${id.uid}`); // set action hash
      data_packet.md5 = this.hash(data_packet, 'md5');
      this.action('hash', `data:${method}:sha256:${id.uid}`); // set action hash
      data_packet.sha256 = this.hash(data_packet, 'sha256');
      this.action('hash', `data:${method}:sha512:${id.uid}`); // set action hash
      data_packet.sha512 = this.hash(data_packet, 'sha512');
      
      const answer = await this.question(`${this.askChr}data ${method}:${collection}:${database} ${text}`, data_packet);
        data_packet.insertedId = answer.a.data.insertedId;
        
        const data_prompt = [
          `::begin:data:${method}:${id.uid}`,
          `content: ${data_packet.content}`,
          `uid: ${id.uid}`,
          `insertedId: ${data_packet.insertedId}`,
          `collection: ${data_packet.collection}`,
          `database: ${data_packet.database}`,
          `md5: ${data_packet.md5}`,
          `sha256: ${data_packet.sha256}`,
          `sha512: ${data_packet.sha512}`,
          `created: ${this.lib.formatDate(data_packet.created, 'long', true)}`,
          `::end:data:${method}:${id.uid}`,
        ].join('\n');
        
        this.action('resolve', `data:${packet.id.uid}`); // set action reject
        this.state('valid', `data:${packet.id.uid}`); // set action reject
        this.intent('good', `data:${packet.id.uid}`);
        return {
          text: data_prompt,
          html: false,
          data: data_packet,
        }
    },
};

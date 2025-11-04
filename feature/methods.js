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
      const {id, q} = packet;
      const {meta, text, data} = q;
      const {params} = meta;
      const method = params[1] ? params[1] : 'insert';
      const collection = params[2] ? params[2] : 'PersonalVault';
      const database = params[3] ? params[3] : `${agent.id}-${agent.profile.name.replace(/\s/g, '')}`;
      const answer = await this.question(`${this.askChr}data ${method}:${collection}:${database} ${text}`, {id:q.id, content:q.text});

      console.log('ANSWER', JSON.stringify(answer, null, 2));     

        this.prompt(`database: ${database}`);
        this.prompt(`collection: ${collection}`);
        this.prompt(`method: ${method}`);
        this.prompt(`text: ${text}`);

        this.action('resolve', `data:${packet.id.uid}`); // set action reject
        this.state('valid', `data:${packet.id.uid}`); // set action reject
        this.intent('good', `data:${packet.id.uid}`);
        return {
          text: answer.a.text,
          html: answer.a.html,
          data: answer.a.data,
        }
    },
};

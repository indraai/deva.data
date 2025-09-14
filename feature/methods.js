"use strict";
// ©2025 Quinn A Michaels; All rights reserved. 
// Legal Signature Required For Lawful Use.
// Distributed under VLA:70660152326008741549 LICENSE.md

export default {
  /**************
  method: data
  params: packet
  describe: The global wall feature that installs with every agent
  ***************/
  async data(packet) {
    const data = await this.methods.sign('data', 'default', packet);
    return data;
  },
};

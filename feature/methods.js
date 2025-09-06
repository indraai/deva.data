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

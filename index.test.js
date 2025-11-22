"use strict";
// Copyright ©2000-2025 Quinn A Michaels; All rights reserved. 
// Legal Signature Required For Lawful Use.
// Distributed under VLA:54611712212611489719 LICENSE.md

const {expect} = require('chai')
const DataDeva = require('./index.js');

describe(DataDeva.me.name, () => {
  beforeEach(() => {
    return DataDeva.init()
  });
  it('Check the DEVA Object', () => {
    expect(DataDeva).to.be.an('object');
    expect(DataDeva).to.have.property('agent');
    expect(DataDeva).to.have.property('vars');
    expect(DataDeva).to.have.property('listeners');
    expect(DataDeva).to.have.property('methods');
    expect(DataDeva).to.have.property('modules');
  });
})

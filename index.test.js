"use strict";
// Copyright ©2025 Quinn A Michaels; All rights reserved. 
// Legal Signature Required For Lawful Use.
// Distributed under VLA:65859204002504361305 LICENSE.md

const {expect} = require('chai')
const LegalDeva = require('./index.js');

describe(LegalDeva.me.name, () => {
  beforeEach(() => {
    return LegalDeva.init()
  });
  it('Check the DEVA Object', () => {
    expect(LegalDeva).to.be.an('object');
    expect(LegalDeva).to.have.property('agent');
    expect(LegalDeva).to.have.property('vars');
    expect(LegalDeva).to.have.property('listeners');
    expect(LegalDeva).to.have.property('methods');
    expect(LegalDeva).to.have.property('modules');
  });
})

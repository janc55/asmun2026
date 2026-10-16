const Module = require('module');
const path = require('path');
const original = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === '@prisma/client') {
    return path.join(__dirname, 'stub-prisma.cjs');
  }
  return original.call(this, request, ...rest);
};

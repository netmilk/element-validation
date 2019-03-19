#!/usr/bin/env node
const fs = require('fs');
const jp = require('jsonpath');
const program = require('commander');
const elementRouter = require('element-routing');
const gavel = require('gavel');
const tap = require('tap');

const validate = async (actual, expected, type) => new Promise((resolve, reject) => {
  gavel.isValid(actual, expected, type, (err, gavelResult) => {
    if (err) reject(err);
    else resolve(gavelResult);
  });
});

const validateRequest = async (actual, expected) => validate(actual, expected, 'request');
const validateResponse = async (actual, expected) => validate(actual, expected, 'response');

program
  .option('-a, --apidescription [name]', 'API description to validate')
  .option('-l, --log [name]', 'HAR log file to validate')
  .parse(process.argv);

const description = JSON.parse(fs.readFileSync(program.apidescription, 'utf8'));
const log = JSON.parse(fs.readFileSync(program.log, 'utf8'));

const entries = jp.query(log, '$..entries.*');

entries.forEach((entry) => {
  const request = jp.query(entry, '$..request')[0];
  const response = jp.query(entry, '$..response')[0];

  const possibleResults = elementRouter.getResults(description, request.url, request.method);
  if (possibleResults.lenght === 0) {
    tap.fail(`${request.url} (${request.method}): Not found!`);
  } else {
    const valid = possibleResults.map((result) => {
      const actualRequestHeaders = {};
      const actualResponseHeaders = {};
      const expectedRequestHeaders = {};
      const expectedResponseHeaders = {};

      if (result.request.headers) {
        result.request.headers.forEach((item) => {
          expectedRequestHeaders[item.key] = item.value;
        });
      }

      if (result.response.headers) {
        response.headers.forEach((item) => {
          expectedResponseHeaders[item.name] = item.value;
        });
      }

      if (request.headers) {
        request.headers.forEach((item) => {
          actualRequestHeaders[item.name] = item.value;
        });
      }

      if (response.headers) {
        response.headers.forEach((item) => {
          actualResponseHeaders[item.name] = item.value;
        });
      }

      const actualRequest = {
        headers: actualRequestHeaders,
        body: request.postData.text,
      };

      const expectedRequest = {
        headers: expectedRequestHeaders,
        body: result.request.content,
        bodySchema: result.request.bodySchema,      };
      };
     
      const actualResponse = {
        headers: actualResponseHeaders,
        body: response.content.text,
        statusCode: response.status,
      };
      
      const expectedResponse = {
        headers: expectedResponseHeaders,
        body: result.response.content,
        statusCode: result.response.statusCode,
        bodySchema: result.request.bodySchema,
      };

      return Promise.all([
        validateRequest(actualRequest, expectedRequest),
        validateResponse(actualResponse, expectedResponse),
      ]);
    });
    Promise.all(valid)
      .then((results) => {
        const validPair = results.find(item => item[0] === true && item[1] === true);
        if (!validPair) {
          tap.fail(`${request.url} (${request.method}): Not valid!`);
        } else {
          tap.pass(`${request.url} (${request.method}): Valid`);
        }
      });
  }
});

#!/usr/bin/env node
/**
 * Simple OpenAPI-driven mock server for integration tests.
 *
 * Usage:
 *   node tools/openapi-mock-server.js --port 4100 --spec openapi/rentease.yaml
 *
 * The server parses the supplied OpenAPI document and automatically exposes
 * each path/method as an Express route. Responses are generated from the
 * documented schemas (preferring `example`, `default`, or enum values and
 * falling back to sensible primitives).  This keeps our UI tests aligned with
 * the published contract while backend services are still maturing.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const express = require('express');

const DEFAULT_SPEC_PATH = path.join(process.cwd(), 'openapi', 'rentease.yaml');
const DEFAULT_PORT = process.env.MOCK_PORT ? Number(process.env.MOCK_PORT) : 4100;

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    spec: DEFAULT_SPEC_PATH,
    port: DEFAULT_PORT
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if ((arg === '-p' || arg === '--port') && args[i + 1]) {
      config.port = Number(args[i + 1]);
      i += 1;
    } else if ((arg === '-s' || arg === '--spec') && args[i + 1]) {
      config.spec = path.isAbsolute(args[i + 1])
        ? args[i + 1]
        : path.join(process.cwd(), args[i + 1]);
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return config;
}

function printHelp() {
  console.log(`
RentEase OpenAPI Mock Server
----------------------------
Usage:
  node tools/openapi-mock-server.js [options]

Options:
  -p, --port   Port to bind (default: ${DEFAULT_PORT})
  -s, --spec   Path to OpenAPI YAML/JSON file (default: ${DEFAULT_SPEC_PATH})
  -h, --help   Show this message
  `);
}

function readOpenApiDocument(specPath) {
  if (!fs.existsSync(specPath)) {
    throw new Error(`OpenAPI spec not found at "${specPath}"`);
  }

  const raw = fs.readFileSync(specPath, 'utf-8');
  if (specPath.endsWith('.json')) {
    return JSON.parse(raw);
  }
  return yaml.load(raw);
}

function createMockFromSchema(schema, components, stack = []) {
  if (!schema) {
    return null;
  }

  if (schema.example !== undefined) {
    return schema.example;
  }

  if (schema.default !== undefined) {
    return schema.default;
  }

  if (schema.enum && schema.enum.length) {
    return schema.enum[0];
  }

  if (schema.$ref) {
    const refPath = schema.$ref.replace(/^#\//, '').split('/');
    let current = components;
    for (const segment of refPath.slice(1)) {
      if (!current) break;
      current = current[segment];
    }
    if (!current) {
      return null;
    }
    // Prevent circular references exploding the stack.
    const signature = schema.$ref;
    if (stack.includes(signature)) {
      return null;
    }
    return createMockFromSchema(current, components, [...stack, signature]);
  }

  if (schema.type === 'object' || schema.properties) {
    const result = {};
    const properties = schema.properties || {};
    Object.entries(properties).forEach(([key, value]) => {
      result[key] = createMockFromSchema(value, components, stack);
    });
    return result;
  }

  if (schema.type === 'array' && schema.items) {
    const item = createMockFromSchema(schema.items, components, stack);
    return item === undefined ? [] : [item];
  }

  switch (schema.type) {
    case 'string':
      if (schema.format === 'date-time') {
        return new Date().toISOString();
      }
      if (schema.format === 'date') {
        return new Date().toISOString().split('T')[0];
      }
      if (schema.format === 'email') {
        return 'mock@example.com';
      }
      if (schema.format === 'uuid') {
        return '00000000-0000-4000-8000-000000000000';
      }
      if (schema.format === 'binary') {
        return 'data:application/octet-stream;base64,';
      }
      return schema.title ? `${schema.title} placeholder` : 'mock-value';
    case 'integer':
    case 'number':
      return schema.minimum || 1;
    case 'boolean':
      return true;
    default:
      return null;
  }
}

function formatExpressPath(openApiPath) {
  return openApiPath.replace(/{(.*?)}/g, ':$1');
}

function registerRoutes(app, spec) {
  const components = spec.components || {};
  const paths = spec.paths || {};
  const registered = [];

  Object.entries(paths).forEach(([route, methods]) => {
    Object.entries(methods).forEach(([method, operation]) => {
      const expressMethod = method.toLowerCase();
      if (typeof app[expressMethod] !== 'function') {
        return;
      }

      const expressPath = formatExpressPath(route);
      const responses = operation.responses || {};
      const statusCode = Object.keys(responses).find(code => code.startsWith('2')) || '200';
      const response = responses[statusCode] || {};
      const content = response.content || {};
      const mediaType = Object.keys(content)[0] || 'application/json';
      const schema = content[mediaType]?.schema || null;
      const payload = createMockFromSchema(schema, components);

      app[expressMethod](expressPath, (req, res) => {
        // Simulate small latency for consumer loaders.
        setTimeout(() => {
          if (!schema) {
            res.status(Number(statusCode)).json({});
            return;
          }
          if (mediaType.includes('json')) {
            res.status(Number(statusCode)).json(payload);
          } else {
            res.status(Number(statusCode)).type(mediaType).send(payload);
          }
        }, 150);
      });

      registered.push({
        method: expressMethod.toUpperCase(),
        path: expressPath,
        status: statusCode
      });
    });
  });

  return registered;
}

function startServer({ spec = DEFAULT_SPEC_PATH, port = DEFAULT_PORT }) {
  const app = express();
  const document = readOpenApiDocument(spec);

  app.get('/__health', (_req, res) => {
    res.json({
      status: 'ok',
      spec: path.relative(process.cwd(), spec)
    });
  });

  app.get('/__spec', (_req, res) => {
    res.json(document);
  });

  const routes = registerRoutes(app, document);

  app.use((_req, res) => {
    res.status(404).json({
      error: 'Mock route not defined in OpenAPI document.',
      path: _req.path,
      method: _req.method
    });
  });

  const server = app.listen(port, () => {
    console.log(`🚀 RentEase mock API listening on http://localhost:${port}`);
    console.log(`    OpenAPI source: ${spec}`);
    console.log(`    Registered routes:`);
    routes.forEach(route => {
      console.log(`      • ${route.method.padEnd(6)} ${route.path} → ${route.status}`);
    });
    console.log('\nUse CTRL+C to stop the mock server.\n');
  });

  return server;
}

function startMockServer(config = {}) {
  const resolved = {
    spec: config.spec ?? DEFAULT_SPEC_PATH,
    port: config.port ?? DEFAULT_PORT
  };
  return startServer(resolved);
}

if (require.main === module) {
  try {
    const config = parseArgs();
    startServer(config);
  } catch (error) {
    console.error('Failed to start mock server:', error.message);
    process.exit(1);
  }
} else {
  module.exports = {
    startMockServer,
    DEFAULT_PORT,
    DEFAULT_SPEC_PATH,
    parseArgs
  };
}

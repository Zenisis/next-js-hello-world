const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-http');
const { SimpleLogRecordProcessor, LoggerProvider } = require('@opentelemetry/sdk-logs');
const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

// Configure logging
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

// Create a custom resource
const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: 'hello-word-application'
});

// Configure Logger Provider with the custom resource
const loggerProvider = new LoggerProvider({
  resource: resource
});

const logExporter = new OTLPLogExporter({
  url: 'http://localhost:4318/v1/logs'
});

loggerProvider.addLogRecordProcessor(new SimpleLogRecordProcessor(logExporter));

// Initialize OpenTelemetry SDK with the custom resource
const sdk = new NodeSDK({
  resource: resource,
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces'
  }),
  instrumentations: [getNodeAutoInstrumentations()]
});

// Function to start the SDK and handle both Promise and non-Promise scenarios
function startSDK() {
  return new Promise((resolve, reject) => {
    const startResult = sdk.start();
    if (startResult && typeof startResult.then === 'function') {
      // If start() returns a Promise
      startResult.then(resolve).catch(reject);
    } else {
      // If start() doesn't return a Promise
      resolve();
    }
  });
}

// Start the SDK and then start the Express server
startSDK()
  .then(() => {
    console.log('OpenTelemetry SDK started');
    // Now import express after the SDK is started
    const express = require('express');
    const app = express();
    const PORT = 3000;

    // Function to log messages
    const logMessage = (level, message) => {
      const logger = loggerProvider.getLogger('example-logger');
      const logRecord = {
        timestamp: Date.now(),
        severityText: level,
        body: message,
      };
      logger.emit(logRecord);
    };

    // Express route
    app.get('/', (req, res) => {
      logMessage('INFO', 'Received request on root path');
      res.send('Hello World!');
    });

    // Start the Express server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Error starting OpenTelemetry SDK', err);
  });

// Handle graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => {
      console.log('Tracing terminated');
      return loggerProvider.shutdown();
    })
    .then(() => console.log('Logging terminated'))
    .catch((error) => console.log('Error during shutdown', error))
    .finally(() => process.exit(0));
});

const express = require('express');
const Gun = require('gun');
const Docker = require('dockerode');
const os = require('os');

console.log('Initializing server...');

const app = express();
const docker = new Docker();
const gun = Gun({
  web: app.listen(3000, () => {
    console.log('Express server listening on port 3000');
  }),
  peers: ['https://gun-manhattan.herokuapp.com/gun']
});

// Get host information
const hostName = os.hostname();
const resources = {
  cpus: os.cpus().length,
  totalMemory: os.totalmem(),
  freeMemory: os.freemem(),
  platform: os.platform(),
};

console.log('Gun and Docker initialized');

// Broadcast host information to the network
const network = gun.get('network');
network.get(hostName).put({
  hostName,
  resources,
  status: 'online',
  lastUpdate: Date.now()
});

// Update host status periodically
setInterval(() => {
  network.get(hostName).put({
    hostName,
    resources: {
      ...resources,
      freeMemory: os.freemem(),
    },
    status: 'online',
    lastUpdate: Date.now()
  });
}, 30000); // Update every 30 seconds

// Listen for new client connections
network.map().on((data, id) => {
  console.log('Network event received:', { data, id });  // Debug log

  if (data?.clientId && data?.targetHost === hostName) {
    console.log(`New client connection request from ${data.clientId}`);
    
    // Create a specific path for this client's code requests
    const requestPath = `codeRequests_${hostName}_${data.clientId}`;
    console.log(`Listening for code requests at: ${requestPath}`);
    
    // Listen for code requests
    gun.get(requestPath).map().on((requestData, requestId) => {
      console.log('Code request data received:', { requestData, requestId });

      // Skip if no data or already processed
      if (!requestData?.code || requestData.processed) {
        console.log('Skipping request - no code or already processed');
        return;
      }

      console.log('Processing new code request:', requestData);

      // Process the code request
      (async () => {
        try {
          console.log('Creating Docker container...');
          const container = await docker.createContainer({
            Image: 'python:alpine',
            Cmd: ['python', '-c', requestData.code],
            HostConfig: {
              AutoRemove: true,
              Memory: Math.floor(resources.freeMemory * 0.1),
              MemorySwap: Math.floor(resources.freeMemory * 0.1),
              CpuQuota: 100000,
              CpuPeriod: 100000,
            }
          });

          console.log('Starting container...');
          await container.start();
          const stream = await container.logs({ follow: true, stdout: true, stderr: true });

          let output = '';
          stream.on('data', chunk => {
            output += chunk.toString('utf8').replace(/^\u0001./, '');  // Clean control characters
          });

          stream.on('end', () => {
            console.log('Container execution completed. Output:', output);
            // Update the specific request with the result
            gun.get(requestPath).get(requestId).put({
              code: requestData.code,
              output: output.trim(),
              processed: true,
              timestamp: Date.now()
            });
          });

          stream.on('error', (err) => {
            console.error('Stream error:', err);
            gun.get(requestPath).get(requestId).put({
              code: requestData.code,
              error: err.message,
              processed: true,
              timestamp: Date.now()
            });
          });
        } catch (error) {
          console.error('Error executing code:', error);
          gun.get(requestPath).get(requestId).put({
            code: requestData.code,
            error: error.message,
            processed: true,
            timestamp: Date.now()
          });
        }
      })();
    });
  }
});

// Cleanup on process exit
process.on('SIGINT', () => {
  console.log('Received SIGINT. Cleaning up...');
  network.get(hostName).put({
    status: 'offline',
    lastUpdate: Date.now()
  });
  process.exit();
});

console.log(`Server running on http://localhost:3000 with hostname: ${hostName}`);
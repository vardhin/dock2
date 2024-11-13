const express = require('express');
const Gun = require('gun');
const Docker = require('dockerode');

console.log('Initializing server...');

const app = express();
const docker = new Docker();
const gun = Gun({
  web: app.listen(3000),
  peers: ['https://gun-manhattan.herokuapp.com/gun']
});

console.log('Gun and Docker initialized');

const codeRequests = gun.get('codeRequests');

codeRequests.map().on(async (data, id) => {
  console.log('Received new code request:', { id, data });
  
  if (data?.code && !data.processed) {
    console.log('Processing code request:', id);
    try {
      console.log('Creating Docker container...');
      const container = await docker.createContainer({
        Image: 'python:alpine',
        Cmd: ['python', '-c', data.code],
        HostConfig: { AutoRemove: true }
      });

      console.log('Starting container...');
      await container.start();
      const stream = await container.logs({ follow: true, stdout: true, stderr: true });
      
      let output = '';
      stream.on('data', chunk => {
        const chunkStr = chunk.toString();
        console.log('Container output chunk:', chunkStr);
        output += chunkStr;
      });
      
      stream.on('end', () => {
        console.log('Container execution completed. Final output:', output);
        codeRequests.get(id).put({ output, processed: true });
        setTimeout(() => {
          console.log('Nullifying processed request:', id);
          codeRequests.get(id).put(null);
        }, 1000);
      });
    } catch (error) {
      console.error('Error executing code:', error);
      codeRequests.get(id).put({ error: error.message, processed: true });
      setTimeout(() => {
        console.log('Nullifying errored request:', id);
        codeRequests.get(id).put(null);
      }, 1000);
    }
  }
});

console.log('Server running on http://localhost:3000');
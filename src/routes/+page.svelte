<script>
  import Gun from 'gun';
  import { onMount } from 'svelte';

  console.log('Initializing Gun connection...');
  const gun = Gun({ peers: ['https://gun-manhattan.herokuapp.com/gun'] });
  const network = gun.get('network');

  let clientId = '';
  let code = '';
  let output = '';
  let availableHosts = [];
  let selectedHost = '';
  let isConnected = false;

  // Get available hosts from the network
  onMount(() => {
    network.map().on((data, hostId) => {
      if (data?.status === 'online') {
        console.log('Found online host:', data);
        availableHosts = [
          ...availableHosts.filter(h => h.hostName !== data.hostName),
          data
        ];
      } else if (data?.status === 'offline') {
        console.log('Host went offline:', hostId);
        availableHosts = availableHosts.filter(h => h.hostName !== data.hostName);
      }
    });
  });

  function connectToHost() {
    if (!clientId || !selectedHost) {
      alert('Please enter client ID and select a host');
      return;
    }

    console.log(`Connecting to host ${selectedHost} with client ID ${clientId}`);
    network.get(selectedHost).put({
      clientId,
      targetHost: selectedHost,
      timestamp: Date.now()
    });

    isConnected = true;
  }

  function executeCode() {
    if (!isConnected) {
      alert('Please connect to a host first');
      return;
    }

    const requestId = Gun.text.random();
    const codeRequests = gun.get(`codeRequests_${selectedHost}_${clientId}`);
    
    console.log('Executing code with requestId:', requestId);
    console.log('Code to execute:', code);
    
    // Clear previous output
    output = 'Executing...';
    
    // Send the request
    codeRequests.get(requestId).put({ 
      code,
      timestamp: Date.now(),
      processed: false  // Add this flag
    });
    console.log('Code request sent to Gun DB');
    
    // Listen for response
    codeRequests.get(requestId).on((data) => {
      console.log('Received data from Gun:', data);
      if (data?.processed) {  // Only handle processed results
        if (data.output !== undefined) {
          console.log('Received output:', data.output);
          output = data.output;
        }
        if (data.error) {
          console.log('Received error:', data.error);
          output = `Error: ${data.error}`;
        }
      }
    });
  }
</script>

<main>
  {#if !isConnected}
    <div>
      <h3>Connect to Host</h3>
      <input 
        type="text" 
        placeholder="Enter client ID" 
        bind:value={clientId}
      />
      
      <select bind:value={selectedHost}>
        <option value="">Select a host</option>
        {#each availableHosts as host}
          <option value={host.hostName}>
            {host.hostName} ({host.resources.cpus} CPUs, 
            {Math.round(host.resources.freeMemory / 1024 / 1024)}MB free)
          </option>
        {/each}
      </select>
      
      <button on:click={connectToHost}>Connect</button>
    </div>
  {:else}
    <div>
      <h3>Connected to {selectedHost} as {clientId}</h3>
      <textarea 
        placeholder="Enter Python code here" 
        bind:value={code}
        rows="10"
      ></textarea>
      <button on:click={executeCode}>Execute</button>
      <div class="output">
        <h4>Output:</h4>
        <pre>{output}</pre>
      </div>
    </div>
  {/if}
</main>

<style>
  main {
    padding: 20px;
    max-width: 800px;
    margin: 0 auto;
  }

  textarea {
    width: 100%;
    margin: 10px 0;
  }

  .output {
    margin-top: 20px;
    padding: 10px;
    background: #f5f5f5;
    border-radius: 4px;
  }

  input, select {
    margin: 10px 0;
    padding: 5px;
    display: block;
    width: 100%;
  }

  button {
    padding: 8px 16px;
    margin: 10px 0;
  }
</style>
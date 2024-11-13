<script>
    import Gun from 'gun';
    console.log('Initializing Gun connection...');
    let gun = Gun({ peers: ['https://gun-manhattan.herokuapp.com/gun'] });
    let codeRequests = gun.get('codeRequests');
    let code = '';
    let output = '';
  
    function executeCode() {
      const requestId = Gun.text.random();
      console.log('Executing code with requestId:', requestId);
      console.log('Code to execute:', code);
      
      codeRequests.get(requestId).put({ code });
      console.log('Code request sent to Gun DB');
      
      codeRequests.get(requestId).on((data) => {
        console.log('Received data from Gun:', data);
        if (data?.output) {
          console.log('Received output:', data.output);
          output = data.output;
        }
        if (data?.error) {
          console.log('Received error:', data.error);
          output = `Error: ${data.error}`;
        }
      });
    }
  </script>
  
  <main>
    <textarea bind:value={code}></textarea>
    <button on:click={executeCode}>Execute</button>
    <pre>{output}</pre>
  </main>
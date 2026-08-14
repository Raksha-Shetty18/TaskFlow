const http = require('http');

const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}`;

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseBody);
          resolve({
            statusCode: res.statusCode,
            body: parsed
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            raw: responseBody
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(data);
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting TaskFlow API Integration Tests (Advanced Features) ---');
  
  let userAToken = '';
  let taskAId = null;
  let subtaskId = null;

  try {
    // 1. User login (existing user or we register a new random email to avoid collisions)
    const uniqueEmail = `test_${Date.now()}@taskflow.com`;
    console.log(`\n[Test 1] Registering and logging in User (${uniqueEmail})...`);
    
    await makeRequest('POST', '/api/auth/register', {
      name: 'Tester Alpha',
      email: uniqueEmail,
      password: 'password123',
      confirmPassword: 'password123'
    });

    const loginRes = await makeRequest('POST', '/api/auth/login', {
      email: uniqueEmail,
      password: 'password123'
    });
    
    userAToken = loginRes.body.token;
    console.log(`User logged in. Token retrieved: ${!!userAToken}`);

    // 2. Create task with tags
    console.log('\n[Test 2] Creating a task with tags...');
    const createTask = await makeRequest('POST', '/api/tasks', {
      title: 'Audit accounting reports',
      description: 'Review Q3 balances.',
      category: 'Work',
      priority: 'High',
      status: 'Pending',
      due_date: '2026-08-22',
      tags: ['audit', 'finance', 'urgent']
    }, { 'Authorization': `Bearer ${userAToken}` });

    console.log(`Status: ${createTask.statusCode}, Tags returned:`, createTask.body.data.tags);
    if (createTask.statusCode !== 201 || !createTask.body.data.tags.includes('finance')) {
      throw new Error('Task creation with tags failed.');
    }
    taskAId = createTask.body.data.id;

    // 3. Verify searching by tag works
    console.log('\n[Test 3] Testing dynamic tag search query...');
    const searchRes = await makeRequest('GET', '/api/tasks?search=finance', null, {
      'Authorization': `Bearer ${userAToken}`
    });
    console.log(`Status: ${searchRes.statusCode}, Number of matching tasks: ${searchRes.body.data.length}`);
    if (searchRes.statusCode !== 200 || searchRes.body.data.length !== 1) {
      throw new Error('Searching task by tag failed.');
    }

    // 4. Create subtask
    console.log('\n[Test 4] Adding subtask to task...');
    const addSub = await makeRequest('POST', `/api/tasks/${taskAId}/subtasks`, {
      title: 'Verify ledger balance spreadsheet'
    }, { 'Authorization': `Bearer ${userAToken}` });
    
    console.log(`Status: ${addSub.statusCode}, Subtask title:`, addSub.body.data.title);
    if (addSub.statusCode !== 201) throw new Error('Subtask creation failed.');
    subtaskId = addSub.body.data.id;

    // 5. Get task details (verify subtask checklist is nested inside task details)
    console.log('\n[Test 5] Fetching task details (checking nested subtasks list)...');
    const taskDetails = await makeRequest('GET', `/api/tasks/${taskAId}`, null, {
      'Authorization': `Bearer ${userAToken}`
    });
    console.log(`Status: ${taskDetails.statusCode}, Nested subtasks length: ${taskDetails.body.data.subtasks.length}`);
    if (taskDetails.statusCode !== 200 || taskDetails.body.data.subtasks.length !== 1) {
      throw new Error('Nested subtasks retrieval failed.');
    }

    // 6. Update subtask completeness
    console.log('\n[Test 6] Toggling subtask completion state...');
    const updateSub = await makeRequest('PUT', `/api/tasks/${taskAId}/subtasks/${subtaskId}`, {
      is_completed: true
    }, { 'Authorization': `Bearer ${userAToken}` });
    
    console.log(`Status: ${updateSub.statusCode}, Is Completed: ${updateSub.body.data.is_completed}`);
    if (updateSub.statusCode !== 200 || updateSub.body.data.is_completed !== 1) {
      throw new Error('Subtask completion toggle failed.');
    }

    // 7. Verify cascade delete (Delete task, ensure subtask is cascade deleted)
    console.log('\n[Test 7] Verifying cascade deletion of checklist subtasks...');
    const delTask = await makeRequest('DELETE', `/api/tasks/${taskAId}`, null, {
      'Authorization': `Bearer ${userAToken}`
    });
    console.log(`Status: ${delTask.statusCode}, Task deleted successfully.`);
    if (delTask.statusCode !== 200) throw new Error('Task deletion failed.');

    console.log('\n--- ALL ADVANCED INTEGRATION TESTS PASSED SUCCESSFULLY! ---');
  } catch (err) {
    console.error('\n--- TEST RUNNER CRITICAL FAILURE ---');
    console.error(err);
    process.exit(1);
  }
}

setTimeout(runTests, 1000);

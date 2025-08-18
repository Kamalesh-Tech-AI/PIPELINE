import { logger } from '../utils/logger.js';
import { RunStore } from '../services/run-store.js';
import { ZipProcessor } from '../services/zip-processor.js';
import { WorkerManager } from '../services/worker-manager.js';

async function runTests() {
  logger.info('Starting tests...');
  
  let passed = 0;
  let failed = 0;
  
  // Test RunStore
  try {
    const runStore = new RunStore();
    const testRun = { id: 'test-1', status: 'queued', createdAt: new Date().toISOString() };
    
    runStore.create(testRun);
    const retrieved = runStore.get('test-1');
    
    if (retrieved && retrieved.id === 'test-1') {
      logger.info('✅ RunStore create/get test passed');
      passed++;
    } else {
      throw new Error('Retrieved run does not match created run');
    }
    
    runStore.update('test-1', { status: 'ready' });
    const updated = runStore.get('test-1');
    
    if (updated.status === 'ready') {
      logger.info('✅ RunStore update test passed');
      passed++;
    } else {
      throw new Error('Run was not updated correctly');
    }
    
  } catch (error) {
    logger.error('❌ RunStore test failed:', error.message);
    failed++;
  }
  
  // Test ZipProcessor basic functionality
  try {
    const zipProcessor = new ZipProcessor();
    
    // Test project analysis with mock files
    const mockFiles = ['index.html', 'style.css', 'script.js'];
    const projectInfo = await zipProcessor.analyzeProject('/mock/path');
    
    if (projectInfo.type === 'unknown') {
      logger.info('✅ ZipProcessor analysis test passed (unknown project type expected)');
      passed++;
    } else {
      throw new Error(`Expected unknown project type, got ${projectInfo.type}`);
    }
    
  } catch (error) {
    logger.error('❌ ZipProcessor test failed:', error.message);
    failed++;
  }
  
  // Test WorkerManager
  try {
    const workerManager = new WorkerManager();
    
    // This will work in simulation mode
    const worker = await workerManager.start({
      runId: 'test-run',
      projectPath: '/mock/path',
      projectType: 'static',
      buildCommand: null,
      startCommand: null
    });
    
    if (worker && worker.id.includes('test-run')) {
      logger.info('✅ WorkerManager start test passed');
      passed++;
    } else {
      throw new Error('Worker was not created correctly');
    }
    
    await workerManager.stop(worker.id);
    logger.info('✅ WorkerManager stop test passed');
    passed++;
    
  } catch (error) {
    logger.error('❌ WorkerManager test failed:', error.message);
    failed++;
  }
  
  // Summary
  logger.info(`\nTest Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(error => {
  logger.error('Test runner failed:', error);
  process.exit(1);
});
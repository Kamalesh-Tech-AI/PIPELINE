import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { WorkerManager } from '../services/worker-manager.js';
import { RunStore } from '../services/run-store.js';
import { ZipProcessor } from '../services/zip-processor.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

const router = Router();
const runStore = new RunStore();
const workerManager = new WorkerManager();
const zipProcessor = new ZipProcessor();

// Configure multer for file uploads
const upload = multer({
  dest: config.upload.tempDir,
  limits: {
    fileSize: config.upload.maxSize,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/zip' && !file.originalname.endsWith('.zip')) {
      return cb(new Error('Only ZIP files are allowed'));
    }
    cb(null, true);
  }
});

// POST /api/runs - Create new run from ZIP upload
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No ZIP file provided' });
    }

    const runId = uuidv4();
    const run = {
      id: runId,
      status: 'queued',
      createdAt: new Date().toISOString(),
      filePath: req.file.path,
      originalName: req.file.originalname,
      fileSize: req.file.size
    };

    // Store run metadata
    runStore.create(run);
    
    logger.info(`Created run ${runId} from file ${req.file.originalname}`);

    // Process asynchronously
    processRun(run).catch(error => {
      logger.error(`Failed to process run ${runId}:`, error);
      runStore.update(runId, { status: 'failed', error: error.message });
    });

    res.status(201).json({
      id: runId,
      status: 'queued',
      createdAt: run.createdAt
    });

  } catch (error) {
    logger.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// GET /api/runs/:id - Get run status
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const run = runStore.get(id);
  
  if (!run) {
    return res.status(404).json({ error: 'Run not found' });
  }

  // Don't expose internal file paths
  const { filePath, ...publicRun } = run;
  res.json(publicRun);
});

// DELETE /api/runs/:id - Cancel/delete run
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const run = runStore.get(id);
  
  if (!run) {
    return res.status(404).json({ error: 'Run not found' });
  }

  // Cancel worker if running
  if (run.workerId) {
    workerManager.stop(run.workerId);
  }

  // Cleanup
  runStore.delete(id);
  zipProcessor.cleanup(id);
  
  logger.info(`Deleted run ${id}`);
  res.json({ message: 'Run deleted' });
});

async function processRun(run) {
  try {
    // Update status to processing
    runStore.update(run.id, { status: 'extracting' });

    // Extract and analyze ZIP
    const projectInfo = await zipProcessor.extract(run.filePath, run.id);
    logger.info(`Extracted project for run ${run.id}:`, projectInfo);

    // Update with project info
    runStore.update(run.id, { 
      status: 'building',
      projectType: projectInfo.type,
      projectInfo
    });

    // Start worker
    const worker = await workerManager.start({
      runId: run.id,
      projectPath: projectInfo.extractPath,
      projectType: projectInfo.type,
      buildCommand: projectInfo.buildCommand,
      startCommand: projectInfo.startCommand
    });

    runStore.update(run.id, { 
      status: 'building',
      workerId: worker.id,
      workerPort: worker.port
    });

    // Wait for worker to be ready
    await worker.waitUntilReady();

    // Generate preview URL
    const previewUrl = `/preview/${run.id}`;
    
    runStore.update(run.id, { 
      status: 'ready',
      previewUrl,
      readyAt: new Date().toISOString()
    });

    logger.info(`Run ${run.id} is ready at ${previewUrl}`);

  } catch (error) {
    logger.error(`Processing failed for run ${run.id}:`, error);
    runStore.update(run.id, { 
      status: 'failed', 
      error: error.message,
      failedAt: new Date().toISOString()
    });
    throw error;
  }
}

export { router as runRouter };
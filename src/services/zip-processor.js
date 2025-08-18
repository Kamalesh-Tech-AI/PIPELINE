import AdmZip from 'adm-zip';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

export class ZipProcessor {
  constructor() {
    this.extractedProjects = new Map();
  }

  async extract(zipPath, runId) {
    const extractPath = path.join(config.upload.tempDir, `extracted-${runId}`);
    
    try {
      const zip = new AdmZip(zipPath);
      const entries = zip.getEntries();
      
      // Security check: validate file count
      if (entries.length > config.upload.maxFiles) {
        throw new Error(`ZIP contains too many files (${entries.length} > ${config.upload.maxFiles})`);
      }

      // Security check: validate file paths for zip bombs and path traversal
      for (const entry of entries) {
        if (entry.entryName.includes('..') || path.isAbsolute(entry.entryName)) {
          throw new Error(`Unsafe file path in ZIP: ${entry.entryName}`);
        }
        
        // Check for extremely deep nesting (potential zip bomb)
        const depth = entry.entryName.split('/').length;
        if (depth > 20) {
          throw new Error(`File path too deep: ${entry.entryName}`);
        }
      }

      // Extract files
      await fs.mkdir(extractPath, { recursive: true });
      zip.extractAllTo(extractPath, true);
      
      logger.info(`Extracted ${entries.length} files for run ${runId}`);

      // Analyze project structure
      const projectInfo = await this.analyzeProject(extractPath);
      projectInfo.extractPath = extractPath;
      
      this.extractedProjects.set(runId, projectInfo);
      
      return projectInfo;
      
    } catch (error) {
      // Cleanup on error
      try {
        await fs.rm(extractPath, { recursive: true, force: true });
      } catch (cleanupError) {
        logger.error(`Cleanup failed for ${extractPath}:`, cleanupError);
      }
      throw error;
    }
  }

  async analyzeProject(projectPath) {
    const files = await this.getFileList(projectPath);
    const rootFiles = files.filter(f => !f.includes('/'));
    
    logger.info(`Analyzing project with files:`, rootFiles);

    // Check for various project types
    if (rootFiles.includes('package.json')) {
      const packageInfo = await this.readPackageJson(path.join(projectPath, 'package.json'));
      return this.analyzeNodeProject(files, packageInfo);
    }
    
    if (rootFiles.includes('requirements.txt') || rootFiles.includes('Pipfile')) {
      return this.analyzePythonProject(files);
    }
    
    if (rootFiles.includes('Dockerfile')) {
      return { type: 'docker', files, buildCommand: 'docker build .', startCommand: 'docker run' };
    }
    
    if (files.some(f => f.endsWith('.html'))) {
      return this.analyzeStaticProject(files);
    }
    
    return { type: 'unknown', files, buildCommand: null, startCommand: null };
  }

  async readPackageJson(packagePath) {
    try {
      const content = await fs.readFile(packagePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      logger.warn(`Failed to read package.json:`, error);
      return {};
    }
  }

  analyzeNodeProject(files, packageInfo) {
    const { scripts = {}, dependencies = {}, devDependencies = {} } = packageInfo;
    
    // Detect framework
    if (dependencies.react || devDependencies.react) {
      return {
        type: 'react',
        framework: 'React',
        files,
        buildCommand: scripts.build ? 'npm run build' : null,
        startCommand: scripts.start || scripts.dev || 'npm start',
        dependencies: Object.keys(dependencies)
      };
    }
    
    if (dependencies.vue || devDependencies.vue) {
      return {
        type: 'vue',
        framework: 'Vue.js',
        files,
        buildCommand: scripts.build ? 'npm run build' : null,
        startCommand: scripts.serve || scripts.dev || 'npm run serve',
        dependencies: Object.keys(dependencies)
      };
    }
    
    if (dependencies['@angular/core'] || devDependencies['@angular/core']) {
      return {
        type: 'angular',
        framework: 'Angular',
        files,
        buildCommand: scripts.build ? 'npm run build' : null,
        startCommand: scripts.start || 'ng serve',
        dependencies: Object.keys(dependencies)
      };
    }
    
    if (dependencies.express || dependencies.fastify || dependencies.koa) {
      return {
        type: 'node',
        framework: 'Node.js Server',
        files,
        buildCommand: scripts.build || null,
        startCommand: scripts.start || 'node index.js',
        dependencies: Object.keys(dependencies)
      };
    }
    
    // Default Node.js project
    return {
      type: 'node',
      framework: 'Node.js',
      files,
      buildCommand: scripts.build || null,
      startCommand: scripts.start || scripts.dev || 'node index.js',
      dependencies: Object.keys(dependencies)
    };
  }

  analyzePythonProject(files) {
    // Check for common Python web frameworks
    if (files.some(f => f.includes('app.py') || f.includes('main.py'))) {
      return {
        type: 'python',
        framework: 'Python Web App',
        files,
        buildCommand: 'pip install -r requirements.txt',
        startCommand: 'python app.py'
      };
    }
    
    return {
      type: 'python',
      framework: 'Python',
      files,
      buildCommand: 'pip install -r requirements.txt',
      startCommand: 'python main.py'
    };
  }

  analyzeStaticProject(files) {
    const hasIndex = files.some(f => f.endsWith('index.html'));
    
    return {
      type: 'static',
      framework: 'Static HTML',
      files,
      buildCommand: null,
      startCommand: null,
      entryPoint: hasIndex ? 'index.html' : files.find(f => f.endsWith('.html'))
    };
  }

  async getFileList(dirPath, prefix = '') {
    const files = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      
      if (entry.isDirectory()) {
        // Skip common directories that shouldn't be analyzed
        if (!['node_modules', '.git', '__pycache__', '.pytest_cache'].includes(entry.name)) {
          const subFiles = await this.getFileList(fullPath, relativePath);
          files.push(...subFiles);
        }
      } else {
        files.push(relativePath);
      }
    }
    
    return files;
  }

  async cleanup(runId) {
    const projectInfo = this.extractedProjects.get(runId);
    if (projectInfo && projectInfo.extractPath) {
      try {
        await fs.rm(projectInfo.extractPath, { recursive: true, force: true });
        logger.info(`Cleaned up extracted files for run ${runId}`);
      } catch (error) {
        logger.error(`Failed to cleanup run ${runId}:`, error);
      }
    }
    
    this.extractedProjects.delete(runId);
  }
}
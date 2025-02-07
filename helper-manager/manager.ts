import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export class UraiHelper {
	baseUrl: string;

	constructor(port: number) {
		this.baseUrl = `http://localhost:${port}`;
	}
}

interface LockFile {
    pid: number;
    port: number;
}

export function startUraiHelper(pluginBaseDir: string): Promise<UraiHelper> {
    const lockFilePath = path.join(pluginBaseDir, '.urai-helper.lock');

    return new Promise((resolve, reject) => {
        // Check if lock file exists
        if (fs.existsSync(lockFilePath)) {
            try {
                const lockData = JSON.parse(fs.readFileSync(lockFilePath, 'utf8')) as LockFile;
                
                // Check if process is still running
                try {
                    process.kill(lockData.pid, 0);
                    // Process is running, return existing helper
                    return resolve(new UraiHelper(lockData.port));
                } catch (e) {
                    // Process is not running, remove stale lock file
                    fs.unlinkSync(lockFilePath);
                }
            } catch (e) {
                fs.unlinkSync(lockFilePath);
            }
        }

        // Find and start helper binary
        const helperPath = path.join(pluginBaseDir, 'urai-helper');
		console.log('Starting helper at', helperPath);
        if (!fs.existsSync(helperPath)) {
            return reject(new Error('urai-helper binary not found'));
        }

        const helperProcess = child_process.spawn(helperPath, {
            stdio: ['ignore', 'pipe', 'pipe']
        });

        helperProcess.stdout.on('data', (data: Buffer) => {
            const output = data.toString();
            const match = output.match(/listening on (\d+)/i);
            
            if (match) {
                const port = parseInt(match[1], 10);
                
                // Create lock file
                const lockData: LockFile = {
                    pid: helperProcess.pid!,
                    port: port
                };
                
                fs.writeFileSync(lockFilePath, JSON.stringify(lockData));
                resolve(new UraiHelper(port));
            }
        });

        helperProcess.stderr.on('data', (data: Buffer) => {
            console.error('Helper error:', data.toString());
        });

        helperProcess.on('error', (err) => {
            reject(new Error(`Failed to start helper: ${err.message}`));
        });

        helperProcess.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`Helper exited with code ${code}`));
            }
        });

        // Set timeout for startup
        setTimeout(() => {
            // helperProcess.kill();
            // reject(new Error('Helper failed to start within timeout'));
        }, 10000);
    });
}
export function stopUraiHelper(pluginBaseDir: string): void {
	const lockFilePath = path.join(pluginBaseDir, '.urai-helper.lock');
	if (fs.existsSync(lockFilePath)) {
		const lockData = JSON.parse(fs.readFileSync(lockFilePath, 'utf8')) as LockFile;
		try {
			process.kill(lockData.pid, 'SIGTERM');
		} catch (e) {
			console.error('Failed to stop helper:', e);
		}
		fs.unlinkSync(lockFilePath);
	}
}

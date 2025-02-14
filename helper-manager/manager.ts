import * as child_process from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import { Editor } from 'obsidian';
import * as path from 'path';
import { ScribeSettings } from 'settings';

type ImproveTextResponse = {
	given_text: string;
	rewritten_text: string;
	changes_made: string[];
}
type ExecutionStatus<T> = {
	error?: string;
	output?: T;
}

export class UraiHelper {
	baseUrl: string;

	constructor(port: number) {
		this.baseUrl = `http://localhost:${port}/api`;
	}
	async executeWorkflow<T>(workflow: string, vars: any): Promise<ExecutionStatus<T>> {
		const url = `${this.baseUrl}/workflows/${workflow}/execute`;
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ vars: vars })
		});
		const data = await response.json();
		return data;
	}
	async improveText(editor: Editor): Promise<ImproveTextResponse> {
		const textToRewrite = editor.getSelection()
		const wholeDocument = editor.getValue()
		const workflow = 'improve_text';
		const result = await this.executeWorkflow<ImproveTextResponse>(
			workflow, { text_to_rewrite: textToRewrite, whole_document: wholeDocument }
		);
		if (result.error) {
			throw new Error(result.error);
		}
		return result.output!;
	}
	async registerPrompts(pluginBaseDir: string): Promise<any> {
		const promptsDir = path.join(pluginBaseDir, 'prompts');

		// Check if prompts directory exists
		if (!fs.existsSync(promptsDir)) {
			console.warn('Prompts directory not found:', promptsDir);
			return;
		}

		const results = [];
		const files = fs.readdirSync(promptsDir);

		for (const file of files) {
			if (file.endsWith('.handlebars')) {
				const filePath = path.join(promptsDir, file);
				const content = fs.readFileSync(filePath, 'utf8');
				const name = path.basename(file, '.handlebars');

				try {
					const response = await fetch(`${this.baseUrl}/prompts`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							name,
							prompt: content
						})
					});

					const result = await response.json();
					results.push({ file, result });
				} catch (error) {
					console.error(`Failed to register prompt ${file}:`, error);
					results.push({ file, error: error.message });
				}
			}
		}

		return results;
	}

	async registerWorkflows(pluginBaseDir: string): Promise<any> {
		const workflowsDir = path.join(pluginBaseDir, 'workflows');

		// Check if workflows directory exists
		if (!fs.existsSync(workflowsDir)) {
			console.warn('Workflows directory not found:', workflowsDir);
			return;
		}

		const results = [];
		const files = fs.readdirSync(workflowsDir);

		for (const file of files) {
			if (file.endsWith('.lua')) {
				const filePath = path.join(workflowsDir, file);
				const code = fs.readFileSync(filePath, 'utf8');
				const name = path.basename(file, '.lua');

				try {
					const response = await fetch(`${this.baseUrl}/workflows`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							name,
							workflow: code
						})
					});

					const result = await response.json();
					results.push({ file, result });
				} catch (error) {
					console.error(`Failed to register workflow ${file}:`, error);
					results.push({ file, error: error.message });
				}
			}
		}

		return results;
	}
}

interface LockFile {
	pid: number;
	port: number;
}

export function startUraiHelper(pluginBaseDir: string, settings: ScribeSettings): Promise<UraiHelper> {
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
		const originalHelperPath = path.join(pluginBaseDir, 'urai-helper');
		console.log('Original helper path:', originalHelperPath);
		if (!fs.existsSync(originalHelperPath)) {
			return reject(new Error('urai-helper binary not found'));
		}

		// Create temp directory with unique name
		const tmpDir = path.join(os.tmpdir(), `urai-helper-${Date.now()}`);
		fs.mkdirSync(tmpDir, { recursive: true });

		// Copy binary to temp directory
		const tempHelperPath = path.join(tmpDir, 'urai-helper');
		fs.copyFileSync(originalHelperPath, tempHelperPath);
		
		// Make the temp binary executable
		fs.chmodSync(tempHelperPath, '755');

		console.log('Starting helper at temp location:', tempHelperPath);
		
		const env = {
			...process.env,
			OPENAI_API_KEY: settings.openAIAPIKey || '',
			GEMINI_API_KEY: settings.geminiAPIKey || ''
		}
		console.log("launching with env", env)

		const helperProcess = child_process.spawn(tempHelperPath, {
			stdio: ['ignore', 'pipe', 'pipe'],
			env
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

				const helper = new UraiHelper(port);
				helper.registerPrompts(pluginBaseDir).then(console.log); // is async but we need not wait for it
				helper.registerWorkflows(pluginBaseDir).then(console.log); // is async but we need not wait for it
				resolve(helper);
			}
		});

		helperProcess.stderr.on('data', (data: Buffer) => {
			console.error('Helper error:', data.toString());
		});

		helperProcess.on('error', (err) => {
			reject(new Error(`Failed to start helper: ${err.message}`));
		});

		helperProcess.on('exit', (code) => {
			// Clean up temp directory
			try {
				fs.rmSync(tmpDir, { recursive: true, force: true });
			} catch (error) {
				console.error('Failed to clean up temp directory:', error);
			}
			
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

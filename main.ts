import * as child_process  from 'child_process';
import * as path from 'path';
import { startUraiHelper, stopUraiHelper, UraiHelper, setupUraiHelper } from 'helper-manager/manager';
import { App, Editor, EditorSelection, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import {EditorView} from '@codemirror/view'
import { ScribeSettings } from 'settings';



const DEFAULT_SETTINGS: ScribeSettings = {
	openAIAPIKey: '',
	geminiAPIKey: '',
	port: 8741
}

export default class ScribePlugin extends Plugin {
	settings: ScribeSettings;
	uraiHelper: UraiHelper;
	vaultBaseDir: string;
	pluginBaseDir: string;

	onunload() {
		// console.log('unloading Urai Scribe');
		// stopUraiHelper(this.pluginBaseDir);
	}

	async onload() {
		console.log(this.manifest);
		await this.loadSettings();
		this.vaultBaseDir = this.app.vault.adapter['basePath'];
		this.pluginBaseDir = path.join(this.vaultBaseDir, this.manifest.dir!); 
		// this.uraiHelper =  await startUraiHelper(this.pluginBaseDir, this.settings)
		this.uraiHelper = setupUraiHelper(this.pluginBaseDir, this.settings.port)
		
		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('feather', 'Urai Scribe', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('Chat with Urai coming soon.');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Urai Assistant Online');

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'Improve Text',
			name: 'Improve the given text',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const editorView = view.editor.cm as EditorView;
				const startPosition = editorView.state.selection.main.from;
				this.uraiHelper.improveText(editor).then((output) => {
					console.log(output)
					const tx = editorView.state.update({ 
						changes: { 
							from: startPosition, 
							insert: "\n" + output.rewritten_text + "\n" 
						}
					});
					editorView.dispatch(tx);
					// editor.transaction({
					// 	changes: [{
					// 		from: startPosition,
					// 		text: "\n" + output.rewritten_text + "\n",
					// 	}]
					// })
					
					// editor.replaceSelection(output.rewritten_text)
				})
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));


		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}


class SampleSettingTab extends PluginSettingTab {
	plugin: ScribePlugin;

	constructor(app: App, plugin: ScribePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('OpenAI API Key')
			.setDesc('You can get your key from https://platform.openai.com/')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.openAIAPIKey)
				.onChange(async (value) => {
					this.plugin.settings.openAIAPIKey= value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Gemini API Key')
			.setDesc('You can get your key from https://aistudio.google.com/')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.geminiAPIKey)
				.onChange(async (value) => {
					this.plugin.settings.geminiAPIKey= value;
					await this.plugin.saveSettings();
				}));
	}
}

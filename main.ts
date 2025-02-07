import * as child_process  from 'child_process';
import * as path from 'path';
import { startUraiHelper, stopUraiHelper, UraiHelper } from 'helper-manager/manager';
import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

// Remember to rename these classes and interfaces!

interface ScribeSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: ScribeSettings = {
	mySetting: 'default'
}

export default class ScribePlugin extends Plugin {
	settings: ScribeSettings;
	uraiHelper: UraiHelper;
	vaultBaseDir: string;
	pluginBaseDir: string;

	onunload() {
		console.log('unloading Urai Scribe');
		stopUraiHelper(this.pluginBaseDir);
	}

	async onload() {
		console.log(this.manifest);
		await this.loadSettings();
		this.vaultBaseDir = this.app.vault.adapter['basePath'];
		this.pluginBaseDir = path.join(this.vaultBaseDir, this.manifest.dir!); 
		this.uraiHelper =  await startUraiHelper(this.pluginBaseDir)
		
		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('feather', 'Sample Plugin', (evt: MouseEvent) => {
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
				const selectedText = editor.getSelection();
				editor.replaceSelection(selectedText + '\n Yay. I have been improved')
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
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}

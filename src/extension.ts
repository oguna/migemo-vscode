import * as vscode from 'vscode';
import * as jsmigemo from 'jsmigemo';
import { readFile } from 'fs/promises';
import { promisify } from 'util'
import { gunzip } from 'zlib';

// this method is called when vs code is activated
export function activate(context: vscode.ExtensionContext) {
	const migemo = new jsmigemo.Migemo()
	const regexSrc = {query: '', regex: new RegExp("", "g")}
	const do_gunzip = promisify(gunzip)
	readFile(context.asAbsolutePath('resources/migemo-compact-dict.gz'))
	.then(e => do_gunzip(e))
	.then(e => {
		const dict = new jsmigemo.CompactDictionary(e.buffer)
		migemo.setDict(dict)
	})

	let timeout: NodeJS.Timer | undefined = undefined;

	// create a decorator type that we use to decorate large numbers
	const largeNumberDecorationType = vscode.window.createTextEditorDecorationType({
		cursor: 'crosshair',
		// use a themable color. See package.json for the declaration and default values.
		backgroundColor: { id: 'migemovscode.highlight' }
	});

	let activeEditor = vscode.window.activeTextEditor;

	function updateDecorations() {
		if (!activeEditor) {
			return;
		}
		const regEx = regexSrc.regex
		if (regexSrc.query === '') {
			activeEditor.setDecorations(largeNumberDecorationType, []);
			return
		}
		const text = activeEditor.document.getText();
		const largeNumbers: vscode.DecorationOptions[] = [];
		let match;
		let count = 0
		while ((match = regEx.exec(text))) {
			const startPos = activeEditor.document.positionAt(match.index);
			const endPos = activeEditor.document.positionAt(match.index + match[0].length);
			const decoration = { range: new vscode.Range(startPos, endPos), hoverMessage: 'Migemo :' + regexSrc.query };
			largeNumbers.push(decoration);
			count++
		}
		activeEditor.setDecorations(largeNumberDecorationType, largeNumbers);
	}

	function triggerUpdateDecorations(throttle = false) {
		if (timeout) {
			clearTimeout(timeout);
			timeout = undefined;
		}
		if (throttle) {
			timeout = setTimeout(updateDecorations, 500);
		} else {
			updateDecorations();
		}
	}

	if (activeEditor) {
		triggerUpdateDecorations();
	}

	vscode.window.onDidChangeActiveTextEditor(editor => {
		activeEditor = editor;
		if (editor) {
			triggerUpdateDecorations();
		}
	}, null, context.subscriptions);

	vscode.workspace.onDidChangeTextDocument(event => {
		if (activeEditor && event.document === activeEditor.document) {
			triggerUpdateDecorations(true);
		}
	}, null, context.subscriptions);

	context.subscriptions.push(vscode.commands.registerCommand('migemo-vscode.search', async() => {
		const clearButton = {
			iconPath: vscode.Uri.file(context.asAbsolutePath('resources/close.svg')),
			tooltip: "ハイライトを取り消す"
		} as vscode.QuickInputButton
		const findInFilesButton = {
			iconPath: vscode.Uri.file(context.asAbsolutePath('resources/layout-sidebar.svg')),
			tooltip: "'Find In Files'で開く"
		} as vscode.QuickInputButton
		const openNewEditorToSideButton = {
			iconPath: vscode.Uri.file(context.asAbsolutePath('resources/layout-sidebar-rever.svg')),
			tooltip: "検索結果をサイドに開く"
		} as vscode.QuickInputButton
		const inputBox = vscode.window.createInputBox()
		inputBox.title = "Migemo Search"
		inputBox.placeholder = "Query"
		inputBox.value = regexSrc.query
		inputBox.prompt = undefined
		inputBox.buttons = [clearButton, findInFilesButton, openNewEditorToSideButton, vscode.QuickInputButtons.Back]
		inputBox.onDidChangeValue(e => {
			const result = inputBox.value
			regexSrc.query = result
			regexSrc.regex = new RegExp(migemo.query(result), 'g')
			triggerUpdateDecorations()
		})
		inputBox.onDidTriggerButton(e => {
			if (e ===  clearButton) {
				regexSrc.query = ''
				regexSrc.regex = new RegExp('', 'g')
				triggerUpdateDecorations()
			} else if (e === findInFilesButton) {
				vscode.commands.executeCommand("workbench.action.findInFiles", {
    				query: regexSrc.regex.source,
    				filesToInclude: "",
    				filesToExclude: "",
					isRegex: true,
					isCaseSensitive: false,
					matchWholeWord: false,
					triggerSearch: true,
  				});
			} else if (e === openNewEditorToSideButton) {
				vscode.commands.executeCommand("search.action.openNewEditorToSide", {
					query: regexSrc.regex.source,
    				include: "",
    				exclude: "",
					regexp: true,
					caseSensitive: false,
					wholeWord: false,
				})
			}
			inputBox.hide()
		})
		inputBox.onDidAccept(e => {
			inputBox.hide()
			const result = inputBox.value
			regexSrc.query = result
			regexSrc.regex = new RegExp(migemo.query(result), 'g')
			updateDecorations()
		})
		inputBox.onDidHide(e => {
			inputBox.dispose()
		})
		inputBox.show()
	}))
}
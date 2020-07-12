/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------*/

'use strict';

import vscode = require('vscode');
import { CancellationToken, Hover, HoverProvider, Position, TextDocument, WorkspaceConfiguration } from 'vscode';
import { definitionLocation } from './goDeclaration';
import { getGoPlusConfig } from './util';

export class GoHoverProvider implements HoverProvider {
	private goPlusConfig: WorkspaceConfiguration | undefined;

	constructor(goPlusConfig?: WorkspaceConfiguration) {
		this.goPlusConfig = goPlusConfig;
	}
	
	public provideHover(document: TextDocument, position: Position, token: CancellationToken): Thenable<Hover> {
		if (!this.goPlusConfig) {
			this.goPlusConfig = getGoPlusConfig(document.uri);
		}
		let goPlusConfig = this.goPlusConfig;

		// Temporary fix to fall back to godoc if guru is the set docsTool
		if (goPlusConfig['docsTool'] === 'guru') {
			goPlusConfig = Object.assign({}, goPlusConfig, { docsTool: 'godoc' });
		}
		return definitionLocation(document, position, goPlusConfig, true, token).then(
			(definitionInfo) => {
				if (definitionInfo == null) {
					return null;
				}
				const lines = definitionInfo.declarationlines
					.filter((line) => line !== '')
					.map((line) => line.replace(/\t/g, '    '));
				let text;
				text = lines.join('\n').replace(/\n+$/, '');
				const hoverTexts = new vscode.MarkdownString();
				hoverTexts.appendCodeblock(text, 'go');
				if (definitionInfo.doc != null) {
					hoverTexts.appendMarkdown(definitionInfo.doc);
				}
				const hover = new Hover(hoverTexts);
				return hover;
			},
			() => {
				return null;
			}
		);
	}
}

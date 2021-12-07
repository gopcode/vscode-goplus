/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------*/

'use strict';

import vscode = require('vscode');

export const GOP_MODE: vscode.DocumentFilter = { language: 'gop', scheme: 'file' };
export const SPX_MODE: vscode.DocumentFilter = { language: 'spx', scheme: 'file' };
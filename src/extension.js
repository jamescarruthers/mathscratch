const vscode = require('vscode');
const { create, all } = require('mathjs');

// Initialize mathjs with BigNumber configuration for precision
const math = create(all, {
    number: 'BigNumber',
    precision: 14,
    angleUnit: 'rad',
});

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    // Create a decoration type for the results (grey text, right margin)
    const decorationType = vscode.window.createTextEditorDecorationType({
        after: {
            margin: '0 0 0 3ch', // 3 character width margin
            color: new vscode.ThemeColor('editorCodeLens.foreground'), // Subtle grey
        },
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    });

    // Function to calculate and update decorations for the active editor
    const updateDecorations = (editor) => {
        if (!editor) return;
        const doc = editor.document;
        const decorations = [];

        // --- Configuration ---
        const config = vscode.workspace.getConfiguration('mathScratchpad');
        const showResults = config.get('showResults', true);

        if (!showResults) {
            editor.setDecorations(decorationType, []);
            return;
        }

        const alignColumn = config.get('alignColumn', 80);
        const minPadding = config.get('padding', 10);

        // --- Pass 1: Calculate results and find max lengths ---
        const lineResults = [];
        let docMaxLineLength = 0;
        let maxValueLength = 0;

        const scope = {}; // Reset scope for the full document pass

        for (let i = 0; i < doc.lineCount; i++) {
            docMaxLineLength = Math.max(docMaxLineLength, doc.lineAt(i).text.length);
            const line = doc.lineAt(i);
            const text = line.text.trim();

            if (!text || text.startsWith('//') || text.startsWith('#')) {
                lineResults.push(null); // Keep array index aligned with line number
                continue;
            }

            try {
                const expr = text.endsWith('=') ? text.slice(0, -1) : text;
                const result = math.evaluate(expr, scope);

                if (result !== undefined && typeof result !== 'function') {
                    let resultText = math.format(result, { precision: 14 });

                    // Custom formatting for binary strings: remove quotes/0b, space nibbles
                    const binaryMatch = resultText.match(/^"?0b([01]+)"?$/);
                    if (binaryMatch) {
                        resultText = binaryMatch[1].replace(/\B(?=(\d{4})+(?!\d))/g, " ");
                    }

                    // Custom formatting for hex strings: remove quotes/0x, uppercase, space every 2 chars
                    const hexMatch = resultText.match(/^"?0x([0-9a-fA-F]+)"?$/);
                    if (hexMatch) {
                        resultText = hexMatch[1].toUpperCase().replace(/\B(?=([0-9A-F]{2})+(?![0-9A-F]))/g, " ");
                    }

                    // Custom formatting for octal strings: remove quotes/0o, space every 3 chars
                    const octalMatch = resultText.match(/^"?0o([0-7]+)"?$/);
                    if (octalMatch) {
                        resultText = octalMatch[1].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
                    }

                    // Split value and unit for alignment
                    // Looks for a space followed by a letter (standard mathjs unit format)
                    const unitMatch = resultText.match(/^(.*?)(\s+[a-zA-Z].*)?$/);
                    const valuePart = unitMatch ? unitMatch[1] : resultText;
                    const unitPart = (unitMatch && unitMatch[2]) ? unitMatch[2] : "";

                    maxValueLength = Math.max(maxValueLength, valuePart.length);
                    lineResults.push({ line, valuePart, unitPart });
                } else {
                    lineResults.push(null);
                }
            } catch (e) {
                lineResults.push(null);
            }
        }

        // --- Calculate alignment ---
        const targetColumn = Math.max(alignColumn, docMaxLineLength + minPadding);

        // --- Pass 2: Create decorations with padding ---
        for (const lineResult of lineResults) {
            if (!lineResult) continue;

            const { line, valuePart, unitPart } = lineResult;

            // Right-align the value part, then append the unit
            const paddedResultText = valuePart.padStart(maxValueLength, '\u00A0') + unitPart;

            // Calculate margin to reach the target column
            const padding = targetColumn - line.text.length;

            if (padding < 0) continue; // Don't decorate if line is too long

            decorations.push({
                range: line.range,
                renderOptions: {
                    after: {
                        contentText: paddedResultText,
                        margin: `0 0 0 ${padding}ch`,
                    },
                },
            });
        }
        editor.setDecorations(decorationType, decorations);
    };

    // Register a CompletionItemProvider for all languages ('*')
    const provider = vscode.languages.registerCompletionItemProvider(
        '*',
        {
            provideCompletionItems(document, position) {
                // 1. Get the text of the current line up to the cursor
                const linePrefix = document.lineAt(position).text.substr(0, position.character);

                // 2. Check if the line ends with "="
                // We trim whitespace from the end to allow "1+1 = " or "1+1="
                if (!linePrefix.trimEnd().endsWith('=')) {
                    return undefined;
                }

                // 3. Extract the expression (remove the trailing '=')
                const expression = linePrefix.substring(0, linePrefix.lastIndexOf('=')).trim();

                // 4. Build the scope (variables) from previous lines
                const scope = parseDocumentVariables(document, position.line);

                try {
                    // 5. Evaluate the expression
                    const result = math.evaluate(expression, scope);

                    // Filter out functions or undefined results to avoid noise
                    if (typeof result === 'function' || result === undefined) {
                        return undefined;
                    }

                    // Format the result
                    // We add a leading space for better readability when inserted
                    const resultText = " " + math.format(result, { precision: 14 });

                    // 6. Create the Completion Item
                    const item = new vscode.CompletionItem(resultText, vscode.CompletionItemKind.Value);
                    item.detail = "Math Result";
                    item.documentation = `Evaluates to: ${resultText}`;
                    item.insertText = resultText; // What gets typed when you hit Tab

                    return [item];

                } catch (err) {
                    // If mathjs fails (syntax error, etc), return no suggestions silently
                    return undefined;
                }
            }
        },
        '=' // Trigger character: The provider activates when user types '='
    );

    // Update decorations when the document changes
    vscode.workspace.onDidChangeTextDocument(event => {
        if (vscode.window.activeTextEditor && event.document === vscode.window.activeTextEditor.document) {
            updateDecorations(vscode.window.activeTextEditor);
        }
    }, null, context.subscriptions);

    // Update decorations when the active editor changes
    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) updateDecorations(editor);
    }, null, context.subscriptions);

    // Update decorations when configuration changes
    vscode.workspace.onDidChangeConfiguration(event => {
        if ((event.affectsConfiguration('mathScratchpad.alignColumn') ||
             event.affectsConfiguration('mathScratchpad.padding') ||
             event.affectsConfiguration('mathScratchpad.showResults'))
            && vscode.window.activeTextEditor) {
            updateDecorations(vscode.window.activeTextEditor);
        }
    }, null, context.subscriptions);

    // Initial update if an editor is open
    if (vscode.window.activeTextEditor) {
        updateDecorations(vscode.window.activeTextEditor);
    }

    context.subscriptions.push(provider);
}

/**
 * Scans the document from line 0 up to the current line to find variable assignments.
 * Looks for patterns like "A = 10" or "radius = 5.5".
 */
function parseDocumentVariables(document, currentLineIndex) {
    const scope = {};

    // Regex to capture "Variable = Value"
    // Group 1: Variable Name (starts with letter, alphanumeric/underscore)
    // Group 2: Value (rest of the line)
    // We use a negative lookahead (?!=) to ensure we don't match "==" comparisons
    const assignmentRegex = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=(?!=)\s*(.*)$/;

    for (let i = 0; i < currentLineIndex; i++) {
        const lineText = document.lineAt(i).text;

        // Skip empty lines or comments
        if (!lineText.trim() || lineText.trim().startsWith('//') || lineText.trim().startsWith('#')) {
            continue;
        }

        const match = lineText.match(assignmentRegex);
        if (match) {
            const varName = match[1];
            const varValueExpr = match[2];

            try {
                // Evaluate the value in the current scope context
                // This allows chaining: A=10, B=A+5
                const val = math.evaluate(varValueExpr, scope);
                scope[varName] = val;
            } catch (e) {
                // Ignore invalid assignments (e.g. partial code)
            }
        }
    }
    return scope;
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};

# Math Scratchpad

A VS Code extension that transforms any file into a real-time mathematical scratchpad with inline results and auto-completion.

## Features

- **Real-time evaluation**: See calculation results inline as you type
- **Auto-completion**: Type an expression followed by `=` and get the result as a completion suggestion
- **Variable support**: Define variables and use them in subsequent calculations
- **Unit support**: Works with physical units (meters, seconds, etc.)
- **Number base formatting**: Clean formatting for binary, hexadecimal, and octal numbers
- **Configurable alignment**: Results align neatly to the right of your expressions

## Usage

Simply type mathematical expressions in any file:

```
10 + 20                           30
radius = 5                         5
area = pi * radius^2              78.53981633974
sqrt(144)                         12
sin(pi/2)                          1
```

For auto-completion, type an expression followed by `=` and press Tab to insert the result:

```
25 * 4 = 100
```

## Supported Operations

- Basic arithmetic: `+`, `-`, `*`, `/`, `^`
- Functions: `sqrt`, `sin`, `cos`, `tan`, `log`, `exp`, etc.
- Constants: `pi`, `e`, `i`
- Units: `5 meters + 3 feet`, `100 km/h to mph`
- Number bases: `0b1010`, `0xFF`, `0o77`
- Variables: `x = 10`, then use `x` in later expressions

## Extension Settings

This extension contributes the following settings:

- `mathScratchpad.showResults`: Enable/disable inline results (default: `true`)
- `mathScratchpad.alignColumn`: Minimum column for result alignment (default: `80`)
- `mathScratchpad.padding`: Minimum padding between expressions and results (default: `10`)

## Development

### Prerequisites

- Node.js 16+
- VS Code 1.80+

### Setup

```bash
# Install dependencies
npm install

# Run the extension in development mode
# Press F5 in VS Code to launch Extension Development Host
```

### Packaging

```bash
# Install vsce if not already installed
npm install -g @vscode/vsce

# Package the extension
npm run package
```

## License

MIT

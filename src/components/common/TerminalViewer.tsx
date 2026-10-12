export default function TerminalViewer({lines}:{lines:string[]}){return <pre className="terminal-viewer" aria-label="Analysis log">{lines.join('\n')}</pre>}

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { failed: boolean; }

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State { return { failed: true }; }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('MAST interface error:', error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return <main className="runtime-error" role="alert"><h1>MAST hit an unexpected error</h1><p>Refresh the page to continue. If the issue persists, contact your workspace administrator.</p><button className="button secondary" onClick={() => window.location.reload()}>Refresh page</button></main>;
    }
    return this.props.children;
  }
}
